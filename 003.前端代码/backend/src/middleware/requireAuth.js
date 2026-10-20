import { getSessionUser, renewSession, setSessionCookie, SESSION_COOKIE } from '../utils/session.js';

// Cookie 会话鉴权：令牌哈希查 user_session，通过则挂 req.userId / req.userName
// 并做 30 天滑动续期；未登录/过期一律 401（PRD F1-7）
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    const session = await getSessionUser(token);
    if (session) {
      req.userId = session.id;
      req.userName = session.username;
      req.userRegisteredOn = session.registered_on; // 注册日期（YYYY-MM-DD 字符串，10 我的页展示）
      req.userJoinedDays = session.joined_days;     // 已加入天数（注册当天 = 1，SQL 时钟计算）
      await renewSession(session.token_hash);
      setSessionCookie(res, token); // Cookie 寿命一并滑动，避免「库内有效、Cookie 先过期」
      return next();
    }
    res.status(401).json({ message: '未登录或登录已过期' });
  } catch (err) {
    next(err);
  }
}
