// 测试集中配置：后端地址、会话 Cookie、测试账号/密码。
// 均可被环境变量覆盖，方便切换环境（如真机局域网 IP、CI 环境）。

// 后端地址（003.前端代码/backend 服务，3000 端口；同时被 Web 前端与 006 跨端 APP 复用）
export const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// 会话 Cookie 名（与后端 src/utils/session.js 一致）
export const SESSION_COOKIE = 'fgj_session';

// 测试账号 A/B：用于横向越权用例（用他人资源 ID 访问自己的接口）。
// 密码须满足后端规范：6–20 位、无空格、含数字/小写/大写/特殊字符四类中的至少三类。
export const TEST_USER_A = process.env.TEST_USER_A || 'qa_account_a';
export const TEST_USER_B = process.env.TEST_USER_B || 'qa_account_b';
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Qa123456!';

// 演示数据账号（可选）：如需「有账单/有分类」的流水与统计用例，
// 用 004/02_seed.sql 预置的账号填入，否则相关用例会新建随机账号自行造数。
export const SEED_USER = process.env.SEED_USER || '';
export const SEED_PASSWORD = process.env.SEED_PASSWORD || '';
