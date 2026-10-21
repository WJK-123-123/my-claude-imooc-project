import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import categoryRoutes from './routes/category.js';
import profileRoutes from './routes/profile.js';
import billsRoutes from './routes/bills.js';
import { getSessionUser, SESSION_COOKIE } from './utils/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '10mb' })); // 头像 base64 上传较大，放宽请求体上限
app.use(cookieParser());

// ---- 访问日志（方法 路径 状态码，便于人工过主流程时核对请求是否到达后端） ----
app.use((req, res, next) => {
  res.on('finish', () => console.log(`${new Date().toLocaleTimeString('zh-CN')} ${req.method} ${req.originalUrl} -> ${res.statusCode}`));
  next();
});

// ---- API ----
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: '接口不存在' }));

// ---- 页面登录守卫（PRD §8：未登录时除登录/注册/找回密码外全部重定向登录页） ----
// 服务端权威拦截 /pages/ 下的 .html；截图等非 HTML 资源与 /assets 不受限
const PUBLIC_PAGES = new Set(['02_login.html', '02_register.html', '03_forgot_password.html']);
app.use('/pages', async (req, res, next) => {
  try {
    const file = req.path.split('/').pop() || '';
    if (req.method === 'GET' && file.endsWith('.html') && !PUBLIC_PAGES.has(file)) {
      const session = await getSessionUser(req.cookies?.[SESSION_COOKIE]);
      if (!session) return res.redirect('/pages/02_login.html');
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ---- 静态托管 003 原型页（同源部署，前端 fetch /api/* 无跨域问题） ----
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.redirect('/pages/02_login.html')); // 默认首页 = 登录页

// ---- 统一错误处理：JSON 消息，不向前端泄露堆栈 ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: '请求体不是合法的 JSON' });
  }
  res.status(500).json({ message: '服务器开小差了，请稍后再试' });
});

app.listen(config.port, () => {
  console.log(`财务管家后端已启动：http://localhost:${config.port}/（自动跳转登录页）`);
});
