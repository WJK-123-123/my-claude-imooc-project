# 财务管家 · 数据库设计说明（DBA）

| 项目 | 内容 |
|---|---|
| 数据库 | `financial_steward`（MySQL 8.0+，已在 MySQL 9.7.0 Docker 容器验证） |
| 字符集 / 排序规则 | `utf8mb4` / `utf8mb4_0900_ai_ci`（emoji 图标、中文用户名必需；不区分大小写） |
| 设计依据 | 《财务管家-PRD-V1.0.md》V1.10（F1–F7、§7 数据模型、附录 A）；003 原型 05/09/10/12/13 页；`admin_user` 表出自《后台管理系统-PRD-V1.0.md》V1.1 · A1 |
| 脚本 | `01_schema.sql` 建表（可重复执行，会清库重建）；`02_seed.sql` 模板 + 演示数据 |
| 硬约定 | **金额一律以「分」为单位的整数存储，全程禁用浮点**；所有查询强制 `user_id` 过滤 |

---

## 1. 表关系总览（ER 简图）

```
user 1 ──── n bill          （用户 → 账单，CASCADE：注销清扫时随用户删除）
user 1 ──── n category      （用户 → 分类，CASCADE）
user 1 ──── n account       （用户 → 支付方式账户，CASCADE）
user 1 ──── n user_session  （用户 → 登录态会话，CASCADE）
user 1 ──── n password_reset_code（用户 → 找回密码验证码，CASCADE）

category 1 ──── n bill      （bill.category_id → RESTRICT：分类被引用不可物理删除）
account  1 ──── n bill      （bill.account_id → SET NULL：账户删除后账单回落「未标记」）

category_template / account_template ：无外键的全局只读参考清单，
V1.9 起注册不再复制，新账号 category / account 初始为空、由用户自行添加（见 §5.1）

admin_user ：后台管理系统超级管理员账号，独立无外键、与上述用户端各表隔离（见 §2 表 9）
```

## 2. 表清单

| # | 表 | 对应需求 | 一句话职责 |
|---|---|---|---|
| 1 | `user` | F1 | 账号本体：用户名（大小写不敏感唯一）、密码哈希、注销状态机、登录锁定字段 |
| 2 | `user_session` | F1-7/8 | 30 天滑动续期登录态（存令牌 SHA-256 哈希；改用 JWT 可不建） |
| 3 | `password_reset_code` | F1-5 | 找回密码 6 位验证码（60s 重发间隔、错 5 次作废、用过即焚） |
| 4 | `category_template` | 附录 A | 「生活账」分类模板清单（参考样例，注册不再复制） |
| 5 | `account_template` | F3-9 | 支付方式默认四项参考样例（微信/支付宝/现金/银行卡） |
| 6 | `category` | F3/F4/F7、13 页 | 用户分类：支出/收入双 scope、emoji 图标、排序、查重唯一约束 |
| 7 | `account` | F3-9、12 页 | 支付方式/收款账户标记（**无任何金额字段**，非多账户余额体系） |
| 8 | `bill` | F3/F4/F5/F7 | 账单流水：类型、金额（分）、分类、账户标记、备注、日期 |
| 9 | `admin_user` | 后台 A1 | 后台管理系统超级管理员账号：账号与会话合一，与用户端 `user` 表完全隔离 |

## 3. 关键设计决策（含与 PRD §7 草案的两处实现层调整）

### 3.1 金额：分为单位的整数 + CHECK 兜底
`bill.amount INT UNSIGNED`，`CHECK (amount BETWEEN 1 AND 99999999)`——上限恰为
¥999,999.99（PRD F3-1）。展示层除以 100 转两位小数，除查询展示外任何环节不做浮点运算
（F4-验收 1：合计与逐笔求和一致）。

### 3.2 调整一：分类均为用户自有行（V1.9 起注册不再复制模板）
PRD §7 草案为「系统分类 user_id 为 NULL + is_system」。本设计改为**全部分类均为用户自有行**，
`is_system` 仅标记「是否来自模板初始化」。V1.9 起注册不再从 `category_template` 复制，
新账号分类初始为空、由用户自行添加（`is_system=0`）。依据：

