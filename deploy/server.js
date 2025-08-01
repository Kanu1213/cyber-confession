const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5173;

// 提供静态文件
app.use(express.static(__dirname));

// 所有路由都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`赛博告解室服务器运行在端口 ${PORT}`);
});