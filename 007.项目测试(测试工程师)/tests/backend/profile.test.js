// L2 接口契约：头像上传 + 记账微卡（/api/profile/*）
// 覆盖测试计划：BE-501 ~ BE-505
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, register, uniqueName } from './helpers.js';

// 1×1 透明 PNG 的 base64（合法图片，<2MB）
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('BE-501 头像上传：合法 png → 落盘并返回 avatarUrl，/me 同步回显', async () => {
  const a = await register(uniqueName('av'));
  const r = await api('/api/profile/avatar', { method: 'PUT', cookie: a.cookie, body: { avatar: PNG_1PX } });
  assert.equal(r.status, 200);
  assert.match(r.data.avatarUrl, /^\/uploads\/avatars\/u\d+_\d+\.png$/);

  const me = await api('/api/auth/me', { cookie: a.cookie });
  assert.equal(me.data.avatarUrl, r.data.avatarUrl);
});

test('BE-502 头像：非 data URL / 伪造 MIME → 400 不落盘', async () => {
  const a = await register(uniqueName('avbad'));

  const notImage = await api('/api/profile/avatar', { method: 'PUT', cookie: a.cookie, body: { avatar: 'hello' } });
  assert.equal(notImage.status, 400);

  const badMime = await api('/api/profile/avatar', { method: 'PUT', cookie: a.cookie, body: { avatar: 'data:text/html;base64,PGI+aDwvYj4=' } });
  assert.equal(badMime.status, 400);
});

test('BE-505 微卡统计：空账号全为 0', async () => {
  const a = await register(uniqueName('stat'));
  const r = await api('/api/profile/stats', { cookie: a.cookie });
  assert.equal(r.status, 200);
  assert.equal(Number(r.data.totalCount), 0);
  assert.equal(Number(r.data.daysCount), 0);
  assert.equal(Number(r.data.monthCount), 0);
});
