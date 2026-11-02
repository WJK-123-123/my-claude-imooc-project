// F7 年度统计 E2E（对应 FE-301）
// 选择器取自 07_statistics_a.html 真实内联脚本：概览三指标 + 年份。
import { test, expect } from '@playwright/test';
import { loginContext, seedCategory, seedAccount, seedBill, todayStr } from './e2e-helpers.js';

test('FE-301 统计页：记账后概览指标正确渲染', async ({ page, context, request }) => {
  await loginContext(context, request);
  const cat = await seedCategory(page, { scope: 'expense', name: '餐饮', icon: '🍜' });
  const acct = await seedAccount(page, { name: '微信', emoji: '💚' });
  await seedBill(page, {
    type: 'expense', amount: 1234, categoryId: cat.id, accountId: acct.id,
    note: '午饭', billDate: todayStr(),
  });

  await page.goto('/pages/07_statistics_a.html');
  // 年份默认本年
  await expect(page.locator('#year-label')).toHaveText(new RegExp(String(new Date().getFullYear()) + '年'));
  // 总笔数 1、最大单笔 12.34 且分类为餐饮（这两个值对单笔支出是确定的）
  await expect(page.locator('#stat-count')).toHaveText('1 笔');
  await expect(page.locator('#stat-max')).toHaveText('¥ 12.34');
  await expect(page.locator('#stat-max-cat')).toHaveText('餐饮');
  // 月均支出反映当月支出（非 0）
  await expect(page.locator('#stat-monthly')).not.toHaveText('¥ 0.00');
});
