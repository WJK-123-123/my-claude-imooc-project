// 通用工具：金额 / 日期 / 转义（对齐 003 前端同款逻辑，金额全程「分」整数无浮点）

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 分 → 元字符串（千分位逗号 + 两位小数）
export function centsToYuan(c) {
  const v = Math.max(0, Math.floor(c || 0));
  const yuan = Math.floor(v / 100);
  const fen = v % 100;
  return String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(fen).padStart(2, '0');
}

// 分 → 普通元字符串（无千分位，用于编辑框回填）
export function centsToPlainYuan(c) {
  return Math.floor(c / 100) + '.' + String(c % 100).padStart(2, '0');
}

// 元字符串 → 分整数（无浮点；无效返回 null）
export function yuanToCents(s) {
  const t = String(s || '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const p = t.split('.');
  const cents = parseInt(p[0], 10) * 100 + (p[1] ? parseInt(p[1].padEnd(2, '0'), 10) : 0);
  if (cents < 1 || cents > 99999999) return null;
  return cents;
}

// 分 → 紧凑元字符串（≥1 万显示「x.x万」，用于折线图纵轴）
export function yuanCompact(c) {
  const yuan = Math.floor(Math.max(0, c || 0) / 100);
  if (yuan >= 10000) {
    const wan = Math.floor(yuan / 10000);
    const qian = Math.floor((yuan % 10000) / 1000);
    return wan + '.' + qian + '万';
  }
  return String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function nowYM() {
  const n = new Date();
  return n.getFullYear() + '-' + pad(n.getMonth() + 1);
}

export function addMonthsYM(ym, delta) {
  const p = ym.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

export function dateParts(dateStr) {
  const p = String(dateStr).split('-');
  return { y: +p[0], m: +p[1], d: +p[2] };
}

// 日分组头标签：今天 / 昨天 / M月D日
export function dayLabel(dateStr) {
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yestStr = yest.getFullYear() + '-' + pad(yest.getMonth() + 1) + '-' + pad(yest.getDate());
  const p = dateParts(dateStr);
  const md = p.m + '月' + p.d + '日';
  if (dateStr === todayStr) return '今天 ' + md;
  if (dateStr === yestStr) return '昨天 ' + md;
  return md;
}

export function fullDate(dateStr) {
  const p = dateParts(dateStr);
  return p.y + '年' + p.m + '月' + p.d + '日';
}

export function fmtDate(c) {
  return c.y + '年' + c.m + '月' + c.d + '日';
}

// 弹提示（统一走 uni.showToast 语义）
export function toast(title) {
  uni.showToast({ title: title, icon: 'none', duration: 2000 });
}
