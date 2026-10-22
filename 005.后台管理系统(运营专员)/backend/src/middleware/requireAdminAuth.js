import { getAdminByToken, renewAdminSession, setAdminSessionCookie, ADMIN_SESSION_COOKIE } from '../utils/session.js';

// 超级管理员会话鉴权：按 Cookie 令牌查 admin_user 表，通过则挂 req.adminId / req.adminUsername
// 并做 30 天滑动续期；未登录/过期一律 401（后台 PRD A1）
export async function requireAdminAuth(req, res, next) {
  try {
    const token = req.cookies?.[ADMIN_SESSION_COOKIE];
    const admin = await getAdminByToken(token);
    if (admin) {
      req.adminId = admin.id;
      req.adminUsername = admin.username;
      await renewAdminSession(admin.token_hash);
      setAdminSessionCookie(res, token); // Cookie 寿命一并滑动
      return next();
    }
    res.status(401).json({ message: '未登录或登录已过期' });
  } catch (err) {
    next(err);
  }
}
