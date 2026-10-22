import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import adminAuthRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import usersRoutes from './routes/users.js';
import billsRoutes from './routes/bills.js';
import statsRoutes from './routes/stats.js';
import exportRoutes from './routes/export.js';
import { getAdminByToken, ADMIN_SESSION_COOKIE } from './utils/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---- 访问日志（方法 路径 状态码，便于人工核对请求是否到达后端） ----
app.use((req, res, next) => {
  res.on('finish', () => console.log(`${new Date().toLocaleTimeString('zh-CN')} ${req.method} ${req.originalUrl} -> ${res.statusCode}`));
  next();
});

// ---- API ----
app.use('/api/admin/auth', adminAuthRoutes);   // A1 超级管理员登录/登出/会话
app.use('/api/admin/dashboard', dashboardRoutes); // A2 数据总览仪表盘
app.use('/api/admin/users', usersRoutes);        // A3 用户管理（列表 + 详情）
app.use('/api/admin/bills', billsRoutes);        // A4 账单流水查看
app.use('/api/admin/stats', statsRoutes);        // A5 统计报表
app.use('/api/admin/export', exportRoutes);      // A6 数据导出（CSV）
app.use('/api/admin', (req, res) => res.status(404).json({ message: '接口不存在' }));

// ---- 页面登录守卫（后台 PRD A1-5）：/pages/ 下除登录页外的 .html 未带有效会话一律 302 回登录页 ----
const PUBLIC_PAGES = new Set(['admin_login.html']);
app.use('/pages', async (req, res, next) => {
  try {
    const file = req.path.split('/').pop() || '';
    if (req.method === 'GET' && file.endsWith('.html') && !PUBLIC_PAGES.has(file)) {
      const admin = await getAdminByToken(req.cookies?.[ADMIN_SESSION_COOKIE]);
      if (!admin) return res.redirect('/pages/admin_login.html');
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ---- 静态托管后台前端（同源部署，前端 fetch /api/admin/* 无跨域问题） ----
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.redirect('/pages/admin_login.html')); // 默认首页 = 登录页

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
  console.log(`财务管家后台管理系统已启动：http://localhost:${config.port}/（自动跳转登录页）`);
});
