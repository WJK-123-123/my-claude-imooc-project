// 统一请求层：手动管理 Cookie 会话。
// 后端会话方案：Cookie 存明文令牌、库中只存 SHA-256 哈希（httpOnly，JS 不可读），
// 响应体不含令牌；小程序 / App 不支持浏览器自动 Cookie 持久化，
// 故在响应头 Set-Cookie 里提取令牌、请求头 Cookie 回传。
import { getBaseUrl, SESSION_COOKIE, TOKEN_KEY } from './config.js';

function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || '';
}
function setToken(t) {
  if (t) uni.setStorageSync(TOKEN_KEY, t);
  else uni.removeStorageSync(TOKEN_KEY);
}

// 从响应头 Set-Cookie 提取会话令牌（兼容大小写 header 名）
function extractToken(res) {
  const h = (res && res.header) || {};
  const sc = h['Set-Cookie'] || h['set-cookie'] || '';
  const m = String(sc).match(new RegExp(SESSION_COOKIE + '=([^;]+)'));
  return m ? m[1] : '';
}

export function request(method, url, data) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) header['Cookie'] = SESSION_COOKIE + '=' + token;
    uni.request({
      url: getBaseUrl() + url,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        const t = extractToken(res);
        if (t) setToken(t); // 登录/注册/续期都会刷新 Set-Cookie，一并持久化
        resolve({ status: res.statusCode, data: res.data || {} });
      },
      fail: (err) => reject(err),
    });
  });
}

export const get = (url) => request('GET', url);
export const post = (url, data) => request('POST', url, data);
export const put = (url, data) => request('PUT', url, data);
export const del = (url) => request('DELETE', url);

export function hasToken() {
  return !!getToken();
}
export function clearToken() {
  setToken('');
}

// 跳登录页并清令牌（与浏览器端 302 回登录页等价）
export function gotoLogin() {
  clearToken();
  uni.reLaunch({ url: '/pages/login/login' });
}

// 登录守卫：校验当前会话，仅后端明确返回 401 才跳登录页（网络异常不跳，兼容预览）
export function ensureAuth() {
  return get('/api/auth/me').then((res) => {
    if (res.status === 401) {
      gotoLogin();
      return false;
    }
    return true;
  }).catch(() => true);
}
