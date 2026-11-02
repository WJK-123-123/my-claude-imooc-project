# 011 · 数据可视化

财务管家「数据分析」交付物：随机演示数据文档 + 图表看板 + 经营分析报告。

## 怎么看

- **双击打开 [数据分析看板.html](数据分析看板.html)** 即可在浏览器查阅图表（ECharts 5）。
  依赖同目录的 `chart_data.js` 与 `assets/echarts.min.js`，**无需联网**，双击即可用。
- **[财务管家-数据分析数据文档.xlsx](财务管家-数据分析数据文档.xlsx)** 是原始数据文档（11 个 sheet）。
- **[财务管家-经营数据分析报告.docx](财务管家-经营数据分析报告.docx)** 是面向领导/董事会的 Word 汇报文档（核心结论 + KPI 表 + 9 张嵌入图表 + 结论建议）。

## 文件说明

| 文件 | 用途 |
|---|---|
| `数据分析看板.html` | 图表看板（KPI + 折线 / 环形 / 堆叠柱 / 条形图，共 9 图） |
| `chart_data.js` | 网页读取的图表数据（由 `chart_data.json` 转出） |
| `chart_data.json` | 图表聚合数据（JSON，供脚本/再加工） |
| `assets/echarts.min.js` | 本地 ECharts 5.4.3（离线渲染用） |
| `财务管家-数据分析数据文档.xlsx` | 数据文档本体（按 004 数据库 9 张表生成） |
| `generate_data.py` | 重新随机生成 xlsx（`random.seed(42)` 固定，改种子可换一批数据） |
| `extract_charts.py` | 从 xlsx 抽取聚合数据 → 生成 `chart_data.json` |
| `财务管家-经营数据分析报告.docx` | 经营分析 Word 报告（汇报用，9 张图表嵌入） |
| `generate_report.js` | 生成 Word 报告（读 `chart_data.json` + `assets/report/*.png`） |
| `render_report_images.js` | 用 Playwright 把看板 9 张图表截成 PNG 供报告嵌入 |
| `assets/report/*.png` | 报告嵌入用的 9 张图表图 |

## 重新生成

```bash
python generate_data.py      # 重新生成 xlsx（换随机数据）
python extract_charts.py     # 从新 xlsx 抽取数据 → chart_data.json
python -c "open('chart_data.js','w',encoding='utf-8').write('window.CHART_DATA = ' + open('chart_data.json',encoding='utf-8').read() + ';\n')"  # 同步给网页

# 重新生成 Word 报告（需先装依赖：npm install docx）
node render_report_images.js  # 把看板 9 张图截成 assets/report/*.png
node generate_report.js       # 生成 财务管家-经营数据分析报告.docx
```

> 注意：图表金额均为**随机演示数据**，非真实用户数据；金额单位「元」（库内以「分」整数存储）。
