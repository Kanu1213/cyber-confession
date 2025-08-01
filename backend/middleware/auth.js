const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./asyncHandler');

// 保护路由中间件
const auth = asyncHandler(async (req, res, next) => {
    let token;

    // 检查Authorization头部
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 检查cookies中的token（如果使用cookie存储）
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // 确保token存在
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '访问被拒绝，请先登录'
        });
    }

    try {
        // 验证token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 获取用户信息
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: '用户不存在，请重新登录'
            });
        }

        // 检查用户状态
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: '账户已被禁用，请联系管理员'
            });
        }

        // 检查账户是否被锁定
        if (user.isLocked) {
            return res.status(423).json({
                success: false,
                error: '账户已被锁定，请稍后再试'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token验证失败:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: '登录已过期，请重新登录'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: '无效的登录凭证'
            });
        } else {
            return res.status(401).json({
                success: false,
                error: '认证失败'
            });
        }
    }
});

// 角色授权中间件
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: '请先登录'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: '权限不足，无法访问此资源'
            });
        }

        next();
    };
};

// 可选认证中间件（不强制要求登录）
const optionalAuth = asyncHandler(async (req, res, next) => {
    let token;

    // 检查Authorization头部
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 检查cookies中的token
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // 如果没有token，直接继续
    if (!token) {
        return next();
    }

    try {
        // 验证token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 获取用户信息
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.status === 'active' && !user.isLocked) {
            req.user = user;
        }
    } catch (error) {
        // 可选认证失败时不返回错误，只是不设置req.user
        console.log('可选认证失败:', error.message);
    }

    next();
});

// 检查资源所有权中间件
const checkOwnership = (Model, paramName = 'id', userField = 'author') => {
    return asyncHandler(async (req, res, next) => {
        const resource = await Model.findById(req.params[paramName]);

        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }

        // 管理员可以访问所有资源
        if (req.user.role === 'admin') {
            req.resource = resource;
            return next();
        }

        // 检查所有权
        const resourceUserId = resource[userField] ? resource[userField].toString() : null;
        const currentUserId = req.user.id.toString();

        if (resourceUserId !== currentUserId) {
            return res.status(403).json({
                success: false,
                error: '无权访问此资源'
            });
        }

        req.resource = resource;
        next();
    });
};

module.exports = {
    auth,
    authorize,
    optionalAuth,
    checkOwnership
};