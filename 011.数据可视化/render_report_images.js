// 渲染看板中的 9 张图表为 PNG，供 Word 报告嵌入使用。
const fs = require("fs");
const path = require("path");
const { chromium } = require("D:/claude-my-product/007.项目测试(测试工程师)/tests/node_modules/playwright");

const ROOT = "D:/claude-my-product/011.数据可视化";
const OUT = path.join(ROOT, "assets", "report");
const URL = "file:///" + path.join(ROOT, "数据分析看板.html").replace(/\\/g, "/");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 2400 }, deviceScaleFactor: 2 });
  await page.goto(URL);
  await page.waitForSelector("#c-user canvas", { timeout: 20000 });
  await page.waitForTimeout(700);

  const charts = [
    ["c-exp-line", "exp_line"],
    ["c-inc-line", "inc_line"],
    ["c-count", "count"],
    ["c-exp-donut", "exp_donut"],
    ["c-inc-donut", "inc_donut"],
    ["c-exp-rank", "exp_rank"],
    ["c-inc-rank", "inc_rank"],
    ["c-acct", "acct"],
    ["c-user", "user"],
  ];
  for (const [id, name] of charts) {
    const el = page.locator("#" + id);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: path.join(OUT, name + ".png") });
  }
  await browser.close();
  console.log("screenshots done:", charts.length);
})().catch(e => { console.error(e); process.exit(1); });
