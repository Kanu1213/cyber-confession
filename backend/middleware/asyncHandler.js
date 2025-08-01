// 异步错误处理中间件
// 用于包装异步路由处理函数，自动捕获异步错误并传递给错误处理中间件

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;