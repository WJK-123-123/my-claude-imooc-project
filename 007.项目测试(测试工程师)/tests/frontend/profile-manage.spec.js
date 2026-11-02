// 我的 / 退出 / 账户管理 / 分类管理 E2E（对应 FE-401、FE-404、FE-406、FE-407）
// 选择器取自 10_profile.html / 12_account_manage.html / 13_category_manage.html 真实内联脚本。
import { test, expect } from '@playwright/test';
import { loginContext, seedCategory, seedBill, nextDialog, todayStr } from './e2e-helpers.js';

test('FE-401 我的页：昵称/注册日/记账微卡取 /api/auth/me 实时数据', async ({ page, context, request }) => {
  const acct = await loginContext(context, request);
  await page.goto('/pages/10_profile.html');
  // 昵称回显真实用户名（而非演示名「小桃子酱」）
  await expect(page.locator('#profile-username')).toHaveText(acct.username);
  await expect(page.locator('#profile-reg')).toHaveText(/注册于 \d{4}-\d{2}-\d{2}/);
  // 新账号三项记账微卡均为 0
  await expect(page.locator('#stat-total')).toHaveText('0');
  await expect(page.locator('#stat-days')).toHaveText('0');
  await expect(page.locator('#stat-month')).toHaveText('0');
});

test('FE-404 退出登录：弹窗确认 → 清会话回登录页', async ({ page, context, request }) => {
  await loginContext(context, request);
  await page.goto('/pages/10_profile.html');
  await page.getByRole('button', { name: /退出登录/ }).click();
  await expect(page.locator('#modal-container')).toContainText('确定要退出登录吗');
  await page.locator('#modal-container').getByRole('button', { name: '退出', exact: true }).click();
  await expect(page).toHaveURL(/02_login\.html/);
});

test('FE-406 账户管理：增/查/改/删 + 重名拦截', async ({ page, context, request }) => {
  await loginContext(context, request);
  await page.goto('/pages/12_account_manage.html');
  await expect(page.locator('#acct-empty')).toBeVisible(); // 新账号空状态

  // 添加
  await page.getByRole('button', { name: /添加账户/ }).click();
  await page.fill('#acct-name', '微信');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#acct-list')).toContainText('微信');

  // 重名拦截
  await page.getByRole('button', { name: /添加账户/ }).click();
  await page.fill('#acct-name', '微信');
  const dupP = nextDialog(page);
  await page.getByRole('button', { name: '保存' }).click();
  expect(await dupP).toContain('账户名称已存在');
  await page.locator('#acct-modal').getByRole('button', { name: '取消' }).click();

  // 编辑改名
  await page.locator('#acct-list').getByRole('button', { name: '编辑' }).click();
  await page.fill('#acct-name', '支付宝');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#acct-list')).toContainText('支付宝');
  await expect(page.locator('#acct-list')).not.toContainText('微信');

  // 删除
  await page.locator('#acct-list').getByRole('button', { name: '删除' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.locator('#acct-empty')).toBeVisible();
});

test('FE-407 分类管理：支出/收入双 Tab CRUD', async ({ page, context, request }) => {
  await loginContext(context, request);
  await page.goto('/pages/13_category_manage.html');
  await expect(page.locator('#cat-empty')).toBeVisible();

  // 添加支出分类
  await page.getByRole('button', { name: /添加分类/ }).click();
  await page.fill('#cat-name', '餐饮');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#cat-list')).toContainText('餐饮');

  // 收入 Tab 独立：空 → 添加收入分类
  await page.click('#tab-income');
  await expect(page.locator('#cat-empty')).toBeVisible();
  await page.getByRole('button', { name: /添加分类/ }).click();
  await page.fill('#cat-name', '工资');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#cat-list')).toContainText('工资');

  // 切回支出删除「餐饮」
  await page.click('#tab-expense');
  await page.locator('#cat-list').getByRole('button', { name: '删除' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.locator('#cat-empty')).toBeVisible();
});

test('FE-407b 被账单引用的分类删除 → 提示无法删除', async ({ page, context, request }) => {
  await loginContext(context, request);
  const cat = await seedCategory(page, { scope: 'expense', name: '餐饮', icon: '🍜' });
  await seedBill(page, {
    type: 'expense', amount: 1234, categoryId: cat.id, accountId: null,
    note: '午饭', billDate: todayStr(),
  });
  await page.goto('/pages/13_category_manage.html');
  await expect(page.locator('#cat-list')).toContainText('餐饮');
  await page.locator('#cat-list').getByRole('button', { name: '删除' }).click();
  const dialogP = nextDialog(page);
  await page.getByRole('button', { name: '确认删除' }).click();
  expect(await dialogP).toContain('该分类下已有账单');
  // 分类仍在
  await expect(page.locator('#cat-list')).toContainText('餐饮');
});
