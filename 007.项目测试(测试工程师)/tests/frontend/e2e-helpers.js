// 前端 E2E 公共夹具：注册新账号 → 注入会话 Cookie → 经 page.request 播种分类/账户/账单。
// 说明：后端 Cookie 为 httpOnly，无法从页面 JS 读取，这里直接经 HTTP 响应头提取后 addCookies；
//       page.request 与浏览器上下文共享 Cookie，播种/校验均走真实后端接口，不绕过鉴权。
import { expect } from '@playwright/test';

const SESSION_COOKIE = 'fgj_session';
const PASSWORD = 'Qa123456!';
const BASE = 'http://localhost:3000';

export function uniqueName(prefix = 'e2e') {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// 本地日期 YYYY-MM-DD（测试机与后端同时区，账单默认落在本月）
export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 经 API 注册（成功即自动登录），返回 { username, password, cookies }
export async function registerViaApi(request) {
  const username = uniqueName();
  const res = await request.post('/api/auth/register', {
    data: { username, password: PASSWORD, confirmPassword: PASSWORD },
  });
  expect(res.ok(), `注册 ${username} 失败: ${res.status()}`).toBeTruthy();

  const setCookie = res.headers()['set-cookie'] || '';
  const m = setCookie.match(new RegExp(SESSION_COOKIE + '=([^;]+)'));
  const token = m ? m[1] : '';
  return {
    username,
    password: PASSWORD,
    cookies: [{ name: SESSION_COOKIE, value: token, url: BASE + '/', httpOnly: true }],
  };
}

// 注册并把 Cookie 注入浏览器上下文，使页面处于「已登录」态
export async function loginContext(context, request) {
  const acct = await registerViaApi(request);
  await context.addCookies(acct.cookies);
  return acct;
}

// 捕获页面下一次 alert() 的消息（页面校验大量使用 alert，Playwright 默认自动 dismiss）
export function nextDialog(page) {
  return new Promise((resolve) => {
    page.once('dialog', (d) => {
      d.accept();
      resolve(d.message());
    });
  });
}

// —— 播种工具：走真实 /api/*（page.request 带会话 Cookie），返回后端创建的实体 ——

export async function seedCategory(page, { scope = 'expense', name, icon = '🍜' }) {
  const res = await page.request.post('/api/categories', { data: { scope, name, icon } });
  const data = await res.json().catch(() => ({}));
  expect(res.ok(), `播种分类失败: ${res.status()} ${JSON.stringify(data)}`).toBeTruthy();
  return data.category;
}

export async function seedAccount(page, { name, emoji = '💚', remark = '' }) {
  const res = await page.request.post('/api/accounts', { data: { name, emoji, remark } });
  const data = await res.json().catch(() => ({}));
  expect(res.ok(), `播种账户失败: ${res.status()} ${JSON.stringify(data)}`).toBeTruthy();
  return data.account;
}

export async function seedBill(page, { type, amount, categoryId, accountId, note, billDate }) {
  const res = await page.request.post('/api/bills', {
    data: { type, amount, categoryId, accountId, note: note ?? null, billDate },
  });
  const data = await res.json().catch(() => ({}));
  expect(res.ok(), `播种账单失败: ${res.status()} ${JSON.stringify(data)}`).toBeTruthy();
  return data.bill;
}
