// L2 接口契约：F1 账号与会话（/api/auth/*）
// 覆盖测试计划：BE-001 ~ BE-019
// 前置：003 后端已启动（:3000）且已连 MySQL。用例使用独立随机账号，不污染既有数据。
// 注意：BE-007 锁定用例会留下一个锁定账号、BE-017 注销用例会留下 deleting 状态账号，
//       二者均为随机名、7 天后由后端懒清扫物理删除，可安全忽略。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, login, uniqueName } from './helpers.js';
import { TEST_PASSWORD } from '../config/env.js';

test('BE-001 注册：合法账号返回 user + 下发会话 Cookie，注册即登录', async () => {
  const u = uniqueName('reg');
  const r = await api('/api/auth/register', {
    method: 'POST',
    body: { username: u, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.username, u);
  assert.ok(r.cookie.startsWith('fgj_session='));

  const me = await api('/api/auth/me', { cookie: r.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.data.username, u);
});

test('BE-002/003 注册：弱密码 / 密码不一致 → 400', async () => {
  const weak = await api('/api/auth/register', {
    method: 'POST',
    body: { username: uniqueName('w'), password: 'abc123', confirmPassword: 'abc123' },
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.data.message, '密码不符合规范，请重新输入');

  const mismatch = await api('/api/auth/register', {
    method: 'POST',
    body: { username: uniqueName('m'), password: TEST_PASSWORD, confirmPassword: 'Diff123!' },
  });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.data.message, '两次输入的密码不一致');
});

test('BE-004 注册：重复用户名 → 409', async () => {
  const u = uniqueName('dup');
  await register(u);
  const again = await api('/api/auth/register', {
    method: 'POST',
    body: { username: u, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD },
  });
  assert.equal(again.status, 409);
  assert.equal(again.data.message, '用户名已被占用');
});

test('BE-006/007 登录：连错 5 次锁号；锁定期内正确密码也拒绝并提示锁定', async () => {
  const u = uniqueName('lock');
  await register(u);
  // 连错 5 次统一提示「用户名或密码错误」，不泄露账号状态（PRD F1-3）；第 5 次内部静默置锁
  for (let i = 1; i <= 5; i++) {
    const r = await login(u, 'Wrong123!');
    assert.equal(r.status, 401);
    assert.equal(r.data.message, '用户名或密码错误');
  }
  // 已锁定：第 6 次即使密码正确也拒绝，并提示锁定
  const r6 = await login(u);
  assert.equal(r6.status, 401);
  assert.match(r6.data.message, /锁定/);
});

test('BE-010 登录：正确密码 → 200 + 会话', async () => {
  const u = uniqueName('ok');
  await register(u);
  const r = await login(u);
  assert.equal(r.status, 200);
  assert.equal(r.data.user.username, u);
  assert.ok(r.cookie);
});

test('BE-011 /me：无 Cookie → 401', async () => {
  const r = await api('/api/auth/me');
  assert.equal(r.status, 401);
});

test('BE-012 登出：清会话，旧 Cookie 再访问 401', async () => {
  const u = uniqueName('out');
  const { cookie } = await register(u);
  const out = await api('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(out.status, 200);
  const me = await api('/api/auth/me', { cookie });
  assert.equal(me.status, 401);
});

test('BE-014/015 找回密码（⚠ 当前免验证码直改）：不存在→404；重置成功→旧密码失效', async () => {
  const no = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { username: uniqueName('nx'), password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD },
  });
  assert.equal(no.status, 404);

  const u = uniqueName('rp');
  await register(u);
  const newPw = 'NewPass123!';
  const ok = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { username: u, password: newPw, confirmPassword: newPw },
  });
  assert.equal(ok.status, 200);
  assert.equal((await login(u, TEST_PASSWORD)).status, 401); // 旧密码立即失效
  assert.equal((await login(u, newPw)).status, 200);          // 新密码可登录
});

test('BE-016/017 注销：错密码 401；对密码 → deleting 冷静期 + 清会话；期内登录可撤销', async () => {
  const u = uniqueName('deact');
  const { cookie } = await register(u);

  const wrong = await api('/api/auth/deactivate', { method: 'POST', cookie, body: { password: 'Wrong123!' } });
  assert.equal(wrong.status, 401);

  const ok = await api('/api/auth/deactivate', { method: 'POST', cookie, body: { password: TEST_PASSWORD } });
  assert.equal(ok.status, 200);
  assert.equal((await api('/api/auth/me', { cookie })).status, 401); // 全部会话已清

  const back = await login(u); // 冷静期内正确密码登录可撤销注销
  assert.equal(back.status, 200);
});
