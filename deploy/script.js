class CyberConfessional {
    constructor() {
        this.confessions = JSON.parse(localStorage.getItem('confessions')) || [];
        this.deferredPrompt = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderConfessions();
        this.updateCharCount();
        this.initPWA();
        this.initMobileOptimizations();
    }

    bindEvents() {
        const submitBtn = document.getElementById('submitBtn');
        const confessionText = document.getElementById('confessionText');
        const modal = document.getElementById('modal');
        const closeModal = document.querySelector('.close');

        submitBtn.addEventListener('click', () => this.submitConfession());
        confessionText.addEventListener('input', () => this.updateCharCount());
        confessionText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.submitConfession();
            }
        });

        closeModal.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // PWA 安装事件
        const installBtn = document.getElementById('installBtn');
        const dismissBtn = document.getElementById('dismissBtn');
        
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installPWA());
        }
        
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismissInstall());
        }
    }

    initPWA() {
        // 检查是否已经被拒绝安装
        const installDismissed = localStorage.getItem('installDismissed');
        const now = Date.now();
        if (installDismissed && (now - parseInt(installDismissed)) < 24 * 60 * 60 * 1000) {
            return; // 24小时内不显示
        }

        // 监听 PWA 安装提示事件
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // 延迟显示安装提示，给用户一些使用时间
            setTimeout(() => {
                this.showInstallPrompt();
            }, 30000); // 30秒后显示
        });

        // 监听 PWA 安装完成事件
        window.addEventListener('appinstalled', () => {
            console.log('PWA 安装成功');
            this.hideInstallPrompt();
            this.showModal('安装成功', '赛博告解室已添加到您的主屏幕 📱');
        });
    }

    initMobileOptimizations() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // 移动端键盘适配
        if (window.innerHeight < window.innerWidth && window.innerHeight < 500) {
            document.body.classList.add('landscape-mode');
        }

        window.addEventListener('resize', () => {
            if (window.innerHeight < window.innerWidth && window.innerHeight < 500) {
                document.body.classList.add('landscape-mode');
            } else {
                document.body.classList.remove('landscape-mode');
            }
        });

        // 触摸反馈
        this.addTouchFeedback();
    }

    addTouchFeedback() {
        // 延迟执行，确保DOM已加载
        setTimeout(() => {
            const touchElements = document.querySelectorAll('.submit-btn, .vote-btn, .comment-btn, .install-btn-yes, .install-btn-no');
            
            touchElements.forEach(element => {
                element.addEventListener('touchstart', () => {
                    element.style.transform = 'scale(0.98)';
                });
                
                element.addEventListener('touchend', () => {
                    setTimeout(() => {
                        element.style.transform = '';
                    }, 100);
                });
            });
        }, 100);
    }

    showInstallPrompt() {
        const installPrompt = document.getElementById('installPrompt');
        if (installPrompt && this.deferredPrompt) {
            installPrompt.style.display = 'block';
            setTimeout(() => {
                installPrompt.classList.add('show');
            }, 100);
        }
    }

    hideInstallPrompt() {
        const installPrompt = document.getElementById('installPrompt');
        if (installPrompt) {
            installPrompt.classList.remove('show');
            setTimeout(() => {
                installPrompt.style.display = 'none';
            }, 300);
        }
    }

    async installPWA() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('用户接受了安装');
        } else {
            console.log('用户拒绝了安装');
        }
        
        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    dismissInstall() {
        this.hideInstallPrompt();
        // 24小时内不再显示
        localStorage.setItem('installDismissed', Date.now().toString());
    }

    updateCharCount() {
        const confessionText = document.getElementById('confessionText');
        const charCount = document.querySelector('.char-count');
        const currentLength = confessionText.value.length;
        charCount.textContent = `${currentLength}/500`;
        
        if (currentLength > 450) {
            charCount.style.color = 'var(--hell-crimson)';
        } else {
            charCount.style.color = 'var(--text-dim)';
        }
    }

    submitConfession() {
        const confessionText = document.getElementById('confessionText');
        const text = confessionText.value.trim();

        if (!text) {
            this.showModal('请输入告解内容', '空的心灵无法得到救赎');
            return;
        }

        if (text.length > 500) {
            this.showModal('告解内容过长', '请将内容控制在500字以内');
            return;
        }

        const confession = {
            id: Date.now(),
            text: text,
            timestamp: new Date().toLocaleString('zh-CN'),
            heavenVotes: 0,
            hellVotes: 0,
            comments: [],
            userVote: null
        };

        this.confessions.unshift(confession);
        this.saveConfessions();
        this.renderConfessions();
        
        confessionText.value = '';
        this.updateCharCount();
        
        this.showModal('告解已提交', '愿主宽恕你的罪过 🙏');
    }

    renderConfessions() {
        const container = document.getElementById('confessionsList');
        
        if (this.confessions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-light); padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">✞</div>
                    <p style="font-size: 1.2rem;">暂无告解内容</p>
                    <p style="margin-top: 10px; opacity: 0.7;">成为第一个向主忏悔的人</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.confessions.map(confession => 
            this.renderConfessionItem(confession)
        ).join('');

        // 绑定投票和评论事件
        this.bindConfessionEvents();
    }

    renderConfessionItem(confession) {
        const totalVotes = confession.heavenVotes + confession.hellVotes;
        const heavenPercentage = totalVotes > 0 ? (confession.heavenVotes / totalVotes * 100).toFixed(1) : 0;
        const hellPercentage = totalVotes > 0 ? (confession.hellVotes / totalVotes * 100).toFixed(1) : 0;

        return `
            <div class="confession-item" data-id="${confession.id}">
                <div class="confession-header">
                    <div class="confession-text">${this.escapeHtml(confession.text)}</div>
                    <div class="confession-meta">
                        <span>📅 ${confession.timestamp}</span>
                        <span>💬 ${confession.comments.length} 条评论</span>
                    </div>
                </div>
                
                <div class="confession-actions">
                    <button class="vote-btn heaven ${confession.userVote === 'heaven' ? 'voted' : ''}" 
                            data-id="${confession.id}" data-type="heaven">
                        <span>👼</span>
                        <span>上天堂</span>
                        <span class="vote-count">${confession.heavenVotes}</span>
                        ${totalVotes > 0 ? `<span style="font-size: 0.8rem; margin-left: 5px;">(${heavenPercentage}%)</span>` : ''}
                    </button>
                    <button class="vote-btn hell ${confession.userVote === 'hell' ? 'voted' : ''}" 
                            data-id="${confession.id}" data-type="hell">
                        <span>👹</span>
                        <span>下地狱</span>
                        <span class="vote-count">${confession.hellVotes}</span>
                        ${totalVotes > 0 ? `<span style="font-size: 0.8rem; margin-left: 5px;">(${hellPercentage}%)</span>` : ''}
                    </button>
                </div>

                <div class="comments-section">
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="发表你的看法..." maxlength="200">
                        <button class="comment-btn" data-id="${confession.id}">评论</button>
                    </div>
                    <div class="comments-list">
                        ${confession.comments.map(comment => `
                            <div class="comment-item">
                                <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                                <div class="comment-time">${comment.timestamp}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    bindConfessionEvents() {
        // 投票事件
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const type = e.currentTarget.dataset.type;
                this.vote(id, type);
            });
        });

        // 评论事件
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const input = e.currentTarget.previousElementSibling;
                this.addComment(id, input.value.trim());
                input.value = '';
            });
        });

        // 评论输入框回车事件
        document.querySelectorAll('.comment-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const btn = e.target.nextElementSibling;
                    btn.click();
                }
            });
        });

        // 重新添加触摸反馈
        this.addTouchFeedback();
    }

    vote(confessionId, voteType) {
        const confession = this.confessions.find(c => c.id === confessionId);
        if (!confession) return;

        // 检查是否已经投过票
        if (confession.userVote === voteType) {
            this.showModal('已投票', '你已经对此告解投过票了');
            return;
        }

        // 如果之前投过其他票，先撤销
        if (confession.userVote) {
            if (confession.userVote === 'heaven') {
                confession.heavenVotes--;
            } else {
                confession.hellVotes--;
            }
        }

        // 投新票
        confession.userVote = voteType;
        if (voteType === 'heaven') {
            confession.heavenVotes++;
        } else {
            confession.hellVotes++;
        }

        this.saveConfessions();
        this.renderConfessions();

        // 显示投票结果
        const voteText = voteType === 'heaven' ? '上天堂 👼' : '下地狱 👹';
        this.showModal('投票成功', `你选择了：${voteText}`);
    }

    addComment(confessionId, commentText) {
        if (!commentText) {
            this.showModal('评论不能为空', '请输入你的看法');
            return;
        }

        if (commentText.length > 200) {
            this.showModal('评论过长', '请将评论控制在200字以内');
            return;
        }

        const confession = this.confessions.find(c => c.id === confessionId);
        if (!confession) return;

        const comment = {
            id: Date.now(),
            text: commentText,
            timestamp: new Date().toLocaleString('zh-CN')
        };

        confession.comments.push(comment);
        this.saveConfessions();
        this.renderConfessions();
    }

    showModal(title, message) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h3 style="color: var(--text-gold); margin-bottom: 15px; font-family: 'Cinzel', serif;">${title}</h3>
            <p style="color: var(--text-light); line-height: 1.6;">${message}</p>
        `;
        
        modal.style.display = 'block';
        
        // 3秒后自动关闭
        setTimeout(() => {
            this.closeModal();
        }, 3000);
    }

    closeModal() {
        const modal = document.getElementById('modal');
        modal.style.display = 'none';
    }

    saveConfessions() {
        localStorage.setItem('confessions', JSON.stringify(this.confessions));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new CyberConfessional();
});

// 添加一些示例数据（仅在首次访问时）
if (!localStorage.getItem('confessions')) {
    const sampleConfessions = [
        {
            id: 1,
            text: "我今天对同事撒了谎，说自己生病了，其实只是想在家休息。我感到很愧疚，不知道该如何面对明天的工作。",
            timestamp: new Date(Date.now() - 86400000).toLocaleString('zh-CN'),
            heavenVotes: 12,
            hellVotes: 3,
            comments: [
                {
                    id: 1,
                    text: "每个人都需要休息，但诚实更重要。下次直接请假吧。",
                    timestamp: new Date(Date.now() - 82800000).toLocaleString('zh-CN')
                },
                {
                    id: 2,
                    text: "理解你的感受，工作压力大的时候确实需要喘息。",
                    timestamp: new Date(Date.now() - 79200000).toLocaleString('zh-CN')
                }
            ],
            userVote: null
        },
        {
            id: 2,
            text: "我偷偷看了室友的日记，发现了一些不该知道的秘密。现在我不知道该如何面对她，内心充满了罪恶感。",
            timestamp: new Date(Date.now() - 172800000).toLocaleString('zh-CN'),
            heavenVotes: 5,
            hellVotes: 18,
            comments: [
                {
                    id: 3,
                    text: "侵犯他人隐私确实不对，但知错能改善莫大焉。",
                    timestamp: new Date(Date.now() - 169200000).toLocaleString('zh-CN')
                }
            ],
            userVote: null
        }
    ];
    
    localStorage.setItem('confessions', JSON.stringify(sampleConfessions));
}