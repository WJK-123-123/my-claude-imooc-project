# 财务管家 · 测试工程说明

本目录是三份测试计划的**自动化测试工程**，独立于业务代码，不改动 `003`、`006` 任何源码。
测试依据：`../测试计划/` 下的三份测试计划（用例编号 FE- / BE- / APP- 与计划一一对应）。

## 一、目录结构

```
007.项目测试(测试工程师)/
├── 测试计划/                  # 三份测试计划（测试依据，勿动）
├── 测试报告/                  # 报告产物输出目录（由本工程生成，勿手改）
└── tests/                     # 测试工程（本目录）
    ├── package.json           # 测试框架与命令
    ├── .gitignore
    ├── README.md              # 本文件
    ├── config/
    │   └── env.js             # 集中配置：后端地址 / 会话 Cookie / 测试账号
    ├── backend/               # 对应 02-用户端后端API-测试计划
    │   ├── helpers.js
    │   ├── validate.unit.test.js
    │   ├── auth.test.js
    │   ├── bills.test.js
    │   ├── flow.test.js
    │   ├── stats.test.js
    │   ├── account-category.test.js
    │   ├── profile.test.js
    │   └── security.test.js
    ├── frontend/              # 对应 01-用户端Web前端-测试计划
    │   ├── playwright.config.js
    │   ├── e2e-helpers.js
    │   ├── auth.spec.js
    │   ├── record.spec.js
    │   ├── flow.spec.js
    │   ├── stats.spec.js
    │   └── profile-manage.spec.js
    └── app/                   # 对应 03-跨端APP(uniapp)-测试计划
        ├── util.test.js
        └── README.md
```

## 二、每个测试文件的作用

### 顶层 / 配置

| 文件 | 作用 |
|---|---|
| `package.json` | 声明测试框架（Node 内置 `node:test` + `@playwright/test`）与全部测试命令 |
| `config/env.js` | 集中配置 `BASE_URL`、会话 Cookie 名、测试账号 A/B 与密码；可用环境变量覆盖 |
| `.gitignore` | 忽略 `node_modules`、Playwright 产物、日志 |

### backend/（后端 API 契约，node:test 零依赖，直连 :3000）

| 文件 | 作用 | 覆盖用例 |
|---|---|---|
| `helpers.js` | 公共夹具：`api()` 请求封装、Cookie 提取、`register()`/`login()`/`uniqueName()` | — |
| `validate.unit.test.js` | L1 单元：用户名/密码正则校验（import 后端 `validate.js`，无需起服务） | BE-002 |
| `auth.test.js` | L2 契约：注册/登录/锁定/登出/找回密码/注销 | BE-001~019 |
| `bills.test.js` | L2 契约：记一笔、详情、编辑、删除 + 横向越权 | BE-101~111 |
| `flow.test.js` | L2 契约：月流水、汇总、日小计、类型筛选、切月 | BE-201~207 |
| `stats.test.js` | L2 契约：年度统计结构、monthly 补齐、years 收口 | BE-301~307 |
| `account-category.test.js` | L2 契约：账户/分类 CRUD、重名、外键 RESTRICT/SET NULL | BE-401~408 |
| `profile.test.js` | L2 契约：头像上传（MIME/大小）、记账微卡 | BE-501~505 |
| `security.test.js` | L4/L6：未授权 401、坏 JSON、未知接口、页面守卫、伪造 Cookie（全只读） | BE-601~604 |

### frontend/（前端 E2E，Playwright）

| 文件 | 作用 | 覆盖用例 |
|---|---|---|
| `playwright.config.js` | Playwright 配置：baseURL、手机视口、失败自动截图、HTML/JSON 报告输出到 `../测试报告/` | — |
| `e2e-helpers.js` | E2E 夹具：经 API 注册账号、注入 httpOnly Cookie，经 `page.request` 播种分类/账户/账单 | — |
| `auth.spec.js` | F1 账号 E2E：协议拦截、空字段、登录跳转、注册弱密码/不一致、注册成功、登录/注册互跳、未登录重定向 | FE-001~007/501 |
| `record.spec.js` | F3 记一笔 E2E：支出/收入双主题、金额边界、空分类拦截、完整记账入账（后端校验） | FE-101/102/104/105 |
| `flow.spec.js` | F4 流水 E2E：账单倒序渲染 + 汇总卡、详情弹层、编辑金额、删除 | FE-201/206 |
| `stats.spec.js` | F7 年度统计 E2E：概览（笔数/月均/最大单笔）按真实账单渲染 | FE-301 |
| `profile-manage.spec.js` | 我的/退出/账户/分类 E2E：资料回显、退出登录、账户增删改查+重名、分类双 Tab CRUD、被引用删除拦截 | FE-401/404/406/407 |

