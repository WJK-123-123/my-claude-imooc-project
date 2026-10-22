import { Router } from 'express';
import pool from '../db.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';

// 数据导出（后台 PRD A6，P1）：用户列表 / 账单流水 CSV，受同一筛选条件约束。
// 金额导出为「元、两位小数」（整数除法转字符串，无浮点）；单次上限 10 万条。
const router = Router();
router.use(requireAdminAuth);

const EXPORT_LIMIT = 100000; // 单次导出条数上限（PRD A6-3）

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(res, status, message) {
  return res.status(status).json({ message });
}

// 分 → 元字符串（整数运算，两位小数，无浮点）
function centsToYuan(c) {
  const v = Math.max(0, Math.floor(Number(c) || 0));
  const yuan = Math.floor(v / 100);
  const fen = v % 100;
  return `${yuan}.${String(fen).padStart(2, '0')}`;
}

// CSV 单元格：统一双引号包裹，内部双引号转义
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(header, rows) {
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + csv); // BOM：Excel 打开中文不乱码
}

const STATUS_LABEL = { active: '正常', deleting: '注销中', deleted: '已注销' };
const TYPE_LABEL = { expense: '支出', income: '收入' };

/* ================= 导出用户列表（与 A3 列表同筛选口径） ================= */
router.get('/users.csv', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = ['active', 'deleting', 'deleted'].includes(req.query.status) ? req.query.status : null;
    const dateFrom = DATE_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : null;
    const dateTo = DATE_RE.test(req.query.dateTo || '') ? req.query.dateTo : null;
    const hasBills = req.query.hasBills === '1' || req.query.hasBills === '0' ? req.query.hasBills : null;

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

    const [countRes] = await pool.query(
      `SELECT COUNT(*) AS c FROM user u
        LEFT JOIN (SELECT user_id, COUNT(*) AS billCount FROM bill GROUP BY user_id) b ON b.user_id = u.id
        ${whereSql}`,
      params
    );
    if (Number(countRes[0].c) > EXPORT_LIMIT) {
      return fail(res, 400, `导出条数超过 ${EXPORT_LIMIT} 条上限，请缩小筛选范围`);
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.status,
              DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS registeredAt,
              DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS lastLoginAt,
              COALESCE(b.billCount, 0) AS billCount,
              COALESCE(b.expenseTotal, 0) AS expenseTotal,
              COALESCE(b.incomeTotal, 0) AS incomeTotal
         FROM user u
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS billCount,
                  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
                  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal
             FROM bill GROUP BY user_id
         ) b ON b.user_id = u.id
         ${whereSql}
        ORDER BY u.id ASC`,
      params
    );

    const csv = toCsv(
      ['UID', '用户名', '状态', '注册时间', '最后登录', '账单笔数', '累计支出(元)', '累计收入(元)'],
      rows.map((r) => [
        r.id,
        r.username,
        STATUS_LABEL[r.status] || r.status,
        r.registeredAt,
        r.lastLoginAt || '',
        r.billCount,
        centsToYuan(r.expenseTotal),
        centsToYuan(r.incomeTotal),
      ])
    );
    sendCsv(res, 'users.csv', csv);
  } catch (err) {
    next(err);
  }
});

/* ================= 导出账单流水（与 A4 列表同筛选口径） ================= */
router.get('/bills.csv', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const type = req.query.type === 'expense' || req.query.type === 'income' ? req.query.type : null;
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const account = typeof req.query.account === 'string' ? req.query.account.trim() : '';
    const dateFrom = DATE_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : null;
    const dateTo = DATE_RE.test(req.query.dateTo || '') ? req.query.dateTo : null;

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

    const [countRes] = await pool.query(
      `SELECT COUNT(*) AS c
         FROM bill b
         JOIN user u ON u.id = b.user_id
         JOIN category c ON c.id = b.category_id
         LEFT JOIN account a ON a.id = b.account_id
         ${whereSql}`,
      params
    );
    if (Number(countRes[0].c) > EXPORT_LIMIT) {
      return fail(res, 400, `导出条数超过 ${EXPORT_LIMIT} 条上限，请缩小筛选范围`);
    }

    const [rows] = await pool.query(
      `SELECT b.id, u.username, b.type, b.amount, b.note,
              c.name AS categoryName, a.name AS accountName,
              DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS billDate,
              DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS createdAt
         FROM bill b
         JOIN user u ON u.id = b.user_id
         JOIN category c ON c.id = b.category_id
         LEFT JOIN account a ON a.id = b.account_id
         ${whereSql}
        ORDER BY b.id ASC`,
      params
    );

    const csv = toCsv(
      ['账单ID', '用户名', '类型', '金额(元)', '分类', '账户', '备注', '记账日期', '记录时间'],
      rows.map((r) => [
        r.id,
        r.username,
        TYPE_LABEL[r.type] || r.type,
        centsToYuan(r.amount),
        r.categoryName,
        r.accountName || '',
        r.note || '',
        r.billDate,
        r.createdAt,
      ])
    );
    sendCsv(res, 'bills.csv', csv);
  } catch (err) {
    next(err);
  }
});

export default router;
