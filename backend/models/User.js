const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, '用户名不能为空'],
        unique: true,
        trim: true,
        minlength: [3, '用户名至少3个字符'],
        maxlength: [30, '用户名不能超过30个字符'],
        match: [/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文']
    },
    email: {
        type: String,
        required: [true, '邮箱不能为空'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
    },
    password: {
        type: String,
        required: [true, '密码不能为空'],
        minlength: [6, '密码至少6个字符'],
        select: false // 默认查询时不返回密码
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'moderator', 'admin'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned'],
        default: 'active'
    },
    profile: {
        bio: {
            type: String,
            maxlength: [200, '个人简介不能超过200个字符']
        },
        location: {
            type: String,
            maxlength: [50, '地址不能超过50个字符']
        },
        website: {
            type: String,
            match: [/^https?:\/\/.+/, '请输入有效的网址']
        }
    },
    stats: {
        confessionsCount: {
            type: Number,
            default: 0
        },
        votesCount: {
            type: Number,
            default: 0
        },
        commentsCount: {
            type: Number,
            default: 0
        },
        reputation: {
            type: Number,
            default: 0
        }
    },
    preferences: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        publicProfile: {
            type: Boolean,
            default: true
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'dark'
        }
    },
    lastLogin: {
        type: Date,
        default: null
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        select: false
    },
    passwordResetToken: {
        type: String,
        select: false
    },
    passwordResetExpires: {
        type: Date,
        select: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 虚拟字段：是否被锁定
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// 索引
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.reputation': -1 });

// 密码加密中间件
userSchema.pre('save', async function(next) {
    // 只有密码被修改时才加密
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 更新统计信息中间件
userSchema.pre('save', function(next) {
    if (this.isNew) {
        this.stats.reputation = 10; // 新用户初始声望
    }
    next();
});

// 实例方法：验证密码
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 实例方法：生成JWT令牌
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { 
            id: this._id,
            username: this.username,
            role: this.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

// 实例方法：增加登录失败次数
userSchema.methods.incLoginAttempts = function() {
    // 如果之前有锁定且已过期，重置计数器
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    // 如果达到最大尝试次数且未被锁定，则锁定账户
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = {
            lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 锁定2小时
        };
    }
    
    return this.updateOne(updates);
};

// 实例方法：重置登录尝试
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: {
            loginAttempts: 1,
            lockUntil: 1
        }
    });
};

// 实例方法：更新最后登录时间
userSchema.methods.updateLastLogin = function() {
    return this.updateOne({
        $set: { lastLogin: new Date() }
    });
};

// 静态方法：根据邮箱或用户名查找用户
userSchema.statics.findByEmailOrUsername = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ]
    }).select('+password');
};

// 静态方法：获取用户统计信息
userSchema.statics.getUserStats = async function(userId) {
    const Confession = mongoose.model('Confession');
    const Vote = mongoose.model('Vote');
    const Comment = mongoose.model('Comment');
    
    const [confessions, votes, comments] = await Promise.all([
        Confession.countDocuments({ author: userId }),
        Vote.countDocuments({ user: userId }),
        Comment.countDocuments({ author: userId })
    ]);
    
    return {
        confessionsCount: confessions,
        votesCount: votes,
        commentsCount: comments
    };
};

// 静态方法：获取排行榜
userSchema.statics.getLeaderboard = function(limit = 10) {
    return this.find({ status: 'active' })
        .sort({ 'stats.reputation': -1 })
        .limit(limit)
        .select('username avatar stats.reputation stats.confessionsCount');
};

module.exports = mongoose.model('User', userSchema);