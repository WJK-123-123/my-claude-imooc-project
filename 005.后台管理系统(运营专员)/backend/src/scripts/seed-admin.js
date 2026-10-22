import bcrypt from 'bcryptjs';
import pool from '../db.js';
import '../config.js'; // 触发 dotenv 加载 .env（ADMIN_USERNAME / ADMIN_PASSWORD）

// 预置超级管理员账号（后台 PRD A1-1）：从环境变量读账号密码，bcrypt 哈希后插入 admin_user。
// 账号已存在则跳过、不覆盖密码；改密码请直接删行或改库后重跑。
async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('请在 .env 中配置 ADMIN_USERNAME 与 ADMIN_PASSWORD 后再运行（npm run seed:admin）');
    process.exit(1);
  }
  if ([...username].length < 2 || [...username].length > 20) {
    console.error('管理员用户名需 2–20 个字符');
    process.exit(1);
  }
  if ([...password].length < 6 || [...password].length > 20) {
    console.error('管理员密码需 6–20 位');
    process.exit(1);
  }

  const [rows] = await pool.query('SELECT id FROM admin_user WHERE username = ?', [username]);
  if (rows.length > 0) {
    console.log(`超级管理员「${username}」已存在，跳过（不覆盖密码）`);
    await pool.end();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO admin_user (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
  console.log(`超级管理员「${username}」创建成功`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('预置超级管理员失败：', err);
  process.exit(1);
});
