# 财务管家 · 用户端后端 API 测试计划

> 测试对象：`003.前端代码/backend`（Express 5 + MySQL，ESM 无构建）
> 文档版本：V1.0
> 关联文档：`001.产品PRD/财务管家-PRD-V1.0.md`（V1.13）、`004.数据库脚本/01_schema.sql`
> 测试类型：接口契约 / 数据一致性 / 安全 / 并发 / 会话

---

## 1. 项目识别

### 1.1 技术栈

| 维度 | 内容 |
|---|---|
| 运行时 | Node.js + Express 5（`"type": "module"`，ESM） |
| 依赖 | mysql2/promise、bcryptjs、cookie-parser、dotenv；开发依赖 nodemon |
| 数据库 | MySQL 8.0+ / utf8mb4，库 `financial_steward`，金额以「分」整数存储 |
| 会话 | Cookie `fgj_session` 存明文令牌（httpOnly），库中 `user_session.token_hash` 存 SHA-256 哈希，30 天滑动续期 |
| 启动 | `npm start`（nodemon，3000 端口）/ `npm run start:prod`（node） |

### 1.2 目录结构

```
backend/
├── .env / .env.example   数据库连接（.env 已 gitignore）
├── package.json
└── src/
    ├── server.js         入口：中间件、静态托管、页面守卫、统一错误处理
    ├── config.js         读 .env 集中配置
    ├── db.js             mysql2 连接池（utf8mb4，connectionLimit 10）
    ├── middleware/requireAuth.js  会话鉴权 + 30 天滑动续期
    ├── utils/
    │   ├── session.js    令牌哈希/建会话/续期/删除/Cookie
    │   └── validate.js   用户名/密码格式校验
    └── routes/
        ├── auth.js       register/login/logout/me/reset-password/deactivate
        ├── bills.js      记账/详情/编辑/删除/月流水分页
        ├── account.js    账户（支付方式标记）CRUD
        ├── category.js   分类 CRUD
        ├── stats.js      年度统计（五路并发聚合）
        └── profile.js    头像上传 + 记账微卡统计
```

### 1.3 API 清单（契约测试基准）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| POST | `/api/auth/register` | 无 | 注册（成功自动登录） |
| POST | `/api/auth/login` | 无 | 登录（连错 5 次锁 10 分钟） |
| POST | `/api/auth/logout` | 无（删会话） | 登出 |
| GET | `/api/auth/me` | 有 | 当前用户 |
| GET | `/api/auth/captcha` | 无 | 图形验证码（4 位 PNG、5 分钟有效、一次性、每 IP 限流） |
| POST | `/api/auth/reset-password` | 无（验证码核验） | 找回密码（图形验证码 + 重置，吊销全部会话） |
| POST | `/api/auth/deactivate` | 有 | 注销（密码确认 + 7 天冷静期） |
| GET/POST/PUT/DELETE | `/api/accounts(/:id)` | 有 | 账户 CRUD |
| GET/POST/PUT/DELETE | `/api/categories(/:id)` | 有 | 分类 CRUD |
| GET | `/api/bills` | 有 | 月流水（分页 + 汇总 + 日小计） |
| POST | `/api/bills` | 有 | 记一笔 |
| GET/PUT/DELETE | `/api/bills/:id` | 有 | 账单详情/编辑/删除 |
| GET | `/api/stats` | 有 | 年度统计 |
| PUT | `/api/profile/avatar` | 有 | 头像上传 |
| GET | `/api/profile/stats` | 有 | 记账微卡统计 |

---

## 2. 核心业务模块

1. **F1 账号**：注册、登录（锁定）、登出、会话、找回密码、注销（冷静期撤销/懒清扫）。
2. **F3 记账**：金额/分类/账户/备注/日期校验 + 归属校验。
3. **F4 流水**：月区间查询、分页、日小计、整月汇总、类型筛选、最早月。
4. **F5 账单详情/编辑/删除**。
5. **F7 年度统计**：概况、最大单笔、分类聚合、月度趋势、年份集合。
6. **扩展**：账户/分类 CRUD（外键 RESTRICT / SET NULL）。
7. **非功能**：会话安全、横向越权防护、金额无浮点、头像落盘安全。

---

## 3. 高风险功能识别

