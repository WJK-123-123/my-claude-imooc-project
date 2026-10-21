import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 记账分类增删改查（PRD F3-4 + 原型 13 分类管理页）。
// 支出/收入双 scope；分类被账单引用后不可物理删除（外键 RESTRICT 兜底，PRD §7）。
const router = Router();
router.use(requireAuth);

const NAME_MAX = 4;    // V1 新增分类限 ≤4 个汉字（PRD F3-4）
const ICON_MAX = 16;   // emoji 图标列宽

function fail(res, status, message) {
  return res.status(status).json({ message });
}

function clean(s) {
  return typeof s === 'string' ? s.trim() : '';
}

function isValidScope(scope) {
  return scope === 'expense' || scope === 'income';
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, scope, name, icon FROM category WHERE user_id = ? ORDER BY scope ASC, sort ASC, id ASC',
      [req.userId]
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const scope = clean(req.body?.scope);
    const name = clean(req.body?.name);
    const icon = clean(req.body?.icon);
    if (!isValidScope(scope)) return fail(res, 400, '分类归属类型不合法');
    if (!name) return fail(res, 400, '请输入分类名称');
    if ([...name].length > NAME_MAX) return fail(res, 400, `分类名称最多 ${NAME_MAX} 个字`);
    if (!icon) return fail(res, 400, '请选择分类图标');
    if ([...icon].length > ICON_MAX) return fail(res, 400, '图标不合法');

    const [m] = await pool.query(
      'SELECT COALESCE(MAX(sort), 0) AS s FROM category WHERE user_id = ? AND scope = ?',
      [req.userId, scope]
    );
    const sort = m[0].s + 10; // 追加到该类型列表末尾
    const [r] = await pool.query(
      'INSERT INTO category (user_id, scope, name, icon, sort, is_system) VALUES (?, ?, ?, ?, ?, 0)',
      [req.userId, scope, name, icon, sort]
    );
    res.json({ category: { id: r.insertId, scope, name, icon } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, '该分类已存在');
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const name = clean(req.body?.name);
    const icon = clean(req.body?.icon);
    if (!name) return fail(res, 400, '请输入分类名称');
    if ([...name].length > NAME_MAX) return fail(res, 400, `分类名称最多 ${NAME_MAX} 个字`);
    if (!icon) return fail(res, 400, '请选择分类图标');
    if ([...icon].length > ICON_MAX) return fail(res, 400, '图标不合法');

    // 仅改名称/图标，scope 归属保持原值（前端在对应 Tab 内编辑）
    const [r] = await pool.query(
      'UPDATE category SET name = ?, icon = ? WHERE id = ? AND user_id = ?',
      [name, icon, id, req.userId]
    );
    if (r.affectedRows === 0) return fail(res, 404, '分类不存在');
    res.json({ category: { id, name, icon } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, '该分类已存在');
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const [r] = await pool.query('DELETE FROM category WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (r.affectedRows === 0) return fail(res, 404, '分类不存在');
    res.json({ message: '已删除' });
  } catch (err) {
    // 外键 RESTRICT：分类被账单引用后不可物理删除（errno 1451）
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return fail(res, 409, '该分类下已有账单，无法删除');
    }
    next(err);
  }
});

export default router;
