// F4 流水 E2E（对应 FE-201、FE-206）
// 选择器取自 06_transaction_history.html 真实内联脚本：账单项点击 → 详情弹层 → 编辑/删除。
import { test, expect } from '@playwright/test';
import { loginContext, seedCategory, seedAccount, seedBill, todayStr } from './e2e-helpers.js';

// 播种一笔「餐饮 12.34 元」支出后进入流水页
async function setupBill(page, context, request) {
  await loginContext(context, request);
  const cat = await seedCategory(page, { scope: 'expense', name: '餐饮', icon: '🍜' });
  const acct = await seedAccount(page, { name: '微信', emoji: '💚' });
  await seedBill(page, {
    type: 'expense', amount: 1234, categoryId: cat.id, accountId: acct.id,
    note: '午饭', billDate: todayStr(),
  });
  await page.goto('/pages/06_transaction_history.html');
  await expect(page.locator('#bill-list').getByText('餐饮')).toBeVisible();
}

test('FE-201 流水页：本月账单倒序渲染 + 汇总卡同步', async ({ page, context, request }) => {
  await setupBill(page, context, request);
  // 账单项：分类名 + 金额（-¥12.34）+ 账户
  const item = page.locator('#bill-list .bg-surface-container-lowest').filter({ hasText: '餐饮' });
  await expect(item).toContainText('餐饮');
  await expect(item).toContainText('-¥12.34');
  await expect(item).toContainText('微信');
  // 汇总卡：本月支出 = ¥ 12.34，结余 = -¥ 12.34（收入 0）
  await expect(page.locator('#sum-expense')).toHaveText('¥ 12.34');
  await expect(page.locator('#sum-income')).toHaveText('¥ 0.00');
  await expect(page.locator('#sum-balance')).toHaveText('-¥ 12.34');
});

test('FE-206 详情弹层：编辑金额 → 列表刷新；删除 → 空状态', async ({ page, context, request }) => {
  await setupBill(page, context, request);

  // 打开详情弹层，校验字段
  await page.locator('#bill-list').getByText('餐饮').click();
  await expect(page.locator('#modal-category')).toHaveText('餐饮');
  await expect(page.locator('#modal-amount')).toHaveText('-¥12.34');
  await expect(page.locator('#modal-type')).toHaveText('支出');
  await expect(page.locator('#modal-note')).toHaveText('午饭');
  await expect(page.locator('#modal-account')).toHaveText('微信');

  // 编辑金额 12.34 → 9.99
  await page.locator('#modal-content').getByRole('button', { name: '编辑' }).click();
  await expect(page.locator('#edit-overlay')).toBeVisible();
  await page.fill('#edit-amount', '9.99');
  await page.click('#edit-save-btn');
  await expect(page.locator('#bill-list')).toContainText('-¥9.99');

  // 再次打开详情并删除
  await page.locator('#bill-list').getByText('餐饮').click();
  await page.locator('#modal-content').getByRole('button', { name: '删除记录' }).click();
  await page.locator('#delete-confirm-modal').getByRole('button', { name: '确认删除' }).click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#empty-title')).toContainText('还没有记账');
});
