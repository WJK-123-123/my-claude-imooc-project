/* 财务管家 · 原型共享脚本：按 PRD 流程的按钮接线
   由 inject_nav.py 在每页 </body> 前注入引用：
   <script src="../assets/proto-nav.js" data-page="02_register"></script>
   12 张页面全部平铺在 pages/ 下（02_login.html … 13_category_manage.html，无 04——场景引导页已删），
   **默认首页为 pages/02_login.html**（登录页）；02_register 为注册页，两页分立（PRD F1）；
   12/13 为「我的」页延伸的账户/分类管理页（原型扩展，非 PRD V1 范围）。
   原「悬浮 🧭 导航」按钮及其面板已于 2026-10-19 删除。 */
(function () {
  'use strict';

  var PAGE = (document.currentScript && document.currentScript.dataset.page) || '';

  /* 接线规则：[匹配文本, 匹配方式 exact|contains, 目标目录]，靠前的优先。
     关键词均取自各页真实按钮文字（2026-10-18 全量核对）。 */
  var RULES = {
    '02_login': [
      ['忘记密码', 'contains', '03_forgot_password'],
      ['立即注册', 'contains', '02_register'],      /* 没有账号？立即注册 → 注册页 */
      ['开启记账之旅', 'contains', '05_add_record']  /* 登录提交键，登录成功 → 记一笔（04 场景引导已删） */
    ],
    '02_register': [
      ['直接登录', 'contains', '02_login'],          /* 已有账号？直接登录 → 登录页 */
      ['加入财务小窝', 'contains', '05_add_record']  /* 注册提交键，注册成功自动登录 → 记一笔（04 场景引导已删） */
    ],
    '03_forgot_password': [
      ['重置密码并登录', 'contains', '02_login'], /* 重设完成回登录页（PRD F1-5） */
      ['返回登录', 'contains', '02_login'],
      ['去登录', 'contains', '02_login'],
      ['完成', 'contains', '02_login']
    ],
    '05_add_record': [
      ['月度统计', 'contains', '07_statistics_a'],
      ['统计', 'exact', '07_statistics_a'],
      ['流水', 'exact', '06_transaction_history'],
      ['我的', 'exact', '10_profile']
    ],
    '06_transaction_history': [
      ['月度统计', 'contains', '07_statistics_a'],
      ['统计', 'exact', '07_statistics_a'],
      ['编辑', 'exact', '09_bill_detail'],
      ['详情', 'contains', '09_bill_detail'],
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
    '09_bill_detail': [
      ['确认删除', 'contains', '06_transaction_history'],
      ['返回流水', 'contains', '06_transaction_history'],
      ['删除', 'contains', '06_transaction_history'], /* 匹配「删除账单」 */
      ['编辑', 'contains', '05_add_record'], /* 匹配「编辑这笔账单」 */
      ['记一笔', 'exact', '05_add_record'],
      ['流水', 'exact', '06_transaction_history'],
      ['统计', 'exact', '07_statistics_a'],
      ['我的', 'exact', '10_profile']
    ],
    '10_profile': [
      ['账户管理', 'contains', '12_account_manage'],
      ['分类管理', 'contains', '13_category_manage'],
      ['退出登录', 'contains', '11_settings'],
      ['注销', 'contains', '11_settings'],
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
})();
