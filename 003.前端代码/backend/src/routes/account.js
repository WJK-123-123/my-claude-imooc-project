import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 账户（支付方式标记）增删改查（PRD F3-9 + 原型 12 账户管理页）。
// 仅账单标记，无余额字段；删除账户时其账单 account_id 由外键 ON DELETE SET NULL 自动置空。
const router = Router();
router.use(requireAuth);

const NAME_MAX = 8;    // 12 页限 ≤8 字
const REMARK_MAX = 12; // 12 页备注限 ≤12 字
const EMOJI_MAX = 16;  // emoji 图标列宽

function fail(res, status, message) {
  return res.status(status).json({ message });
}

function clean(s) {
  return typeof s === 'string' ? s.trim() : '';
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, emoji, remark FROM account WHERE user_id = ? ORDER BY sort ASC, id ASC',
      [req.userId]
    );
    res.json({ accounts: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = clean(req.body?.name);
    const emoji = clean(req.body?.emoji);
    const remark = clean(req.body?.remark);
    if (!name) return fail(res, 400, '请输入账户名称');
    if ([...name].length > NAME_MAX) return fail(res, 400, `账户名称最多 ${NAME_MAX} 个字`);
    if (!emoji) return fail(res, 400, '请选择账户图标');
    if ([...emoji].length > EMOJI_MAX) return fail(res, 400, '图标不合法');
    if ([...remark].length > REMARK_MAX) return fail(res, 400, `备注最多 ${REMARK_MAX} 个字`);

    const [m] = await pool.query('SELECT COALESCE(MAX(sort), 0) AS s FROM account WHERE user_id = ?', [req.userId]);
    const sort = m[0].s + 10; // 追加到列表末尾
    const [r] = await pool.query(
      'INSERT INTO account (user_id, name, emoji, remark, sort) VALUES (?, ?, ?, ?, ?)',
      [req.userId, name, emoji, remark || null, sort]
    );
    res.json({ account: { id: r.insertId, name, emoji, remark: remark || null } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, '账户名称已存在');
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const name = clean(req.body?.name);
    const emoji = clean(req.body?.emoji);
    const remark = clean(req.body?.remark);
    if (!name) return fail(res, 400, '请输入账户名称');
    if ([...name].length > NAME_MAX) return fail(res, 400, `账户名称最多 ${NAME_MAX} 个字`);
    if (!emoji) return fail(res, 400, '请选择账户图标');
    if ([...emoji].length > EMOJI_MAX) return fail(res, 400, '图标不合法');
    if ([...remark].length > REMARK_MAX) return fail(res, 400, `备注最多 ${REMARK_MAX} 个字`);

    const [r] = await pool.query(
      'UPDATE account SET name = ?, emoji = ?, remark = ? WHERE id = ? AND user_id = ?',
      [name, emoji, remark || null, id, req.userId]
    );
    if (r.affectedRows === 0) return fail(res, 404, '账户不存在');
    res.json({ account: { id, name, emoji, remark: remark || null } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, '账户名称已存在');
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    // 账单的 account_id 由外键 ON DELETE SET NULL 自动回落为「未标记」（PRD F5-1 显示「—」）
    const [r] = await pool.query('DELETE FROM account WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (r.affectedRows === 0) return fail(res, 404, '账户不存在');
    res.json({ message: '已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
