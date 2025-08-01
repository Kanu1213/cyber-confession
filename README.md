# 赛博告解室 - Cyber Confessional

一个基于基督教哥特式风格的数字化告解平台，采用现代化全栈技术架构，提供完整的前后端解决方案。

## 🌟 项目特色

### 🎨 前端特性
- **哥特式设计风格** - 深色主题，石材质感，营造庄严肃穆的氛围
- **PWA支持** - 可安装到手机主屏幕，支持离线访问
- **移动端优化** - 完美适配各种设备尺寸和交互方式
- **响应式设计** - 支持横屏、键盘弹出等各种使用场景
- **现代化交互** - 流畅的动画效果和用户体验

### 🔧 后端架构
- **RESTful API设计** - 标准化的API接口，支持前后端分离
- **完整数据模型** - 用户、告解、投票、评论四大核心业务模型
- **用户认证授权** - JWT认证、角色权限、账户安全机制
- **数据验证逻辑** - 输入验证、数据清理、防注入攻击
- **错误处理机制** - 全局错误处理、异步错误捕获
- **性能优化方案** - 数据库索引、查询优化、缓存策略
- **安全最佳实践** - 密码加密、速率限制、XSS防护

## 🎯 核心功能

1. **发布告解** - 用户可以发布最多2000字的告解内容，支持分类和标签
2. **投票系统** - 对每个告解进行"上天堂"或"下地狱"的投票判决
3. **评论互动** - 用户可以对告解发表评论，支持回复和点赞
4. **用户系统** - 完整的用户注册、登录、资料管理功能
5. **管理后台** - 管理员可以审核内容、管理用户、查看统计
6. **搜索筛选** - 支持按分类、标签、关键词搜索告解
7. **排行榜** - 用户声望排行、热门告解展示

## 🏗️ 技术架构

### 前端技术栈
- **基础技术**: HTML5, CSS3, JavaScript (ES6+)
- **样式方案**: CSS Grid, Flexbox, CSS Variables
- **字体方案**: Google Fonts (Cinzel, Noto Serif SC)
- **PWA技术**: Service Worker, Web App Manifest
- **数据存储**: localStorage (前端缓存)

### 后端技术栈
- **运行环境**: Node.js 16+
- **Web框架**: Express.js 4.18+
- **数据库**: MongoDB 5.0+
- **认证方案**: JWT (JSON Web Tokens)
- **数据验证**: express-validator + Joi
- **安全防护**: Helmet, CORS, Rate Limiting
- **密码加密**: bcryptjs
- **数据清理**: express-mongo-sanitize, xss

## 📁 项目结构

```
cyber-confessional/
├── 前端文件/
│   ├── index.html              # 主页面
│   ├── style.css               # 哥特式样式文件
│   ├── script.js               # 前端业务逻辑
│   ├── manifest.json           # PWA应用配置
│   ├── sw.js                   # Service Worker
│   └── ICONS.md               # 图标创建指南
├── 后端系统/
│   ├── models/                 # 数据模型层
│   │   ├── User.js            # 用户模型
│   │   ├── Confession.js      # 告解模型
│   │   ├── Vote.js            # 投票模型
│   │   └── Comment.js         # 评论模型
│   ├── routes/                 # API路由层
│   │   ├── auth.js            # 认证路由
│   │   ├── confessions.js     # 告解路由
│   │   ├── users.js           # 用户路由
│   │   └── admin.js           # 管理员路由
│   ├── middleware/             # 中间件层
│   │   ├── auth.js            # 认证中间件
│   │   ├── optionalAuth.js    # 可选认证中间件
│   │   ├── asyncHandler.js    # 异步错误处理
│   │   ├── errorHandler.js    # 全局错误处理
│   │   └── notFound.js        # 404处理
│   ├── scripts/                # 工具脚本
│   │   └── seed.js            # 数据库种子文件
│   ├── server.js               # 服务器入口文件
│   ├── package.json            # 后端项目配置
│   ├── .env.example            # 环境变量示例
│   └── README.md              # 后端详细文档
├── 部署配置/
│   ├── package.json            # 前端项目配置
│   ├── vercel.json             # Vercel部署配置
│   ├── netlify.toml            # Netlify部署配置
│   └── README.md              # 项目总文档
└── 文档说明/
    └── ICONS.md               # PWA图标制作指南
```

## 🚀 快速开始

### 环境要求
- Node.js 16.0+
- MongoDB 5.0+ (后端需要)
- 现代浏览器 (Chrome 60+, Firefox 55+, Safari 11+)

### 前端部署

#### 1. 本地预览
```bash
# 使用 Python
python -m http.server 8000

# 使用 Node.js
npx serve .

# 访问 http://localhost:8000
```

#### 2. 云端部署
```bash
# Vercel 部署
vercel --prod

# Netlify 部署
netlify deploy --prod --dir .

# GitHub Pages
# 直接推送到 GitHub 仓库并启用 Pages
```

### 后端部署

#### 1. 安装依赖
```bash
cd backend
npm install
```

#### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置数据库连接等信息
```

#### 3. 初始化数据库
```bash
npm run seed
```

#### 4. 启动服务器
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 📚 API文档

### 基础信息
- **Base URL**: `http://localhost:5000/api`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON

