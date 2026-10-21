-- =====================================================================================
-- 财务管家 · 数据库建表脚本（DDL）
-- -------------------------------------------------------------------------------------
-- 适用版本 : MySQL 8.0+（已在 MySQL 9.7.0 / Docker 容器验证）
-- 字符集   : utf8mb4（emoji 图标、中文用户名/分类名必需）
-- 排序规则 : utf8mb4_0900_ai_ci（不区分大小写 → 满足 F1-1「用户名查重不区分大小写」，
--            同时覆盖分类名/账户名查重）
-- 存储引擎 : InnoDB（事务、外键、行锁）
-- 设计依据 : 《财务管家-PRD-V1.0.md》V1.6（F1–F7、§7 数据模型、附录 A 模板）
--            003 原型 05/09/10/12/13 页数据结构
-- 硬约定   : 金额一律以「分」为单位的整数存储，全程禁用浮点（PRD 6.5 前的架构约定）
-- 说明     : 本脚本可重复执行（先 DROP 再 CREATE），会清空既有数据，请勿在生产库直接运行
-- =====================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `financial_steward`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `financial_steward`;

-- 依依赖关系倒序清理（模板 → 业务表 → 账号体系）
DROP TABLE IF EXISTS `bill`;
DROP TABLE IF EXISTS `category`;
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `category_template`;
DROP TABLE IF EXISTS `account_template`;
DROP TABLE IF EXISTS `password_reset_code`;
DROP TABLE IF EXISTS `user_session`;
DROP TABLE IF EXISTS `user`;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- 表 1：user —— 用户账号（F1 账号：注册/登录/找回/锁定/注销）
-- -------------------------------------------------------------------------------------
-- · 密码只存 bcrypt/argon2 编码串（编码串内已含随机盐），故不设独立 salt 列，
--   同样满足 PRD「密码只存哈希 + 盐」与「禁止明文/可逆加密」的要求
-- · 注销走状态机（PRD §7）：active → deleting（冷静期 7 天，可登录撤销）→ deleted（墓碑行，
--   仅保留 id/username 占位防止用户名被他人重新注册冒用；账单等业务数据已物理删除）
-- · failed_login_count / locked_until 支撑 F1-3「连续密码错误 ≥ 5 次锁定 10 分钟」
-- =====================================================================================
CREATE TABLE `user` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户 ID（主键）',
  `username`           VARCHAR(20)     NOT NULL COMMENT '用户名，2–20 字符（中文/字母/数字/下划线，应用层校验格式）；列排序规则不区分大小写 → 唯一索引即实现 F1-1 大小写不敏感查重',
  `password_hash`      VARCHAR(255)    NOT NULL COMMENT '密码哈希（bcrypt/argon2 编码串，内含盐；注销期满后清空）',
  `status`             ENUM('active','deleting','deleted') NOT NULL DEFAULT 'active' COMMENT '账号状态机：active 正常 / deleting 注销冷静期（7 天，登录可撤销）/ deleted 已注销墓碑',
  `avatar_url`         VARCHAR(500)    NULL COMMENT '头像图片 URL/路径（10 我的页上传，文件存对象存储或静态目录，库里只存地址；默认无头像）',
  `failed_login_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续登录失败次数（成功登录后清零；≥5 触发锁定，F1-3）',
  `locked_until`       DATETIME        NULL COMMENT '登录锁定截止时间（锁定期间即使密码正确也拒绝登录，F1-3）',
  `purge_at`           DATETIME        NULL COMMENT '注销冷静期到期时间（申请注销时 = 当时 + 7 天，F1-9；定时任务到期清扫）',
  `last_login_at`      DATETIME        NULL COMMENT '最近一次登录成功时间',
  `created_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_username` (`username`),
  CONSTRAINT `chk_user_username_len` CHECK (CHAR_LENGTH(`username`) BETWEEN 2 AND 20)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户账号表：用户名密码登录/注册/找回密码/锁定/注销状态机（PRD F1）';

-- =====================================================================================
-- 表 2：user_session —— 登录态会话（F1-7「30 天滑动续期」/ F1-8 登出）
-- -------------------------------------------------------------------------------------
-- · 服务端会话方案：令牌本体（随机串）只存于用户 Cookie，库中存其 SHA-256 哈希，
--   泄库不等于泄登录态
-- · 「滑动续期」= 每次请求校验通过后 UPDATE expires_at = NOW() + 30 天
-- · 若后端最终采用 JWT 无状态方案，可不建/不用本表（保留不影响其余设计）
-- =====================================================================================
CREATE TABLE `user_session` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话 ID（主键）',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '所属用户',
  `token_hash` CHAR(64)        NOT NULL COMMENT '会话令牌的 SHA-256 哈希（64 位十六进制；令牌明文只在 Cookie）',
  `expires_at` DATETIME        NOT NULL COMMENT '会话过期时间（30 天滑动续期，每次访问刷新）',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '会话创建时间（本次登录时间）',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近活跃时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_token` (`token_hash`),
  KEY `idx_session_user` (`user_id`),
  KEY `idx_session_expires` (`expires_at`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '登录态会话表：30 天滑动续期（PRD F1-7/F1-8；JWT 方案可省）';

-- =====================================================================================
-- 表 3：password_reset_code —— 找回密码验证码（F1-5）
-- -------------------------------------------------------------------------------------
-- · 6 位数字验证码，发送后 60s 内不可重发（应用层按 user_id + created_at 判断）
-- · fail_count ≥ 5 即作废，须重新获取（F1-5 业务规则）
-- · V1 正式版接入短信/邮箱通道前的演示码同样落本表；验证通过置 used_at，
--   同一码不可复用；定时任务按 expires_at 清理过期行
-- =====================================================================================
CREATE TABLE `password_reset_code` (
  `id`         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '验证码记录 ID（主键）',
  `user_id`    BIGINT UNSIGNED  NOT NULL COMMENT '申请找回密码的用户',
  `code`       CHAR(6)          NOT NULL COMMENT '6 位数字验证码',
  `expires_at` DATETIME         NOT NULL COMMENT '过期时间（建议生成后 10 分钟）',
  `fail_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '验证失败次数（≥5 作废，F1-5）',
  `used_at`    DATETIME         NULL COMMENT '验证通过时间（非 NULL 即已使用，不可再用）',
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成/发送时间（60s 重发间隔以此判断）',
  PRIMARY KEY (`id`),
  KEY `idx_code_user_created` (`user_id`, `created_at`),
  KEY `idx_code_expires` (`expires_at`),
  CONSTRAINT `fk_code_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_code_format` CHECK (`code` REGEXP '^[0-9]{6}$')
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '找回密码验证码表（PRD F1-5：60s 重发间隔、错 5 次作废）';

-- =====================================================================================
-- 表 4：category_template —— 分类模板清单（仅作参考，PRD 附录 A「生活账」）
-- -------------------------------------------------------------------------------------
-- · 与 category 表结构对齐但无 user_id：全局只读的参考清单。V1.9 起注册不再复制模板，
--   新账号分类初始为空、由用户自行添加；本表仅存附录 A 生活账样例，供演示/参考
-- · 不再被注册接口读取；如确需给存量账号批量补分类，可按本表 SELECT 复制（is_system=1）
-- =====================================================================================
CREATE TABLE `category_template` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '模板行 ID（主键）',
  `scope`      ENUM('expense','income') NOT NULL COMMENT '归属类型：expense 支出 / income 收入',
  `name`       VARCHAR(16)     NOT NULL COMMENT '分类名称（模板最长 4 个汉字：水果生鲜/人情往来）',
  `icon`       VARCHAR(16)     NOT NULL COMMENT '分类图标（emoji，utf8mb4 存储）',
  `sort`       INT             NOT NULL DEFAULT 0 COMMENT '九宫格排序（值小在前；间隔 10 便于中间插入）',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '模板行创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_ct_scope_sort` (`scope`, `sort`),
  CONSTRAINT `uq_ct_scope_name` UNIQUE (`scope`, `name`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '分类模板清单：PRD 附录 A 生活账样例（V1.9 起仅作参考，注册不再复制）';

-- =====================================================================================
-- 表 5：account_template —— 支付方式（账户）默认模板清单（F3-9 参考样例）
-- -------------------------------------------------------------------------------------
-- · 仅作参考清单：V1.9 起注册不再复制，新账号账户初始为空、由用户自行添加
-- · 注意：账户仅是账单的「支付方式标记」，无余额字段——不构成 PRD 3.2 范围外的多账户余额体系
-- =====================================================================================
CREATE TABLE `account_template` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '模板行 ID（主键）',
  `name`       VARCHAR(16)     NOT NULL COMMENT '账户名称（默认四项：微信/支付宝/现金/银行卡）',
  `emoji`      VARCHAR(16)     NOT NULL COMMENT '账户图标（emoji）',
  `remark`     VARCHAR(24)     NULL COMMENT '账户备注（可选）',
  `sort`       INT             NOT NULL DEFAULT 0 COMMENT '展示排序（值小在前）',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '模板行创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_at_sort` (`sort`),
  CONSTRAINT `uq_at_name` UNIQUE (`name`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '支付方式默认模板清单：F3-9 参考样例（V1.9 起仅作参考，注册不再复制）';

-- =====================================================================================
-- 表 6：category —— 记账分类（F3-3/3-4 九宫格、F4 流水展示、F7 分类占比、13 分类管理页）
-- -------------------------------------------------------------------------------------
-- · 实现层调整（相对 PRD §7 草案「系统分类 user_id 为 NULL」）：分类全部为用户自有行。
--   V1.9 起注册不再复制模板，新账号分类初始为空、由用户自行添加（is_system=0）；
--   好处：天然支持 V1.1 的分类编辑/删除/排序，查询无需 OR NULL 分支；
--   is_system 仅标记「是否来自模板复制」（当前均为 0，V1 内与用户新增行为一致）
-- · 唯一约束 (user_id, scope, name) + 不区分大小写排序规则 → F3-4 分类查重；
--   「其他」兜底分类同样是普通行，不特殊对待
-- =====================================================================================
CREATE TABLE `category` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类 ID（主键）',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '所属用户（严格隔离，所有查询强制过滤，防横向越权）',
  `scope`      ENUM('expense','income') NOT NULL COMMENT '归属类型：expense 支出 / income 收入（05 页顶部双分段）',
  `name`       VARCHAR(16)     NOT NULL COMMENT '分类名称（V1 新增限 ≤4 个汉字——F3-4，应用层校验；列宽为 V1.1 放宽预留）',
  `icon`       VARCHAR(16)     NOT NULL DEFAULT '📝' COMMENT '分类图标（emoji，置于浅粉圆底展示）',
  `sort`       INT             NOT NULL DEFAULT 0 COMMENT '九宫格排序（值小在前，默认选中第一个分类即 sort 最小者）',
  `is_system`  TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否模板初始化：1=自附录 A 模板复制（V1.9 起注册不再复制，均为 0）/ 0=用户自定义新增（V1 内两者行为一致）',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cat_user_scope_name` (`user_id`, `scope`, `name`),
  KEY `idx_cat_user_scope_sort` (`user_id`, `scope`, `sort`),
  CONSTRAINT `fk_cat_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '记账分类表：支出/收入双 scope 九宫格（PRD F3/F4/F7；注册不初始化，用户自行添加）';

-- =====================================================================================
-- 表 7：account —— 支付方式（账户）标记（F3-9 选填标记 + 12 账户管理页 CRUD）
-- -------------------------------------------------------------------------------------
-- · 对应 003 原型 12 页：emoji + 名称（≤8 字）+ 备注（≤12 字），增删改查
-- · 仅作为账单上的「支付方式/收款账户」标签，无余额、无期初、无对账——
--   多账户余额体系属 V2.x（PRD 3.2 范围外），本表刻意不含任何金额字段
-- · 用户删除账户时，其账单的 account_id 置 NULL（回落为「未标记」，PRD F5-1 显示「—」）
-- =====================================================================================
CREATE TABLE `account` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '账户 ID（主键）',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '所属用户（严格隔离）',
  `name`       VARCHAR(16)     NOT NULL COMMENT '账户名称（12 页限 ≤8 字，应用层校验；默认四项：微信/支付宝/现金/银行卡）',
  `emoji`      VARCHAR(16)     NOT NULL DEFAULT '💰' COMMENT '账户图标（emoji）',
  `remark`     VARCHAR(24)     NULL COMMENT '账户备注（可选，12 页限 ≤12 字）',
  `sort`       INT             NOT NULL DEFAULT 0 COMMENT 'chips 展示排序（值小在前）',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acct_user_name` (`user_id`, `name`),
  KEY `idx_acct_user_sort` (`user_id`, `sort`),
  CONSTRAINT `fk_acct_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '支付方式（账户）标记表：仅账单标签非余额体系（PRD F3-9 + 原型 12 页）';

-- =====================================================================================
-- 表 8：bill —— 账单流水（核心表：F3 记一笔 / F4 流水 / F5 详情编辑删除 / F7 统计）
-- -------------------------------------------------------------------------------------
-- · amount 为「分」的整数（INT UNSIGNED，上限 99999999 分 = ¥999,999.99，恰为 F3-1 金额上限），
--   CHECK 约束兜底禁止 0/负数/越上限——全程无浮点
-- · bill_date 支持跨月/跨年（F3-6，最早 2000-01-01，DB 兜底下限；「不可选未来日期」由应用层保证）
-- · 组内排序按 created_at 倒序（F4-3）；「记录时间」= created_at（F5-1）
-- · category_id 外键 RESTRICT → PRD §7 关键约束「分类被账单引用后不可物理删除」由数据库兜底
-- =====================================================================================
CREATE TABLE `bill` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '账单 ID（主键）',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '所属用户（严格隔离，所有查询强制过滤，防横向越权——PRD §5 安全）',
  `type`        ENUM('expense','income') NOT NULL COMMENT '记账类型：expense 支出（展示「-」深灰）/ income 收入（展示「+」薄荷绿）',
  `amount`      INT UNSIGNED    NOT NULL COMMENT '金额，整数单位：分（如 32.00 元存 3200；全程禁用浮点——PRD 架构硬约定）',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '分类 ID（RESTRICT：被引用的分类不可物理删除）',
  `account_id`  BIGINT UNSIGNED NULL COMMENT '支付方式/收款账户 ID（选填标记，NULL=未标记「—」；账户被删时置 NULL）',
  `note`        VARCHAR(50)     NULL COMMENT '备注（选填，≤50 字，F3-5；NULL 与空串均视为未填）',
  `bill_date`   DATE            NOT NULL COMMENT '记账日期（默认今天，应用层保证不可选未来；跨月跨年可选，F3-6）',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间（首次保存时间；F4-3 组内倒序、F5-1 详情展示）',
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近编辑时间（F5 编辑）',
  PRIMARY KEY (`id`),
  KEY `idx_bill_user_date_created` (`user_id`, `bill_date`, `created_at`) COMMENT 'F4 月区间查询 + 日组内 created_at 倒序；F7 年度聚合',
  KEY `idx_bill_user_category` (`user_id`, `category_id`) COMMENT '分类引用检查（删除保护）与按分类回查',
  CONSTRAINT `fk_bill_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bill_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bill_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_bill_amount` CHECK (`amount` BETWEEN 1 AND 99999999),
  CONSTRAINT `chk_bill_date_lower` CHECK (`bill_date` >= DATE'2000-01-01')
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '账单流水表（核心）：金额以分存储（PRD F3/F4/F5/F7）';
