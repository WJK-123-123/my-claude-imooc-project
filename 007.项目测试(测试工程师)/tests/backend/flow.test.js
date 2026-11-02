// L2 接口契约：F4 流水（GET /api/bills 列表/分页/汇总/日小计）
// 覆盖测试计划：BE-201 ~ BE-207
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';

async function setup() {
  const a = await register(uniqueName('flow'));
  const c = { cookie: a.cookie };
  const expCat = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' } });
  const incCat = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'income', name: '工资', icon: '💰' } });
  const acct = await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '微信', emoji: '💚', remark: '' } });
  return {
    cookie: c.cookie,
    expenseId: expCat.data.category.id,
    incomeId: incCat.data.category.id,
    accountId: acct.data.account.id,
  };
}

// 本月某日（避免用例与运行月份耦合）
function thisMonthDay(day) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}`;
}

test('BE-201/202 GET /api/bills：默认本月 + 整数 summary + balance 无浮点', async () => {
  const f = await setup();
  const day = thisMonthDay(10);
  await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { type: 'expense', amount: 1000, categoryId: f.expenseId, accountId: f.accountId, note: '早餐', billDate: day } });
  await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { type: 'income', amount: 20000, categoryId: f.incomeId, accountId: f.accountId, note: '', billDate: day } });

  const r = await api('/api/bills', { cookie: f.cookie });
  assert.equal(r.status, 200);
  assert.ok(Number.isInteger(r.data.summary.income));
  assert.equal(r.data.summary.expense, 1000);
  assert.equal(r.data.summary.income, 20000);
  assert.equal(r.data.summary.balance, 19000); // 整数运算，balance = income - expense
  assert.equal(r.data.total, 2);
  assert.equal(r.data.bills.length, 2);
  assert.equal(r.data.bills[0].type, 'income'); // 同一天按创建时间倒序
});

test('BE-205 type 筛选：仅 bills/total 过滤，summary 仍全月', async () => {
  const f = await setup();
  const day = thisMonthDay(10);
  await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { type: 'expense', amount: 1000, categoryId: f.expenseId, accountId: f.accountId, note: '', billDate: day } });
  await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { type: 'income', amount: 20000, categoryId: f.incomeId, accountId: f.accountId, note: '', billDate: day } });

  const r = await api('/api/bills?type=expense', { cookie: f.cookie });
  assert.equal(r.data.total, 1);
  assert.equal(r.data.bills.length, 1);
  assert.equal(r.data.bills[0].type, 'expense');
  assert.equal(r.data.summary.expense, 1000); // summary 仍整月全量
  assert.equal(r.data.summary.income, 20000);
});

test('BE-203 month 切月 / 非法回退：均返回 200，month 为中文标签', async () => {
  const f = await setup();
  const bad = await api('/api/bills?month=2026-13', { cookie: f.cookie });
  assert.equal(bad.status, 200);
  assert.match(bad.data.month, /年/); // 非法月份回退本月，不报错
  const ok = await api('/api/bills?month=2000-01', { cookie: f.cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.month, '2000年1月');
  assert.equal(ok.data.earliestMonth, null); // 空账号无账单
});
