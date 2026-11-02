# 测试报告输出目录

本目录为测试报告产物的统一输出位置，由 `tests/` 测试工程自动写入，**请勿手工编辑产物**。

三份测试计划**各对应一份独立报告**，分别落在三个子目录：

| 测试计划 | 报告产物 | 生成命令 |
|---|---|---|
| 01-用户端Web前端-测试计划 | `01-用户端Web前端/index.html`（Playwright HTML：步骤/耗时/失败截图/轨迹） | `cd tests && npm run report:frontend` |
| 02-用户端后端API-测试计划 | `02-用户端后端API/index.html`（node:test → HTML） | `cd tests && npm run report:backend` |
| 03-跨端APP(uniapp)-测试计划 | `03-跨端APP/index.html`（node:test → HTML） | `cd tests && npm run report:app` |

- 每份目录内同时保留原始结构化产物：`backend-junit.xml` / `app-junit.xml` / `results.json`，供 CI 或二次处理。
- 一次性生成三份：`cd tests && npm run report`。

> 说明：`.gitignore` 已忽略本目录下除 `README.md` 外的所有产物，报告不入库、仅在本地/CI 生成。
