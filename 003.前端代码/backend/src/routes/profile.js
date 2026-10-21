import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 个人中心：头像上传 + 记账统计（PRD F1-9 前的 10 我的页数据）。
const router = Router();
router.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 上传目录放在 frontend 下，随 express.static(frontend) 直接以 /uploads/avatars/* 对外可访问
const AVATAR_DIR = path.resolve(__dirname, '../../../frontend/uploads/avatars');
const UPLOAD_PREFIX = '/uploads/avatars/';
const ALLOWED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function fail(res, status, message) {
  return res.status(status).json({ message });
}

/* ================= 头像上传（10 我的页） ================= */
// 前端以 data URL（data:image/...;base64,...）提交；后端落盘静态目录，库里只存访问地址
router.put('/avatar', async (req, res, next) => {
  try {
    const dataUrl = req.body?.avatar;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return fail(res, 400, '请选择图片文件');
    }
    const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!m) return fail(res, 400, '图片格式不支持');
    const mime = m[1].toLowerCase();
    const ext = ALLOWED[mime];
    if (!ext) return fail(res, 400, '仅支持 png/jpg/webp/gif 图片');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0 || buf.length > MAX_BYTES) return fail(res, 400, '图片大小需在 2MB 以内');

    // 读旧地址，便于落盘成功后清理旧文件
    const [oldRows] = await pool.query('SELECT avatar_url FROM user WHERE id = ?', [req.userId]);
    const oldUrl = oldRows[0]?.avatar_url;

    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    const filename = `u${req.userId}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(AVATAR_DIR, filename), buf);
    const url = UPLOAD_PREFIX + filename;
    await pool.query('UPDATE user SET avatar_url = ? WHERE id = ?', [url, req.userId]);

    if (oldUrl && oldUrl.startsWith(UPLOAD_PREFIX)) {
      try { fs.unlinkSync(path.join(AVATAR_DIR, path.basename(oldUrl))); } catch { /* 旧文件不存在则忽略 */ }
    }
    res.json({ avatarUrl: url });
  } catch (err) {
    next(err);
  }
});

/* ================= 记账统计（10 我的页三个微卡） ================= */
// 累计记账 = 总笔数；记账天数 = 有账单的去重日期数；本月记账 = 本自然月笔数
router.get('/stats', async (req, res, next) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) AS c FROM bill WHERE user_id = ?', [req.userId]);
    const [days] = await pool.query('SELECT COUNT(DISTINCT bill_date) AS c FROM bill WHERE user_id = ?', [req.userId]);
    const [month] = await pool.query(
      `SELECT COUNT(*) AS c FROM bill
        WHERE user_id = ?
          AND bill_date >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND bill_date < DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')`,
      [req.userId]
    );
    res.json({
      totalCount: total[0].c,
      daysCount: days[0].c,
      monthCount: month[0].c,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
