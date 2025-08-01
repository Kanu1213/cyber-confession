const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./asyncHandler');

// 可选认证中间件（不强制要求登录）
// 如果提供了有效token，则设置req.user；否则继续执行而不报错

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

        // 只有在用户存在且状态正常时才设置req.user
        if (user && user.status === 'active' && !user.isLocked) {
            req.user = user;
        }
    } catch (error) {
        // 可选认证失败时不返回错误，只是不设置req.user
        console.log('可选认证失败:', error.message);
    }

    next();
});

module.exports = optionalAuth;