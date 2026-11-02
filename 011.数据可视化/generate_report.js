// 生成《财务管家 · 经营数据分析报告》Word 文档（含 9 张嵌入图表 + KPI 表 + 分析结论）。
// 运行：node generate_report.js  （需已先运行 _render_report_images.js 生成 assets/report/*.png）
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, Footer, PageNumber, Header,
} = require("docx");

const ROOT = "D:/claude-my-product/011.数据可视化";
const IMG = path.join(ROOT, "assets", "report");
const OUT = path.join(ROOT, "财务管家-经营数据分析报告.docx");

const D = JSON.parse(fs.readFileSync(path.join(ROOT, "chart_data.json"), "utf8"));

/* ===== 主题 ===== */
const ZH = "微软雅黑";
const FONT = { ascii: ZH, eastAsia: ZH, hAnsi: ZH, cs: ZH };
const INK = "1a1a1a";
const INK2 = "555555";
const INK3 = "808080";
const ROSE = "c2185b";
const PINK_FILL = "fce4ec";
const GRAY_FILL = "f7f6f3";
const BORDER = { color: "d8d5cf", size: 4, style: BorderStyle.SINGLE };

/* ===== 数字工具 ===== */
const yuan = n => Number(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wan = n => (n / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
const pct = (a, b) => (a / b * 100).toFixed(1) + "%";

const k = D.kpi;
const m = D.monthly;
const expTop = D.exp_cat.slice(0, 5);
const incTop = D.inc_cat;
const accts = D.accounts.slice().sort((a, b) => b.exp - a.exp);
const u10 = D.user_top10;
const uAvg = u10.reduce((s, x) => s + x.exp, 0) / u10.length;

const firstMonth = m.months[0], lastMonth = m.months[m.months.length - 1];
const firstBills = m.exp_count[0] + m.inc_count[0];
const lastBills = m.exp_count[m.exp_count.length - 1] + m.inc_count[m.inc_count.length - 1];

/* ===== 构件 ===== */
function r(text, o = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: o.size || 21,
    bold: o.bold,
    color: o.color || INK,
    italics: o.italics,
  });
}
function para(text, o = {}) {
  return new Paragraph({
    spacing: { before: o.before || 0, after: o.after != null ? o.after : 120, line: o.line || 300 },
    alignment: o.align || AlignmentType.JUSTIFIED,
    indent: o.noIndent ? undefined : { firstLine: 420 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
    children: [r(text, o)],
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 140 },
    border: { bottom: { color: ROSE, size: 6, style: BorderStyle.SINGLE, space: 4 } },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: ROSE })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: INK })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 220 },
    children: [new TextRun({ text, font: FONT, size: 18, color: INK2 })],
  });
}
function figure(file, cap) {
  const b = fs.readFileSync(path.join(IMG, file));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const tw = 560, th = Math.round(tw * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 0 },
      children: [new ImageRun({ type: "png", data: b, transformation: { width: tw, height: th } })],
    }),
    caption(cap),
  ];
}
function cell(text, width, o = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
    margins: { top: 90, bottom: 90, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: o.align || AlignmentType.LEFT,
      spacing: { after: 0 },
      children: [new TextRun({ text, font: FONT, size: o.size || 21, bold: o.bold, color: o.color || INK })],
    })],
  });
}

/* ===== KPI 表 ===== */
const W = [2200, 3226, 3600];
const kpiRows = [
  ["核心指标", "数值", "口径说明"],
  ["累计收入", yuan(k.total_inc) + " 元", "收入流水 " + k.inc_count + " 笔"],
  ["累计支出", yuan(k.total_exp) + " 元", "支出流水 " + k.exp_count + " 笔"],
  ["净结余", yuan(k.net) + " 元", "收入 − 支出，全程为正"],
  ["账单总笔数", k.bill_count.toLocaleString("zh-CN") + " 笔", "覆盖 " + k.months + " 个自然月"],
  ["活跃用户", k.active_users + " 人", "共 " + (k.active_users + 12) + " 位注册用户"],
  ["平均单笔支出", yuan(k.avg_exp) + " 元", "月均支出 " + yuan(k.avg_month_exp) + " 元"],
].map((cols, i) => new TableRow({
  tableHeader: i === 0,
  children: cols.map((t, j) => cell(t, W[j],
    i === 0 ? { bold: true, fill: PINK_FILL, align: AlignmentType.CENTER }
            : { align: (j === 0 ? AlignmentType.LEFT : j === 1 ? AlignmentType.RIGHT : AlignmentType.LEFT),
                bold: j === 0, color: (j === 1 ? INK : INK2), fill: (i % 2 === 0 ? GRAY_FILL : undefined) })),
}));

const kpiTable = new Table({
  width: { size: W[0] + W[1] + W[2], type: WidthType.DXA },
  columnWidths: W,
  borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
  rows: kpiRows,
});

