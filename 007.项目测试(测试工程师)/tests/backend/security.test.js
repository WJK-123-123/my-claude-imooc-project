// L4 安全 / L6 异常：越权、未授权、坏 JSON、未知接口、页面守卫
// 覆盖测试计划：BE-601 ~ BE-604（BE-605 XSS 需前端联动渲染、BE-606 断库需停库，另见测试计划）
// 本文件全部为只读/无副作用用例，可安全随时运行。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';
import { BASE_URL } from '../config/env.js';

test('BE-601 受保护接口无 Cookie → 401', async () => {
  for (const path of ['/api/auth/me', '/api/bills', '/api/accounts', '/api/categories', '/api/stats', '/api/profile/stats']) {
    const r = await api(path);
    assert.equal(r.status, 401, `${path} 应拒绝未登录`);
  }
});

test('BE-602 坏 JSON 请求体 → 400', async () => {
  const res = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
});

test('BE-603 未知接口 → 404', async () => {
  const r = await api('/api/not-exist');
  assert.equal(r.status, 404);
});

test('BE-604 页面守卫：未登录访问受保护页 → 302 回登录页', async () => {
  const res = await fetch(BASE_URL + '/pages/06_transaction_history.html', { redirect: 'manual' });
  assert.equal(res.status, 302);
  const loc = res.headers.get('location') || '';
  assert.match(loc, /02_login/);
});

test('BE-601b 伪造/非法 Cookie → 401', async () => {
  const r = await api('/api/auth/me', { cookie: 'fgj_session=forged-token-123' });
  assert.equal(r.status, 401);
});
