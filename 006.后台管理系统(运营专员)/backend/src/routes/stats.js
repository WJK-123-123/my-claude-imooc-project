import { Router } from 'express';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';

// 统计报表（后台 PRD A5）：按年 / 最近 12 个月切换的收支趋势 + 全局分类排行 + 账户分布。
// 口径复用用户端 F7：金额「分」整数求和，占比由前端按同一规则计算（一位小数）。
const router = Router();
router.use(requireAdminAuth);

const YEAR_MIN = 2000; // 与 bill 表 CHECK 下限（2000-01-01）对齐

function fail(res, status, message) {
  return res.status(status).json({ message });
}

const pad = (n) => String(n).padStart(2, '0');

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const range = req.query.range === 'recent12' ? 'recent12' : 'year';

    // 确定统计窗口 [from, to) 与 12 个趋势月标签
    let from;
    let to;
    let trendLabels = [];
    let year = null;

    if (range === 'recent12') {
      // 最近 12 个月：起始月 = 当前月 - 11
      const start = new Date(currentYear, now.getMonth() - 11, 1);
      const end = new Date(currentYear, now.getMonth() + 1, 1);
      from = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;
      to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-01`;
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        trendLabels.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
      }
    } else {
      let y = parseInt(req.query.year, 10);
      if (!Number.isInteger(y) || y < YEAR_MIN) y = currentYear;
      if (y > currentYear) y = currentYear; // 未来年份无数据，收口到本年
      year = y;
      from = `${y}-01-01`;
      to = `${y + 1}-01-01`;
      for (let m = 1; m <= 12; m++) trendLabels.push(`${y}-${pad(m)}`);
    }

    // 并发：概览 / 按月趋势 / 支出分类 / 收入分类 / 账户分布
    const [ovRes, trendRes, expRes, incRes, acctRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS billCount,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal
           FROM bill
          WHERE bill_date >= ? AND bill_date < ?`,
        [from, to]
      ),
      pool.query(
        `SELECT DATE_FORMAT(bill_date, '%Y-%m') AS m,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income
           FROM bill
          WHERE bill_date >= ? AND bill_date < ?
          GROUP BY DATE_FORMAT(bill_date, '%Y-%m')`,
        [from, to]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b JOIN category c ON c.id = b.category_id
          WHERE b.type = 'expense' AND b.bill_date >= ? AND b.bill_date < ?
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [from, to]
      ),
      pool.query(
        `SELECT c.name, c.icon, SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b JOIN category c ON c.id = b.category_id
          WHERE b.type = 'income' AND b.bill_date >= ? AND b.bill_date < ?
          GROUP BY c.id, c.name, c.icon
          ORDER BY amount DESC, count DESC`,
        [from, to]
      ),
      pool.query(
        `SELECT COALESCE(a.name, '未标记') AS name, COALESCE(a.emoji, '🏷️') AS emoji,
                SUM(b.amount) AS amount, COUNT(*) AS count
           FROM bill b LEFT JOIN account a ON a.id = b.account_id
          WHERE b.bill_date >= ? AND b.bill_date < ?
          GROUP BY a.id, a.name, a.emoji
          ORDER BY amount DESC, count DESC`,
        [from, to]
      ),
    ]);

    const ov = ovRes[0][0];

    // 12 个月趋势补齐（无账单月为 0）
    const trendMap = new Map(trendRes[0].map((r) => [r.m, { expense: Number(r.expense) || 0, income: Number(r.income) || 0 }]));
    const trend = trendLabels.map((label) => ({
      label,
      expense: (trendMap.get(label) || {}).expense || 0,
      income: (trendMap.get(label) || {}).income || 0,
    }));

    const norm = (rows) => rows.map((r) => ({
      name: r.name,
      icon: r.icon || r.emoji || '',
      amount: Number(r.amount) || 0,
      count: Number(r.count) || 0,
    }));

    res.json({
      range,
      year,
      currentYear,
      from,
      to,
      summary: {
        billCount: Number(ov.billCount) || 0,
        expenseTotal: Number(ov.expenseTotal) || 0,
        incomeTotal: Number(ov.incomeTotal) || 0,
      },
      trend,
      expenseCategories: norm(expRes[0]),
      incomeCategories: norm(incRes[0]),
      accounts: norm(acctRes[0]),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
