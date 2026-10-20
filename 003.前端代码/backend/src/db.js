import mysql from 'mysql2/promise';
import config from './config.js';

// 全局连接池（utf8mb4：中文用户名、emoji 图标必需，与 004 建表脚本一致）
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
