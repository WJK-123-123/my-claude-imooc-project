import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 账单（PRD F3 记一笔 / F4 流水 / F5 详情·编辑·删除）：金额以「分」整数存储，全程无浮点。
const router = Router();
router.use(requireAuth);

const AMOUNT_MAX = 99999999; // 分，= ¥999,999.99（PRD F3-1 上限）
const NOTE_MAX = 50;        // 备注 ≤50 字（PRD F3-5）

function fail(res, status, message) {
  return res.status(status).json({ message });
}

/* 校验并解析记账字段 + 校验分类/账户归属当前用户（防横向越权，PRD §5）。
   返回 { error } 或规范化后的 { type, amount, categoryId, accountId, note, billDate } */
async function resolveBillPayload(req) {
  const type = req.body?.type;
  const amount = req.body?.amount;
  const categoryId = Number(req.body?.categoryId);
  const accountId = req.body?.accountId == null ? null : Number(req.body?.accountId);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const billDate = req.body?.billDate;

  if (type !== 'expense' && type !== 'income') return { error: '记账类型不合法' };
  if (!Number.isInteger(amount) || amount < 1 || amount > AMOUNT_MAX) return { error: '金额不合法' };
  if (!Number.isInteger(categoryId) || categoryId <= 0) return { error: '请选择分类' };
  if (accountId != null && (!Number.isInteger(accountId) || accountId <= 0)) return { error: '账户不合法' };
  if (note.length > NOTE_MAX) return { error: `备注最多 ${NOTE_MAX} 个字` };
  if (typeof billDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) return { error: '日期不合法' };

  const [catRows] = await pool.query(
    'SELECT id FROM category WHERE id = ? AND user_id = ? AND scope = ?',
    [categoryId, req.userId, type]
  );
  if (!catRows[0]) return { error: '分类不存在或与类型不符' };
  if (accountId != null) {
    const [acctRows] = await pool.query(
      'SELECT id FROM account WHERE id = ? AND user_id = ?',
      [accountId, req.userId]
    );
    if (!acctRows[0]) return { error: '账户不存在' };
  }
  return { type, amount, categoryId, accountId, note: note || null, billDate };
}

/* ================= 记一笔（PRD F3） ================= */
router.post('/', async (req, res, next) => {
  try {
    const payload = await resolveBillPayload(req);
    if (payload.error) return fail(res, 400, payload.error);

    const [r] = await pool.query(
      'INSERT INTO bill (user_id, type, amount, category_id, account_id, note, bill_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.userId, payload.type, payload.amount, payload.categoryId, payload.accountId, payload.note, payload.billDate]
    );
    res.json({ bill: { id: r.insertId } });
  } catch (err) {
    next(err);
  }
});

/* ================= 单条详情（PRD F5-1） ================= */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const [rows] = await pool.query(
      `SELECT b.id, b.type, b.amount, b.note,
              DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
              DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS createdAt,
              b.category_id AS categoryId, b.account_id AS accountId,
              c.name AS categoryName, c.icon AS categoryIcon,
              a.name AS accountName
         FROM bill b
         JOIN category c ON c.id = b.category_id
         LEFT JOIN account a ON a.id = b.account_id
        WHERE b.id = ? AND b.user_id = ?`,
      [id, req.userId]
    );
    if (!rows[0]) return fail(res, 404, '账单不存在');
    res.json({ bill: rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ================= 编辑（PRD F5-2） ================= */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const payload = await resolveBillPayload(req);
    if (payload.error) return fail(res, 400, payload.error);

    const [r] = await pool.query(
      `UPDATE bill SET type = ?, amount = ?, category_id = ?, account_id = ?, note = ?, bill_date = ?
        WHERE id = ? AND user_id = ?`,
      [payload.type, payload.amount, payload.categoryId, payload.accountId, payload.note, payload.billDate, id, req.userId]
    );
    if (r.affectedRows === 0) return fail(res, 404, '账单不存在');
    res.json({ bill: { id } });
  } catch (err) {
    next(err);
  }
});

