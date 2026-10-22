import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';
import { createAdminSession, deleteAdminSession, clearAdminSessionCookie, ADMIN_SESSION_COOKIE } from '../utils/session.js';

// 超级管理员登录/登出（后台 PRD A1）。
// 账号独立存于 admin_user 表，与用户端 user 表完全隔离、互不通行。
const router = Router();

// 固定哑哈希：账号不存在时也做一次同代价比较，均化响应时间防探测
const DUMMY_HASH = bcrypt.hashSync('financial-steward-admin-dummy', 10);
const LOCK_THRESHOLD = 5; // 连续密码错误 ≥ 5 次锁定（沿用用户端 F1-3）
const LOCK_MINUTES = 10;

function fail(res, status, message) {
  return res.status(status).json({ message });
}

/* ================= 登录（后台 PRD A1-3） ================= */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    // 锁定状态一律用 SQL 时钟判断，避免应用与数据库跨时钟误判
    const [rows] = await pool.query(
      `SELECT id, username, password_hash, failed_login_count,
              (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked,
              TIMESTAMPDIFF(MINUTE, NOW(), locked_until) AS lock_minutes_left
         FROM admin_user
        WHERE username = ?`,
      [username]
    );
    const admin = rows[0];

    // 账号不存在：统一提示，不泄露账号存在性
    if (!admin) {
      await bcrypt.compare(String(password ?? ''), DUMMY_HASH);
      return fail(res, 401, '用户名或密码错误');
    }

    // 锁定期内即使密码正确也拒绝
    if (admin.is_locked) {
      const minutes = Math.max(1, admin.lock_minutes_left);
      return fail(res, 401, `失败次数过多，账号已锁定，请约 ${minutes} 分钟后再试`);
    }

    const ok = await bcrypt.compare(String(password ?? ''), admin.password_hash);
    if (!ok) {
      // 连续错误计数；达到阈值锁定 10 分钟并清零计数
      const count = admin.failed_login_count + 1;
      if (count >= LOCK_THRESHOLD) {
        await pool.query(
          'UPDATE admin_user SET failed_login_count = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [LOCK_MINUTES, admin.id]
        );
      } else {
        await pool.query('UPDATE admin_user SET failed_login_count = ? WHERE id = ?', [count, admin.id]);
      }
      return fail(res, 401, '用户名或密码错误');
    }

    // 成功：清零计数、解除锁定、记录最近登录，再写会话（单行 token_hash 覆盖旧会话）
    await pool.query(
      'UPDATE admin_user SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
      [admin.id]
    );
    await createAdminSession(res, admin.id);
    res.json({ admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    next(err);
  }
});

/* ================= 登出（后台 PRD A1-6） ================= */
router.post('/logout', async (req, res, next) => {
  try {
    await deleteAdminSession(req.cookies?.[ADMIN_SESSION_COOKIE]);
    clearAdminSessionCookie(res);
    res.json({ message: '已退出登录' });
  } catch (err) {
    next(err);
  }
});

/* ================= 当前超级管理员（客户端守卫/首页展示用） ================= */
router.get('/me', requireAdminAuth, (req, res) => {
  res.json({ id: req.adminId, username: req.adminUsername });
});

export default router;