/* ===== 摘要（核心结论）===== */
const summary = [
  "收支稳健：22 个月累计收入 " + wan(k.total_inc) + " 万元、支出 " + wan(k.total_exp) + " 万元，净结余 " + wan(k.net) + " 万元，收入约为支出的 " + (k.total_inc / k.total_exp).toFixed(1) + " 倍，现金流入显著优于流出。",
  "增长提速：2026 年起收入与记账活跃度明显抬升，10 月单月收入 " + wan(m.inc[m.inc.length - 1]) + " 万元、支出 " + wan(m.exp[m.exp.length - 1]) + " 万元，均为 22 个月峰值，业务进入放量期。",
  "支出高度集中：居住（" + pct(expTop[0].amount, k.total_exp) + "）与教育（" + pct(expTop[1].amount, k.total_exp) + "）两大刚性支出合计占近六成，是控制支出的关键抓手。",
  "收入来源单一：工资一项占收入 " + pct(incTop[0].amount, k.total_inc) + "，薪酬类来源（工资 + 奖金）合计 " + pct(incTop[0].amount + incTop[1].amount, k.total_inc) + "，结构依赖度偏高。",
  "支付方式分散：银行卡 / 支付宝 / 现金 / 微信四类支出分布均匀，未出现单一渠道垄断，用户支付习惯多元。",
].map((t, i) => para((i + 1) + ". " + t, { after: 80, line: 300, noIndent: true }));

