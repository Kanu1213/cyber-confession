const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Confession = require('../models/Confession');
const Vote = require('../models/Vote');
const Comment = require('../models/Comment');
const User = require('../models/User');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// 创建告解速率限制
const createConfessionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 5, // 最多5个告解
    message: {
        error: '创建告解过于频繁，请1小时后再试',
        code: 'CREATE_CONFESSION_RATE_LIMIT'
    }
});

// 投票速率限制
const voteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 10, // 最多10次投票
    message: {
        error: '投票过于频繁，请稍后再试',
        code: 'VOTE_RATE_LIMIT'
    }
});

// 创建告解验证规则
const createConfessionValidation = [
    body('content')
        .isLength({ min: 10, max: 2000 })
        .withMessage('告解内容长度必须在10-2000个字符之间')
        .trim(),
    body('title')
        .optional()
        .isLength({ max: 100 })
        .withMessage('标题不能超过100个字符')
        .trim(),
    body('category')
        .optional()
        .isIn(['personal', 'work', 'relationship', 'family', 'moral', 'other'])
        .withMessage('无效的分类'),
    body('tags')
        .optional()
        .isArray({ max: 5 })
        .withMessage('标签最多5个'),
    body('tags.*')
        .optional()
        .isLength({ min: 1, max: 20 })
        .withMessage('标签长度必须在1-20个字符之间')
        .trim(),
    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('匿名标识必须为布尔值')
];

// 投票验证规则
const voteValidation = [
    body('type')
        .isIn(['heaven', 'hell'])
        .withMessage('投票类型必须是 heaven 或 hell')
];

// @desc    获取告解列表
// @route   GET /api/confessions
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
        .isIn(['latest', 'hot', 'votes', 'comments'])
        .withMessage('排序方式无效'),
    query('category')
        .optional()
        .isIn(['personal', 'work', 'relationship', 'family', 'moral', 'other'])
        .withMessage('分类无效'),
    query('search')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('搜索关键词长度必须在1-100个字符之间')
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

    const {
        page = 1,
        limit = 20,
        sort = 'latest',
        category,
        search,
        tags
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {
        status: 'approved',
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    };

    // 分类筛选
    if (category) {
        query.category = category;
    }

    // 标签筛选
    if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query.tags = { $in: tagArray };
    }

    // 搜索
    if (search) {
        query.$text = { $search: search };
    }

    // 排序
    let sortOptions = {};
    switch (sort) {
        case 'hot':
            // 使用热度算法排序
            const confessions = await Confession.getHotConfessions(parseInt(limit), skip);
            return res.json({
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
        case 'votes':
            sortOptions = { 'votes.heaven': -1, 'votes.hell': -1, createdAt: -1 };
            break;
        case 'comments':
            sortOptions = { commentsCount: -1, createdAt: -1 };
            break;
        default:
            sortOptions = { createdAt: -1 };
    }

    const confessions = await Confession.find(query)
        .populate('author', 'username avatar')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip)
        .select('-metadata -moderation');

    // 如果用户已登录，获取用户的投票信息
    if (req.user) {
        const confessionIds = confessions.map(c => c._id);
        const userVotes = await Vote.find({
            user: req.user.id,
            confession: { $in: confessionIds }
        });

        const voteMap = {};
        userVotes.forEach(vote => {
            voteMap[vote.confession.toString()] = vote.type;
        });

        confessions.forEach(confession => {
            confession.userVote = voteMap[confession._id.toString()] || null;
        });
    }

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

// @desc    获取单个告解详情
// @route   GET /api/confessions/:id
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
    const confession = await Confession.findById(req.params.id)
        .populate('author', 'username avatar stats.reputation')
        .select('-metadata -moderation');

    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    // 检查告解状态
    if (confession.status !== 'approved') {
        return res.status(403).json({
            success: false,
            error: '告解不可访问'
        });
    }

    // 检查是否过期
    if (confession.isExpired) {
        return res.status(410).json({
            success: false,
            error: '告解已过期'
        });
    }

    // 增加浏览量
    await confession.incrementViews();

    // 获取用户投票信息
    let userVote = null;
    if (req.user) {
        const vote = await Vote.findOne({
            user: req.user.id,
            confession: confession._id
        });
        userVote = vote ? vote.type : null;
    }

    res.json({
        success: true,
        data: {
            confession: {
                ...confession.toObject(),
                userVote
            }
        }
    });
}));

// @desc    创建告解
// @route   POST /api/confessions
// @access  Private
router.post('/', auth, createConfessionLimiter, createConfessionValidation, asyncHandler(async (req, res) => {
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
        title,
        content,
        category = 'other',
        tags = [],
        isAnonymous = true
    } = req.body;

    // 创建告解
    const confession = await Confession.create({
        title,
        content,
        author: isAnonymous ? null : req.user.id,
        isAnonymous,
        category,
        tags,
        metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }
    });

    // 更新用户统计
    if (!isAnonymous) {
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { 'stats.confessionsCount': 1 }
        });
    }

    // 填充作者信息
    await confession.populate('author', 'username avatar');

    res.status(201).json({
        success: true,
        message: '告解创建成功',
        data: { confession }
    });
}));