- V1.9 起 F1-4 改为「新账号分类/账户初始为空、自行添加」，模板初始化语义已移除；
- V1.1 路线图即有「分类编辑/删除/排序」，自有行天然支持，共享行会牵一发动全身；
- 原型 13 页按用户维度整表 CRUD，读取无 `OR user_id IS NULL` 分支，索引更简单。

### 3.3 调整二：`bill.pay_method` 枚举 → `account` 表外键
PRD §7 草案为 `pay_method(wechat/alipay/cash/card)` 枚举。但 003 原型已落地「12 账户管理页」
（emoji + 名称 ≤8 字 + 备注 ≤12 字的增删改查），且 05 记一笔页的支付方式 chips 动态读取该账户
列表、收入态切换为「收款账户」——固定四值枚举无法表达。故建 `account` 表、`bill.account_id`
可空外键承接。**边界不变**：本表不含余额/期初/对账字段，仅是账单标记（PRD 3.2 多账户余额
体系仍在 V2.x 范围外）；默认四项与 F3-9 完全一致（`account_template` 种子）。
未选中即 `NULL`，F5 详情显示「—」。

### 3.4 密码：不设独立 salt 列
bcrypt/argon2 编码串内已含随机盐（`password_hash VARCHAR(255)` 整串存储），满足 PRD
「密码只存哈希 + 盐、禁止明文/可逆加密」；独立 salt 列在此类算法下是冗余且易被误用。

### 3.5 注销状态机与用户名墓碑
`status: active → deleting → deleted`。申请注销置 `deleting` + `purge_at = NOW()+7 天`（冷静期
内登录可撤销，回 `active`）；定时任务到期后**物理删除** bill/session/code/account/category
（CASCADE），`user` 行保留为 `deleted` 墓碑（清空 password_hash/avatar_url）——只占用户名、
不含任何业务数据，防止他人以原用户名重新注册造成冒用（PRD §7 状态枚举含 `deleted` 的用意）。

### 3.6 大小写不敏感的唯一性
`username`、`category.name`、`account.name` 均以 `utf8mb4_0900_ai_ci` 存储，唯一索引天然实现
F1-1「查重不区分大小写（`XiaoLin` 与 `xiaolin` 同名）」及分类/账户查重，无需额外小写列。

### 3.7 防越权
所有业务表带 `user_id` 且为外键；所有查询必须带 `user_id` 条件（PRD §5 安全、§7 关键约束）。
数据库层再兜底两处：分类被账单引用 `RESTRICT` 不可删；账单仅能通过所属用户级联删除。

## 4. 索引与查询映射

| 索引 | 服务的查询 |
|---|---|
| `bill (user_id, bill_date, created_at)` | F4 月区间拉取 + 日组内 `created_at` 倒序；F7 年度聚合；F4-验收 1 |
| `bill (user_id, category_id)` | 分类删除保护的引用检查；V1.1 分类管理 |
| `category (user_id, scope, sort)` | F3-3 九宫格按类型加载（排序取默认选中项） |
| `category (user_id, scope, name)` 唯一 | F3-4 新增分类查重 |
| `account (user_id, sort)` / `(user_id, name)` 唯一 | 05 页 chips 渲染 / 12 页增删改查查重 |
| `user_session (token_hash)` 唯一、`(expires_at)` | 每请求令牌校验；过期清扫任务 |
| `password_reset_code (user_id, created_at)`、`(expires_at)` | 60s 重发间隔判断；过期清扫 |
| `admin_user (token_hash)` | 超级管理员每次请求的会话令牌校验（后台 A1） |

## 5. 应用侧对接约定

### 5.1 注册（F1-4，仅建号，不再初始化分类/账户）
```sql
INSERT INTO user (username, password_hash) VALUES (?, ?);   -- 哈希由后端 bcrypt/argon2 生成
```
新账号 `category`/`account` 初始为空；分类经 `POST /api/categories`、账户经 `POST /api/accounts`
由用户自行添加并落库。

