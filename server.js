const express = require('express');
const path = require('path');
const db = require('./database.js');
const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體 (Middleware)
app.use(express.static('public')); // 讓 'public' 資料夾內的檔案可以被存取
app.use(express.json());           // 解析傳入的 JSON 請求

// --- API Endpoints ---

// (管理員) 儲存新的設定
app.post('/api/config', async (req, res) => {
    try {
        const { items, groups } = req.body;
        if (!items || !groups || items.length === 0 || groups.length === 0) {
            return res.status(400).send({ message: '項目和組別不能為空' });
        }
        await db.saveConfig(items, groups);
        res.status(200).send({ message: '設定已儲存' });
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
});

// (所有人) 取得目前的設定
app.get('/api/config', async (req, res) => {
    try {
        const config = await db.getConfig();
        res.status(200).json(config);
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
});

// (評分者) 提交分數
app.post('/api/score', async (req, res) => {
    try {
        const { scorerName, scores } = req.body;
        if (!scorerName || !scores) {
            return res.status(400).send({ message: '評分者名稱和分數為必填' });
        }
        await db.saveScores(scorerName, scores);
        res.status(200).send({ message: '分數已儲存' });
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
});

// (所有人) 取得計算後的結果
app.get('/api/results', async (req, res) => {
    try {
        const results = await db.getResults();
        res.status(200).json(results);
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
});

// 啟動伺服器
async function startServer() {
    await db.initDb(); // 確保資料庫已準備好
    app.listen(PORT, () => {
        console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
    });
}

startServer();