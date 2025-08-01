const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');
const Confession = require('../models/Confession');
const Vote = require('../models/Vote');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    获取用户列表
// @route   GET /api/users
// @access  Public
router.get('/', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('每页数量必须在1-50之间'),
    query('sort')
        .optional()
        .isIn(['reputation', 'confessions', 'votes', 'comments', 'newest'])
        .withMessage('排序方式无效'),
    query('search')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('搜索关键词长度必须在1-50个字符之间')
], asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const {
        page = 1,
        limit = 20,
        sort = 'reputation',
        search
    } = req.query;

    const skip = (page - 1) * limit;
    let query = { 
        status: 'active',
        'preferences.publicProfile': true 
    };

    // 搜索用户
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { 'profile.bio': { $regex: search, $options: 'i' } }
        ];
    }

    // 排序选项
    let sortOptions = {};
    switch (sort) {
        case 'confessions':
            sortOptions = { 'stats.confessionsCount': -1 };
            break;
        case 'votes':
            sortOptions = { 'stats.votesCount': -1 };
            break;
        case 'comments':
            sortOptions = { 'stats.commentsCount': -1 };
            break;
        case 'newest':
            sortOptions = { createdAt: -1 };
            break;
        default:
            sortOptions = { 'stats.reputation': -1 };
    }

    const users = await User.find(query)
        .select('username avatar profile stats createdAt')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip);

    res.json({
        success: true,
        data: {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: users.length === parseInt(limit)
            }
        }
    });
}));

// @desc    获取用户详情
// @route   GET /api/users/:id
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('username avatar profile stats createdAt lastLogin');

    if (!user) {
        return res.status(404).json({
            success: false,
            error: '用户不存在'
        });
    }

    // 检查用户是否公开资料
    if (!user.preferences.publicProfile && (!req.user || req.user.id !== user.id)) {
        return res.status(403).json({
            success: false,
            error: '用户资料不公开'
        });
    }

    // 获取用户统计信息
    const stats = await User.getUserStats(user._id);
    user.stats = { ...user.stats, ...stats };

    res.json({
        success: true,
        data: { user }
    });
}));

// @desc    获取用户的告解
// @route   GET /api/users/:id/confessions
// @access  Public
router.get('/:id/confessions', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('每页数量必须在1-50之间')
], optionalAuth, asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.id;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: '用户不存在'
        });
    }

    // 检查权限
    const isOwner = req.user && req.user.id === userId;
    const isPublic = user.preferences.publicProfile;

    if (!isOwner && !isPublic) {
        return res.status(403).json({
            success: false,
            error: '无权查看此用户的告解'
        });
    }

    const skip = (page - 1) * limit;
    const query = {
        author: userId,
        isAnonymous: false, // 只显示非匿名告解
        status: 'approved'
    };

    // 如果不是所有者，只显示未过期的告解
    if (!isOwner) {
        query.$or = [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ];
    }

    const confessions = await Confession.find(query)
        .populate('author', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .select('-metadata -moderation');

    res.json({
        success: true,
        data: {
            confessions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: confessions.length === parseInt(limit)
            }
        }
    });
}));

// @desc    获取用户的评论
// @route   GET /api/users/:id/comments
// @access  Public
router.get('/:id/comments', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('每页数量必须在1-50之间')
], optionalAuth, asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.id;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: '用户不存在'
        });
    }

    // 检查权限
    const isOwner = req.user && req.user.id === userId;
    const isPublic = user.preferences.publicProfile;

    if (!isOwner && !isPublic) {
        return res.status(403).json({
            success: false,
            error: '无权查看此用户的评论'
        });
    }

    const skip = (page - 1) * limit;
    const comments = await Comment.getUserComments(userId, parseInt(limit), skip);

    res.json({
        success: true,
        data: {
            comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: comments.length === parseInt(limit)
            }
        }
    });
}));

// @desc    获取用户的投票历史
// @route   GET /api/users/:id/votes
// @access  Private (只有用户本人可以查看)
router.get('/:id/votes', auth, [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('每页数量必须在1-50之间')
], asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const userId = req.params.id;

    // 只有用户本人或管理员可以查看投票历史
    if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '无权查看投票历史'
        });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const votes = await Vote.getUserVoteHistory(userId, parseInt(limit), skip);

    res.json({
        success: true,
        data: {
            votes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: votes.length === parseInt(limit)
            }
        }
    });
}));

// @desc    关注用户
// @route   POST /api/users/:id/follow
// @access  Private
router.post('/:id/follow', auth, asyncHandler(async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    // 不能关注自己
    if (targetUserId === currentUserId) {
        return res.status(400).json({
            success: false,
            error: '不能关注自己'
        });
    }

    // 检查目标用户是否存在
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
        return res.status(404).json({
            success: false,
            error: '用户不存在'
        });
    }

    // 这里可以实现关注功能的逻辑
    // 由于当前模型中没有关注字段，这里只是示例
    res.json({
        success: true,
        message: '关注功能待实现'
    });
}));

// @desc    获取排行榜
// @route   GET /api/users/leaderboard
// @access  Public
router.get('/leaderboard', [
    query('type')
        .optional()
        .isIn(['reputation', 'confessions', 'votes', 'comments'])
        .withMessage('排行榜类型无效'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('数量限制必须在1-100之间')
], asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { type = 'reputation', limit = 10 } = req.query;

    let sortField = 'stats.reputation';
    switch (type) {
        case 'confessions':
            sortField = 'stats.confessionsCount';
            break;
        case 'votes':
            sortField = 'stats.votesCount';
            break;
        case 'comments':
            sortField = 'stats.commentsCount';
            break;
    }

    const users = await User.find({
        status: 'active',
        'preferences.publicProfile': true
    })
    .select('username avatar stats')
    .sort({ [sortField]: -1 })
    .limit(parseInt(limit));

    res.json({
        success: true,
        data: {
            leaderboard: users,
            type
        }
    });
}));

// @desc    搜索用户
// @route   GET /api/users/search
// @access  Public
router.get('/search', [
    query('q')
        .notEmpty()
        .isLength({ min: 1, max: 50 })
        .withMessage('搜索关键词长度必须在1-50个字符之间'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage('数量限制必须在1-20之间')
], asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { q, limit = 10 } = req.query;

    const users = await User.find({
        status: 'active',
        'preferences.publicProfile': true,
        $or: [
            { username: { $regex: q, $options: 'i' } },
            { 'profile.bio': { $regex: q, $options: 'i' } }
        ]
    })
    .select('username avatar profile.bio stats.reputation')
    .sort({ 'stats.reputation': -1 })
    .limit(parseInt(limit));

    res.json({
        success: true,
        data: { users }
    });
}));

module.exports = router;