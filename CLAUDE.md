# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

「财务管家」——极简记账产品（粉嫩可爱风，手机浏览器优先的 Web 端）。仓库按编号阶段目录组织，新阶段开新编号目录：

- `001.产品PRD(产品经理)/`——产品需求文档（`财务管家-PRD-V1.0.md`，文件名锁定初版号、实际版本以文首版本号为准，当前 V1.11）与后台管理系统 PRD（`后台管理系统-PRD-V1.0.md`，当前 V1.1，运营后台功能 A1–A7 的唯一事实来源），**全部产品决策的唯一事实来源**
- `002.产品UI原型(美术设计)/`——Stitch UI 原始美术稿存档（`UI原型/_1~_9、_11` 各屏 + `financial_steward` 设计系统；场景引导屏已随功能砍掉一并删除），是 `003.前端代码` 的上游素材
- `003.前端代码/frontend/`——Stitch 高保真原型：**无总览页、无根目录 index.html**，默认首页即 `pages/02_login.html`（登录页），共 11 页平铺在 `pages/`（`02_login.html` … `11_settings.html` 主流程 + `12_account_manage`/`13_category_manage` 管理扩展页，登录/注册两页分立，无 04 场景引导页与 09 账单详情页——均已删除、登录/注册成功直进记账页，03、05–08、10、11 含同名 `.png` 截图，编号即主流程顺序），共享接线脚本 `assets/proto-nav.js`（每页 `</body>` 前经 `data-page` 引用）
- `003.前端代码/backend/`——正式后端起步（Express 5 + mysql2 + bcryptjs，ESM 无构建）：已实现 F1 注册/登录/登出/会话（`/api/auth/*`）与页面登录守卫（`/pages/` 非公开 `.html` 未登录 302 回登录页），同源静态托管 `../frontend`、`npm start` 跑 3000 端口；`.env` 配数据库连接（已 gitignore）
- `004.数据库脚本(数据库管理员DBA)/`——数据库设计（`README.md` 设计说明 + `01_schema.sql` 建表 + `02_seed.sql` 附录 A 模板/演示数据；MySQL 8.0+ / utf8mb4，库名 `financial_steward`，9 张表——含后台管理系统超级管理员 `admin_user`；金额以「分」为整数存 `bill.amount` 并有 CHECK 兜底，`account` 表仅是支付方式标记**无余额字段**）
- `005.后台管理系统(运营专员)/`——后台管理系统**完整实现**（A1–A6，独立于用户端的运营后台，桌面浏览器优先）：`backend/` 独立后端（Express 5 + mysql2 + bcryptjs，ESM 无构建，`npm start` 跑 3002 端口，连同一 `financial_steward` 库，账号与会话合一存 `admin_user` 单表、与 `user` 表完全隔离）+ 预置账号 `npm run seed:admin`；已实现 A1 登录/登出/会话（`/api/admin/auth/*`）、A2 数据总览仪表盘（`/api/admin/dashboard`）、A3 用户列表/搜索/筛选/详情下钻（`/api/admin/users`）、A4 跨用户账单筛选与汇总（`/api/admin/bills`）、A5 统计报表按年/近 12 月（`/api/admin/stats`）、A6 CSV 导出（`/api/admin/export/users.csv`、`bills.csv`）；`frontend/` 后台页面（`admin_login` 登录 + `admin_home` 仪表盘 + `admin_users`/`admin_user_detail` 用户 + `admin_bills` 账单 + `admin_stats` 统计，共享 `assets/admin-nav.js` 客户端守卫 + `doAdminLogout()` + `adminApi`/`centsToYuan`/`esc` 等工具；左侧导航 + 顶部栏桌面布局，图表走本地 Chart.js（`assets/chart.umd.js`））；A7 封禁/注销/审计按 PRD P1 **默认只读不实现**

本仓库所有文档、UI 文案、代码注释均使用中文。

## 常用命令

```bash
# 启动正式后端（F1 注册/登录；同源托管 003 原型页；nodemon 监听 src/* 改动自动重启）
cd 003.前端代码/backend && npm start   # http://localhost:3000（自动跳转登录页）
# 无需热重载的生产式启动：npm run start:prod（node src/server.js）

# 纯原型静态预览（不走后端；页面依赖 Tailwind CDN，需联网）
cd 003.前端代码/frontend && python -m http.server 8080   # http://localhost:8080/pages/02_login.html

# 改动共享脚本后的语法检查
cd 003.前端代码/frontend && node --check assets/proto-nav.js

# 启动后台管理系统后端（005 完整版 A1–A6；nodemon 热重载；连同一 financial_steward 库）
cd 005.后台管理系统(运营专员)/backend && npm start   # http://localhost:3002（自动跳转登录页，账号见 .env）
# 预置超级管理员账号：npm run seed:admin（读 .env 的 ADMIN_USERNAME/ADMIN_PASSWORD，已存在则跳过）
# 生产式启动：npm run start:prod（node src/server.js）
```

无 lint、无测试框架；003 原型的交互验证以浏览器人工过主流程为主。

## 架构

