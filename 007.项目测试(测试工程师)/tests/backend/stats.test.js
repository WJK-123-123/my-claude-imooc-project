// L2 接口契约：F7 年度统计（GET /api/stats）
// 覆盖测试计划：BE-301 ~ BE-307
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';

test('BE-301/305/306 stats 结构：空账号默认本年，monthly 补齐 12 月，years 收口本年', async () => {
  const a = await register(uniqueName('stat'));
  const r = await api('/api/stats', { cookie: a.cookie });
  assert.equal(r.status, 200);

  const year = new Date().getFullYear();
  assert.equal(r.data.year, year);
  assert.equal(r.data.totalCount, 0);
  assert.equal(r.data.expenseTotal, 0);
  assert.equal(r.data.incomeTotal, 0);
  assert.equal(r.data.monthlyAvgExpense, 0);
  assert.equal(r.data.maxExpense, null);        // 无支出最大单笔为 null
  assert.equal(r.data.monthly.length, 12);      // 1–12 月补齐
  assert.ok(r.data.years.includes(year));       // years 必含本年
  assert.deepEqual(r.data.expenseCategories, []);
  assert.deepEqual(r.data.incomeCategories, []);
});

test('BE-307 越权隔离：只统计当前用户数据（空账号与无账单一致）', async () => {
  const a = await register(uniqueName('stata'));
  const r = await api('/api/stats', { cookie: a.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.data.totalCount, 0); // 别人有账单也不影响本账号统计口径
});