| 风险点 | 位置 | 风险说明 | 等级 |
|---|---|---|---|
| **找回密码批量重置（已加固 2026-11-05）** | auth.js `/captcha` + `/reset-password` | 图形验证码（一次性、5 分钟）+ 每 IP 限流 + 重置成功吊销全部会话（PRD V1.14）；自动化覆盖缺码/错码/一次性/存在性不泄露，成功路径人工过主流程 | 中（安全） |
| 注销懒清扫物理删除 | auth.js `/login` deleting 分支 | 冷静期届满登录时先删 `bill` 再删 `user`，依赖顺序错误会触发外键 RESTRICT 失败 | 高 |
| 横向越权 | 全部路由 | 所有查询必须 `WHERE user_id = ?`；分类/账户归属校验、账单 ID 归属 | 高 |
| 金额「分」整数无浮点 | bills.js / stats.js | 边界 1～99999999、`intDivRound` 整数四舍五入、月均分母口径 | 高 |
| 登录锁定（SQL 时钟） | auth.js | `locked_until > NOW()`、跨时区、锁定期间正确密码也拒绝 | 中 |
| 会话滑动续期 | requireAuth.js / session.js | Cookie 寿命与库内 expires_at 同步、并发续期、令牌哈希碰撞 | 中 |
| 头像上传落盘 | profile.js `/avatar` | MIME 白名单、base64 解码、2MB 限制、旧文件清理、**路径穿越（filename 由服务端生成，需验证）** | 中 |
| 分类删除 RESTRICT | category.js | 被引用分类删除返回 409，错误码 errno 1451 判定 | 中 |
| 并发注册同名 | auth.js | 预查 + 唯一索引兜底，`ER_DUP_ENTRY` 处理 | 中 |
| 分页/汇总一致 | bills.js | `summary` 全月 vs `bills` 类型过滤口径差异 | 中 |
| 请求体 10MB 上限 | server.js | 头像 base64 放宽，防止滥用 | 低 |

---

## 4. 分层测试方案

| 层 | 内容 | 工具/方式 | 覆盖目标 |
|---|---|---|---|
| L1 单元 | `validate.js` 用户名/密码正则、`intDivRound`、金额边界 | 建议引入 Node 断言脚本（当前无测试框架，需新建） | 纯函数边界 |
| L2 接口契约 | 全部 `/api/*` 的请求/响应/状态码/错误消息 | curl / Postman / REST Client 脚本 | 契约正确性 |
| L3 数据一致性 | 入库结果、外键行为、级联/约束、事务回滚 | 直接查 MySQL 断言 | 数据不脏、约束兜底 |
| L4 安全 | 越权、未授权、会话、锁定、XSS 存储、头像上传 | 构造恶意请求（跨用户 ID、伪造 Cookie） | 安全红线 |
| L5 并发 | 并发注册同名、并发记账、并发续期 | 轻量并发脚本 | 无死锁、计数正确 |
| L6 异常/降级 | DB 断开、坏 JSON、超限请求体 | 断库模拟 | 统一 500 处理、不泄露堆栈 |

> 建议：后端无现成测试框架，本轮以 **L2 接口契约 + L3 数据一致性 + L4 安全** 手动/脚本化为主；L1/L5 若成本允许再补脚本。

---

## 5. 测试范围与用例（P0=核心）