> 说明：前端 E2E 已从「冒烟级」升级为**真实业务流**——每步断言真实 DOM 文本/状态，
> 记账/改删/增删改查后经 `page.request` 回查后端确认数据真实落库；失败自动截图写入 HTML 报告。

### app/（跨端 APP，node:test 零依赖）

| 文件 | 作用 | 覆盖用例 |
|---|---|---|
| `util.test.js` | L2 单元：金额「元/分」整数换算、esc 转义、跨年日期等纯函数（import 006 `common/util.js`） | APP-202 等 |
| `README.md` | 说明为何只自动化 util.js，并给出多端/鸿蒙手工用例索引 | — |

## 三、快速开始

```bash
# 1. 前置：003 后端已启动（:3000）且已连 MySQL；前端 E2E 需联网（Tailwind/字体 CDN）

cd 007.项目测试(测试工程师)/tests

# 2. 零依赖用例（纯函数，无需起服务、无需安装）
npm run test:unit      # 后端 validate + APP util

# 3. 后端 API 契约用例（需后端 :3000 运行；node:test 内置，无需安装）
npm run test:api

# 4. 前端 E2E（需先安装依赖 + 浏览器）
npm install
npx playwright install chromium
npm run test:e2e
```

## 四、测试命令一览

| 命令 | 说明 | 依赖 |
|---|---|---|
| `npm run test:unit` | 纯函数单测（validate + util） | 无 |
| `npm run test:api` | 后端 API 契约全套 | 后端 :3000 运行 |
| `npm run test:app` | APP 纯函数单测 | 无 |
| `npm test` | node:test 全部（backend + app） | 后端 :3000 运行 |
| `npm run test:e2e` | 前端 E2E（Playwright） | `npm install` + 浏览器 |
| `npm run test:e2e:ui` | 前端 E2E 交互模式 | 同上 |
| `npm run report:backend` | 后端报告 → `../测试报告/02-用户端后端API/index.html` | 后端 :3000 运行 |
| `npm run report:app` | APP 报告 → `../测试报告/03-跨端APP/index.html` | 无 |
| `npm run report:frontend` | 前端报告 → `../测试报告/01-用户端Web前端/index.html` | `npm install` + 浏览器 |
| `npm run report` | 三份报告一次性生成 | 上述三者 |

## 五、报告输出目录

所有报告统一写入 `../测试报告/`（即 `007.项目测试(测试工程师)/测试报告/`），**三份测试计划各一份独立报告**：

- `01-用户端Web前端/index.html` —— 前端 E2E HTML 报告（Playwright，含步骤/截图/轨迹）
- `02-用户端后端API/index.html` —— 后端 API 契约 HTML 报告（node:test → HTML）
- `03-跨端APP/index.html` —— 跨端 APP 纯函数单测 HTML 报告（node:test → HTML）

> 每份目录内还保留原始 JUnit/JSON（`*-junit.xml`、`results.json`）供 CI 二次处理。

## 六、注意事项

1. **不改动业务代码**：本工程只读 import 后端的 `validate.js` 与 006 的 `util.js`，其余全部经 HTTP 接口联调；测试数据使用随机唯一账号，不污染既有数据（锁定/注销残留账号 7 天后后端懒清扫）。
2. **最高安全风险**：`/reset-password` 免验证码直改在 `auth.test.js` 中已作为用例（BE-014/015）保留，测试结论需在报告中显式标注供产品决策。
3. **前端 E2E 需联网**：页面依赖 Tailwind CDN / 字体图标；断网环境只跑 `test:unit` / `test:api`。
4. **报告脚本需在 `tests/` 目录下执行**：`report:api` 的 `--test-reporter-destination` 相对路径以本目录为基准。
