import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// 年度收支统计（07 统计页）：记账笔数 / 月均支出 / 最大单笔 + 支出/收入分类排行（按年聚合）。
// 金额一律以「分」整数运算，全程无浮点（PRD 金额硬约定）；查询强制过滤 user_id 防横向越权。
const router = Router();
router.use(requireAuth);

const YEAR_MIN = 2000; // 与 bill 表 CHECK 下限（2000-01-01）对齐

function fail(res, status, message) {
  return res.status(status).json({ message });
}

// 整数四舍五入：round(n/d) = floor((2n + d) / (2d))，全程整数无浮点
function intDivRound(n, d) {
  if (d <= 0) return 0;
  return Math.floor((n * 2 + d) / (d * 2));
}

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    let year = parseInt(req.query.year, 10);
    if (!Number.isInteger(year) || year < YEAR_MIN) year = currentYear;
    if (year > currentYear) year = currentYear; // 未来年份无数据，收口到本年

    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;

    // 五路查询并发：概览 / 最大单笔（含分类）/ 支出分类聚合 / 收入分类聚合 / 有账单的年份
    const [ovRes, maxRes, expRes, incRes, yrRes, monRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS totalCount,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal
           FROM bill
          WHERE user_id = ? AND bill_date >= ? AND bill_date < ?`,
        [req.userId, from, to]
      ),
      pool.query(
        `SELECT b.amount, c.name AS categoryName, c.icon AS categoryIcon
           FROM bill b
           JOIN category c ON c.id = b.category_id
          WHERE b.user_id = ? AND b.type = 'expense' AND b.bill_date >= ? AND b.bill_date < ?
          ORDER BY b.amount DESC, b.bill_date DESC, b.id DESC
          LIMIT 1`,
        [req.userId, from, to]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b
           JOIN category c ON c.id = b.category_id
          WHERE b.user_id = ? AND b.type = 'expense' AND b.bill_date >= ? AND b.bill_date < ?
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [req.userId, from, to]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b
           JOIN category c ON c.id = b.category_id
          WHERE b.user_id = ? AND b.type = 'income' AND b.bill_date >= ? AND b.bill_date < ?
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [req.userId, from, to]
      ),
      pool.query(
        'SELECT DISTINCT YEAR(bill_date) AS y FROM bill WHERE user_id = ? ORDER BY y ASC',
        [req.userId]
      ),
      pool.query(
        `SELECT MONTH(bill_date) AS m,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income
           FROM bill
          WHERE user_id = ? AND bill_date >= ? AND bill_date < ?
          GROUP BY MONTH(bill_date)
          ORDER BY m ASC`,
        [req.userId, from, to]
      ),
    ]);

    const overview = ovRes[0]?.[0] || {};
    const maxRow = maxRes[0]?.[0] || null;
    const expenseTotal = Number(overview.expenseTotal) || 0;
    const incomeTotal = Number(overview.incomeTotal) || 0;
    const totalCount = Number(overview.totalCount) || 0;

    // 月均支出分母：本年按已过月数（含当月），历史年按整年月数（12）
    let months;
    if (year < currentYear) {
      months = 12;
    } else {
      months = now.getMonth() + 1; // 1–12，含当月
    }
    const monthlyAvgExpense = intDivRound(expenseTotal, months);

    // 可选年份 = 有账单的年份 ∪ 当前年（最早到有账单的年份，最晚到本年）
    const years = yrRes[0].map((r) => Number(r.y)).filter((y) => Number.isInteger(y) && y >= YEAR_MIN);
    if (!years.includes(currentYear)) years.push(currentYear);
    years.sort((a, b) => a - b);

    const norm = (rows) => rows.map((r) => ({
      name: r.name,
      icon: r.icon,
      amount: Number(r.amount) || 0,
      count: Number(r.count) || 0,
    }));

    // 月度收支（1–12 月补齐，无账单月份为 0），供 07 页「收支趋势」折线图使用
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, expense: 0, income: 0 }));
    for (const r of monRes[0]) {
      const idx = Number(r.m) - 1;
      if (idx >= 0 && idx < 12) {
        monthly[idx].expense = Number(r.expense) || 0;
        monthly[idx].income = Number(r.income) || 0;
      }
    }

    res.json({
      year,
      currentYear,
      years,
      totalCount,
      expenseTotal,
      incomeTotal,
      monthlyAvgExpense,
      maxExpense: maxRow
        ? {
            amount: Number(maxRow.amount) || 0,
            categoryName: maxRow.categoryName,
            categoryIcon: maxRow.categoryIcon,
          }
        : null,
      expenseCategories: norm(expRes[0]),
      incomeCategories: norm(incRes[0]),
      monthly,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
