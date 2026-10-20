import crypto from 'node:crypto';
import pool from '../db.js';

// 会话方案沿用 004 数据库设计：随机令牌明文只存用户 Cookie（httpOnly），
// 库中只存其 SHA-256 哈希，泄库不等于泄登录态；30 天滑动续期（PRD F1-7）
export const SESSION_COOKIE = 'fgj_session';
const SESSION_DAYS = 30;

export function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// 按令牌查有效会话所属用户（联表确认仍为 active）；无效返回 null。
// API 鉴权（401）与页面守卫（302 登录页）共用这一份判定
export async function getSessionUser(token) {
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT s.user_id AS id, u.username, s.token_hash,
              DATE_FORMAT(u.created_at, '%Y-%m-%d') AS registered_on,
              DATEDIFF(NOW(), u.created_at) + 1 AS joined_days
       FROM user_session s
       JOIN user u ON u.id = s.user_id AND u.status = 'active'
      WHERE s.token_hash = ? AND s.expires_at > NOW()`,
    [sha256(token)]
  );
  return rows[0] || null;
}

// 登录/注册成功后创建会话并写 Cookie
export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO user_session (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [userId, sha256(token), SESSION_DAYS]
  );
  setSessionCookie(res, token);
  return token;
}

// 滑动续期：每次鉴权通过后把过期时间推到 30 天后
export async function renewSession(tokenHash) {
  await pool.query(
    'UPDATE user_session SET expires_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE token_hash = ?',
    [SESSION_DAYS, tokenHash]
  );
}

// 登出：删除会话行（云端数据不受影响，PRD F1-8）
export async function deleteSession(token) {
  if (!token) return;
  await pool.query('DELETE FROM user_session WHERE token_hash = ?', [sha256(token)]);
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // JS 不可读，防 XSS 窃取令牌
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    // 正式环境启用 HTTPS 后应补 secure: true（PRD §5 全站 HTTPS）
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
