const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

// 決定資料庫檔案的路徑 (為了託管相容性)
const dbPath = process.env.RENDER ? '/var/data/db.sqlite' : 'db.sqlite';

let db;

// 初始化資料庫
async function initDb() {
    db = await sqlite.open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // 建立需要的表格 (如果它們不存在)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS config_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        );
        CREATE TABLE IF NOT EXISTS config_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        );
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scorer_name TEXT,
            group_name TEXT,
            item_name TEXT,
            score INTEGER
        );
    `);
    console.log('Database initialized.');
}

// 儲存設定 (會清除所有舊資料！)
async function saveConfig(items, groups) {
    await db.exec('DELETE FROM scores');
    await db.exec('DELETE FROM config_items');
    await db.exec('DELETE FROM config_groups');

    const itemStmt = await db.prepare('INSERT INTO config_items (name) VALUES (?)');
    for (const item of items) {
        await itemStmt.run(item);
    }
    await itemStmt.finalize();

    const groupStmt = await db.prepare('INSERT INTO config_groups (name) VALUES (?)');
    for (const group of groups) {
        await groupStmt.run(group);
    }
    await groupStmt.finalize();
}

// 取得設定
async function getConfig() {
    const items = await db.all('SELECT name FROM config_items');
    const groups = await db.all('SELECT name FROM config_groups');
    return {
        items: items.map(i => i.name),
        groups: groups.map(g => g.name)
    };
}

// 儲存評分 (一個評分者提交的所有分數)
async function saveScores(scorerName, scores) {
    // 先刪除這位評分者之前的所有分數，避免重複
    await db.run('DELETE FROM scores WHERE scorer_name = ?', scorerName);

    // 插入新分數
    const stmt = await db.prepare('INSERT INTO scores (scorer_name, group_name, item_name, score) VALUES (?, ?, ?, ?)');
    for (const groupName in scores) {
        for (const itemName in scores[groupName]) {
            await stmt.run(scorerName, groupName, itemName, scores[groupName][itemName]);
        }
    }
    await stmt.finalize();
}

// 取得並計算結果
async function getResults() {
    // 1. 取得每個項目的平均分
    const itemAvgs = await db.all(`
        SELECT group_name, item_name, AVG(score) as average
        FROM scores
        GROUP BY group_name, item_name
    `);

    // 2. 取得每個組別的總平均分
    const groupTotals = await db.all(`
        SELECT group_name, AVG(total_score) as group_average
        FROM (
            SELECT scorer_name, group_name, SUM(score) as total_score
            FROM scores
            GROUP BY scorer_name, group_name
        )
        GROUP BY group_name
        ORDER BY group_average DESC
    `);

    // 3. 取得已評分的人數
    const scorers = await db.all('SELECT DISTINCT scorer_name FROM scores');

    return {
        itemAvgs: itemAvgs,
        groupTotals: groupTotals,
        scorerCount: scorers.length
    };
}

// 匯出功能
module.exports = {
    initDb,
    saveConfig,
    getConfig,
    saveScores,
    getResults
};