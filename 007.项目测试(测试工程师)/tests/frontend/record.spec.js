// F3 记一笔 E2E（对应 FE-101 ~ FE-105）
// 选择器取自 05_add_record.html 真实内联脚本；金额经只读输入框直接注入，校验逻辑与键盘路径共用 parseAmountToCents。
import { test, expect } from '@playwright/test';
import { loginContext, seedCategory, seedAccount, nextDialog } from './e2e-helpers.js';

async function enterAmount(page, value) {
  await page.evaluate((v) => { document.getElementById('amount-input').value = v; }, value);
}

// 播种一个「有分类/账户」的账号并打开记一笔页，等待分类渲染完成
async function setupRecord(page, context, request) {
  await loginContext(context, request);
  await seedCategory(page, { scope: 'expense', name: '餐饮', icon: '🍜' });
  await seedCategory(page, { scope: 'income', name: '工资', icon: '💰' });
  await seedAccount(page, { name: '微信', emoji: '💚' });
  await page.goto('/pages/05_add_record.html');
  await expect(page.locator('#category-grid .category-btn').first()).toBeVisible();
}

test('FE-101 支出/收入切换 → 双主题联动（颜色/文案/分类过滤）', async ({ page, context, request }) => {
  await setupRecord(page, context, request);
  // 默认支出主题：Tab 粉、保存键 primary-container
  await expect(page.locator('#tab-expense')).toHaveClass(/bg-primary/);
  await expect(page.locator('#save-btn')).toHaveClass(/bg-primary-container/);
  await expect(page.locator('#note-input')).toHaveAttribute('placeholder', '这笔钱花在哪里了？');

  // 切到收入
  await page.click('#tab-income');
  await expect(page.locator('#tab-income')).toHaveClass(/bg-secondary/);
  await expect(page.locator('#save-btn')).toHaveClass(/bg-secondary-container/);
  await expect(page.locator('#note-input')).toHaveAttribute('placeholder', '这笔钱从哪儿来呀？');
  await expect(page.locator('#acct-label')).toHaveText('收款账户');
  // 分类按 scope 过滤：收入 Tab 显示「工资」，支出分类「餐饮」不应出现
  await expect(page.locator('#category-grid .category-btn').filter({ hasText: '工资' })).toBeVisible();
  await expect(page.locator('#category-grid .category-btn').filter({ hasText: '餐饮' })).toHaveCount(0);
});

test('FE-105 空账号不选分类直接保存 → alert 请先选择分类', async ({ page, context, request }) => {
  await loginContext(context, request); // 新账号无分类/账户
  await page.goto('/pages/05_add_record.html');
  await expect(page.locator('#category-grid')).toContainText('暂无分类');
  await enterAmount(page, '12.34');
  const dialogP = nextDialog(page);
  await page.click('#save-btn');
  expect(await dialogP).toContain('请先选择分类');
});

test('FE-102 金额边界：0.001/0/超上限 → 拒绝；0.01 → 可保存', async ({ page, context, request }) => {
  await setupRecord(page, context, request);
  // 非法金额一律 alert「请输入有效金额」
  for (const bad of ['0.001', '0', '100000000']) {
    await enterAmount(page, bad);
    const dialogP = nextDialog(page);
    await page.click('#save-btn');
    expect(await dialogP).toContain('请输入有效金额');
  }
  // 0.01 合法：保存成功 toast + 金额复位
  await enterAmount(page, '0.01');
  await page.click('#save-btn');
  await expect(page.locator('#success-toast')).toHaveClass(/opacity-100/);
  await expect(page.locator('#success-toast')).toContainText('记账成功');
  await expect(page.locator('#amount-input')).toHaveValue('0.00');
});

test('FE-104 完整记一笔：选分类/账户/备注 → 保存入账（后端校验）', async ({ page, context, request }) => {
  await setupRecord(page, context, request);
  await page.locator('#category-grid .category-btn').filter({ hasText: '餐饮' }).click();
  await page.locator('#acct-grid .pay-btn').filter({ hasText: '微信' }).click();
  await page.fill('#note-input', '午饭');
  await enterAmount(page, '12.34');

  await page.click('#save-btn');
  // 成功反馈：toast + 金额/备注复位（保留分类与账户支持连续记账）
  await expect(page.locator('#success-toast')).toHaveClass(/opacity-100/);
  await expect(page.locator('#success-toast')).toContainText('记账成功');
  await expect(page.locator('#amount-input')).toHaveValue('0.00');
  await expect(page.locator('#note-input')).toHaveValue('');

  // 后端真实入账：本月账单 total ≥ 1，且第一笔金额 1234 分、分类餐饮
  const res = await page.request.get('/api/bills');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.total).toBeGreaterThanOrEqual(1);
  expect(data.bills[0].amount).toBe(1234);
  expect(data.bills[0].categoryName).toBe('餐饮');
});
