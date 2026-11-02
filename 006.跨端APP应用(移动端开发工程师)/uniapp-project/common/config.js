// 全局配置：后端接口地址（iOS / Android / 微信小程序 / 鸿蒙真机共用）
// - H5：默认留空，经 manifest.json 的 h5.devServer.proxy 把 /api 代理到后端（同源，规避跨域，后端无需开 CORS）
// - 微信开发者工具：http://localhost:3000（需在 manifest.json 的 mp-weixin 里关闭 urlCheck，已关）
// - Android 模拟器访问宿主机：http://10.0.2.2:3000
// - iOS/Android/鸿蒙真机：填运行后端那台电脑的局域网 IP（本机 WLAN 实测 192.168.1.7）
//   ⚠️ 真机必须与电脑连同一 Wi-Fi，否则连不上局域网 IP
// - 微信小程序真机：需 https 域名，并在小程序后台配置 request 合法域名
//
// 运行时可改：设置页「后端地址」可覆盖默认值（存本地 storage），免改文件重编译。
// 未设置（或清空）时回落下方默认地址；换网络后到设置页改一次即可，不必改源码。
// #ifdef H5
const DEFAULT_BASE_URL = '';
// #endif
// #ifndef H5
const DEFAULT_BASE_URL = 'http://192.168.1.7:3000';
// #endif

export const API_BASE_KEY = 'fgj_api_base';

// 当前生效的后端地址：优先取用户在本机设置页填的值，否则用默认值（末尾斜杠统一去掉）
export function getBaseUrl() {
  const custom = uni.getStorageSync(API_BASE_KEY);
  if (custom) return String(custom).replace(/\/+$/, '');
  return DEFAULT_BASE_URL;
}

// 会话 Cookie 名与本地令牌存储 key（后端见 003.前端代码/backend/src/utils/session.js）
export const SESSION_COOKIE = 'fgj_session';
export const TOKEN_KEY = 'fgj_token';