/* ================= 删除（PRD F5-3） ================= */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');
    const [r] = await pool.query('DELETE FROM bill WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (r.affectedRows === 0) return fail(res, 404, '账单不存在');
    res.json({ message: '已删除' });
  } catch (err) {
    next(err);
  }
});

/* ================= 本月流水（06 流水页：分页账单 + 全月汇总 + 按日小计，支持切月） ================= */
// 默认当前自然月；传 month=YYYY-MM 可切换历史月份（PRD F4-1，最早可到有账单的月份）。
// summary/dayTotals 覆盖所选整月，bills 按 offset/limit 分页（默认每页 20 条，前端滚动到底翻页）。
// 账单与汇总都只查当前用户，防横向越权
router.get('/', async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // 目标月份：默认本月；传 month=YYYY-MM 可切月（F4-1），非法/缺失一律回退本月
    const now = new Date();
    const curYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : curYM;
    const firstDay = ym + '-01';
    const monthLabel = parseInt(ym.slice(0, 4), 10) + '年' + parseInt(ym.slice(5, 7), 10) + '月';
    // 类型筛选（可选）：expense / income；缺省或非法返回全部。summary/dayTotals 仍按整月全量，只有 bills/total 按类型过滤
    const type = (req.query.type === 'expense' || req.query.type === 'income') ? req.query.type : null;

    // 全月按日小计（组头展示；同时累加出整月收入/支出）
    const [dayRows] = await pool.query(
      `SELECT DATE_FORMAT(bill_date, '%Y-%m-%d') AS date,
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
         FROM bill
        WHERE user_id = ? AND bill_date >= ? AND bill_date < DATE_ADD(?, INTERVAL 1 MONTH)
        GROUP BY bill_date
        ORDER BY bill_date DESC`,
      [req.userId, firstDay, firstDay]
    );
    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS c
         FROM bill WHERE user_id = ? AND bill_date >= ? AND bill_date < DATE_ADD(?, INTERVAL 1 MONTH)
         ${type ? 'AND type = ?' : ''}`,
      type ? [req.userId, firstDay, firstDay, type] : [req.userId, firstDay, firstDay]
    );
    const [rows] = await pool.query(
      `SELECT b.id, b.type, b.amount, b.note,
              b.category_id AS categoryId, b.account_id AS accountId,
              DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
              DATE_FORMAT(b.created_at, '%H:%i') AS createdTime,
              c.name AS categoryName, c.icon AS categoryIcon,
              a.name AS accountName
         FROM bill b
         JOIN category c ON c.id = b.category_id
         LEFT JOIN account a ON a.id = b.account_id
        WHERE b.user_id = ? AND b.bill_date >= ? AND b.bill_date < DATE_ADD(?, INTERVAL 1 MONTH)
          ${type ? 'AND b.type = ?' : ''}
        ORDER BY b.bill_date DESC, b.created_at DESC, b.id DESC
        LIMIT ? OFFSET ?`,
      type ? [req.userId, firstDay, firstDay, type, pageSize, offset] : [req.userId, firstDay, firstDay, pageSize, offset]
    );

    // 有账单的最早月份（YYYY-MM；无账单为 null），供前端限制「最早可浏览」下限（F4-1）
    let earliestMonth = null;
    if (offset === 0) {
      const [minRows] = await pool.query(
        "SELECT DATE_FORMAT(MIN(bill_date), '%Y-%m') AS m FROM bill WHERE user_id = ?",
        [req.userId]
      );
      earliestMonth = minRows[0].m || null;
    }

    // 汇总在 JS 内做整数运算，全程无浮点（PRD 金额硬约定）；结余 = 收入 - 支出
    let income = 0;
    let expense = 0;
    const dayTotals = dayRows.map((d) => {
      const inc = Number(d.income) || 0;
      const exp = Number(d.expense) || 0;
      income += inc;
      expense += exp;
      return { date: d.date, income: inc, expense: exp };
    });
    res.json({
      month: monthLabel,
      earliestMonth,
      summary: { income, expense, balance: income - expense },
      dayTotals,
      total: Number(totalRows[0].c) || 0,
      bills: rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
