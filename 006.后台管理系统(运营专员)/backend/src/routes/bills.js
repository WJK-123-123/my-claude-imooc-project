import { Router } from 'express';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';

// 账单流水查看（后台 PRD A4）：跨用户列表 + 多条件筛选 + 当前筛选汇总。
// 金额一律以「分」整数存储与运算；流水按 bill_date 归集（PRD 4.3）。
const router = Router();
router.use(requireAdminAuth);

const ORDER_BY = {
  billDate: 'b.bill_date',
  createdAt: 'b.created_at',
  amount: 'b.amount',
};

function fail(res, status, message) {
  return res.status(status).json({ message });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * pageSize;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const type = req.query.type === 'expense' || req.query.type === 'income' ? req.query.type : null;
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const account = typeof req.query.account === 'string' ? req.query.account.trim() : '';
    const dateFrom = DATE_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : null;
    const dateTo = DATE_RE.test(req.query.dateTo || '') ? req.query.dateTo : null;
    const sort = ORDER_BY[req.query.sort] ? req.query.sort : 'billDate';
    const dir = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];
    if (search) {
      if (/^\d+$/.test(search)) {
        where.push('u.id = ?');
        params.push(Number(search));
      } else {
        where.push('u.username LIKE ?');
        params.push(`%${search}%`);
      }
    }
    if (type) {
      where.push('b.type = ?');
      params.push(type);
    }
    if (category) {
      where.push('c.name LIKE ?');
      params.push(`%${category}%`);
    }
    if (account) {
      where.push('a.name LIKE ?');
      params.push(`%${account}%`);
    }
    if (dateFrom) {
      where.push('b.bill_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push('b.bill_date <= ?');
      params.push(dateTo);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 汇总（覆盖全部匹配行，非仅当前页）、总数与分页列表并发（三处 JOIN 口径一致）
    const [sumRes, countRes, listRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS c,
                COALESCE(SUM(CASE WHEN b.type = 'expense' THEN b.amount ELSE 0 END), 0) AS expenseTotal,
                COALESCE(SUM(CASE WHEN b.type = 'income' THEN b.amount ELSE 0 END), 0) AS incomeTotal
           FROM bill b
           JOIN user u ON u.id = b.user_id
           JOIN category c ON c.id = b.category_id
           LEFT JOIN account a ON a.id = b.account_id
           ${whereSql}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) AS c
           FROM bill b
           JOIN user u ON u.id = b.user_id
           JOIN category c ON c.id = b.category_id
           LEFT JOIN account a ON a.id = b.account_id
           ${whereSql}`,
        params
      ),
      pool.query(
        `SELECT b.id, b.user_id AS userId, u.username, b.type, b.amount, b.note,
                c.name AS categoryName, c.icon AS categoryIcon,
                a.name AS accountName,
                DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
                DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS createdAt
           FROM bill b
           JOIN user u ON u.id = b.user_id
           JOIN category c ON c.id = b.category_id
           LEFT JOIN account a ON a.id = b.account_id
           ${whereSql}
          ORDER BY ${ORDER_BY[sort]} ${dir}, b.bill_date DESC, b.id DESC
          LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ]);

    const summary = sumRes[0][0];
    res.json({
      total: Number(countRes[0][0].c) || 0,
      page,
      pageSize,
      summary: {
        expenseTotal: Number(summary.expenseTotal) || 0,
        incomeTotal: Number(summary.incomeTotal) || 0,
        count: Number(summary.c) || 0,
      },
      bills: listRes[0].map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
