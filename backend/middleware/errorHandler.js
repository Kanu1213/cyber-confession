const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // 记录错误日志
    console.error('错误详情:', err);

    // Mongoose 验证错误
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = {
            message,
            statusCode: 400
        };
    }

    // Mongoose 重复键错误
    if (err.code === 11000) {
        let message = '资源已存在';
        const field = Object.keys(err.keyValue)[0];
        
        switch (field) {
            case 'email':
                message = '邮箱已被注册';
                break;
            case 'username':
                message = '用户名已被使用';
                break;
            default:
                message = `${field} 已存在`;
        }
        
        error = {
            message,
            statusCode: 400
        };
    }

    // Mongoose 无效ObjectId错误
    if (err.name === 'CastError') {
        const message = '资源不存在';
        error = {
            message,
            statusCode: 404
        };
    }

    // JWT错误
    if (err.name === 'JsonWebTokenError') {
        const message = '无效的登录凭证';
        error = {
            message,
            statusCode: 401
        };
    }

    // JWT过期错误
    if (err.name === 'TokenExpiredError') {
        const message = '登录已过期，请重新登录';
        error = {
            message,
            statusCode: 401
        };
    }

    // 文件上传错误
    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = '文件大小超出限制';
        error = {
            message,
            statusCode: 400
        };
    }

    // 速率限制错误
    if (err.statusCode === 429) {
        error = {
            message: err.message || '请求过于频繁，请稍后再试',
            statusCode: 429
        };
    }

    // 数据库连接错误
    if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
        const message = '数据库连接失败，请稍后再试';
        error = {
            message,
            statusCode: 503
        };
    }

    // 权限错误
    if (err.name === 'UnauthorizedError') {
        const message = '访问被拒绝，权限不足';
        error = {
            message,
            statusCode: 403
        };
    }

    // 默认错误响应
    const statusCode = error.statusCode || err.statusCode || 500;
    const message = error.message || '服务器内部错误';

    // 开发环境下返回错误堆栈
    const response = {
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            details: err 
        })
    };

    // 记录严重错误
    if (statusCode >= 500) {
        console.error('严重错误:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            user: req.user ? req.user.id : 'anonymous',
            timestamp: new Date().toISOString()
        });
    }

    res.status(statusCode).json(response);
};

module.exports = errorHandler;