# 跨端 APP（uniapp）测试说明

对应测试计划：`../测试计划/03-跨端APP(uniapp)-测试计划.md`。

## 自动化范围

| 层 | 内容 | 本目录覆盖 | 工具 |
|---|---|---|---|
| L2 纯函数单测 | `common/util.js` 金额换算 / 日期 / esc 转义 | ✅ `util.test.js` | node:test（零依赖） |
| L3 接口联调 | 与 003 后端契约一致 | 复用 `../backend/` 结论 | 后端测试计划 |
| L4 E2E 主流程 | 注册→记账→流水→统计→管理→退出 | 需 H5 端 Playwright（见 `../frontend/`）或人工 | — |
| L5 多端兼容 | H5 / 微信小程序 / Android / iOS / **鸿蒙** | ❌ 需各端真机/模拟器人工执行 | HBuilderX |
| L6 非功能 | 弱网、换网络、登录态持久化 | ❌ 需真机人工执行 | — |

## 为什么只自动化 util.js

- uni-app 的页面与组件依赖 HBuilderX 编译 + 各端运行时，无法用 Node 直接加载；
- `common/config.js` 含 `#ifdef H5` 条件编译指令，**不是合法 JS**，Node 无法直接 import；
- 纯函数（金额「元/分」整数换算、esc 转义、跨年日期）是测试计划认定的**高风险项**（APP-202 等），可脱离运行时验证，故用 node:test 覆盖。

## 运行

```bash
cd 007.项目测试(测试工程师)/tests
npm run test:app       # 只跑 util.test.js
```

## 手工用例索引（不在本目录自动化的部分）

- APP-001 ~ APP-006：会话与守卫（`common/api.js`）→ 见测试计划 §5.1，各端人工。
- APP-401 ~ APP-403：**鸿蒙端图表必须 canvas + `uni.createCanvasContext`**，非 SVG → 见测试计划 §5.5，鸿蒙真机专项。
- APP-601 ~ APP-604：多端样式/安全区/TabBar → 见测试计划 §5.7。
