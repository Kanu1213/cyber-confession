const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Confession = require('../models/Confession');
const Vote = require('../models/Vote');
const Comment = require('../models/Comment');
const { auth, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// 所有管理员路由都需要管理员权限
router.use(auth);
router.use(authorize('admin', 'moderator'));

// @desc    获取系统统计信息
// @route   GET /api/admin/stats
// @access  Private (Admin/Moderator)
router.get('/stats', asyncHandler(async (req, res) => {
    const [
        userStats,
        confessionStats,
        voteStats,
        commentStats
    ] = await Promise.all([
        User.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
                    banned: { $sum: { $cond: [{ $eq: ['$status', 'banned'] }, 1, 0] } },
                    newThisMonth: {
                        $sum: {
                            $cond: [
                                { $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]),
        Confession.getStats(),
        Vote.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    heaven: { $sum: { $cond: [{ $eq: ['$type', 'heaven'] }, 1, 0] } },
                    hell: { $sum: { $cond: [{ $eq: ['$type', 'hell'] }, 1, 0] } }
                }
            }
        ]),
        Comment.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
                }
            }
        ])
    ]);

    res.json({
        success: true,
        data: {
            users: userStats[0] || { total: 0, active: 0, suspended: 0, banned: 0, newThisMonth: 0 },
            confessions: confessionStats,
            votes: voteStats[0] || { total: 0, heaven: 0, hell: 0 },
            comments: commentStats[0] || { total: 0, approved: 0, pending: 0, rejected: 0 }
        }
    });
}));

// @desc    获取用户管理列表
// @route   GET /api/admin/users
// @access  Private (Admin/Moderator)
router.get('/users', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('每页数量必须在1-100之间'),
    query('status')
        .optional()
        .isIn(['active', 'suspended', 'banned'])
        .withMessage('用户状态无效'),
    query('role')
        .optional()
        .isIn(['user', 'moderator', 'admin'])
        .withMessage('用户角色无效'),
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
        status,
        role,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // 状态筛选
    if (status) {
        query.status = status;
    }

    // 角色筛选
    if (role) {
        query.role = role;
    }

    // 搜索
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    // 排序
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
        .select('username email role status stats createdAt lastLogin loginAttempts lockUntil')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip);

    const total = await User.countDocuments(query);

    res.json({
        success: true,
        data: {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
                hasMore: skip + users.length < total
            }
        }
    });
}));

// @desc    更新用户状态
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
router.put('/users/:id/status', authorize('admin'), [
    body('status')
        .isIn(['active', 'suspended', 'banned'])
        .withMessage('用户状态无效'),
    body('reason')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('原因长度必须在1-200个字符之间')
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

    const { status, reason } = req.body;
    const userId = req.params.id;

    // 不能修改自己的状态
    if (userId === req.user.id) {
        return res.status(400).json({
            success: false,
            error: '不能修改自己的状态'
        });
    }

    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: '用户不存在'
        });
    }

    // 不能修改其他管理员的状态
    if (user.role === 'admin' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }

    user.status = status;
    await user.save();

    // 记录管理操作日志
    console.log(`管理员 ${req.user.username} 将用户 ${user.username} 的状态更改为 ${status}，原因：${reason || '无'}`);

    res.json({
        success: true,
        message: '用户状态更新成功',
        data: { user }
    });
}));

// @desc    获取告解管理列表
// @route   GET /api/admin/confessions
// @access  Private (Admin/Moderator)
router.get('/confessions', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('每页数量必须在1-100之间'),
    query('status')
        .optional()
        .isIn(['pending', 'approved', 'rejected', 'hidden'])
        .withMessage('告解状态无效'),
    query('reported')
        .optional()
        .isBoolean()
        .withMessage('举报标识必须为布尔值')
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
        status,
        reported,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // 状态筛选
    if (status) {
        query.status = status;
    }

    // 举报筛选
    if (reported === 'true') {
        query['moderation.isReported'] = true;
    }

    // 排序
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const confessions = await Confession.find(query)
        .populate('author', 'username email')
        .populate('moderation.moderatedBy', 'username')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Confession.countDocuments(query);

    res.json({
        success: true,
        data: {
            confessions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
                hasMore: skip + confessions.length < total
            }
        }
    });
}));

// @desc    审核告解
// @route   PUT /api/admin/confessions/:id/moderate
// @access  Private (Admin/Moderator)
router.put('/confessions/:id/moderate', [
    body('status')
        .isIn(['approved', 'rejected', 'hidden'])
        .withMessage('审核状态无效'),
    body('reason')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('原因长度必须在1-200个字符之间')
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

    const { status, reason } = req.body;
    const confessionId = req.params.id;

    const confession = await Confession.findById(confessionId);
    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    confession.status = status;
    confession.moderation.moderatedBy = req.user.id;
    confession.moderation.moderatedAt = new Date();
    confession.moderation.moderationReason = reason;

    await confession.save();

    // 记录管理操作日志
    console.log(`管理员 ${req.user.username} 审核告解 ${confessionId}，状态：${status}，原因：${reason || '无'}`);

    res.json({
        success: true,
        message: '告解审核完成',
        data: { confession }
    });
}));

