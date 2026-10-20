import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { validateUsername, validatePassword } from '../utils/validate.js';
import { createSession, deleteSession, clearSessionCookie, SESSION_COOKIE } from '../utils/session.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// 固定哑哈希：用户名不存在时也做一次同代价比较，均化响应时间防撞库探测
const DUMMY_HASH = bcrypt.hashSync('financial-steward-dummy', 10);
const LOCK_THRESHOLD = 5; // 连续密码错误 ≥ 5 次锁定（PRD F1-3）
const LOCK_MINUTES = 10;

function fail(res, status, message) {
  return res.status(status).json({ message });
}

/* ================= 注册（PRD F1-4） ================= */
router.post('/register', async (req, res, next) => {
  let conn;
  try {
    const { username, password, confirmPassword } = req.body || {};
    const invalid = validateUsername(username) || validatePassword(password);
    if (invalid) return fail(res, 400, invalid);
    if (password !== confirmPassword) return fail(res, 400, '两次输入的密码不一致');

    // 预查友好提示；列排序规则 utf8mb4_0900_ai_ci 天然不区分大小写（F1-1）
    const [dup] = await pool.query('SELECT id FROM user WHERE username = ?', [username]);
    if (dup.length > 0) return fail(res, 409, '用户名已被占用');

    const passwordHash = await bcrypt.hash(password, 10);

    // 建号 + 按模板初始化分类/账户，同一事务保证「要么全套、要么没有」
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO user (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );
    const userId = result.insertId;
    await conn.query(
      `INSERT INTO category (user_id, scope, name, icon, sort, is_system)
       SELECT ?, scope, name, icon, sort, 1 FROM category_template`,
      [userId]
    );
    await conn.query(
      `INSERT INTO account (user_id, name, emoji, remark, sort)
       SELECT ?, name, emoji, remark, sort FROM account_template`,
      [userId]
    );
    await conn.commit();

    await createSession(res, userId); // 注册成功即自动登录（F1-4）
    res.json({ user: { id: userId, username } });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* 连接已断开，忽略 */ }
      conn.release();
    }
    // 并发注册同名由唯一索引兜底，同样按「用户名已被占用」提示
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, '用户名已被占用');
    next(err);
  }
});

/* ================= 登录（PRD F1-3） ================= */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    // 锁定状态一律用 SQL 时钟判断，避免应用与数据库跨时区/跨时钟误判
    const [rows] = await pool.query(
      `SELECT id, username, password_hash, status, failed_login_count,
              (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked,
              TIMESTAMPDIFF(MINUTE, NOW(), locked_until) AS lock_minutes_left
         FROM user
        WHERE username = ?`,
      [username]
    );
    const user = rows[0];

    // 不存在 / 已注销墓碑：统一提示，不泄露用户名存在性（F1-3）
    if (!user || user.status === 'deleted') {
      await bcrypt.compare(String(password ?? ''), DUMMY_HASH);
      return fail(res, 401, '用户名或密码错误');
    }

    // 锁定期内即使密码正确也拒绝（验收 5）
    if (user.is_locked) {
      const minutes = Math.max(1, user.lock_minutes_left);
      return fail(res, 401, `失败次数过多，账号已锁定，请约 ${minutes} 分钟后再试`);
    }

    if (user.status === 'deleting') {
      // TODO(F1-9)：冷静期内登录应可撤销注销，待注销功能实现时补充
      return fail(res, 403, '账号正在注销冷静期，暂无法登录');
    }

    const ok = await bcrypt.compare(String(password ?? ''), user.password_hash);
    if (!ok) {
      // 连续错误计数；达到阈值锁定 10 分钟并清零计数（下个周期重新累计 5 次）
      const count = user.failed_login_count + 1;
      if (count >= LOCK_THRESHOLD) {
        await pool.query(
          'UPDATE user SET failed_login_count = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [LOCK_MINUTES, user.id]
        );
      } else {
        await pool.query('UPDATE user SET failed_login_count = ? WHERE id = ?', [count, user.id]);
      }
      return fail(res, 401, '用户名或密码错误');
    }

    // 成功：清零计数、解除锁定、记录最近登录，再建会话
    await pool.query(
      'UPDATE user SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
      [user.id]
    );
    await createSession(res, user.id);
    res.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    next(err);
  }
});

/* ================= 登出（PRD F1-8） ================= */
router.post('/logout', async (req, res, next) => {
  try {
    await deleteSession(req.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.json({ message: '已退出登录' });
  } catch (err) {
    next(err);
  }
});

/* ================= 当前用户（为后续页面登录守卫铺路） ================= */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.userId,
    username: req.userName,
    registeredAt: req.userRegisteredOn,
    joinedDays: req.userJoinedDays,
  });
});

export default router;
