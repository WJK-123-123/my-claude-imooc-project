// F1 账号 E2E（对应 01-用户端Web前端-测试计划：FE-001 ~ FE-007、FE-501）
// 选择器取自 02_login.html / 02_register.html 真实内联脚本，断言均为真实 DOM 行为。
import { test, expect } from '@playwright/test';
import { registerViaApi, uniqueName } from './e2e-helpers.js';

const PASSWORD = 'Qa123456!';

test('FE-001 登录页未勾选协议提交 → 提示且不发请求', async ({ page }) => {
  await page.goto('/pages/02_login.html');
  await page.fill('input[name="login-off"]', 'whatever');
  await page.fill('input[name="password-off"]', PASSWORD);
  await page.click('#form-login button[type="submit"]');
  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#form-error')).toContainText('同意用户协议');
  await expect(page).toHaveURL(/02_login\.html/); // 仍停在登录页，未跳转
});

test('FE-002 登录空用户名/密码提交 → 中文错误提示', async ({ page }) => {
  await page.goto('/pages/02_login.html');
  await page.check('#login-agreement');
  await page.click('#form-login button[type="submit"]');
  await expect(page.locator('#form-error')).toContainText('请输入用户名和密码');
});

test('FE-004 登录成功 → 跳转 05 记一笔页', async ({ page, request }) => {
  const acct = await registerViaApi(request); // 先造一个真实账号
  await page.goto('/pages/02_login.html');
  await page.fill('input[name="login-off"]', acct.username);
  await page.fill('input[name="password-off"]', acct.password);
  await page.check('#login-agreement');
  await page.click('#form-login button[type="submit"]');
  await page.waitForURL('**/05_add_record.html');
  await expect(page.locator('#tab-expense')).toBeVisible();
  await expect(page.locator('#save-btn')).toBeVisible();
});

test('FE-005 登录页 ↔ 注册页互跳', async ({ page }) => {
  await page.goto('/pages/02_login.html');
  await page.getByText('没有账号？立即注册').click();
  await expect(page).toHaveURL(/02_register\.html/);
  await page.getByText('已有账号？直接登录').click();
  await expect(page).toHaveURL(/02_login\.html/);
});

test('FE-006 注册：两次密码不一致 → 中文错误行，不注册', async ({ page }) => {
  const u = uniqueName('mm');
  await page.goto('/pages/02_register.html');
  await page.fill('input[name="reg-username-off"]', u);
  await page.fill('input[name="reg-password-off"]', PASSWORD);
  await page.fill('input[name="reg-password2-off"]', 'Diff123!');
  await page.check('#reg-agreement');
  await page.click('#form-register button[type="submit"]');
  await expect(page.locator('#form-error')).toContainText('两次输入的密码不一致');
  await expect(page).toHaveURL(/02_register\.html/);
});

test('FE-006b 注册：弱密码 → 弹密码规范提示框拦截', async ({ page }) => {
  await page.goto('/pages/02_register.html');
  await page.fill('input[name="reg-username-off"]', uniqueName('wk'));
  await page.fill('input[name="reg-password-off"]', 'abc123');
  await page.fill('input[name="reg-password2-off"]', 'abc123');
  await page.check('#reg-agreement');
  await page.click('#form-register button[type="submit"]');
  await expect(page.locator('#modal-container')).toContainText('密码不符合规范');
  await expect(page).toHaveURL(/02_register\.html/);
});

test('FE-007 注册成功 → 自动登录直进 05 记一笔页', async ({ page }) => {
  const u = uniqueName('reg');
  await page.goto('/pages/02_register.html');
  await page.fill('input[name="reg-username-off"]', u);
  await page.fill('input[name="reg-password-off"]', PASSWORD);
  await page.fill('input[name="reg-password2-off"]', PASSWORD);
  await page.check('#reg-agreement');
  await page.click('#form-register button[type="submit"]');
  await page.waitForURL('**/05_add_record.html');
  await expect(page.locator('#tab-expense')).toBeVisible();
});

test('FE-501 未登录访问受保护页 → 重定向回登录页', async ({ page }) => {
  await page.goto('/pages/06_transaction_history.html');
  await expect(page).toHaveURL(/02_login\.html/);
});
