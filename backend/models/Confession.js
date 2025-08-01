const mongoose = require('mongoose');

const confessionSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true,
        maxlength: [100, '标题不能超过100个字符']
    },
    content: {
        type: String,
        required: [true, '告解内容不能为空'],
        trim: true,
        minlength: [10, '告解内容至少10个字符'],
        maxlength: [2000, '告解内容不能超过2000个字符']
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // 支持匿名告解
    },
    isAnonymous: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ['personal', 'work', 'relationship', 'family', 'moral', 'other'],
        default: 'other'
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: [20, '标签不能超过20个字符']
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'hidden'],
        default: 'approved'
    },
    votes: {
        heaven: {
            type: Number,
            default: 0,
            min: 0
        },
        hell: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    commentsCount: {
        type: Number,
        default: 0,
        min: 0
    },
    viewsCount: {
        type: Number,
        default: 0,
        min: 0
    },
    sharesCount: {
        type: Number,
        default: 0,
        min: 0
    },
    metadata: {
        ipAddress: {
            type: String,
            select: false // 管理员可见
        },
        userAgent: {
            type: String,
            select: false
        },
        location: {
            country: String,
            city: String
        }
    },
    moderation: {
        isReported: {
            type: Boolean,
            default: false
        },
        reportCount: {
            type: Number,
            default: 0
        },
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        moderatedAt: Date,
        moderationReason: String
    },
    featured: {
        type: Boolean,
        default: false
    },
    featuredAt: Date,
    expiresAt: {
        type: Date,
        default: null // 可设置告解过期时间
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 虚拟字段：总投票数
confessionSchema.virtual('totalVotes').get(function() {
    return this.votes.heaven + this.votes.hell;
});

// 虚拟字段：天堂投票比例
confessionSchema.virtual('heavenPercentage').get(function() {
    const total = this.totalVotes;
    return total > 0 ? Math.round((this.votes.heaven / total) * 100) : 0;
});

// 虚拟字段：地狱投票比例
confessionSchema.virtual('hellPercentage').get(function() {
    const total = this.totalVotes;
    return total > 0 ? Math.round((this.votes.hell / total) * 100) : 0;
});

// 虚拟字段：热度分数（基于投票、评论、浏览量）
confessionSchema.virtual('hotScore').get(function() {
    const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    const score = (this.totalVotes * 2 + this.commentsCount * 3 + this.viewsCount * 0.1) / Math.pow(ageInHours + 2, 1.5);
    return Math.round(score * 100) / 100;
});

// 虚拟字段：是否已过期
confessionSchema.virtual('isExpired').get(function() {
    return this.expiresAt && this.expiresAt < new Date();
});

// 索引
confessionSchema.index({ createdAt: -1 }); // 按时间排序
confessionSchema.index({ status: 1, createdAt: -1 }); // 状态和时间
confessionSchema.index({ author: 1, createdAt: -1 }); // 作者的告解
confessionSchema.index({ category: 1, createdAt: -1 }); // 分类
confessionSchema.index({ tags: 1 }); // 标签搜索
confessionSchema.index({ featured: 1, createdAt: -1 }); // 精选告解
confessionSchema.index({ 'votes.heaven': -1, 'votes.hell': -1 }); // 投票排序
confessionSchema.index({ viewsCount: -1 }); // 热门排序
confessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL索引

// 文本搜索索引
confessionSchema.index({
    title: 'text',
    content: 'text',
    tags: 'text'
}, {
    weights: {
        title: 10,
        content: 5,
        tags: 3
    }
});

// 中间件：保存前验证
confessionSchema.pre('save', function(next) {
    // 清理标签
    if (this.tags && this.tags.length > 0) {
        this.tags = this.tags
            .filter(tag => tag && tag.trim())
            .map(tag => tag.trim().toLowerCase())
            .slice(0, 5); // 最多5个标签
    }
    
    // 设置默认过期时间（30天）
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    next();
});

// 中间件：删除时清理相关数据
confessionSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    try {
        const Vote = mongoose.model('Vote');
        const Comment = mongoose.model('Comment');
        
        // 删除相关投票和评论
        await Promise.all([
            Vote.deleteMany({ confession: this._id }),
            Comment.deleteMany({ confession: this._id })
        ]);
        
        next();
    } catch (error) {
        next(error);
    }
});

