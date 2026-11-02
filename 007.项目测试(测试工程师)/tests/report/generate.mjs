// 生成单个测试计划（node:test）的独立 HTML 测试报告。
// 用法：node report/generate.mjs <backend|app>
// 作用：1) 运行对应目录的 node:test 并输出 JUnit XML；2) 把 JUnit 转成自包含 HTML 报告。
// 前端（01-用户端Web前端）由 Playwright 自带 HTML reporter 生成，不走本脚本。
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');                 // tests/
const REPORTS = path.resolve(ROOT, '../测试报告');           // 007.项目测试(测试工程师)/测试报告

const PLANS = {
  backend: {
    title: '用户端后端 API 测试报告',
    plan: '02-用户端后端API-测试计划',
    dir: '02-用户端后端API',
    filesDir: 'backend',
    pattern: '*.test.js',
    note: '对应测试计划：02-用户端后端API-测试计划（BE-xxx 用例）。',
  },
  app: {
    title: '跨端 APP（uniapp）测试报告',
    plan: '03-跨端APP(uniapp)-测试计划',
    dir: '03-跨端APP',
    filesDir: 'app',
    pattern: '*.test.js',
    note: '对应测试计划：03-跨端APP(uniapp)-测试计划（L2 纯函数单测；多端/真机/鸿蒙用例见手工清单）。',
  },
};

const key = process.argv[2];
const plan = PLANS[key];
if (!plan) {
  console.error('用法：node report/generate.mjs <backend|app>');
  process.exit(1);
}

const outDir = path.join(REPORTS, plan.dir);
mkdirSync(outDir, { recursive: true });

// 手动展开测试文件（Windows 下 npm 用 cmd 执行不展开 *，这里不依赖 shell）
const fileRe = new RegExp('^' + plan.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
const testFiles = readdirSync(path.join(ROOT, plan.filesDir))
  .filter((f) => fileRe.test(f))
  .sort()
  .map((f) => path.join(ROOT, plan.filesDir, f));

const xmlPath = path.join(outDir, `${key}-junit.xml`);
const htmlPath = path.join(outDir, 'index.html');

// 1) 跑 node:test，输出 JUnit（无论成败都要继续渲染报告）
const res = spawnSync(process.execPath, [
  '--test',
  '--test-reporter=junit',
  `--test-reporter-destination=${xmlPath}`,
  ...testFiles,
], { cwd: ROOT, stdio: 'inherit', shell: false });

// 2) 渲染 HTML（JUnit 缺失时也输出错误页，保证有产物可看）
const xml = existsSync(xmlPath) ? readFileSync(xmlPath, 'utf8') : '';
const html = renderHtml(plan, xml);
writeFileSync(htmlPath, html, 'utf8');
console.log(`已生成报告：${htmlPath}`);
process.exit(res.status ?? 0);

/* ---------------- 解析 node:test 的 JUnit XML ---------------- */
function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseJunit(xml) {
  if (!xml) return null;
  const pick = (name) => {
    const m = xml.match(new RegExp(`<!-- ${name} ([\\d.]+) -->`));
    return m ? Number(m[1]) : 0;
  };
  const cases = [];
  const re = /<testcase\b([^>]*?)(?:\/>|>(.*?)<\/testcase>)/gs;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = {};
    const ar = /(\w+)="([^"]*)"/g;
    let a;
    while ((a = ar.exec(m[1])) !== null) attrs[a[1]] = a[2];
    const inner = m[2] || '';
    let failure = null;
    const fr = inner.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/);
    if (fr) {
      const msgAttr = fr[0].match(/message="([^"]*)"/);
      failure = msgAttr ? decodeEntities(msgAttr[1]) : decodeEntities(fr[1].trim());
    }
    cases.push({
      name: decodeEntities(attrs.name || '(未命名用例)'),
      timeMs: Number(attrs.time || 0) * 1000,
      file: attrs.file ? decodeEntities(attrs.file) : '',
      failure,
    });
  }
  return {
    tests: pick('tests'),
    pass: pick('pass'),
    fail: pick('fail'),
    skipped: pick('skipped'),
    todo: pick('todo'),
    durationMs: pick('duration_ms'),
    cases,
  };
}

/* ---------------- 渲染自包含 HTML ---------------- */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s) {
  return esc(s).replace(/\n/g, '<br>');
}

