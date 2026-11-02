// 全局配置：后端接口地址（iOS / Android / 微信小程序 / 鸿蒙真机共用）
// - H5：BASE_URL 留空，经 manifest.json 的 h5.devServer.proxy 把 /api 代理到后端（同源，规避跨域，后端无需开 CORS）
// - 微信开发者工具：http://localhost:3000（需在 manifest.json 的 mp-weixin 里关闭 urlCheck，已关）
// - Android 模拟器访问宿主机：http://10.0.2.2:3000
// - iOS/Android/鸿蒙真机：改成运行后端那台电脑的局域网 IP（本机 WLAN 实测 192.168.1.7）
//   ⚠️ 真机必须与电脑连同一 Wi-Fi，否则连不上局域网 IP；换网络后 IP 会变，需同步改这里并重新运行
// - 微信小程序真机：需 https 域名，并在小程序后台配置 request 合法域名
// #ifdef H5
export const BASE_URL = '';
// #endif
// #ifndef H5
export const BASE_URL = 'http://192.168.1.7:3000';
// #endif

// 会话 Cookie 名与本地令牌存储 key（后端见 003.前端代码/backend/src/utils/session.js）
export const SESSION_COOKIE = 'fgj_session';
export const TOKEN_KEY = 'fgj_token';