正式后端自 2026-10-20 起步于 `003.前端代码/backend/`：F1 注册/登录/登出/会话已接真库（注册不再按模板初始化分类/账户，新账号两表初始为空、自行添加；登录统一错误提示 + 连错 5 次锁 10 分钟；会话沿用 004 设计——Cookie 存令牌明文 + `user_session` 存 SHA-256 哈希 + 30 天滑动续期，鉴权走 `src/middleware/requireAuth.js`），并同源静态托管 `../frontend`；页面守卫在 `server.js`：`/pages/` 下除登录/注册/找回密码外的 `.html` 未带有效会话一律 302 回登录页（截图等非 HTML 与 `/assets` 放行）。`02_login`/`02_register` 表单已接真实 `/api/auth/*`（成功才跳 05 页、失败展示中文错误行）；10/11 页「退出登录」弹窗确认键调全局 `doLogout()` 清会话后回登录页；10 我的页昵称、「注册于 YYYY-MM-DD」小字与徽章「已坚持记账 N 天 · UID」均取自 `/api/auth/me`（user 表实时数据，N = DATEDIFF 当天=1；未登录/无后端时回落演示文案「小桃子酱」）。其余页面内容仍为下述原型演示。原 `002.财务管家-Web` 三文件纯原生实现已删除。`003.前端代码/frontend/` 高保真原型：

- 零框架静态 HTML + Tailwind CDN、无构建。脚本分两层，改前先分清改哪层：
  - **共享脚本 `assets/proto-nav.js`**（每页 `</body>` 前经 `data-page` 引用）：页间跳转接线（RULES 自上而下首条命中优先）；2026-10-20 起兼做登录守卫客户端兜底（非公开页加载后查 `/api/auth/me`，仅 401 才跳登录页——404/网络异常不跳，兼容 python 纯原型预览）与全局 `doLogout()`（10/11 页退出弹窗共用）。原「悬浮 🧭 导航」粉钮及其面板已于 2026-10-19 删除，`proto-nav.css` 一并移除。
  - **各页内联 `<script>`**：页面特有行为都在这一层（05 分类/账户动态渲染与支出/收入双主题、06/07 日期药丸+日历小框、07 导出 .xlsx、10 头像上传、11 退出/注销弹窗、12/13 管理 CRUD）。改跳转改共享脚本，改某页行为改该页内联脚本。
- 数据层（2026-10-21 起账户/分类/账单/头像均已接真库，无内存演示残留）：`05 记一笔` 从 `/api/categories`、`/api/accounts` 读分类/账户并 `POST /api/bills` 记账；`12 账户管理`/`13 分类管理` 走 `/api/accounts`、`/api/categories` 增删改查（持久化到数据库，刷新仍保留）；10 我的头像经 `/api/profile/avatar` 落盘写 `user.avatar_url`；07 页「导出数据」为前端 .xlsx 导出（SheetJS CDN，导出本在 V1 范围外，勿当正式功能扩散）。

后台管理系统自 2026-10-22 起步于 `005.后台管理系统(运营专员)/backend/`：A1 超级管理员登录/登出/会话——账号独立存 `admin_user` 表（与用户端 `user` 表完全隔离、互不通行），会话沿用「Cookie 存令牌明文 + `admin_user.token_hash` 存 SHA-256 哈希 + 30 天滑动续期」且**账号与会话合一**（全系统仅此一张新增表，不另建会话表），鉴权走 `src/middleware/requireAdminAuth.js`；登录失败沿用连错 5 次锁 10 分钟。页面守卫在 `server.js`：`/pages/` 下除 `admin_login.html` 外的 `.html` 未带有效会话一律 302 回登录页。A2–A6 全部只读复用 `user`/`bill`/`category`/`account` 四表、**不新增不改动任何表**（A7 封禁/注销/审计按 PRD P1 默认不实现）：A2 总览、A3 用户列表/详情、A4 账单筛选、A5 统计均以「分」整数求和、展示层换算元；A6 CSV 导出受同一筛选条件约束、单次上限 10 万条。前端为左侧导航 + 顶部栏桌面布局，金额沿用语义色（支出深灰「-」/收入薄荷绿「+」），图表走本地 Chart.js（`assets/chart.umd.js`）。

**PRD 硬约定（改代码前先查文档）：**

- 金额一律以**分为单位的整数**存储与计算，全程禁用浮点运算。
- 功能与验收标准对应 PRD 的 F1–F7 编号（F2 场景引导已于 V1.6 移除，编号保留不复用），改功能先读对应条目及验收表。
- V1 范围红线：不做预算、多账户（余额体系）、共享账本、搜索、导出、多月份趋势图表（PRD 3.2 范围外清单）。注意两项已**提前进 V1**、勿当范围蔓延回退：年度分类占比统计（F7）、支付方式标记字段（F3-9，仅账单标记，非账户体系）。收到新需求先判断版本归属，防止 MVP 膨胀。
- 视觉规范锁定 PRD 6.5：色板、圆角、动效时长以 PRD 为唯一来源，原型页统一走各页 Tailwind 配置里的设计令牌，不得在组件里硬编码颜色值。

## 文档维护

修改 PRD 时必须同步：文首文档版本号 + 修订记录表（追加一行，不覆盖历史）；产品名当前为「财务管家」（已定名）。
