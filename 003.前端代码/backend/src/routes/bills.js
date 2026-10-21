import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 账单创建（PRD F3 记一笔：类型/分类/账户/备注/日期/金额以分存储）。
const router = Router();
router.use(requireAuth);

const AMOUNT_MAX = 99999999; // 分，= ¥999,999.99（PRD F3-1 上限）
const NOTE_MAX = 50;        // 备注 ≤50 字（PRD F3-5）

function fail(res, status, message) {
  return res.status(status).json({ message });
}

router.post('/', async (req, res, next) => {
  try {
    const type = req.body?.type;
    const amount = req.body?.amount;
    const categoryId = Number(req.body?.categoryId);
    const accountId = req.body?.accountId == null ? null : Number(req.body?.accountId);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const billDate = req.body?.billDate;

    if (type !== 'expense' && type !== 'income') return fail(res, 400, '记账类型不合法');
    if (!Number.isInteger(amount) || amount < 1 || amount > AMOUNT_MAX) return fail(res, 400, '金额不合法');
    if (!Number.isInteger(categoryId) || categoryId <= 0) return fail(res, 400, '请选择分类');
    if (accountId != null && (!Number.isInteger(accountId) || accountId <= 0)) return fail(res, 400, '账户不合法');
    if (note.length > NOTE_MAX) return fail(res, 400, `备注最多 ${NOTE_MAX} 个字`);
    if (typeof billDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) return fail(res, 400, '日期不合法');

    // 校验分类/账户归属当前用户，且分类 scope 与记账类型一致（防横向越权，PRD §5）
    const [catRows] = await pool.query(
      'SELECT id FROM category WHERE id = ? AND user_id = ? AND scope = ?',
      [categoryId, req.userId, type]
    );
    if (!catRows[0]) return fail(res, 400, '分类不存在或与类型不符');
    if (accountId != null) {
      const [acctRows] = await pool.query(
        'SELECT id FROM account WHERE id = ? AND user_id = ?',
        [accountId, req.userId]
      );
      if (!acctRows[0]) return fail(res, 400, '账户不存在');
    }

    const [r] = await pool.query(
      'INSERT INTO bill (user_id, type, amount, category_id, account_id, note, bill_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.userId, type, amount, categoryId, accountId, note || null, billDate]
    );
    res.json({ bill: { id: r.insertId } });
  } catch (err) {
    next(err);
  }
});

/* ================= 本月流水（06 流水页：分页账单 + 全月汇总 + 按日小计） ================= */
// 按本自然月整月加载（与 10 页统计同口径）；summary/dayTotals 覆盖整月，bills 按 offset/limit
// 分页（默认每页 20 条，前端滚动到底翻页）。账单与汇总都只查当前用户，防横向越权
router.get('/', async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const monthRange = `bill_date >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND bill_date < DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')`;

    // 全月按日小计（组头展示；同时累加出整月收入/支出）
    const [dayRows] = await pool.query(
      `SELECT DATE_FORMAT(bill_date, '%Y-%m-%d') AS date,
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
         FROM bill
        WHERE user_id = ? AND ${monthRange}
        GROUP BY bill_date
        ORDER BY bill_date DESC`,
      [req.userId]
    );
    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS c, DATE_FORMAT(NOW(), '%Y年%c月') AS month
         FROM bill WHERE user_id = ? AND ${monthRange}`,
      [req.userId]
    );
    const [rows] = await pool.query(
      `SELECT b.id, b.type, b.amount, b.note,
              DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
              DATE_FORMAT(b.created_at, '%H:%i') AS createdTime,
              c.name AS categoryName, c.icon AS categoryIcon,
              a.name AS accountName
         FROM bill b
         JOIN category c ON c.id = b.category_id
         LEFT JOIN account a ON a.id = b.account_id
        WHERE b.user_id = ? AND ${monthRange}
        ORDER BY b.bill_date DESC, b.created_at DESC, b.id DESC
        LIMIT ? OFFSET ?`,
      [req.userId, pageSize, offset]
    );

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
      month: totalRows[0].month, // 与 summary 同口径的当前自然月（DB NOW() 计算，非前端时间）
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