// @desc    设置精选告解
// @route   PUT /api/admin/confessions/:id/feature
// @access  Private (Admin/Moderator)
router.put('/confessions/:id/feature', [
    body('featured')
        .isBoolean()
        .withMessage('精选标识必须为布尔值')
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

    const { featured } = req.body;
    const confessionId = req.params.id;

    const confession = await Confession.findById(confessionId);
    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    confession.featured = featured;
    if (featured) {
        confession.featuredAt = new Date();
    }

    await confession.save();

    res.json({
        success: true,
        message: featured ? '已设为精选告解' : '已取消精选',
        data: { confession }
    });
}));

// @desc    获取评论管理列表
// @route   GET /api/admin/comments
// @access  Private (Admin/Moderator)
router.get('/comments', [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('每页数量必须在1-100之间'),
    query('status')
        .optional()
        .isIn(['pending', 'approved', 'rejected', 'hidden'])
        .withMessage('评论状态无效'),
    query('reported')
        .optional()
        .isBoolean()
        .withMessage('举报标识必须为布尔值')
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
        status,
        reported,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // 状态筛选
    if (status) {
        query.status = status;
    }

    // 举报筛选
    if (reported === 'true') {
        query['moderation.isReported'] = true;
    }

    // 排序
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const comments = await Comment.find(query)
        .populate('author', 'username email')
        .populate('confession', 'title content')
        .populate('moderation.moderatedBy', 'username')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Comment.countDocuments(query);

    res.json({
        success: true,
        data: {
            comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
                hasMore: skip + comments.length < total
            }
        }
    });
}));

// @desc    审核评论
// @route   PUT /api/admin/comments/:id/moderate
// @access  Private (Admin/Moderator)
router.put('/comments/:id/moderate', [
    body('status')
        .isIn(['approved', 'rejected', 'hidden'])
        .withMessage('审核状态无效'),
    body('reason')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('原因长度必须在1-200个字符之间')
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

    const { status, reason } = req.body;
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
        return res.status(404).json({
            success: false,
            error: '评论不存在'
        });
    }

    comment.status = status;
    comment.moderation.moderatedBy = req.user.id;
    comment.moderation.moderatedAt = new Date();
    comment.moderation.moderationReason = reason;

    await comment.save();

    // 记录管理操作日志
    console.log(`管理员 ${req.user.username} 审核评论 ${commentId}，状态：${status}，原因：${reason || '无'}`);

    res.json({
        success: true,
        message: '评论审核完成',
        data: { comment }
    });
}));

// @desc    批量操作
// @route   POST /api/admin/batch
// @access  Private (Admin)
router.post('/batch', authorize('admin'), [
    body('action')
        .isIn(['delete', 'approve', 'reject', 'hide'])
        .withMessage('批量操作类型无效'),
    body('type')
        .isIn(['confessions', 'comments', 'users'])
        .withMessage('操作对象类型无效'),
    body('ids')
        .isArray({ min: 1, max: 100 })
        .withMessage('ID数组必须包含1-100个元素'),
    body('reason')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('原因长度必须在1-200个字符之间')
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

    const { action, type, ids, reason } = req.body;

    let Model;
    switch (type) {
        case 'confessions':
            Model = Confession;
            break;
        case 'comments':
            Model = Comment;
            break;
        case 'users':
            Model = User;
            break;
    }

    let updateData = {};
    switch (action) {
        case 'delete':
            await Model.deleteMany({ _id: { $in: ids } });
            break;
        case 'approve':
            updateData.status = 'approved';
            break;
        case 'reject':
            updateData.status = 'rejected';
            break;
        case 'hide':
            updateData.status = 'hidden';
            break;
    }

    if (action !== 'delete') {
        if (type !== 'users') {
            updateData['moderation.moderatedBy'] = req.user.id;
            updateData['moderation.moderatedAt'] = new Date();
            updateData['moderation.moderationReason'] = reason;
        }

        await Model.updateMany(
            { _id: { $in: ids } },
            { $set: updateData }
        );
    }

    // 记录管理操作日志
    console.log(`管理员 ${req.user.username} 批量${action} ${type}，数量：${ids.length}，原因：${reason || '无'}`);

    res.json({
        success: true,
        message: `批量操作完成，处理了 ${ids.length} 个项目`
    });
}));

// @desc    获取系统日志
// @route   GET /api/admin/logs
// @access  Private (Admin)
router.get('/logs', authorize('admin'), [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('页码必须是正整数'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('每页数量必须在1-100之间')
], asyncHandler(async (req, res) => {
    // 这里应该实现日志系统
    // 由于当前没有日志模型，返回示例数据
    res.json({
        success: true,
        message: '日志系统待实现',
        data: {
            logs: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0,
                hasMore: false
            }
        }
    });
}));

module.exports = router;