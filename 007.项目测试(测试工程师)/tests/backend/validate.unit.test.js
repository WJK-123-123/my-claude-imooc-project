// L1 单元测试（纯函数，无需服务器/数据库）：用户名/密码格式校验
// 覆盖测试计划：BE-002（注册非法用户名/弱密码）
// 直接 import 后端 src/utils/validate.js，不改动业务代码。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, validatePassword } from '../../../003.前端代码/backend/src/utils/validate.js';

test('validateUsername：合法用户名返回 null', () => {
  assert.equal(validateUsername('小桃子'), null);
  assert.equal(validateUsername('abc_123'), null);
  assert.equal(validateUsername('12'), null); // 2 字下限
});

test('validateUsername：非法用户名返回中文提示', () => {
  assert.equal(validateUsername(''), '请输入用户名');
  assert.equal(validateUsername('a'), '用户名需 2–20 个字符');
  assert.equal(validateUsername('a'.repeat(21)), '用户名需 2–20 个字符');
  assert.equal(validateUsername('ab c'), '用户名仅支持中文、字母、数字、下划线');
  assert.equal(validateUsername('ab-c'), '用户名仅支持中文、字母、数字、下划线');
});

test('validatePassword：合法密码返回 null', () => {
  assert.equal(validatePassword('Qa123456!'), null); // 数字/小写/大写/特殊 四类
  assert.equal(validatePassword('abc123DEF'), null); // 数字/小写/大写 三类
});

test('validatePassword：弱密码返回中文提示', () => {
  assert.equal(validatePassword(''), '请输入密码');
  assert.equal(validatePassword('a1'), '密码需 6–20 位');               // <6
  assert.equal(validatePassword('a1A!a1A!a1A!a1A!a1A!a1A!'), '密码需 6–20 位'); // >20
  assert.equal(validatePassword('abc 123'), '密码不能包含空格');         // 含空白
  assert.equal(validatePassword('abcdef'), '密码不符合规范，请重新输入');  // 仅 1 类
  assert.equal(validatePassword('Abcdef'), '密码不符合规范，请重新输入');  // 仅 2 类
});