### 5.1 F1 账号与会话（auth）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-001 | 注册：合法用户名/密码 | 201/200，自动登录，`user` 新增、`user_session` 新增，分类/账户两表为空 |
| BE-002 | 注册：用户名 1/21 字、非法字符、弱密码（<6、含空格、<3 类字符） | 400 + 对应中文提示 |
| BE-003 | 注册：两次密码不一致 | 400「两次输入的密码不一致」 |
| BE-004 | 注册：已存在用户名（含大小写变体） | 409「用户名已被占用」（utf8mb4_0900_ai_ci 不区分大小写） |
| BE-005 | 并发注册同名 | 仅 1 成功，其余 409，无脏数据 |
| BE-006 | 登录：错密码 1–4 次 | 401 统一「用户名或密码错误」，`failed_login_count` 递增 |
| BE-007 | 登录：错 5 次 | 锁定 10 分钟；期间**正确密码**也拒绝「账号已锁定」 |
| BE-008 | 登录：锁定 10 分钟后 | 可再登录；计数清零（下周期重新累计 5 次） |
| BE-009 | 登录：不存在/已注销用户名 | 401 统一提示（不泄露存在性），响应时间与存在用户接近（哑哈希均化） |
| BE-010 | 登录成功 | `last_login_at` 更新、计数清零、`Set-Cookie` 下发 httpOnly 令牌 |
| BE-011 | `/api/auth/me` 无 Cookie / 伪造 Cookie | 401；有 Cookie 返回 id/username/registeredAt/joinedDays/avatarUrl |
| BE-012 | 登出 | 删会话行、清 Cookie，原 Cookie 再访问 401 |
| BE-013 | 会话滑动续期 | 鉴权通过后 `expires_at` 推到 30 天后，Cookie `maxAge` 同步 |
| BE-014 | 找回密码：缺验证码 / 错验证码 / 一次性 | 缺码 400「请输入图形验证码」；错码 400「验证码不正确或已过期」；同一 captchaId 第二次尝试必拒 |
| BE-015 | 找回密码：用户名存在性不泄露 | 验证码未通过时一律报验证码错（不返回 404）；404「用户名不存在」仅在过码后出现；墓碑行不可重置 |
| BE-016 | 注销：错密码 | 401「密码错误」，状态不变 |
| BE-017 | 注销：对密码 | 状态 `deleting`、`purge_at`=7 天后，清全部会话，登出 |
| BE-018 | 注销冷静期内登录（对密码） | 撤销注销：状态回 `active`、`purge_at` 清空，可正常使用 |
| BE-019 | 注销冷静期届满后登录 | 懒清扫：先删 bill 再删 user，提示「用户名或密码错误」 |

### 5.2 F3 记账 + F5 详情/编辑/删除（bills）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-101 | POST 记账：type=expense/income + 合法金额/分类/账户/备注/日期 | 成功，`bill` 入库，返回 `{id}` |
| BE-102 | 金额边界：0、负数、小数、100000000（分） | 400「金额不合法」 |
| BE-103 | 分类归属：用**他人**分类 ID 记账 | 400「分类不存在或与类型不符」（横向越权） |
| BE-104 | 分类 scope 不匹配（expense 账单用 income 分类） | 400 拒绝 |
| BE-105 | 账户归属：用他人账户 ID | 400「账户不存在」 |
| BE-106 | 备注 >50 字、日期非 YYYY-MM-DD、日期早于 2000-01-01 / 晚于今天 | 400 对应提示（范围校验为 2026-11-05 API 层新增，PRD F3-6） |
| BE-107 | GET `/api/bills/:id` 他人账单 | 404「账单不存在」 |
| BE-108 | PUT 编辑：金额/类型/分类/账户/日期/备注全改 | 成功，字段更新 |
| BE-109 | PUT 编辑他人账单 | 404 |
| BE-110 | DELETE 删除 | 成功；再查 404 |
| BE-111 | DELETE 他人账单 | 404 |

### 5.3 F4 流水（bills GET）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-201 | GET 默认（无 month） | 本月账单 + `summary{income,expense,balance}` + `dayTotals` 日小计 + `total` |
| BE-202 | 金额整数 | summary 与 dayTotals 全程整数，`balance = income - expense`，无浮点误差 |
| BE-203 | `month=YYYY-MM` 切月 / 非法 month | 合法月精确返回；非法/缺失回退本月 |
| BE-204 | 分页 `limit/offset` | limit 夹取 1–100，offset 正确；`total` 为整月过滤后总数 |
| BE-205 | `type=expense/income` 筛选 | 仅 bills/total 过滤；summary/dayTotals 仍整月全量（口径核对） |
| BE-206 | `earliestMonth` | offset=0 返回最早有账单月份；无账单为 null |
| BE-207 | 排序 | bill_date DESC, created_at DESC, id DESC |

### 5.4 F7 年度统计（stats）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-301 | GET 默认 year | `expenseTotal/incomeTotal/totalCount` 与 bills 一致 |
| BE-302 | 月均支出口径 | 本年=expenseTotal÷已过月数(含当月)；历史年=÷12；`intDivRound` 四舍五入正确 |
| BE-303 | 最大单笔 `maxExpense` | 全年度支出最大一笔，含分类名/图标；无支出为 null |
| BE-304 | 分类聚合 | expense/income 分类按金额降序，含 count |
| BE-305 | `monthly` 1–12 补齐 | 无账单月份为 0，趋势数据完整 |
| BE-306 | `years` 集合 | 有账单年份 ∪ 当前年，升序，未来年份收口本年 |
| BE-307 | 越权隔离 | 只统计当前 user_id 数据 |

