-- =====================================================================================
-- 财务管家 · 种子数据脚本（模板 + 演示数据）
-- -------------------------------------------------------------------------------------
-- 依赖：先执行 01_schema.sql
-- 内容：
--   1) category_template —— PRD 附录 A「生活账」模板清单（V1.9 起仅作参考，注册不再复制）
--   2) account_template  —— 支付方式默认四项参考样例（F3-9 / 原型 12 页）
--   3) 演示账号 demo     —— 手工铺一套完整账本数据（复制模板生成分类/账户 + 示例账单），
--      供 003 原型联调与后端自测；正式环境可只执行第 1、2 部分
-- 注意：演示账密的 password_hash 为占位串（无法通过校验登录），联调请走注册接口
--       生成真实 bcrypt/argon2 哈希后替换，或直接用注册接口新建账号
-- 金额：所有演示金额均为「分」（如 3200 = ¥32.00）
-- =====================================================================================

SET NAMES utf8mb4;
USE `financial_steward`;

-- =====================================================================================
-- 1. 分类模板（PRD 附录 A · 生活账；生意账清单已转为用户自定义参考，不入模板）
-- =====================================================================================
INSERT INTO `category_template` (`scope`, `name`, `icon`, `sort`) VALUES
  -- 支出 · 生活账（12 项 + 兜底「其他」）
  ('expense', '餐饮',     '🍜', 10),
  ('expense', '交通',     '🚌', 20),
  ('expense', '购物',     '🛒', 30),
  ('expense', '日用',     '🧻', 40),
  ('expense', '水果生鲜', '🥬', 50),
  ('expense', '娱乐',     '🎮', 60),
  ('expense', '通讯',     '📱', 70),
  ('expense', '居住',     '🏠', 80),
  ('expense', '医疗',     '💊', 90),
  ('expense', '教育',     '📚', 100),
  ('expense', '人情往来', '🎁', 110),
  ('expense', '宠物',     '🐾', 120),
  ('expense', '其他',     '📝', 130),
  -- 收入 · 生活账（5 项 + 兜底「其他」）
  ('income',  '工资',     '💰', 10),
  ('income',  '奖金',     '🧧', 20),
  ('income',  '兼职',     '💼', 30),
  ('income',  '理财收益', '📈', 40),
  ('income',  '红包',     '🎊', 50),
  ('income',  '其他',     '📝', 60);

-- =====================================================================================
-- 2. 支付方式默认模板（F3-9 四项；名称与原型 12 页初始账户对齐）
-- =====================================================================================
INSERT INTO `account_template` (`name`, `emoji`, `remark`, `sort`) VALUES
  ('微信',   '💚', '第三方支付',       10),
  ('支付宝', '💙', '第三方支付',       20),
  ('现金',   '💰', '零钱与日常现金',   30),
  ('银行卡', '🏦', '储蓄卡 · 日常消费', 40);

-- =====================================================================================
-- 3. 演示账号（手工铺数据：建号 → 复制分类/账户模板 → 记几笔账）
-- —— 正式环境执行到上一节为止即可 ——
-- =====================================================================================

-- 3.1 演示用户（密码哈希为占位，见文件头说明）
INSERT INTO `user` (`username`, `password_hash`, `status`, `last_login_at`) VALUES
  ('demo', '$2a$10$PLACEHOLDER_DEMO_ONLY_REPLACE_VIA_REGISTER_API', 'active', NULL);
SET @uid = LAST_INSERT_ID();

-- 3.2 演示数据：复制模板生成分类/账户（仅演示用；正式注册接口已不再复制，见 V1.9）
INSERT INTO `category` (`user_id`, `scope`, `name`, `icon`, `sort`, `is_system`)
SELECT @uid, t.`scope`, t.`name`, t.`icon`, t.`sort`, 1
FROM `category_template` t;

INSERT INTO `account` (`user_id`, `name`, `emoji`, `remark`, `sort`)
SELECT @uid, t.`name`, t.`emoji`, t.`remark`, t.`sort`
FROM `account_template` t;

-- 3.3 取演示分类/账户 ID（便于账单外键引用）
SELECT id INTO @cat_food   FROM `category` WHERE user_id = @uid AND scope = 'expense' AND name = '餐饮';
SELECT id INTO @cat_traffic FROM `category` WHERE user_id = @uid AND scope = 'expense' AND name = '交通';
SELECT id INTO @cat_shopping FROM `category` WHERE user_id = @uid AND scope = 'expense' AND name = '购物';
SELECT id INTO @cat_fruit   FROM `category` WHERE user_id = @uid AND scope = 'expense' AND name = '水果生鲜';
SELECT id INTO @cat_salary  FROM `category` WHERE user_id = @uid AND scope = 'income'  AND name = '工资';
SELECT id INTO @cat_interest FROM `category` WHERE user_id = @uid AND scope = 'income' AND name = '理财收益';

SELECT id INTO @acct_wechat  FROM `account` WHERE user_id = @uid AND name = '微信';
SELECT id INTO @acct_alipay  FROM `account` WHERE user_id = @uid AND name = '支付宝';
SELECT id INTO @acct_cash    FROM `account` WHERE user_id = @uid AND name = '现金';
SELECT id INTO @acct_bank    FROM `account` WHERE user_id = @uid AND name = '银行卡';

-- 3.4 示例账单（2026-10，金额单位：分；覆盖 支出/收入、有无备注、有无支付标记 各情形）
INSERT INTO `bill` (`user_id`, `type`, `amount`, `category_id`, `account_id`, `note`, `bill_date`, `created_at`) VALUES
  (@uid, 'expense', 3200,    @cat_food,     @acct_wechat, '午饭',       DATE'2026-10-20', '2026-10-20 12:30:00'),
  (@uid, 'expense', 600,     @cat_traffic,  NULL,         '地铁',       DATE'2026-10-20', '2026-10-20 08:45:00'),
  (@uid, 'expense', 48000,   @cat_shopping, @acct_alipay, '本周食材',   DATE'2026-10-19', '2026-10-19 18:20:00'),
  (@uid, 'income',  1200000, @cat_salary,   @acct_bank,   '十月工资',   DATE'2026-10-19', '2026-10-19 10:00:00'),
  (@uid, 'expense', 3680,    @cat_fruit,    @acct_cash,   NULL,         DATE'2026-10-18', '2026-10-18 19:05:00'),
  (@uid, 'income',  1520,    @cat_interest, NULL,         NULL,         DATE'2026-10-18', '2026-10-18 21:30:00');
