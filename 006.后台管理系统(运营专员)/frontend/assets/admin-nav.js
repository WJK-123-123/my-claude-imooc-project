// 后台管理系统共享脚本（后台 PRD A1 守卫 + 各页通用工具）。
// 服务端已有权威 302 拦截；这里再兜底：页面加载后查 /api/admin/auth/me，仅 401 才跳登录页
// （404/网络异常不跳，兼容纯静态预览），并暴露全局 doAdminLogout() / adminApi() 等供各页共用。
(function () {
  const LOGIN_URL = '/pages/admin_login.html';

  // 页面加载后的客户端守卫：登录页不生效；同时回填顶部栏当前管理员用户名
  window.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.getAttribute('data-page');
    if (!page || page === 'login') return;
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'same-origin' });
      if (res.status === 401) {
        location.href = LOGIN_URL;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const el = document.getElementById('adminName');
        if (el) el.textContent = '👑 ' + data.username;
      }
    } catch {
      // 网络异常静默，交由服务端守卫兜底
    }
  });

  // 全局退出登录：清会话后回登录页
  window.doAdminLogout = async function () {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      location.href = LOGIN_URL;
    }
  };

  // 通用 JSON 请求封装：同源 + 自动带上会话 Cookie；401 统一跳登录页；非 2xx 抛中文错误
  window.adminApi = async function (path, options = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...options });
    if (res.status === 401) {
      location.href = LOGIN_URL;
      throw new Error('未登录或登录已过期');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || '请求失败，请稍后再试');
    return data;
  };

  // HTML 转义：所有用户生成内容（用户名/分类/备注等）注入 innerHTML 前必须经过此函数防 XSS
  window.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  };

  // 分 → 元字符串（纯整数运算：千分位逗号 + 两位小数），展示层专用
  window.centsToYuan = function (c) {
    const v = Math.max(0, Math.floor(Number(c) || 0));
    const yuan = Math.floor(v / 100);
    const fen = v % 100;
    return String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(fen).padStart(2, '0');
  };

  // 分 → 带符号元字符串（结余可能为负）；整数运算、千分位逗号 + 两位小数
  window.centsToYuanSigned = function (c) {
    const v = Math.floor(Number(c) || 0);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    const yuan = Math.floor(abs / 100);
    const fen = abs % 100;
    return sign + String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(fen).padStart(2, '0');
  };

  // 账号状态 → 中文标签
  window.STATUS_LABEL = { active: '正常', deleting: '注销中', deleted: '已注销' };
})();