### 5.2 常用查询（后端可直接采用，保证 F7-验收 1 数字一致）

```sql
-- 月小结（F4-2）：入参 user_id、月初、次日零点（前闭后开）
SELECT
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)            AS expense_total, -- 分
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)            AS income_total,  -- 分
  SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END)      AS balance        -- 分
FROM bill
WHERE user_id = ? AND bill_date >= ? AND bill_date < ?;

-- 分类占比排名（F7-4/5，type 换 'income' 即收入版；占比一位小数）
SELECT c.icon, c.name, SUM(b.amount) AS total,
       ROUND(SUM(b.amount) * 100.0 / t.total, 1) AS pct
FROM bill b
JOIN category c ON c.id = b.category_id
JOIN (SELECT COALESCE(SUM(amount), 0) AS total FROM bill
      WHERE user_id = ? AND type = 'expense' AND bill_date >= ? AND bill_date < ?) t
  ON t.total > 0
WHERE b.user_id = ? AND b.type = 'expense' AND b.bill_date >= ? AND b.bill_date < ?
GROUP BY c.id, c.icon, c.name
ORDER BY total DESC;

-- 记账概况（F7-6）：笔数 + 最大单笔支出；月均 = 支出合计 ÷ 月数（本年取已过月数，历史年取整年 12 个月，由应用层计算）
SELECT COUNT(*) AS bill_count,
      (SELECT CONCAT(c.name, ' ', b.amount) FROM bill b JOIN category c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.type = 'expense' AND b.bill_date >= ? AND b.bill_date < ?
       ORDER BY b.amount DESC LIMIT 1) AS max_expense
FROM bill
WHERE user_id = ? AND bill_date >= ? AND bill_date < ?;

-- 流水按日分组（F4-3）：组间日期倒序、组内 created_at 倒序
SELECT id, type, amount, category_id, account_id, note, bill_date, created_at
FROM bill
WHERE user_id = ? AND bill_date >= ? AND bill_date < ?
ORDER BY bill_date DESC, created_at DESC;
```

### 5.3 定时任务（建议每日一次）
- **注销清扫**：`DELETE FROM user WHERE status='deleting' AND purge_at <= NOW()` 前，
  事务内先按序 `DELETE bill → account → category → password_reset_code → user_session WHERE user_id=?`，
  再置 `user SET status='deleted', password_hash='', avatar_url=NULL`（墓碑化）。
  （虽然外键均 CASCADE，显式按序删除可避免 `bill→category RESTRICT` 的级联顺序问题。）
- **过期清扫**：`DELETE FROM user_session WHERE expires_at < NOW()`；
  `DELETE FROM password_reset_code WHERE expires_at < NOW() - INTERVAL 1 DAY`。
- **每日备份**（PRD §5 可用性）：`mysqldump financial_steward` 全量 + binlog。

## 6. 执行方法

本机 Docker MySQL 容器（9.7.0，端口 3306，root/123456）验证通过：

```bash
docker exec -i <容器名> mysql -uroot -p123456 --default-character-set=utf8mb4 < 01_schema.sql
docker exec -i <容器名> mysql -uroot -p123456 --default-character-set=utf8mb4 < 02_seed.sql
```

`01_schema.sql` 会 DROP 重建全部表，**仅用于初始化/重置**，生产环境变更须走增量迁移脚本
（后续以 `03_migration_*.sql` 编号追加，不回改 01）。

## 7. 版本记录

| 版本 | 日期 | 说明 |
|---|---|---|
| V1.0 | 2026-10-20 | 首版：8 表 DDL + 附录 A 模板种子 + 演示数据；对应 PRD V1.6 / 原型 2026-10-19 状态 |
| V1.1 | 2026-10-21 | 同步 PRD V1.9：注册不再复制模板，category_template/account_template 转为参考清单；02_seed 演示数据说明相应调整 |
| V1.2 | 2026-10-22 | 新增 `admin_user` 表（后台管理系统超级管理员账号，账号与会话合一、全系统仅此一张新增表）；同步后台 PRD V1.1 · A1 |
