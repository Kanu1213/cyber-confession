const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const confessionRoutes = require('./routes/confessions');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// 导入中间件
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// 数据清理中间件
app.use(mongoSanitize());

// 压缩响应
app.use(compression());

// 日志记录
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP 15分钟内最多100个请求
    message: {
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS配置
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:8000'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: '赛博告解室API服务运行正常',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/confessions', confessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// API文档路由
app.get('/api', (req, res) => {
    res.json({
        message: '赛博告解室 API v1.0',
        documentation: '/api/docs',
        endpoints: {
            auth: '/api/auth',
            confessions: '/api/confessions',
            users: '/api/users',
            admin: '/api/admin'
        }
    });
});

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 数据库连接
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyber-confessional', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB 连接成功: ${conn.connection.host}`);
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        process.exit(1);
    }
};

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    mongoose.connection.close(() => {
        console.log('数据库连接已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    mongoose.connection.close(() => {
        console.log('数据库连接已关闭');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 5000;

// 启动服务器
const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 赛博告解室API服务器运行在端口 ${PORT}`);
        console.log(`📖 API文档: http://localhost:${PORT}/api`);
        console.log(`💚 健康检查: http://localhost:${PORT}/health`);
    });
};

startServer();

module.exports = app;