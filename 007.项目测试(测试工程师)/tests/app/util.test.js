// L2 单元测试（纯函数，无需 uni 运行时）：跨端 APP 金额/日期/转义工具
// 覆盖测试计划：APP-202（金额边界）、APP-6xx（XSS 转义、金额换算）。
// 直接 import 006 uniapp 的 common/util.js（该文件为纯 ESM、无 uni 依赖，toast 仅调用时才引 uni）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, centsToYuan, centsToPlainYuan, yuanToCents, yuanCompact,
  addMonthsYM, dateParts, fullDate, dayLabel,
} from '../../../006.跨端APP应用(移动端开发工程师)/uniapp-project/common/util.js';

test('esc：转义 HTML 特殊字符防 XSS', () => {
  assert.equal(esc('<script>'), '&lt;script&gt;');
  assert.equal(esc('"&\''), '&quot;&amp;&#39;');
  assert.equal(esc(null), '');
});

test('centsToYuan：分→元，千分位 + 两位小数', () => {
  assert.equal(centsToYuan(0), '0.00');
  assert.equal(centsToYuan(1), '0.01');
  assert.equal(centsToYuan(100), '1.00');
  assert.equal(centsToYuan(1234567), '12,345.67');
  assert.equal(centsToYuan(99999999), '999,999.99');
});

test('yuanToCents：元→分整数（无浮点，缺位补零）', () => {
  assert.equal(yuanToCents('0.01'), 1);
  assert.equal(yuanToCents('1'), 100);
  assert.equal(yuanToCents('1.5'), 150);
  assert.equal(yuanToCents('999999.99'), 99999999);
});

test('yuanToCents：非法/越界返回 null', () => {
  assert.equal(yuanToCents('0'), null);         // 小于 1 分
  assert.equal(yuanToCents('0.001'), null);     // 三位小数
  assert.equal(yuanToCents('-1'), null);
  assert.equal(yuanToCents('1000000'), null);   // 超上限 999999.99
  assert.equal(yuanToCents('abc'), null);
  assert.equal(yuanToCents(''), null);
});

test('yuanCompact：紧凑元（≥1 万元即 100 万分才显示 x.x万）', () => {
  assert.equal(yuanCompact(10000), '100');       // ¥100，未到万
  assert.equal(yuanCompact(1000000), '1.0万');   // ¥10000
  assert.equal(yuanCompact(1234567), '1.2万');   // ¥12345.67
  assert.equal(yuanCompact(9999), '99');         // ¥99.99
});

test('centsToPlainYuan：无千分位回填', () => {
  assert.equal(centsToPlainYuan(1234567), '12345.67');
});

test('addMonthsYM：跨年进位', () => {
  assert.equal(addMonthsYM('2026-12', 1), '2027-01');
  assert.equal(addMonthsYM('2026-01', -1), '2025-12');
  assert.equal(addMonthsYM('2026-02', 0), '2026-02');
});

test('dateParts / fullDate：解析与中文日期', () => {
  assert.deepEqual(dateParts('2026-10-27'), { y: 2026, m: 10, d: 27 });
  assert.equal(fullDate('2026-10-27'), '2026年10月27日');
});

test('dayLabel：今天前缀 / 普通日期', () => {
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  assert.ok(dayLabel(today).startsWith('今天'));
  assert.equal(dayLabel('2000-01-01'), '1月1日');
});
