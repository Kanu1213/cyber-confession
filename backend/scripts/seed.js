const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 导入模型
const User = require('../models/User');
const Confession = require('../models/Confession');
const Vote = require('../models/Vote');
const Comment = require('../models/Comment');

// 连接数据库
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyber-confessional', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB 连接成功');
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        process.exit(1);
    }
};

// 清空数据库
const clearDatabase = async () => {
    try {
        await Promise.all([
            User.deleteMany({}),
            Confession.deleteMany({}),
            Vote.deleteMany({}),
            Comment.deleteMany({})
        ]);
        console.log('数据库已清空');
    } catch (error) {
        console.error('清空数据库失败:', error);
    }
};

// 创建示例用户
const createUsers = async () => {
    try {
        const users = [
            {
                username: 'admin',
                email: 'admin@cyber-confessional.com',
                password: 'Admin123456',
                role: 'admin',
                profile: {
                    bio: '系统管理员',
                    location: '天堂'
                },
                stats: {
                    reputation: 1000,
                    confessionsCount: 0,
                    votesCount: 0,
                    commentsCount: 0
                },
                emailVerified: true
            },
            {
                username: '忏悔者001',
                email: 'user1@example.com',
                password: 'User123456',
                role: 'user',
                profile: {
                    bio: '寻求救赎的灵魂',
                    location: '人间'
                },
                stats: {
                    reputation: 150,
                    confessionsCount: 3,
                    votesCount: 15,
                    commentsCount: 8
                },
                emailVerified: true
            },
            {
                username: '审判天使',
                email: 'moderator@example.com',
                password: 'Mod123456',
                role: 'moderator',
                profile: {
                    bio: '负责审判众生罪过的天使',
                    location: '天堂之门'
                },
                stats: {
                    reputation: 500,
                    confessionsCount: 1,
                    votesCount: 50,
                    commentsCount: 25
                },
                emailVerified: true
            },
            {
                username: '迷途羔羊',
                email: 'user2@example.com',
                password: 'User123456',
                role: 'user',
                profile: {
                    bio: '在黑暗中寻找光明',
                    location: '迷雾森林'
                },
                stats: {
                    reputation: 80,
                    confessionsCount: 2,
                    votesCount: 8,
                    commentsCount: 5
                },
                emailVerified: true
            },
            {
                username: '赎罪之路',
                email: 'user3@example.com',
                password: 'User123456',
                role: 'user',
                profile: {
                    bio: '走在赎罪路上的旅人',
                    location: '炼狱'
                },
                stats: {
                    reputation: 120,
                    confessionsCount: 4,
                    votesCount: 20,
                    commentsCount: 12
                },
                emailVerified: true
            }
        ];

        const createdUsers = await User.create(users);
        console.log(`创建了 ${createdUsers.length} 个用户`);
        return createdUsers;
    } catch (error) {
        console.error('创建用户失败:', error);
        return [];
    }
};

// 创建示例告解
const createConfessions = async (users) => {
    try {
        const confessions = [
            {
                title: '工作中的谎言',
                content: '我今天对同事撒了谎，说自己生病了，其实只是想在家休息。我感到很愧疚，不知道该如何面对明天的工作。主啊，请宽恕我的软弱。',
                author: users[1]._id,
                isAnonymous: false,
                category: 'work',
                tags: ['工作', '谎言', '愧疚'],
                status: 'approved',
                votes: { heaven: 15, hell: 3 },
                commentsCount: 5,
                viewsCount: 120,
                featured: true,
                featuredAt: new Date()
            },
            {
                content: '我偷偷看了室友的日记，发现了一些不该知道的秘密。现在我不知道该如何面对她，内心充满了罪恶感。我知道这是错误的，但好奇心战胜了理智。',
                author: users[3]._id,
                isAnonymous: true,
                category: 'personal',
                tags: ['隐私', '好奇心', '罪恶感'],
                status: 'approved',
                votes: { heaven: 8, hell: 22 },
                commentsCount: 8,
                viewsCount: 200
            },
            {
                title: '对父母的不孝',
                content: '昨天和父母吵架了，说了很多伤人的话。现在冷静下来，我意识到自己的错误。他们为我付出了这么多，我却如此不懂感恩。我想道歉，但不知道如何开口。',
                author: users[4]._id,
                isAnonymous: false,
                category: 'family',
                tags: ['家庭', '孝顺', '道歉'],
                status: 'approved',
                votes: { heaven: 25, hell: 5 },
                commentsCount: 12,
                viewsCount: 300
            },
            {
                content: '我在考试中作弊了，虽然没有被发现，但内心一直不安。这个成绩不属于我，我欺骗了老师、同学，也欺骗了自己。我应该承认错误吗？',
                author: null,
                isAnonymous: true,
                category: 'moral',
                tags: ['诚信', '考试', '道德'],
                status: 'approved',
                votes: { heaven: 12, hell: 18 },
                commentsCount: 6,
                viewsCount: 150
            },
            {
                title: '背叛朋友的信任',
                content: '我把朋友告诉我的秘密说给了别人，现在她知道了，我们的友谊可能就此结束。我为什么要这样做？是嫉妒还是恶意？我真的很后悔。',
                author: users[1]._id,
                isAnonymous: false,
                category: 'relationship',
                tags: ['友谊', '背叛', '秘密'],
                status: 'approved',
                votes: { heaven: 6, hell: 28 },
                commentsCount: 10,
                viewsCount: 180
            },
            {
                content: '我在网上传播了一些不实信息，现在意识到这可能伤害了无辜的人。网络的匿名性让我失去了理智，我应该为自己的行为负责。',
                author: users[4]._id,
                isAnonymous: true,
                category: 'other',
                tags: ['网络', '谣言', '责任'],
                status: 'approved',
                votes: { heaven: 10, hell: 15 },
                commentsCount: 4,
                viewsCount: 90
            }
        ];

        const createdConfessions = await Confession.create(confessions);
        console.log(`创建了 ${createdConfessions.length} 个告解`);
        return createdConfessions;
    } catch (error) {
        console.error('创建告解失败:', error);
        return [];
    }
};

