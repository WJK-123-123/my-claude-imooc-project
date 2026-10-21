/* 财务管家 · 原型共享脚本：按 PRD 流程的按钮接线
   由 inject_nav.py 在每页 </body> 前注入引用：
   <script src="../assets/proto-nav.js" data-page="02_register"></script>
   11 张页面全部平铺在 pages/ 下（02_login.html … 13_category_manage.html，无 04 场景引导页与 09 账单详情页——均已删），
   **默认首页为 pages/02_login.html**（登录页）；02_register 为注册页，两页分立（PRD F1）；
   12/13 为「我的」页延伸的账户/分类管理页（原型扩展，非 PRD V1 范围）。
   原「悬浮 🧭 导航」按钮及其面板已于 2026-10-19 删除。 */
(function () {
  'use strict';

  var PAGE = (document.currentScript && document.currentScript.dataset.page) || '';

  /* 接线规则：[匹配文本, 匹配方式 exact|contains, 目标目录]，靠前的优先。
     关键词均取自各页真实按钮文字（2026-10-18 全量核对）。
     注意：登录/注册/找回密码提交键（开启记账之旅 / 加入财务小窝 / 重置密码并登录）已改由
     各页内联脚本调用后端 /api/auth/*（003.前端代码/backend），校验通过、登录态建立后才跳
     05_add_record，故不再在此直跳（登录/注册 2026-10-20 接线，找回密码 2026-10-21 接线）。 */
  var RULES = {
    '02_login': [
      ['忘记密码', 'contains', '03_forgot_password'],
      ['立即注册', 'contains', '02_register']       /* 没有账号？立即注册 → 注册页 */
    ],
    '02_register': [
      ['直接登录', 'contains', '02_login']           /* 已有账号？直接登录 → 登录页 */
    ],
    '05_add_record': [
      ['年度统计', 'contains', '07_statistics_a'],
      ['统计', 'exact', '07_statistics_a'],
      ['流水', 'exact', '06_transaction_history'],
      ['我的', 'exact', '10_profile']
    ],
    '06_transaction_history': [
      ['年度统计', 'contains', '07_statistics_a'],
      ['统计', 'exact', '07_statistics_a'],
      ['记一笔账', 'exact', '05_add_record'],
      ['记一笔', 'exact', '05_add_record'],
      ['流水', 'exact', '06_transaction_history'],
      ['我的', 'exact', '10_profile']
    ],
    '07_statistics_a': [
      ['流水', 'exact', '06_transaction_history'],
      ['记一笔', 'exact', '05_add_record'],
      ['我的', 'exact', '10_profile'],
      ['返回', 'contains', '06_transaction_history']
    ],
    '08_statistics_b': [
      ['流水', 'exact', '06_transaction_history'],
      ['记一笔', 'exact', '05_add_record'],
      ['我的', 'exact', '10_profile'],
      ['返回', 'contains', '06_transaction_history']
    ],
    '10_profile': [
      ['账户管理', 'contains', '12_account_manage'],
      ['分类管理', 'contains', '13_category_manage'],
      /* 退出登录/注销入口已改走本页弹窗（showLogoutModal/showDeleteModal，
         退出确认键 doLogout 调后端 /api/auth/logout，2026-10-20），不再跳 11_settings */
      ['记一笔', 'exact', '05_add_record'],
      ['流水', 'exact', '06_transaction_history'],
      ['统计', 'exact', '07_statistics_a']
    ],
    '11_settings': [
      ['流水', 'exact', '06_transaction_history'],
      ['记一笔', 'exact', '05_add_record'],
      ['统计', 'exact', '07_statistics_a']
    ],
    '12_account_manage': [
      ['返回', 'contains', '10_profile']
    ],
    '13_category_manage': [
      ['返回', 'contains', '10_profile']
    ]
  };

  /* —— 按钮接线 ——
     Material 图标的连字文本（如 arrow_forward）会污染 textContent，
     先克隆节点剔除图标再取标签；并压缩空白、去掉行尾箭头装饰。 */
  function labelText(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(
      c.querySelectorAll('.material-symbols-outlined,svg,img'),
      function (n) { n.remove(); }
    );
    return (c.textContent || '').replace(/\s+/g, '').replace(/[→›»]+$/, '');
  }

  var rules = RULES[PAGE] || [];
  Array.prototype.forEach.call(
    document.querySelectorAll('a,button,[role="button"],[onclick]'),
    function (el) {
      var t = labelText(el);
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var hit = r[1] === 'exact' ? t === r[0] : t.indexOf(r[0]) > -1;
        if (hit) {
          el.onclick = function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            location.href = r[2] + '.html';
          };
          break;
        }
      }
    }
  );

  /* —— 登录守卫（客户端兜底，2026-10-20）——
     服务端已对 /pages/ 下非公开 .html 做 302 拦截；此处兜底浏览器返回键/内存缓存快照：
     仅当后端明确返回 401 才跳登录页，404/网络异常不跳——兼容 python http.server
     纯原型预览（无后端时页面照常可看）。 */
  var PUBLIC_PAGES = { '02_login': 1, '02_register': 1, '03_forgot_password': 1 };
  if (PAGE && !PUBLIC_PAGES[PAGE]) {
    fetch('/api/auth/me').then(function (r) {
      if (r.status === 401) location.replace('02_login.html');
    }).catch(function () {});
  }

  /* —— 退出登录（10/11 页弹窗确认键共用）——
     POST /api/auth/logout 清会话后回登录页（PRD F1-8）；请求失败也照样回登录页，
     兼容纯原型预览。 */
  window.doLogout = function (btn) {
    if (btn) btn.disabled = true;
    fetch('/api/auth/logout', { method: 'POST' })
      .catch(function () {})
      .then(function () { location.replace('02_login.html'); });
  };
})();