// @desc    投票
// @route   POST /api/confessions/:id/vote
// @access  Private
router.post('/:id/vote', auth, voteLimiter, voteValidation, asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { type } = req.body;
    const confessionId = req.params.id;

    // 检查告解是否存在
    const confession = await Confession.findById(confessionId);
    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    // 检查告解状态
    if (confession.status !== 'approved') {
        return res.status(403).json({
            success: false,
            error: '无法对此告解投票'
        });
    }

    // 检查是否过期
    if (confession.isExpired) {
        return res.status(410).json({
            success: false,
            error: '告解已过期，无法投票'
        });
    }

    // 检查用户是否已投票
    const existingVote = await Vote.findOne({
        user: req.user.id,
        confession: confessionId
    });

    if (existingVote) {
        // 如果投票类型相同，取消投票
        if (existingVote.type === type) {
            await existingVote.deleteOne();
            
            res.json({
                success: true,
                message: '投票已取消',
                data: {
                    action: 'removed',
                    type: null
                }
            });
        } else {
            // 更改投票类型
            existingVote.type = type;
            await existingVote.save();
            
            res.json({
                success: true,
                message: '投票已更改',
                data: {
                    action: 'changed',
                    type
                }
            });
        }
    } else {
        // 创建新投票
        await Vote.create({
            user: req.user.id,
            confession: confessionId,
            type,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        // 更新用户统计
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { 'stats.votesCount': 1 }
        });

        res.json({
            success: true,
            message: '投票成功',
            data: {
                action: 'added',
                type
            }
        });
    }
}));

// @desc    获取告解评论
// @route   GET /api/confessions/:id/comments
// @access  Public
router.get('/:id/comments', [
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
        .isIn(['latest', 'oldest', 'likes'])
        .withMessage('排序方式无效')
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
        sort = 'latest'
    } = req.query;

    const confessionId = req.params.id;

    // 检查告解是否存在
    const confession = await Confession.findById(confessionId);
    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    const skip = (page - 1) * limit;
    let sortOptions = {};

    switch (sort) {
        case 'oldest':
            sortOptions = { createdAt: 1 };
            break;
        case 'likes':
            sortOptions = { likes: -1, createdAt: -1 };
            break;
        default:
            sortOptions = { createdAt: -1 };
    }

    const comments = await Comment.find({
        confession: confessionId,
        status: 'approved',
        parentComment: null // 只获取顶级评论
    })
    .populate('author', 'username avatar')
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip(skip);

    // 获取每个评论的回复数量
    for (let comment of comments) {
        const repliesCount = await Comment.countDocuments({
            parentComment: comment._id,
            status: 'approved'
        });
        comment.repliesCount = repliesCount;
    }

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

// @desc    分享告解
// @route   POST /api/confessions/:id/share
// @access  Public
router.post('/:id/share', asyncHandler(async (req, res) => {
    const confession = await Confession.findById(req.params.id);
    
    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    // 增加分享量
    await confession.incrementShares();

    res.json({
        success: true,
        message: '分享成功'
    });
}));

// @desc    举报告解
// @route   POST /api/confessions/:id/report
// @access  Private
router.post('/:id/report', auth, [
    body('reason')
        .isIn(['spam', 'inappropriate', 'harassment', 'fake', 'other'])
        .withMessage('举报原因无效'),
    body('description')
        .optional()
        .isLength({ max: 200 })
        .withMessage('描述不能超过200个字符')
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

    const { reason, description } = req.body;
    const confession = await Confession.findById(req.params.id);

    if (!confession) {
        return res.status(404).json({
            success: false,
            error: '告解不存在'
        });
    }

    // 举报告解
    await confession.report(`${reason}: ${description || ''}`);

    res.json({
        success: true,
        message: '举报已提交，我们会尽快处理'
    });
}));

// @desc    获取热门告解
// @route   GET /api/confessions/hot
// @access  Public
router.get('/hot', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    
    const confessions = await Confession.getHotConfessions(parseInt(limit));
    
    res.json({
        success: true,
        data: { confessions }
    });
}));

// @desc    获取精选告解
// @route   GET /api/confessions/featured
// @access  Public
router.get('/featured', asyncHandler(async (req, res) => {
    const confessions = await Confession.find({
        featured: true,
        status: 'approved',
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    })
    .populate('author', 'username avatar')
    .sort({ featuredAt: -1 })
    .limit(10)
    .select('-metadata -moderation');

    res.json({
        success: true,
        data: { confessions }
    });
}));

module.exports = router;