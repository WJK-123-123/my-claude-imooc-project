// L2 接口契约：F3 记一笔 / F5 详情·编辑·删除（/api/bills）
// 覆盖测试计划：BE-101 ~ BE-111
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';

// 每个用例独立账号 + 自建分类/账户，避免数据耦合。
async function setup() {
  const a = await register(uniqueName('bill'));
  const cat = await api('/api/categories', {
    method: 'POST', cookie: a.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' },
  });
  const acct = await api('/api/accounts', {
    method: 'POST', cookie: a.cookie, body: { name: '微信', emoji: '💚', remark: '' },
  });
  return {
    cookie: a.cookie,
    categoryId: cat.data.category.id,
    accountId: acct.data.account.id,
    valid: {
      type: 'expense', amount: 1234,
      categoryId: cat.data.category.id, accountId: acct.data.account.id,
      note: '午饭', billDate: '2026-10-01',
    },
  };
}

test('BE-101 记一笔：合法 payload → 200 返回 bill.id', async () => {
  const f = await setup();
  const r = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: f.valid });
  assert.equal(r.status, 200);
  assert.ok(Number.isInteger(r.data.bill.id));
});

test('BE-102 金额边界：0/负数/小数/超上限 → 400 金额不合法', async () => {
  const f = await setup();
  for (const amount of [0, -1, 1.5, 100000000]) {
    const r = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, amount } });
    assert.equal(r.status, 400);
    assert.equal(r.data.message, '金额不合法');
  }
});

test('BE-104 分类 scope 不匹配 → 400（收入账单用支出分类）', async () => {
  const f = await setup();
  const r = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, type: 'income' } });
  assert.equal(r.status, 400);
  assert.equal(r.data.message, '分类不存在或与类型不符');
});

test('BE-106 日期格式与越界：非 YYYY-MM-DD / 早于 2000-01-01 / 晚于今天 → 400（PRD F3-6）', async () => {
  const f = await setup();
  const bad = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, billDate: '2026/10/01' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.message, '日期不合法');

  const early = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, billDate: '1999-12-31' } });
  assert.equal(early.status, 400);
  assert.equal(early.data.message, '日期不能早于 2000-01-01');

  const d = new Date();
  d.setDate(d.getDate() + 30); // 未来 30 天必然晚于「今天」
  const future = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const late = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, billDate: future } });
  assert.equal(late.status, 400);
  assert.equal(late.data.message, '日期不能晚于今天');
});

test('BE-103 横向越权：用他人分类记账 → 400', async () => {
  const f = await setup();
  const other = await setup();
  const r = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: { ...f.valid, categoryId: other.categoryId } });
  assert.equal(r.status, 400);
  assert.equal(r.data.message, '分类不存在或与类型不符');
});

test('BE-107/108/110 详情/编辑/删除主流程', async () => {
  const f = await setup();
  const created = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: f.valid });
  const id = created.data.bill.id;

  const detail = await api(`/api/bills/${id}`, { cookie: f.cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.bill.amount, 1234);

  const upd = await api(`/api/bills/${id}`, { method: 'PUT', cookie: f.cookie, body: { ...f.valid, amount: 999 } });
  assert.equal(upd.status, 200);

  const del = await api(`/api/bills/${id}`, { method: 'DELETE', cookie: f.cookie });
  assert.equal(del.status, 200);
  assert.equal((await api(`/api/bills/${id}`, { cookie: f.cookie })).status, 404);
});

test('BE-109/111 编辑/删除他人账单 → 404', async () => {
  const f = await setup();
  const other = await setup();
  const created = await api('/api/bills', { method: 'POST', cookie: f.cookie, body: f.valid });
  const id = created.data.bill.id;
  // 用 other 自己的分类/账户（payload 校验能通过），目标是 f 的账单 id → WHERE id=? AND user_id=? 命中 0 行 → 404
  assert.equal((await api(`/api/bills/${id}`, { method: 'PUT', cookie: other.cookie, body: other.valid })).status, 404);
  assert.equal((await api(`/api/bills/${id}`, { method: 'DELETE', cookie: other.cookie })).status, 404);
});
