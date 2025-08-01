const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: [true, '评论内容不能为空'],
        trim: true,
        minlength: [1, '评论内容至少1个字符'],
        maxlength: [500, '评论内容不能超过500个字符']
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, '作者ID不能为空']
    },
    confession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Confession',
        required: [true, '告解ID不能为空']
    },
    parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null // null表示顶级评论
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'hidden'],
        default: 'approved'
    },
    likes: {
        type: Number,
        default: 0,
        min: 0
    },
    dislikes: {
        type: Number,
        default: 0,
        min: 0
    },
    repliesCount: {
        type: Number,
        default: 0,
        min: 0
    },
    metadata: {
        ipAddress: {
            type: String,
            select: false
        },
        userAgent: {
            type: String,
            select: false
        },
        editedAt: Date,
        editCount: {
            type: Number,
            default: 0
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
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 虚拟字段：是否为回复
commentSchema.virtual('isReply').get(function() {
    return !!this.parentComment;
});

// 虚拟字段：净赞数
commentSchema.virtual('netLikes').get(function() {
    return this.likes - this.dislikes;
});

// 虚拟字段：是否被编辑过
commentSchema.virtual('isEdited').get(function() {
    return this.metadata.editCount > 0;
});

// 索引
commentSchema.index({ confession: 1, createdAt: -1 }); // 按告解和时间查询
commentSchema.index({ author: 1, createdAt: -1 }); // 作者的评论
commentSchema.index({ parentComment: 1, createdAt: 1 }); // 回复评论
commentSchema.index({ status: 1, createdAt: -1 }); // 状态筛选
commentSchema.index({ likes: -1 }); // 按赞数排序
commentSchema.index({ createdAt: -1 }); // 时间排序

// 文本搜索索引
commentSchema.index({ content: 'text' });

// 中间件：保存后更新告解的评论数
commentSchema.post('save', async function() {
    if (this.isNew && this.status === 'approved') {
        try {
            const Confession = mongoose.model('Confession');
            const confession = await Confession.findById(this.confession);
            if (confession) {
                await confession.updateCommentCount();
            }
            
            // 如果是回复，更新父评论的回复数
            if (this.parentComment) {
                await this.constructor.updateRepliesCount(this.parentComment);
            }
        } catch (error) {
            console.error('更新评论数失败:', error);
        }
    }
});

// 中间件：删除后更新相关计数
commentSchema.post('deleteOne', { document: true, query: false }, async function() {
    try {
        const Confession = mongoose.model('Confession');
        const confession = await Confession.findById(this.confession);
        if (confession) {
            await confession.updateCommentCount();
        }
        
        // 如果是回复，更新父评论的回复数
        if (this.parentComment) {
            await this.constructor.updateRepliesCount(this.parentComment);
        }
        
        // 删除所有子回复
        await this.constructor.deleteMany({ parentComment: this._id });
    } catch (error) {
        console.error('删除评论后清理失败:', error);
    }
});

// 实例方法：增加点赞
commentSchema.methods.addLike = function() {
    return this.updateOne({ $inc: { likes: 1 } });
};

// 实例方法：减少点赞
commentSchema.methods.removeLike = function() {
    return this.updateOne({ $inc: { likes: -1 } });
};

// 实例方法：增加踩
commentSchema.methods.addDislike = function() {
    return this.updateOne({ $inc: { dislikes: 1 } });
};

// 实例方法：减少踩
commentSchema.methods.removeDislike = function() {
    return this.updateOne({ $inc: { dislikes: -1 } });
};

// 实例方法：编辑评论
commentSchema.methods.editContent = function(newContent) {
    return this.updateOne({
        $set: { 
            content: newContent,
            'metadata.editedAt': new Date()
        },
        $inc: { 'metadata.editCount': 1 }
    });
};

// 实例方法：举报评论
commentSchema.methods.report = function(reason) {
    return this.updateOne({
        $inc: { 'moderation.reportCount': 1 },
        $set: { 
            'moderation.isReported': true,
            'moderation.moderationReason': reason
        }
    });
};

// 静态方法：获取告解的评论（分页）
commentSchema.statics.getConfessionComments = function(confessionId, options = {}) {
    const {
        limit = 20,
        skip = 0,
        sortBy = 'createdAt',
        sortOrder = 1,
        includeReplies = true
    } = options;
    
    const query = {
        confession: confessionId,
        status: 'approved'
    };
    
    // 是否只获取顶级评论
    if (!includeReplies) {
        query.parentComment = null;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;
    
    return this.find(query)
        .populate('author', 'username avatar')
        .populate('parentComment', 'content author')
        .sort(sortOptions)
        .limit(limit)
        .skip(skip);
};

// 静态方法：获取评论的回复
commentSchema.statics.getCommentReplies = function(commentId, limit = 10, skip = 0) {
    return this.find({
        parentComment: commentId,
        status: 'approved'
    })
    .populate('author', 'username avatar')
    .sort({ createdAt: 1 })
    .limit(limit)
    .skip(skip);
};

// 静态方法：更新回复数量
commentSchema.statics.updateRepliesCount = async function(commentId) {
    const count = await this.countDocuments({
        parentComment: commentId,
        status: 'approved'
    });
    
    return this.updateOne(
        { _id: commentId },
        { $set: { repliesCount: count } }
    );
};

// 静态方法：获取用户评论历史
commentSchema.statics.getUserComments = function(userId, limit = 20, skip = 0) {
    return this.find({ 
        author: userId,
        status: 'approved'
    })
    .populate('confession', 'title content')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// 静态方法：搜索评论
commentSchema.statics.searchComments = function(query, options = {}) {
    const {
        confessionId,
        authorId,
        limit = 20,
        skip = 0
    } = options;
    
    const searchQuery = {
        status: 'approved',
        $text: { $search: query }
    };
    
    if (confessionId) {
        searchQuery.confession = confessionId;
    }
    
    if (authorId) {
        searchQuery.author = authorId;
    }
    
    return this.find(searchQuery)
        .populate('author', 'username avatar')
        .populate('confession', 'title')
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .skip(skip);
};

// 静态方法：获取热门评论
commentSchema.statics.getHotComments = function(confessionId, limit = 10) {
    return this.find({
        confession: confessionId,
        status: 'approved',
        parentComment: null // 只获取顶级评论
    })
    .populate('author', 'username avatar')
    .sort({ likes: -1, createdAt: -1 })
    .limit(limit);
};

// 静态方法：获取最新评论
commentSchema.statics.getLatestComments = function(limit = 10, skip = 0) {
    return this.find({ status: 'approved' })
        .populate('author', 'username avatar')
        .populate('confession', 'title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

module.exports = mongoose.model('Comment', commentSchema);