// 实例方法：增加浏览量
confessionSchema.methods.incrementViews = function() {
    return this.updateOne({ $inc: { viewsCount: 1 } });
};

// 实例方法：增加分享量
confessionSchema.methods.incrementShares = function() {
    return this.updateOne({ $inc: { sharesCount: 1 } });
};

// 实例方法：更新投票数
confessionSchema.methods.updateVoteCount = async function() {
    const Vote = mongoose.model('Vote');
    
    const [heavenCount, hellCount] = await Promise.all([
        Vote.countDocuments({ confession: this._id, type: 'heaven' }),
        Vote.countDocuments({ confession: this._id, type: 'hell' })
    ]);
    
    this.votes.heaven = heavenCount;
    this.votes.hell = hellCount;
    
    return this.save();
};

// 实例方法：更新评论数
confessionSchema.methods.updateCommentCount = async function() {
    const Comment = mongoose.model('Comment');
    
    const count = await Comment.countDocuments({ 
        confession: this._id, 
        status: 'approved' 
    });
    
    this.commentsCount = count;
    return this.save();
};

// 实例方法：举报告解
confessionSchema.methods.report = function(reason) {
    return this.updateOne({
        $inc: { 'moderation.reportCount': 1 },
        $set: { 
            'moderation.isReported': true,
            'moderation.moderationReason': reason
        }
    });
};

// 静态方法：获取热门告解
confessionSchema.statics.getHotConfessions = function(limit = 10, skip = 0) {
    return this.aggregate([
        {
            $match: {
                status: 'approved',
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            }
        },
        {
            $addFields: {
                totalVotes: { $add: ['$votes.heaven', '$votes.hell'] },
                ageInHours: {
                    $divide: [
                        { $subtract: [new Date(), '$createdAt'] },
                        1000 * 60 * 60
                    ]
                }
            }
        },
        {
            $addFields: {
                hotScore: {
                    $divide: [
                        {
                            $add: [
                                { $multiply: ['$totalVotes', 2] },
                                { $multiply: ['$commentsCount', 3] },
                                { $multiply: ['$viewsCount', 0.1] }
                            ]
                        },
                        { $pow: [{ $add: ['$ageInHours', 2] }, 1.5] }
                    ]
                }
            }
        },
        { $sort: { hotScore: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $lookup: {
                from: 'users',
                localField: 'author',
                foreignField: '_id',
                as: 'authorInfo',
                pipeline: [
                    { $project: { username: 1, avatar: 1 } }
                ]
            }
        }
    ]);
};

// 静态方法：搜索告解
confessionSchema.statics.searchConfessions = function(query, options = {}) {
    const {
        category,
        tags,
        sortBy = 'createdAt',
        sortOrder = -1,
        limit = 20,
        skip = 0
    } = options;
    
    const searchQuery = {
        status: 'approved',
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    };
    
    // 文本搜索
    if (query) {
        searchQuery.$text = { $search: query };
    }
    
    // 分类筛选
    if (category) {
        searchQuery.category = category;
    }
    
    // 标签筛选
    if (tags && tags.length > 0) {
        searchQuery.tags = { $in: tags };
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;
    
    return this.find(searchQuery)
        .sort(sortOptions)
        .limit(limit)
        .skip(skip)
        .populate('author', 'username avatar')
        .select('-metadata -moderation');
};

// 静态方法：获取统计信息
confessionSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                approved: {
                    $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
                },
                pending: {
                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                },
                totalVotes: {
                    $sum: { $add: ['$votes.heaven', '$votes.hell'] }
                },
                totalComments: { $sum: '$commentsCount' },
                totalViews: { $sum: '$viewsCount' }
            }
        }
    ]);
    
    return stats[0] || {
        total: 0,
        approved: 0,
        pending: 0,
        totalVotes: 0,
        totalComments: 0,
        totalViews: 0
    };
};

module.exports = mongoose.model('Confession', confessionSchema);