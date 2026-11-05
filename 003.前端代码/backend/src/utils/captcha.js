import crypto from 'node:crypto';
import zlib from 'node:zlib';

// 图形验证码（找回密码的身份核验层，PRD F1-5）。产品明确不接入短信/邮箱通道
// （与 PRD §5「不收集手机号等实名信息」的合规取舍一致），故这里就是长期方案而非过渡：
// - 4 位数字，5 分钟有效，一次性：无论校验对错，校验一次即作废，须刷新重取
// - 自绘 7 段数码管 + 抖动 + 噪线/噪点，直接编码为 PNG（无第三方依赖，
//   Web <img> 与 uniapp <image>（含微信小程序）全端通用；SVG 在部分小程序端不渲染，故不用）
// - 内存存储：单实例部署够用；重启丢码无安全影响（用户刷新重取即可），多实例需换 Redis
// 防护定位：与接口限流（utils/rate-limit.js）+ 重置成功吊销全部会话配合，
// 挡脚本批量重置与撞库探测；知道用户名的真人定向重置属产品已接受的风险面。

const CODE_LEN = 4;
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 10000; // 内存兜底上限，超出按插入序淘汰最旧
const store = new Map(); // id -> { code, expiresAt }

function sweep(now) {
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

// 生成一张验证码。返回 { id, code, pngBase64 }；
// code 仅供服务端内部与测试断言使用，HTTP 端点不得下发（见 routes/auth.js）
export function createCaptcha() {
  const now = Date.now();
  sweep(now);
  while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);

  let code = '';
  for (let i = 0; i < CODE_LEN; i++) code += crypto.randomInt(0, 10);
  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { code, expiresAt: now + TTL_MS });
  return { id, code, pngBase64: renderPng(code) };
}

// 一次性校验：对/错/过期均立即删除条目；返回是否验证通过
export function verifyCaptcha(id, code) {
  sweep(Date.now());
  const entry = typeof id === 'string' ? store.get(id) : null;
  if (!entry) return false;
  store.delete(id);
  return entry.expiresAt > Date.now() && typeof code === 'string' && code.trim() === entry.code;
}

/* ================= PNG 光栅渲染（手写编码器，node:zlib 出 IDAT） ================= */

const W = 132;
const H = 48;
const BG = [0xfc, 0xf1, 0xf4];          // 浅粉底（贴合 PRD 6.5 视觉）
const DIGIT_COLORS = [                  // 深色码身，浅底上保证可读
  [0x79, 0x24, 0x3f], [0x9b, 0x3f, 0x5a], [0x8c, 0x15, 0x20],
];
const NOISE_LINE = [0xff, 0xb3, 0xb0];  // 干扰线（浅）
const NOISE_DOT_DARK = [0x8c, 0x15, 0x20];
const NOISE_DOT_LIGHT = [0xff, 0xd9, 0xe0];

// 7 段数码管：每段为单元格内的归一化端点 [x1,y1,x2,y2]（0~1）
const SEGMENTS = {
  a: [0.1, 0, 0.9, 0], f: [0, 0.08, 0, 0.42], b: [1, 0.08, 1, 0.42],
  g: [0.1, 0.5, 0.9, 0.5], e: [0, 0.58, 0, 0.92], c: [1, 0.58, 1, 0.92],
  d: [0.1, 1, 0.9, 1],
};
const DIGITS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

// 抖动与噪点不承担安全职责，用 Math.random 即可；验证码数字本身用 crypto.randomInt
const rnd = (n) => Math.floor(Math.random() * n);
const jitter = (span) => rnd(span * 2 + 1) - span;

function drawLine(buf, x1, y1, x2, y2, thick, rgb) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2 + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + (x2 - x1) * t);
    const cy = Math.round(y1 + (y2 - y1) * t);
    for (let dy = 0; dy < thick; dy++) {
      for (let dx = 0; dx < thick; dx++) setPx(buf, cx + dx, cy + dy, rgb);
    }
  }
}

function setPx(buf, x, y, rgb) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] = rgb[0];
  buf[p + 1] = rgb[1];
  buf[p + 2] = rgb[2];
}

function renderPng(code) {
  const buf = Buffer.alloc(W * H * 3);
  for (let p = 0; p < W * H * 3; p += 3) {
    buf[p] = BG[0];
    buf[p + 1] = BG[1];
    buf[p + 2] = BG[2];
  }

  const cellW = 18;
  const cellH = 32;
  for (let i = 0; i < code.length; i++) {
    const ox = 12 + i * 28 + jitter(2);
    const oy = 8 + jitter(2);
    const thick = 3 + rnd(2);
    const rgb = DIGIT_COLORS[rnd(DIGIT_COLORS.length)];
    for (const seg of DIGITS[code[i]]) {
      const [x1, y1, x2, y2] = SEGMENTS[seg];
      drawLine(buf,
        ox + x1 * cellW + jitter(1), oy + y1 * cellH + jitter(1),
        ox + x2 * cellW + jitter(1), oy + y2 * cellH + jitter(1),
        thick, rgb);
    }
  }

  // 干扰：3 条浅色噪线 + 少量明暗噪点，压低最简单的像素级模板匹配
  for (let i = 0; i < 3; i++) drawLine(buf, rnd(W), rnd(H), rnd(W), rnd(H), 1, NOISE_LINE);
  for (let i = 0; i < 70; i++) {
    setPx(buf, rnd(W), rnd(H), rnd(2) ? NOISE_DOT_DARK : NOISE_DOT_LIGHT);
  }

  return encodePng(buf);
}

/* ---- 最小 PNG 编码：8 位 RGB、无滤波、zlib IDAT ---- */

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(body) {
  let c = ~0;
  for (let i = 0; i < body.length; i++) c = CRC_TABLE[(c ^ body[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // 位深
  ihdr[9] = 2;  // 色彩类型：真彩色 RGB
  const rowLen = W * 3 + 1; // 每行前 1 字节滤波类型（0 = None）
  const raw = Buffer.alloc(rowLen * H);
  for (let y = 0; y < H; y++) {
    pixels.copy(raw, y * rowLen + 1, y * W * 3, (y + 1) * W * 3);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}