// 创建示例投票
const createVotes = async (users, confessions) => {
    try {
        const votes = [];
        
        // 为每个告解创建一些随机投票
        for (const confession of confessions) {
            const heavenVoters = users.slice(0, confession.votes.heaven);
            const hellVoters = users.slice(0, confession.votes.hell);
            
            // 天堂投票
            for (let i = 0; i < Math.min(heavenVoters.length, confession.votes.heaven); i++) {
                if (heavenVoters[i] && heavenVoters[i]._id.toString() !== confession.author?.toString()) {
                    votes.push({
                        user: heavenVoters[i]._id,
                        confession: confession._id,
                        type: 'heaven'
                    });
                }
            }
            
            // 地狱投票
            for (let i = 0; i < Math.min(hellVoters.length, confession.votes.hell); i++) {
                if (hellVoters[i] && hellVoters[i]._id.toString() !== confession.author?.toString()) {
                    votes.push({
                        user: hellVoters[i]._id,
                        confession: confession._id,
                        type: 'hell'
                    });
                }
            }
        }

        const createdVotes = await Vote.create(votes);
        console.log(`创建了 ${createdVotes.length} 个投票`);
        return createdVotes;
    } catch (error) {
        console.error('创建投票失败:', error);
        return [];
    }
};

// 创建示例评论
const createComments = async (users, confessions) => {
    try {
        const comments = [
            {
                content: '每个人都需要休息，但诚实更重要。下次直接请假吧，相信同事们会理解的。',
                author: users[2]._id,
                confession: confessions[0]._id,
                status: 'approved',
                likes: 8,
                dislikes: 1
            },
            {
                content: '理解你的感受，工作压力大的时候确实需要喘息。但建议以后用更诚实的方式处理。',
                author: users[4]._id,
                confession: confessions[0]._id,
                status: 'approved',
                likes: 5,
                dislikes: 0
            },
            {
                content: '侵犯他人隐私确实不对，但知错能改善莫大焉。建议你主动道歉，承担责任。',
                author: users[2]._id,
                confession: confessions[1]._id,
                status: 'approved',
                likes: 12,
                dislikes: 2
            },
            {
                content: '好奇心是人之常情，但要学会控制。真正的友谊需要建立在尊重的基础上。',
                author: users[1]._id,
                confession: confessions[1]._id,
                status: 'approved',
                likes: 6,
                dislikes: 1
            },
            {
                content: '父母的爱是无条件的，他们会原谅你的。勇敢地道歉吧，这是成长的一部分。',
                author: users[3]._id,
                confession: confessions[2]._id,
                status: 'approved',
                likes: 15,
                dislikes: 0
            },
            {
                content: '诚信是做人的根本。虽然承认错误需要勇气，但这是正确的选择。',
                author: users[2]._id,
                confession: confessions[3]._id,
                status: 'approved',
                likes: 10,
                dislikes: 3
            },
            {
                content: '背叛朋友的信任是很严重的事情。真诚的道歉和时间或许能修复这段友谊。',
                author: users[4]._id,
                confession: confessions[4]._id,
                status: 'approved',
                likes: 8,
                dislikes: 2
            },
            {
                content: '网络言论也需要负责任。建议你主动澄清，减少不实信息的传播。',
                author: users[1]._id,
                confession: confessions[5]._id,
                status: 'approved',
                likes: 7,
                dislikes: 1
            }
        ];

        const createdComments = await Comment.create(comments);
        console.log(`创建了 ${createdComments.length} 个评论`);
        return createdComments;
    } catch (error) {
        console.error('创建评论失败:', error);
        return [];
    }
};

// 主函数
const seedDatabase = async () => {
    try {
        console.log('开始初始化数据库...');
        
        await connectDB();
        await clearDatabase();
        
        const users = await createUsers();
        const confessions = await createConfessions(users);
        const votes = await createVotes(users, confessions);
        const comments = await createComments(users, confessions);
        
        console.log('数据库初始化完成！');
        console.log('='.repeat(50));
        console.log('测试账户信息：');
        console.log('管理员账户：');
        console.log('  邮箱: admin@cyber-confessional.com');
        console.log('  密码: Admin123456');
        console.log('');
        console.log('普通用户账户：');
        console.log('  邮箱: user1@example.com');
        console.log('  密码: User123456');
        console.log('='.repeat(50));
        
        process.exit(0);
    } catch (error) {
        console.error('数据库初始化失败:', error);
        process.exit(1);
    }
};

// 运行种子脚本
if (require.main === module) {
    seedDatabase();
}

module.exports = {
    seedDatabase,
    createUsers,
    createConfessions,
    createVotes,
    createComments
};