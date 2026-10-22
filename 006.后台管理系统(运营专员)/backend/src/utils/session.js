import crypto from 'node:crypto';
import pool from '../db.js';

// 超级管理员会话方案（后台 PRD A1）：账号与会话合一，落在 admin_user 单表。
// 登录令牌明文只存 Cookie（httpOnly），库中 admin_user.token_hash 只存其 SHA-256 哈希；
// 每账号同一时间仅保留一个有效会话（后登录覆盖先登录），30 天滑动续期。
export const ADMIN_SESSION_COOKIE = 'fgj_admin_session';
const SESSION_DAYS = 30;

export function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// 按令牌查有效超级管理员（token_hash 匹配且未过期）；无效返回 null。
// 与用户端 fgj_session 完全隔离：只查 admin_user 表，不碰 user 表
export async function getAdminByToken(token) {
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT id, username, token_hash
       FROM admin_user
      WHERE token_hash = ? AND token_expires_at > NOW()`,
    [sha256(token)]
  );
  return rows[0] || null;
}

// 登录成功后：把令牌哈希 + 过期时间写进该 admin_user 行，并下发 Cookie
export async function createAdminSession(res, adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'UPDATE admin_user SET token_hash = ?, token_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?',
    [sha256(token), SESSION_DAYS, adminId]
  );
  setAdminSessionCookie(res, token);
  return token;
}

// 滑动续期：每次鉴权通过后把过期时间推到 30 天后
export async function renewAdminSession(tokenHash) {
  await pool.query(
    'UPDATE admin_user SET token_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE token_hash = ?',
    [SESSION_DAYS, tokenHash]
  );
}

// 登出：清空该行的会话字段（云端账号不受影响）
export async function deleteAdminSession(token) {
  if (!token) return;
  await pool.query(
    'UPDATE admin_user SET token_hash = NULL, token_expires_at = NULL WHERE token_hash = ?',
    [sha256(token)]
  );
}

export function setAdminSessionCookie(res, token) {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true, // JS 不可读，防 XSS 窃取令牌
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    // 正式环境启用 HTTPS 后应补 secure: true（PRD §5 全站 HTTPS）
  });
}

export function clearAdminSessionCookie(res) {
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
}
