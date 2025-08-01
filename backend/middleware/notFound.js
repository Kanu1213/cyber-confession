// 404 Not Found 中间件
// 当没有路由匹配时触发

const notFound = (req, res, next) => {
    const error = new Error(`未找到路由 - ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: '请求的资源不存在',
        details: {
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });
};

module.exports = notFound;