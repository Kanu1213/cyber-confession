const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// 登录速率限制
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 最多5次尝试
    message: {
        error: '登录尝试过于频繁，请15分钟后再试',
        code: 'LOGIN_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 注册速率限制
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 3, // 最多3次注册
    message: {
        error: '注册过于频繁，请1小时后再试',
        code: 'REGISTER_RATE_LIMIT'
    }
});

// 注册验证规则
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('用户名长度必须在3-30个字符之间')
        .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
        .withMessage('用户名只能包含字母、数字、下划线和中文'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('请输入有效的邮箱地址'),
    body('password')
        .isLength({ min: 6, max: 128 })
        .withMessage('密码长度必须在6-128个字符之间')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('密码必须包含至少一个小写字母、一个大写字母和一个数字'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('确认密码与密码不匹配');
            }
            return true;
        })
];

// 登录验证规则
const loginValidation = [
    body('identifier')
        .notEmpty()
        .withMessage('请输入用户名或邮箱'),
    body('password')
        .notEmpty()
        .withMessage('请输入密码')
];

// @desc    用户注册
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registerLimiter, registerValidation, asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { username, email, password } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({
        $or: [
            { email: email.toLowerCase() },
            { username }
        ]
    });

    if (existingUser) {
        return res.status(400).json({
            success: false,
            error: existingUser.email === email.toLowerCase() ? '邮箱已被注册' : '用户名已被使用'
        });
    }

    // 创建用户
    const user = await User.create({
        username,
        email: email.toLowerCase(),
        password,
        metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }
    });

    // 生成JWT令牌
    const token = user.getSignedJwtToken();

    // 更新最后登录时间
    await user.updateLastLogin();

    res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        }
    });
}));

// @desc    用户登录
// @route   POST /api/auth/login
// @access  Public
router.post('/login', loginLimiter, loginValidation, asyncHandler(async (req, res) => {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '输入验证失败',
            details: errors.array()
        });
    }

    const { identifier, password } = req.body;

    // 查找用户
    const user = await User.findByEmailOrUsername(identifier);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: '用户名或密码错误'
        });
    }

    // 检查账户是否被锁定
    if (user.isLocked) {
        return res.status(423).json({
            success: false,
            error: '账户已被锁定，请稍后再试'
        });
    }

    // 检查账户状态
    if (user.status !== 'active') {
        return res.status(403).json({
            success: false,
            error: '账户已被禁用，请联系管理员'
        });
    }

    // 验证密码
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        // 增加登录失败次数
        await user.incLoginAttempts();
        
        return res.status(401).json({
            success: false,
            error: '用户名或密码错误'
        });
    }

    // 重置登录尝试次数
    if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
    }

    // 更新最后登录时间
    await user.updateLastLogin();

    // 生成JWT令牌
    const token = user.getSignedJwtToken();

    res.json({
        success: true,
        message: '登录成功',
        data: {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                lastLogin: user.lastLogin,
                stats: user.stats
            }
        }
    });
}));

// @desc    获取当前用户信息
// @route   GET /api/auth/me
// @access  Private
router.get('/me', auth, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
        .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    res.json({
        success: true,
        data: { user }
    });
}));

// @desc    更新用户资料
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', auth, [
    body('username')
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage('用户名长度必须在3-30个字符之间')
        .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
        .withMessage('用户名只能包含字母、数字、下划线和中文'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('请输入有效的邮箱地址'),
    body('profile.bio')
        .optional()
        .isLength({ max: 200 })
        .withMessage('个人简介不能超过200个字符'),
    body('profile.location')
        .optional()
        .isLength({ max: 50 })
        .withMessage('地址不能超过50个字符'),
    body('profile.website')
        .optional()
        .isURL()
        .withMessage('请输入有效的网址')
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

    const { username, email, profile, preferences } = req.body;
    const updateData = {};

    // 检查用户名是否已被使用
    if (username && username !== req.user.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: '用户名已被使用'
            });
        }
        updateData.username = username;
    }

    // 检查邮箱是否已被使用
    if (email && email !== req.user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: '邮箱已被注册'
            });
        }
        updateData.email = email;
        updateData.emailVerified = false; // 需要重新验证邮箱
    }

    // 更新个人资料
    if (profile) {
        updateData.profile = { ...req.user.profile, ...profile };
    }

    // 更新偏好设置
    if (preferences) {
        updateData.preferences = { ...req.user.preferences, ...preferences };
    }

    const user = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    res.json({
        success: true,
        message: '资料更新成功',
        data: { user }
    });
}));

// @desc    修改密码
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', auth, [
    body('currentPassword')
        .notEmpty()
        .withMessage('请输入当前密码'),
    body('newPassword')
        .isLength({ min: 6, max: 128 })
        .withMessage('新密码长度必须在6-128个字符之间')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('新密码必须包含至少一个小写字母、一个大写字母和一个数字'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('确认密码与新密码不匹配');
            }
            return true;
        })
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

    const { currentPassword, newPassword } = req.body;

    // 获取用户（包含密码）
    const user = await User.findById(req.user.id).select('+password');

    // 验证当前密码
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
        return res.status(400).json({
            success: false,
            error: '当前密码错误'
        });
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.json({
        success: true,
        message: '密码修改成功'
    });
}));

// @desc    用户登出
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', auth, asyncHandler(async (req, res) => {
    // 在实际应用中，可以将token加入黑名单
    // 这里只是返回成功响应
    res.json({
        success: true,
        message: '登出成功'
    });
}));

// @desc    删除账户
// @route   DELETE /api/auth/account
// @access  Private
router.delete('/account', auth, [
    body('password')
        .notEmpty()
        .withMessage('请输入密码确认删除'),
    body('confirmation')
        .equals('DELETE')
        .withMessage('请输入 DELETE 确认删除')
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

    const { password } = req.body;

    // 获取用户（包含密码）
    const user = await User.findById(req.user.id).select('+password');

    // 验证密码
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        return res.status(400).json({
            success: false,
            error: '密码错误'
        });
    }

    // 删除用户相关数据
    const Confession = require('../models/Confession');
    const Vote = require('../models/Vote');
    const Comment = require('../models/Comment');

    await Promise.all([
        Confession.deleteMany({ author: user._id }),
        Vote.deleteMany({ user: user._id }),
        Comment.deleteMany({ author: user._id }),
        User.findByIdAndDelete(user._id)
    ]);

    res.json({
        success: true,
        message: '账户删除成功'
    });
}));

module.exports = router;