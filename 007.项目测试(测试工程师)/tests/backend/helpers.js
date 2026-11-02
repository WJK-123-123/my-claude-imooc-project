// 后端 API 测试公共夹具（对应 02-用户端后端API-测试计划）。
// 基于 Node 内置 fetch（Node 18+），无需任何第三方请求库。

import { BASE_URL, SESSION_COOKIE, TEST_PASSWORD } from '../config/env.js';

// 统一 HTTP 请求封装，返回 { status, data, cookie, res }。
// data 为已解析 JSON（失败时可能为 null）；cookie 为从 Set-Cookie 提取的会话串。
export async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cookie: extractCookie(res), res };
}

// 从响应头提取 fgj_session 令牌（后端 httpOnly，测试端手工回传）。
// 兼容 getSetCookie()（Node 19.7+）与 get('set-cookie') 两种形态。
export function extractCookie(res) {
  const lines = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie') || ''];
  const line = lines.find((l) => l.startsWith(SESSION_COOKIE + '=')) || '';
  const m = line.match(/^[^=]+=([^;]+)/);
  return m ? `${SESSION_COOKIE}=${m[1]}` : '';
}

let seq = 0;

// 生成唯一用户名，避免多次运行互相污染既有数据。
export function uniqueName(prefix = 'qa') {
  return `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
}

// 注册并返回 { username, password, cookie, userId }。注册成功即自动登录（返回会话 Cookie）。
export async function register(username = uniqueName(), password = TEST_PASSWORD) {
  const r = await api('/api/auth/register', {
    method: 'POST',
    body: { username, password, confirmPassword: password },
  });
  if (r.status >= 400) {
    throw new Error(`注册 ${username} 失败：${r.status} ${JSON.stringify(r.data)}`);
  }
  return { username, password, cookie: r.cookie, userId: r.data?.user?.id };
}

// 登录，返回 { status, data, cookie, username, password }。
export async function login(username, password = TEST_PASSWORD) {
  const r = await api('/api/auth/login', { method: 'POST', body: { username, password } });
  return { ...r, username, password };
}
