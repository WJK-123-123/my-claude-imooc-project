// L2 接口契约：账户/分类 CRUD（/api/accounts、/api/categories）
// 覆盖测试计划：BE-401 ~ BE-408
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';

test('BE-401/402 账户：空名/超长/重名', async () => {
  const a = await register(uniqueName('acct'));
  const c = { cookie: a.cookie };

  assert.equal((await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '', emoji: '💚' } })).status, 400);
  assert.equal((await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '一二三四五六七八九', emoji: '💚' } })).status, 400);

  const ok = await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '微信', emoji: '💚' } });
  assert.equal(ok.status, 200);
  const dup = await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '微信', emoji: '💚' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.message, '账户名称已存在');
});

test('BE-404/405 分类：scope 非法 / 重名', async () => {
  const a = await register(uniqueName('cat'));
  const c = { cookie: a.cookie };

  assert.equal((await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'other', name: '餐饮', icon: '🍜' } })).status, 400);

  const ok = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' } });
  assert.equal(ok.status, 200);
  const dup = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.message, '该分类已存在');
});

test('BE-406 分类删除被账单引用 → 409（外键 RESTRICT）', async () => {
  const a = await register(uniqueName('catref'));
  const c = { cookie: a.cookie };
  const cat = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' } });
  const acct = await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '微信', emoji: '💚' } });
  await api('/api/bills', { method: 'POST', cookie: c.cookie, body: { type: 'expense', amount: 100, categoryId: cat.data.category.id, accountId: acct.data.account.id, note: '', billDate: '2026-10-01' } });

  const del = await api(`/api/categories/${cat.data.category.id}`, { method: 'DELETE', cookie: c.cookie });
  assert.equal(del.status, 409);
  assert.equal(del.data.message, '该分类下已有账单，无法删除');
});

test('BE-403 账户删除被账单引用 → 成功，账单 account_id 由外键 SET NULL', async () => {
  const a = await register(uniqueName('acctref'));
  const c = { cookie: a.cookie };
  const cat = await api('/api/categories', { method: 'POST', cookie: c.cookie, body: { scope: 'expense', name: '餐饮', icon: '🍜' } });
  const acct = await api('/api/accounts', { method: 'POST', cookie: c.cookie, body: { name: '微信', emoji: '💚' } });
  const bill = await api('/api/bills', { method: 'POST', cookie: c.cookie, body: { type: 'expense', amount: 100, categoryId: cat.data.category.id, accountId: acct.data.account.id, note: '', billDate: '2026-10-01' } });

  const del = await api(`/api/accounts/${acct.data.account.id}`, { method: 'DELETE', cookie: c.cookie });
  assert.equal(del.status, 200);
  const detail = await api(`/api/bills/${bill.data.bill.id}`, { cookie: c.cookie });
  assert.equal(detail.data.bill.accountId, null); // 外键 SET NULL 回落
});
