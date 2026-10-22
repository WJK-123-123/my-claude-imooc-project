import { Router } from 'express';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';

// 用户管理（后台 PRD A3）：列表（搜索/筛选/排序/分页）+ 用户详情下钻。
// 金额一律以「分」整数存储与运算，全程无浮点；展示由前端换算为元。
const router = Router();
router.use(requireAdminAuth);

const STATUSES = new Set(['active', 'deleting', 'deleted']);
// 排序字段白名单 → ORDER BY 表达式（聚合字段可能为 NULL，用 COALESCE 兜底）
const ORDER_BY = {
  register: 'u.created_at',
  lastLogin: 'u.last_login_at',
  billCount: 'COALESCE(b.billCount, 0)',
  expense: 'COALESCE(b.expenseTotal, 0)',
  income: 'COALESCE(b.incomeTotal, 0)',
};

function fail(res, status, message) {
  return res.status(status).json({ message });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 用户维度账单聚合子查询（列表与计数共用）
const BILL_AGG = `(
  SELECT user_id,
         COUNT(*) AS billCount,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal
    FROM bill
   GROUP BY user_id
) b`;

/* ================= 用户列表（后台 PRD A3-1/2/3/4） ================= */
router.get('/', async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * pageSize;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = STATUSES.has(req.query.status) ? req.query.status : null;
    const dateFrom = DATE_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : null;
    const dateTo = DATE_RE.test(req.query.dateTo || '') ? req.query.dateTo : null;
    const hasBills = req.query.hasBills === '1' || req.query.hasBills === '0' ? req.query.hasBills : null;
    const sort = ORDER_BY[req.query.sort] ? req.query.sort : 'register';
    const dir = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // 组装筛选条件（search 纯数字按 UID 精确匹配，否则用户名模糊不区分大小写）
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
    if (status) {
      where.push('u.status = ?');
      params.push(status);
    }
    if (dateFrom) {
      where.push('u.created_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }
    if (dateTo) {
      where.push('u.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(`${dateTo} 00:00:00`);
    }
    if (hasBills === '1') where.push('b.billCount > 0');
    else if (hasBills === '0') where.push('(b.billCount IS NULL OR b.billCount = 0)');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 计数与列表并发（同一筛选口径）
    const [countRes, listRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS c FROM user u LEFT JOIN ${BILL_AGG} ON b.user_id = u.id ${whereSql}`, params),
      pool.query(
        `SELECT u.id, u.username, u.avatar_url AS avatarUrl, u.status,
                DATE_FORMAT(u.purge_at, '%Y-%m-%d') AS purgeAt,
                DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS registeredAt,
                DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS lastLoginAt,
                COALESCE(b.billCount, 0) AS billCount,
                COALESCE(b.expenseTotal, 0) AS expenseTotal,
                COALESCE(b.incomeTotal, 0) AS incomeTotal
           FROM user u
           LEFT JOIN ${BILL_AGG} ON b.user_id = u.id
           ${whereSql}
          ORDER BY ${ORDER_BY[sort]} ${dir}, u.id ASC
          LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ]);

    const users = listRes[0].map((r) => ({
      ...r,
      billCount: Number(r.billCount) || 0,
      expenseTotal: Number(r.expenseTotal) || 0,
      incomeTotal: Number(r.incomeTotal) || 0,
    }));

    res.json({
      total: Number(countRes[0][0].c) || 0,
      page,
      pageSize,
      users,
    });
  } catch (err) {
    next(err);
  }
});

/* ================= 用户详情下钻（后台 PRD A3-6/7） ================= */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '参数错误');

    // 基本信息（含「已坚持天数」沿用用户端口径：注册当天 = 1）
    const [userRows] = await pool.query(
      `SELECT id, username, avatar_url AS avatarUrl, status,
              DATE_FORMAT(purge_at, '%Y-%m-%d') AS purgeAt,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS registeredAt,
              DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i') AS lastLoginAt,
              DATEDIFF(NOW(), created_at) + 1 AS joinedDays
         FROM user WHERE id = ?`,
      [id]
    );
    const user = userRows[0];
    if (!user) return fail(res, 404, '用户不存在');

    // 收支汇总 / 分类统计（支出+收入）/ 账户分布 / 最近账单 并发查询
    const [sumRes, expCatRes, incCatRes, acctRes, billRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS billCount,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal,
                COUNT(DISTINCT bill_date) AS recordDays
           FROM bill WHERE user_id = ?`,
        [id]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b JOIN category c ON c.id = b.category_id
          WHERE b.user_id = ? AND b.type = 'expense'
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [id]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b JOIN category c ON c.id = b.category_id
          WHERE b.user_id = ? AND b.type = 'income'
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [id]
      ),
      pool.query(
        `SELECT COALESCE(a.name, '未标记') AS name, COALESCE(a.emoji, '🏷️') AS emoji,
                SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b LEFT JOIN account a ON a.id = b.account_id
          WHERE b.user_id = ?
          GROUP BY a.id, a.name, a.emoji
          ORDER BY amount DESC, count DESC`,
        [id]
      ),
      pool.query(
        `SELECT b.id, b.type, b.amount, b.note,
                c.name AS categoryName, c.icon AS categoryIcon,
                a.name AS accountName,
                DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
                DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS createdAt
           FROM bill b
           JOIN category c ON c.id = b.category_id
           LEFT JOIN account a ON a.id = b.account_id
          WHERE b.user_id = ?
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT 10`,
        [id]
      ),
    ]);

    const sum = sumRes[0][0];
    const expenseTotal = Number(sum.expenseTotal) || 0;
    const incomeTotal = Number(sum.incomeTotal) || 0;

    const norm = (rows) => rows.map((r) => ({
      name: r.name,
      icon: r.icon || r.emoji || '',
      amount: Number(r.amount) || 0,
      count: Number(r.count) || 0,
    }));

    res.json({
      user: {
        ...user,
        joinedDays: Number(user.joinedDays) || 1,
        summary: {
          billCount: Number(sum.billCount) || 0,
          expenseTotal,
          incomeTotal,
          balance: incomeTotal - expenseTotal,
          recordDays: Number(sum.recordDays) || 0,
        },
        expenseCategories: norm(expCatRes[0]),
        incomeCategories: norm(incCatRes[0]),
        accounts: norm(acctRes[0]),
        recentBills: billRes[0].map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