### 5.5 账户 / 分类 CRUD（account/category）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-401 | 账户：名称空/超 8 字、emoji 空/超 16、备注超 12 | 400 对应提示 |
| BE-402 | 账户：重名 | 409「账户名称已存在」（唯一索引） |
| BE-403 | 账户：删除被账单引用的账户 | 成功，账单 `account_id` 由外键 SET NULL 回「—」 |
| BE-404 | 分类：scope 非法/名称空/超 6 字/图标空/超 16 | 400 对应提示 |
| BE-405 | 分类：重名（同 scope） | 409「该分类已存在」 |
| BE-406 | 分类：删除被账单引用的分类 | 409「该分类下已有账单，无法删除」（RESTRICT errno 1451） |
| BE-407 | 分类：删除他人分类 | 404 |
| BE-408 | 新增 sort | 追加到列表末尾（MAX(sort)+10） |

### 5.6 头像与微卡（profile）

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-501 | PUT avatar：png/jpg/webp/gif base64 | 落盘 `frontend/uploads/avatars/u{id}_{ts}.{ext}`，库存 `/uploads/avatars/*` |
| BE-502 | 非图片 data URL / 伪造 MIME / >2MB / 空 | 400 对应提示，不落盘 |
| BE-503 | 二次上传 | 新文件落盘，旧文件被清理 |
| BE-504 | 头像访问 | `/uploads/avatars/*` 静态可访问（无鉴权，验证无敏感信息） |
| BE-505 | GET profile/stats | totalCount/daysCount/monthCount 与 bill 表一致（本月口径正确） |

### 5.7 非功能 / 安全 / 异常

| 编号 | 步骤 | 预期 |
|---|---|---|
| BE-601 | 所有受保护接口无 Cookie | 401「未登录或登录已过期」 |
| BE-602 | 坏 JSON 请求体 | 400「请求体不是合法的 JSON」 |
| BE-603 | 未知接口 `/api/xxx` | 404「接口不存在」 |
| BE-604 | 页面守卫：未登录访问受保护 .html | 302 回登录页；登录/注册/找回密码放行 |
| BE-605 | 备注/分类名/账户名含 `<script>` | 入库原样（utf8mb4），响应 JSON；**前端渲染必须转义**（联动前端 FE-安全） |
| BE-606 | DB 断开时请求 | 统一 500「服务器开小差了」，不泄露堆栈 |

---

## 6. 测试环境准备

1. MySQL 容器跑 3306（root/123456），库 `financial_steward` 由 `004/01_schema.sql` 建表，`02_seed.sql` 灌演示数据。
2. 后端 `.env` 正确指向库；`npm start` 起 3000。
3. 至少 2 个测试账号（A/B）用于越权用例；可临时插数据制造「被引用分类/账户」。
4. 工具：Postman/curl（请求）、MySQL 客户端（断言）、可选并发脚本。

---

## 7. 缺陷分级与出口准则

| 级别 | 定义 | 示例 |
|---|---|---|
| P0 致命 | 越权、数据丢失/错乱、会话可伪造 | 横向越权读写、金额浮点错、注销误删 |
| P1 严重 | 核心功能缺陷/安全弱点 | 找回密码无核验被滥用、锁定失效、RESTRICT 失效 |
| P2 一般 | 非核心缺陷 | 错误提示文案、排序边缘 |
| P3 建议 | 优化 | 性能、日志 |

**出口准则**：P0/P1 全部关闭；越权/金额/会话/锁定安全用例全绿；F1/F3/F4/F5/F7 契约用例通过；无数据一致性问题。

---

## 8. 风险与依赖

- **找回密码安全（2026-11-05 已加固）**：免验证码直改已升级为图形验证码（一次性、5 分钟）+ 每 IP 限流 + 重置吊销全部会话（PRD V1.14，不接短信/邮箱通道）；重置成功路径需人眼读码，不在自动化范围，按人工主流程覆盖。
- 会话令牌明文存 Cookie（httpOnly），库存哈希——安全边界正确，但**无 `secure` 标志**（待 HTTPS），测试记录为已知项。
- 注销懒清扫依赖「先删 bill 再删 user」顺序，需专项验证外键顺序不报错。
- 后端同时服务 Web 前端与 006 跨端 APP，接口契约变更需同步两端测试计划。