### 主要API端点

#### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/profile` - 更新用户资料
- `PUT /api/auth/password` - 修改密码

#### 告解相关
- `GET /api/confessions` - 获取告解列表
- `GET /api/confessions/:id` - 获取告解详情
- `POST /api/confessions` - 创建告解
- `POST /api/confessions/:id/vote` - 投票
- `GET /api/confessions/:id/comments` - 获取评论

#### 用户相关
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `GET /api/users/leaderboard` - 获取排行榜

#### 管理员相关
- `GET /api/admin/stats` - 系统统计
- `GET /api/admin/users` - 用户管理
- `PUT /api/admin/confessions/:id/moderate` - 审核告解

详细API文档请参考 `backend/README.md`

## 🎨 设计特色

### 哥特式视觉元素
- **配色方案**: 深色主题配金色点缀，营造神圣庄严感
- **字体选择**: Cinzel英文字体 + 思源宋体中文，体现宗教庄重感
- **图标设计**: 十字架✞、天使👼、恶魔👹等宗教符号
- **质感效果**: 石材纹理、阴影渐变、光晕效果

### 移动端适配
- **响应式布局**: 适配手机、平板、桌面各种屏幕
- **触摸优化**: 按钮尺寸、手势操作、滑动体验
- **性能优化**: 图片压缩、代码分割、懒加载
- **PWA功能**: 离线缓存、桌面安装、推送通知

## 🔒 安全特性

### 前端安全
- **输入验证**: 客户端数据验证和清理
- **XSS防护**: 内容转义和CSP策略
- **HTTPS强制**: 生产环境强制使用HTTPS

### 后端安全
- **认证授权**: JWT令牌 + 角色权限控制
- **数据加密**: bcrypt密码加密
- **注入防护**: SQL注入、NoSQL注入防护
- **速率限制**: API调用频率限制
- **安全头部**: Helmet安全头部设置

## 📊 数据模型

### 用户模型 (User)
- 基础信息: 用户名、邮箱、密码、头像
- 角色权限: user、moderator、admin
- 个人资料: 简介、地址、网站
- 统计数据: 告解数、投票数、评论数、声望值

### 告解模型 (Confession)
- 内容信息: 标题、正文、分类、标签
- 状态管理: 待审核、已通过、已拒绝、已隐藏
- 互动数据: 投票统计、评论数、浏览量
- 时间管理: 创建时间、过期时间

### 投票模型 (Vote)
- 投票关系: 用户ID、告解ID、投票类型
- 唯一约束: 每用户每告解只能投一票

### 评论模型 (Comment)
- 评论内容: 正文、作者、所属告解
- 层级结构: 支持回复评论
- 互动数据: 点赞数、踩数

## 🌐 部署方案

### 前端部署选项
1. **Vercel** - 推荐，自动CI/CD
2. **Netlify** - 静态站点托管
3. **GitHub Pages** - 免费托管
4. **CloudStudio** - 已成功部署 ✅
5. **自建服务器** - Nginx静态文件服务

### 后端部署选项
1. **Heroku** - 简单易用的PaaS平台
2. **Railway** - 现代化部署平台
3. **DigitalOcean** - VPS服务器部署
4. **AWS/阿里云** - 云服务器部署
5. **Docker** - 容器化部署

### 数据库选项
1. **MongoDB Atlas** - 云端MongoDB服务
2. **本地MongoDB** - 自建数据库
3. **Docker MongoDB** - 容器化数据库

## 🧪 测试账户

数据库种子文件提供以下测试账户：

**管理员账户**:
- 邮箱: `admin@cyber-confessional.com`
- 密码: `Admin123456`

**普通用户账户**:
- 邮箱: `user1@example.com`
- 密码: `User123456`

## 📱 在线预览

**前端演示**: http://e66d5a1861484dcd9d457aff22f1a891.ap-singapore.myide.io

*注: 当前部署仅包含前端界面，后端API需要单独部署MongoDB环境*

## 🔧 开发指南

### 前端开发
1. 修改 `style.css` 调整界面样式
2. 编辑 `script.js` 添加新功能
3. 更新 `manifest.json` 配置PWA设置

### 后端开发
1. 在 `models/` 目录添加新的数据模型
2. 在 `routes/` 目录创建新的API路由
3. 在 `middleware/` 目录添加中间件逻辑
4. 运行 `npm run seed` 重置测试数据

### 数据库管理
```bash
# 连接MongoDB
mongo cyber-confessional

# 查看集合
show collections

# 查询数据
db.users.find()
db.confessions.find()
```

## 🤝 贡献指南

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 技术支持

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**: 提交Bug报告或功能请求
- **邮件联系**: kanu1213@qq.com
- **技术文档**: 查看 `backend/README.md` 获取详细API文档

## 🎯 未来规划

### 短期目标
- [ ] 完善移动端交互体验
- [ ] 添加更多告解分类
- [ ] 实现实时通知功能
- [ ] 优化搜索算法

### 长期目标
- [ ] 多语言国际化支持
- [ ] AI智能内容审核
- [ ] 社交功能扩展
- [ ] 数据分析仪表板

---

**愿主宽恕众生的罪过** ✞

*赛博告解室 - 在数字时代寻找心灵的救赎*
