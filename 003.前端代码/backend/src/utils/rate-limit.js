// 每 IP 简单固定窗口限流（内存版，单实例部署够用）。
// 用途：给找回密码等无认证的敏感接口加最低限度的防刷（配合图形验证码）。
// 部署提示：挂 nginx 反向代理后所有请求 IP 都是代理地址，须在 server.js 设
// app.set('trust proxy', 1) 才能按真实客户端 IP 限流；未挂反代时切勿开启（X-Forwarded-For 可伪造）。
export function rateLimit({ windowMs, max, message = '尝试过于频繁，请稍后再试' }) {
  const hits = new Map(); // ip -> { windowStart, count }

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ message });
    }
    // 惰性清理：条目过多时先清过期窗口，防 Map 无界增长
    if (hits.size > 10000) {
      for (const [key, e] of hits) {
        if (hits.size <= 10000) break;
        if (now - e.windowStart >= windowMs) hits.delete(key);
      }
    }
    next();
  };
}
