import { Router } from 'express';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';

// 数据总览仪表盘（后台 PRD A2）：核心指标卡 + 活跃口径 + 近 30 天趋势。
// 金额一律以「分」整数存储与运算，全程无浮点（PRD 金额硬约定）；展示层由前端换算为元。
const router = Router();
router.use(requireAdminAuth);

const TREND_DAYS = 30; // 近 30 天（含今天）

function fail(res, status, message) {
  return res.status(status).json({ message });
}

// 本地时区日期 → YYYY-MM-DD（不依赖 toISOString，避免 UTC 偏移跨天）
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get('/', async (req, res, next) => {
  try {
    // 近 30 天窗口（含今天）；from/to 为闭区间两端，SQL 用 >= from 即可（未来无数据）
    const days = [];
    const now = new Date();
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      days.push(localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
    }
    const from = days[0];

    // 并发查询：核心指标 / 活跃口径 / 每日注册 / 每日记账笔数 / 每日收支 / 窗口前累计注册
    const [userRes, billRes, loginRes, activeRes, regRes, billDayRes, flowRes, beforeRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM user'),
      pool.query(
        `SELECT COUNT(*) AS c,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income
           FROM bill`
      ),
      pool.query('SELECT COUNT(*) AS c FROM user WHERE last_login_at >= ?', [`${from} 00:00:00`]),
      pool.query('SELECT COUNT(DISTINCT user_id) AS c FROM bill WHERE created_at >= ?', [`${from} 00:00:00`]),
      pool.query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c FROM user WHERE created_at >= ? GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')", [`${from} 00:00:00`]),
      pool.query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c FROM bill WHERE created_at >= ? GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')", [`${from} 00:00:00`]),
      pool.query(
        `SELECT DATE_FORMAT(bill_date, '%Y-%m-%d') AS d,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income
           FROM bill
          WHERE bill_date >= ?
          GROUP BY DATE_FORMAT(bill_date, '%Y-%m-%d')`,
        [from]
      ),
      pool.query('SELECT COUNT(*) AS c FROM user WHERE created_at < ?', [`${from} 00:00:00`]),
    ]);

    const userCount = Number(userRes[0][0].c) || 0;
    const billCount = Number(billRes[0][0].c) || 0;
    const expenseTotal = Number(billRes[0][0].expense) || 0;
    const incomeTotal = Number(billRes[0][0].income) || 0;

    // 每日注册 → 逐日累计（窗口前累计 + 前缀和，得到「截至当日」的累计注册数）
    const regMap = new Map(regRes[0].map((r) => [r.d, Number(r.c) || 0]));
    const billDayMap = new Map(billDayRes[0].map((r) => [r.d, Number(r.c) || 0]));
    const flowMap = new Map(
      flowRes[0].map((r) => [r.d, { expense: Number(r.expense) || 0, income: Number(r.income) || 0 }])
    );

    let cum = Number(beforeRes[0][0].c) || 0;
    const registrations = [];
    const cumulativeRegistrations = [];
    const billCounts = [];
    const expenses = [];
    const incomes = [];
    for (const d of days) {
      const rc = regMap.get(d) || 0;
      cum += rc;
      const bc = billDayMap.get(d) || 0;
      const fl = flowMap.get(d) || { expense: 0, income: 0 };
      registrations.push(rc);
      cumulativeRegistrations.push(cum);
      billCounts.push(bc);
      expenses.push(fl.expense);
      incomes.push(fl.income);
    }

    res.json({
      metrics: {
        userCount,
        billCount,
        expenseTotal,
        incomeTotal,
        balance: incomeTotal - expenseTotal, // 结余 = 收入 − 支出（分）
      },
      active: {
        loginLast30d: Number(loginRes[0][0].c) || 0,
        billLast30d: Number(activeRes[0][0].c) || 0,
      },
      trends: {
        days, // YYYY-MM-DD，前端再裁剪为 MM-DD 展示
        registrations,
        cumulativeRegistrations,
        billCounts,
        expenses,
        incomes,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
