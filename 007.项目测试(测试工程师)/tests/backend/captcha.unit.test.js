// 单元测试：图形验证码生成/校验（直接 import 003 后端模块，同 app/util.test.js 跨目录模式）。
// HTTP 层的「缺码/错码/一次性」契约见 auth.test.js BE-014；
// 重置成功（200）路径需读出图中数字，自动化不做 OCR，按仓库惯例人工过主流程验证。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptcha, verifyCaptcha } from '../../../003.前端代码/backend/src/utils/captcha.js';

test('验证码：4 位数字 + PNG base64（132×48）；正确码通过；一次性（对/错均作废）', () => {
  const c = createCaptcha();
  assert.match(c.code, /^\d{4}$/);
  const png = Buffer.from(c.pngBase64, 'base64');
  assert.equal(png.readUInt32BE(0), 0x89504e47);  // PNG 魔数
  assert.equal(png.readUInt32BE(12), 0x49484452); // IHDR
  assert.equal(png.readUInt32BE(16), 132);        // 宽
  assert.equal(png.readUInt32BE(20), 48);         // 高

  // 错码拒绝且立即作废，随后即使输入正确码也不可复用
  const w = createCaptcha();
  assert.equal(verifyCaptcha(w.id, 'x' + w.code), false);
  assert.equal(verifyCaptcha(w.id, w.code), false);

  // 正确码通过（容忍首尾空白），通过后立即作废
  const ok = createCaptcha();
  assert.equal(verifyCaptcha(ok.id, ' ' + ok.code + ' '), true);
  assert.equal(verifyCaptcha(ok.id, ok.code), false);

  // 不存在的 id 一律拒绝
  assert.equal(verifyCaptcha('nonexistent', '1234'), false);
});
