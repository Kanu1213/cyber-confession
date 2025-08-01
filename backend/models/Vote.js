const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, '用户ID不能为空']
    },
    confession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Confession',
        required: [true, '告解ID不能为空']
    },
    type: {
        type: String,
        enum: ['heaven', 'hell'],
        required: [true, '投票类型不能为空']
    },
    metadata: {
        ipAddress: {
            type: String,
            select: false
        },
        userAgent: {
            type: String,
            select: false
        }
    }
}, {
    timestamps: true
});

// 复合索引：确保每个用户对每个告解只能投一票
voteSchema.index({ user: 1, confession: 1 }, { unique: true });

// 其他索引
voteSchema.index({ confession: 1, type: 1 }); // 按告解和类型查询
voteSchema.index({ user: 1, createdAt: -1 }); // 用户投票历史
voteSchema.index({ createdAt: -1 }); // 时间排序

// 中间件：投票后更新告解的投票数
voteSchema.post('save', async function() {
    try {
        const Confession = mongoose.model('Confession');
        const confession = await Confession.findById(this.confession);
        if (confession) {
            await confession.updateVoteCount();
        }
    } catch (error) {
        console.error('更新告解投票数失败:', error);
    }
});

// 中间件：删除投票后更新告解的投票数
voteSchema.post('deleteOne', { document: true, query: false }, async function() {
    try {
        const Confession = mongoose.model('Confession');
        const confession = await Confession.findById(this.confession);
        if (confession) {
            await confession.updateVoteCount();
        }
    } catch (error) {
        console.error('更新告解投票数失败:', error);
    }
});

// 静态方法：获取用户对特定告解的投票
voteSchema.statics.getUserVote = function(userId, confessionId) {
    return this.findOne({ user: userId, confession: confessionId });
};

// 静态方法：获取告解的投票统计
voteSchema.statics.getVoteStats = function(confessionId) {
    return this.aggregate([
        { $match: { confession: mongoose.Types.ObjectId(confessionId) } },
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 }
            }
        }
    ]);
};

// 静态方法：获取用户投票历史
voteSchema.statics.getUserVoteHistory = function(userId, limit = 20, skip = 0) {
    return this.find({ user: userId })
        .populate('confession', 'title content createdAt votes')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

module.exports = mongoose.model('Vote', voteSchema);