function renderHtml(plan, xml) {
  const data = parseJunit(xml);
  const ts = new Date().toLocaleString('zh-CN', { hour12: false });

  let summaryHtml;
  let tableHtml;
  if (!data) {
    summaryHtml = '<p class="empty">未生成 JUnit 数据（测试运行异常）。</p>';
    tableHtml = '';
  } else {
    const rate = data.tests > 0 ? ((data.pass / data.tests) * 100).toFixed(1) : '—';
    const durSec = (data.durationMs / 1000).toFixed(2);
    summaryHtml = `
      <div class="card"><span>总用例</span><b>${data.tests}</b></div>
      <div class="card ok"><span>通过</span><b>${data.pass}</b></div>
      <div class="card bad"><span>失败</span><b>${data.fail}</b></div>
      <div class="card"><span>跳过</span><b>${data.skipped}</b></div>
      <div class="card"><span>待办</span><b>${data.todo}</b></div>
      <div class="card"><span>通过率</span><b>${rate}%</b></div>
      <div class="card"><span>总耗时</span><b>${durSec}s</b></div>`;

    tableHtml = data.cases.map((c, i) => {
      const isFail = c.failure != null;
      const cls = isFail ? 'fail' : 'pass';
      const badge = isFail ? '❌ 失败' : '✅ 通过';
      return `
      <tr class="${cls}">
        <td class="idx">${i + 1}</td>
        <td class="name" title="${esc(c.file)}">${esc(c.name)}</td>
        <td class="result">${badge}</td>
        <td class="time">${c.timeMs.toFixed(0)}ms</td>
        <td class="detail">${isFail ? nl2br(c.failure) : '—'}</td>
      </tr>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>财务管家 · ${esc(plan.title)}</title>
<style>
  :root { --pink:#ec4899; --pink-weak:#fdf2f8; --ok:#16a34a; --bad:#dc2626; --ink:#1f2937; --mut:#6b7280; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink); background:#fafafa; }
  header { background:linear-gradient(135deg,#ec4899,#f472b6); color:#fff; padding:28px 32px; }
  header h1 { margin:0 0 6px; font-size:22px; font-weight:700; }
  header .meta { margin:0; font-size:13px; opacity:.92; }
  main { max-width:1080px; margin:24px auto; padding:0 20px 40px; }
  .summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:20px 0; }
  .card { background:#fff; border:1px solid #f3d3e3; border-radius:14px; padding:14px 16px; text-align:center; }
  .card span { display:block; font-size:12px; color:var(--mut); margin-bottom:6px; }
  .card b { font-size:24px; }
  .card.ok b { color:var(--ok); }
  .card.bad b { color:var(--bad); }
  .note { background:var(--pink-weak); border-left:4px solid var(--pink); padding:10px 14px; border-radius:8px; font-size:13px; color:#86198f; }
  h2 { font-size:16px; margin:26px 0 10px; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  th,td { text-align:left; padding:10px 14px; border-bottom:1px solid #f3f4f6; font-size:13px; vertical-align:top; }
  th { background:#fff1f8; color:#86198f; font-weight:600; white-space:nowrap; }
  tr:last-child td { border-bottom:none; }
  td.idx { color:var(--mut); width:40px; }
  td.name { font-weight:500; }
  td.result { white-space:nowrap; }
  tr.pass td.result { color:var(--ok); }
  tr.fail td.result { color:var(--bad); }
  td.time { color:var(--mut); white-space:nowrap; }
  td.detail { color:#9f1239; font-family:ui-monospace,Consolas,monospace; font-size:12px; }
  .empty { color:var(--mut); padding:20px; background:#fff; border-radius:12px; }
  footer { color:var(--mut); font-size:12px; text-align:center; margin-top:30px; }
</style>
</head>
<body>
  <header>
    <h1>财务管家 · ${esc(plan.title)}</h1>
    <p class="meta">测试计划：${esc(plan.plan)}　·　生成时间：${esc(ts)}</p>
  </header>
  <main>
    <div class="summary">${summaryHtml}</div>
    <p class="note">${esc(plan.note)}</p>
    <h2>用例明细</h2>
    <table>
      <thead><tr><th>#</th><th>用例</th><th>结果</th><th>耗时</th><th>失败详情</th></tr></thead>
      <tbody>${tableHtml}</tbody>
    </table>
    <footer>由 node:test（JUnit reporter）自动生成 · 财务管家测试工程</footer>
  </main>
</body>
</html>`;
}