/* ===== 正文 ===== */
const children = [
  // —— 标题区 ——
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: "财务管家 · 经营数据分析报告", font: FONT, size: 40, bold: true, color: INK })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: "覆盖 " + firstMonth + " — " + lastMonth + "（22 个月）", font: FONT, size: 22, color: ROSE, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "汇报对象：公司领导 / 董事会    编制日期：2026 年 10 月 31 日", font: FONT, size: 19, color: INK3 })],
  }),

  // —— 数据说明 ——
  para("数据说明：本报告基于「财务管家」数据库设计（9 张业务表）随机生成的演示数据撰写，数据规模 60 位注册用户、5,394 笔账单流水，覆盖 22 个自然月；金额单位均为「元」（系统库内以「分」整数存储）。本报告用于演示数据分析方法与汇报结构，非真实经营数据，正式汇报前请以真实生产数据替换。",
    { fill: GRAY_FILL, size: 19, color: INK2, after: 200 }),

  // —— 核心结论 ——
  h1("核心结论"),
  ...summary,

  // —— 一、经营总览 ——
  h1("一、经营总览"),
  para("报告期内，产品累计产生 " + k.bill_count.toLocaleString("zh-CN") + " 笔记账流水，覆盖 " + k.months + " 个自然月；累计收入 " + yuan(k.total_inc) + " 元，累计支出 " + yuan(k.total_exp) + " 元，净结余 " + yuan(k.net) + " 元。整体呈现「收入远高于支出、结余持续为正」的健康经营态势。", { after: 140 }),
  kpiTable,
  para("注：用户数为数据库演示口径（60 位注册用户、48 位活跃）；账户仅作支付方式标记，不承载余额。", { size: 18, color: INK3, before: 80, after: 120 }),

  // —— 二、收支趋势 ——
  h1("二、收支趋势分析"),
  ...figure("exp_line.png", "图 1 · 月度支出趋势（元）"),
  ...figure("inc_line.png", "图 2 · 月度收入趋势（元）"),
  ...figure("count.png", "图 3 · 每月记账笔数（支出 / 收入堆叠）"),
  para("支出端，2025 年月度支出在 " + wan(Math.min(...m.exp)) + " 万 – " + wan(61800) + " 万元区间窄幅波动，2026 年起稳步抬升至 6 万 – 8.7 万元区间，10 月跃升至 " + wan(m.exp[m.exp.length - 1]) + " 万元，创单月新高。收入端，2025 年月收入多在 16.9 万 – 37.8 万元之间，2026 年 1 月跳升至 " + wan(m.inc[12]) + " 万元后维持高位，10 月激增至 " + wan(m.inc[m.inc.length - 1]) + " 万元。", { after: 100 }),
  para("记账活跃度方面，月记账笔数由 " + firstMonth + " 的 " + firstBills + " 笔增长至 " + lastMonth + " 的 " + lastBills + " 笔，增幅约 " + (lastBills / firstBills).toFixed(1) + " 倍，用户记账意愿与产品粘性持续增强。", { after: 120 }),

  // —— 三、支出结构 ——
  h1("三、支出结构分析"),
  ...figure("exp_donut.png", "图 4 · 支出分类占比（前 5 大 + 其余合并）"),
  ...figure("exp_rank.png", "图 5 · 支出分类排行（前 12）"),
  para("居住为最大支出项，占 " + pct(expTop[0].amount, k.total_exp) + "（" + yuan(expTop[0].amount) + " 元）；教育次之，占 " + pct(expTop[1].amount, k.total_exp) + "（" + yuan(expTop[1].amount) + " 元）。两者合计占总支出的 " + pct(expTop[0].amount + expTop[1].amount, k.total_exp) + "，构成支出的刚性基本盘。", { after: 100 }),
  para("购物（" + pct(expTop[2].amount, k.total_exp) + "）、人情往来（" + pct(expTop[3].amount, k.total_exp) + "）、娱乐（" + pct(expTop[4].amount, k.total_exp) + "）分列三至五位，属于相对可调控的弹性支出，是后续精细化运营与引导的潜在空间。", { after: 120 }),

  // —— 四、收入结构 ——
  h1("四、收入结构分析"),
  ...figure("inc_donut.png", "图 6 · 收入分类占比"),
  ...figure("inc_rank.png", "图 7 · 收入分类排行"),
  para("工资是绝对主力，占收入的 " + pct(incTop[0].amount, k.total_inc) + "（" + yuan(incTop[0].amount) + " 元）；奖金 " + pct(incTop[1].amount, k.total_inc) + "、兼职 " + pct(incTop[2].amount, k.total_inc) + " 分列二、三位。工资 + 奖金两项合计 " + pct(incTop[0].amount + incTop[1].amount, k.total_inc) + "，收入对薪酬类来源的依赖度较高。", { after: 100 }),
  para("理财收益 " + yuan(incTop[3].amount) + " 元（" + pct(incTop[3].amount, k.total_inc) + "），被动收入占比偏低，收入结构抗风险能力有待关注。", { after: 120 }),

  // —— 五、支付方式与用户行为 ——
  h1("五、支付方式与用户行为"),
  ...figure("acct.png", "图 8 · 支付账户支出排行（元）"),
  ...figure("user.png", "图 9 · 用户记账 Top10（按支出，元）"),
  para("支付方式方面，除「未标记」外，银行卡（" + yuan(accts[1].exp) + " 元）、支付宝（" + yuan(accts[2].exp) + " 元）、现金（" + yuan(accts[3].exp) + " 元）、微信（" + yuan(accts[4].exp) + " 元）四类支出分布均匀，均处于 24 万 – 27 万元区间；信用卡支出（" + yuan(accts[5].exp) + " 元）相对较低。用户支付习惯多元，未出现单一渠道垄断。", { after: 100 }),
  para("用户层面，Top10 用户支出集中在 " + yuan(u10[9].exp) + " – " + yuan(u10[0].exp) + " 元区间，头部用户之间差距不大，均值约 " + yuan(uAvg) + " 元，高活跃用户贡献稳定，未出现显著单点依赖。", { after: 120 }),

  // —— 六、结论与建议 ——
  h1("六、结论与建议"),
  para("1. 经营基本面健康：净结余为正且持续扩大，收入增速高于支出增速，整体现金流状况稳健。", { after: 80, noIndent: true }),
  para("2. 结构性风险需跟踪：收入过度依赖工资（" + pct(incTop[0].amount, k.total_inc) + "）、支出集中于居住（" + pct(expTop[0].amount, k.total_exp) + "），需持续监测结构变化并评估其影响。", { after: 80, noIndent: true }),
  para("3. 增长信号明确：2026 年记账笔数与收入双升，10 月创多项峰值，产品处于放量阶段，建议把握窗口期加大投入。", { after: 80, noIndent: true }),
  para("4. 后续观察点：关注活跃用户留存、月度收支比稳定性，以及 10 月异常高增是否可持续。", { after: 160, noIndent: true }),

  // —— 附录 ——
  h1("附录"),
  para("原始数据文档：《财务管家-数据分析数据文档.xlsx》（11 个 sheet）；交互式图表看板：《数据分析看板.html》（ECharts 5，双击即可离线查看）。", { after: 60 }),
  para("注：所有图表与金额均为随机演示数据，非真实用户数据。", { size: 18, color: INK3, noIndent: true }),
];

/* ===== 文档 ===== */
const doc = new Document({
  creator: "财务管家 · 数据可视化",
  title: "财务管家 · 经营数据分析报告",
  description: "经营数据分析报告（演示数据）",
  styles: {
    default: {
      document: { run: { font: FONT, size: 21, color: INK } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { color: "e1e0d9", size: 4, style: BorderStyle.SINGLE, space: 4 } },
          children: [new TextRun({ text: "财务管家 · 经营数据分析报告", font: FONT, size: 16, color: INK3 })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: ["第 ", PageNumber.CURRENT, " 页"], font: FONT, size: 16, color: INK3 })],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("written:", OUT, buf.length, "bytes");
});
