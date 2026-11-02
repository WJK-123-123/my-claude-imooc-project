# 财务管家 · 跨端 APP（uniapp）测试计划

> 测试对象：`006.跨端APP应用(移动端开发工程师)/uniapp-project`（uni-app + Vue3）
> 文档版本：V1.0
> 关联文档：`001.产品PRD/财务管家-PRD-V1.0.md`（V1.13）、`003.前端代码/backend`（**共用同一后端**）
> 测试类型：功能 / 多端兼容 / 会话 / 鸿蒙专项 / 回归

---

## 1. 项目识别

### 1.1 技术栈

| 维度 | 内容 |
|---|---|
| 框架 | uni-app（`"vueVersion": "3"`，Vue3 `createSSRApp`） |
| 构建/运行 | HBuilderX（本机 5.26，CLI 免登录构建见项目记忆）；鸿蒙 DevEco 26.1 |
| 目标端 | H5、微信小程序、iOS/Android App、**鸿蒙 HarmonyOS App**（`app-harmony` 已配签名） |
| 数据来源 | 复用 003 后端 `/api/*`（**无独立后端**），`BASE_URL` 见 `common/config.js` |
| 会话 | 手动管理 Cookie：`uni.request` 响应头 `Set-Cookie` 提取令牌 → `uni.setStorageSync`，请求头 `Cookie` 回传 |
| 图表 | 鸿蒙 Web 组件不画内联 SVG，统计页图表须用 **canvas + `uni.createCanvasContext`**（见项目记忆） |

### 1.2 目录结构

```
uniapp-project/
├── App.vue            全局设计令牌（粉嫩可爱风，对齐 003 DESIGN.md）
├── main.js / manifest.json / pages.json / uni.scss / index.html
├── .hbuilderx/launch.json  鸿蒙/Android 调试配置（工程目录绕中文路径）
├── harmony-configs/        鸿蒙配置（当前空）
├── common/
│   ├── config.js     BASE_URL（H5 走代理；真机改局域网 IP）
│   ├── api.js        request 封装 + Cookie 会话 + ensureAuth 守卫
│   └── util.js       金额/日期/esc 工具（对齐 003 前端，金额「分」整数）
├── components/TabBar.vue   自绘底部导航（流水/记一笔/统计/我的）
└── pages/            10 页（对齐 003 前端主流程）
    ├── login / register / forgot
    ├── add（记一笔）/ flow（流水）/ stats（统计）
    ├── profile（我的）/ settings（退出与注销）
    └── accounts（账户管理）/ categories（分类管理）
```

### 1.3 启动方式（测试环境）

| 端 | 命令/方式 | 说明 |
|---|---|---|
| H5 | HBuilderX → 运行到浏览器 | `h5.devServer.proxy` 把 `/api` 代理到 `http://localhost:3000`（同源无跨域） |
| 微信小程序 | HBuilderX → 运行到微信开发者工具 | `BASE_URL=http://localhost:3000`，需 `mp-weixin.urlCheck=false`（已关） |
| Android 模拟器 | HBuilderX → 运行到 App-Android | `BASE_URL=http://10.0.2.2:3000` |
| iOS/Android/鸿蒙真机 | 真机运行 | `BASE_URL` 改电脑局域网 IP（本机 192.168.1.8），须同 Wi-Fi |
| 鸿蒙真机 | HBuilderX → 运行到 App-Harmony | 需 DevEco 26.1 + 签名（manifest 已配），图表走 canvas |

> 前置：003 后端必须先启动（`:3000`）并连库，APP 所有页面依赖它。

---

## 2. 核心业务模块

与 003 前端同源映射（页面一对一对齐）：F1 账号（login/register/forgot）、F3 记一笔（add）、F4 流水（flow）、F7 年度统计（stats）、我的（profile）、退出注销（settings）、账户/分类管理（accounts/categories）。差异在于**多端运行 + 手动 Cookie 会话 + 鸿蒙图表**。

---

## 3. 高风险功能识别

| 风险点 | 位置 | 风险说明 | 等级 |
|---|---|---|---|
| 手动 Cookie 会话 | common/api.js | 小程序/App 不自动持久化 Cookie，靠 `Set-Cookie` 提取 + `Cookie` 回传，漏提取/不续期即掉登录 | 高 |
| BASE_URL 多端切换 | common/config.js | H5 空串走代理；真机硬编码局域网 IP，换网络即连不上 | 高 |
| 鸿蒙图表渲染 | stats.vue | 鸿蒙 Web 组件不画内联 SVG，须 canvas + `uni.createCanvasContext`，兼容性易踩坑 | 高 |
| 金额「元/分」换算 | common/util.js | `yuanToCents`/`centsToYuan`/`yuanCompact` 边界、无浮点 | 高 |
| 登录守卫 ensureAuth | common/api.js | 仅 401 跳登录；网络异常不跳，需验证多端行为一致 | 中 |
| 自绘底部 TabBar | components/TabBar.vue | `reLaunch` 跳转、active 态、profile 变体、安全区 padding | 中 |
| 头像上传（App 端选图） | profile.vue | `uni.chooseImage`→base64→PUT，与 H5 文件选择差异 | 中 |
| XSS 回显 | 各页渲染 | 用户输入（备注/分类名）是否 `esc` 转义 | 中 |
| 多端样式一致性 | 全部 | rpx 换算、安全区、字体、固定定位 tabbar 遮挡 | 中 |

---

## 4. 分层测试方案

| 层 | 内容 | 工具/方式 | 覆盖目标 |
|---|---|---|---|
| L1 静态检查 | pages.json 路由、manifest 配置、各页语法 | HBuilderX 编译日志、`npm run dev` 报错 | 10 页可编译运行 |
| L2 纯函数单测 | util.js 金额/日期/esc、api.js 令牌提取 | 浏览器 Console / Node 脚本手测 | 边界与换算正确 |
| L3 接口联调 | 与 003 后端契约一致（复用后端测试计划结论） | H5 走代理抓 Network | 各页数据真实渲染 |
| L4 E2E 主流程 | 注册→记账→流水→统计→管理→退出 | H5 端人工全链路 | 主流程闭环 |
| L5 多端兼容 | H5 / 微信小程序 / Android / iOS / **鸿蒙** | 各端真机/模拟器 | 功能与样式一致 |
| L6 非功能 | 弱网/断网、换网络 IP、登录态持久化（杀进程重启） | 断网 + 冷启动 | 会话/降级健壮性 |

> 优先级：L4(H5) → L5(鸿蒙 + 至少一个 App 端 + 微信) → L3 → L2 → L6。后端接口正确性由 `02-用户端后端API-测试计划` 覆盖，此处只验「APP 端对接正确」。

---

## 5. 测试范围与用例（P0=核心）

### 5.1 会话与守卫（common/api.js）

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-001 | 登录成功 | `Set-Cookie` 中 `fgj_session` 被提取并 `setStorage`；后续请求头带 `Cookie` |
| APP-002 | 冷启动（杀进程重启） | 令牌仍在 storage，`ensureAuth` 校验通过，不重复登录 |
| APP-003 | 会话过期后访问受保护页 | 后端 401 → `gotoLogin` 清令牌回登录页 |
| APP-004 | 断网/后端未启动访问受保护页 | 网络异常不跳登录（`catch(() => true)`），页面不白屏 |
| APP-005 | 登出 | 清本地令牌，回登录页，旧令牌再访问 401 |
| APP-006 | 滑动续期 | 鉴权后 `Set-Cookie` 刷新，新令牌持久化 |

### 5.2 F1 账号（login/register/forgot）

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-101 | 登录表单校验 + 错误提示 | 中文错误、协议勾选拦截、锁定提示一致 |
| APP-102 | 登录成功跳转 | `reLaunch` 到 add（记一笔），无 04 引导 |
| APP-103 | 注册/找回密码 | 与后端契约一致，成功/失败提示正确 |

### 5.3 F3 记一笔（add）

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-201 | 支出/收入双主题 + 分类分页 + 账户 + 备注 | 与 003 前端一致（详见 FE-1xx），数据入账 |
| APP-202 | 金额键盘输入边界 | `yuanToCents` 正确：0.01/999999.99/三位小数/超上限 |

### 5.4 F4 流水（flow）

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-301 | 分页/日分组/月切换/类型筛选/空状态 | 与 FE-2xx 一致 |
| APP-302 | 点账单详情编辑/删除 | 弹层正确，改后列表刷新 |

### 5.5 F7 年度统计（stats）——鸿蒙专项

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-401 | H5 端统计页 | 概况/分类占比/排行/趋势折线正确渲染 |
| APP-402 | **鸿蒙端图表** | 用 canvas 渲染（非 SVG），折线/占比图正常，无空白/报错 |
| APP-403 | 年份切换 + 未来年份收口 | 数据正确刷新 |

### 5.6 我的/设置/管理（profile/settings/accounts/categories）

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-501 | 我的页昵称/注册日/坚持天数/UID/微卡 | 取 `/api/auth/me`、`/api/profile/stats` 正确 |
| APP-502 | 头像上传（`uni.chooseImage`） | 选图→base64→PUT，回显成功；超 2MB/非法提示 |
| APP-503 | 退出/注销弹窗 | 确认后清会话回登录页 |
| APP-504 | 账户/分类管理 CRUD + 重名/被引用删除拦截 | 与 BE-4xx 契约一致，前端提示正确 |

### 5.7 多端兼容与样式

| 编号 | 步骤 | 预期 |
|---|---|---|
| APP-601 | 底部 TabBar 四 Tab 切换 + active 态 | 各端 `reLaunch` 正确，profile 变体样式正常，不遮挡内容 |
| APP-602 | 安全区（iPhone 底部小黑条） | `.safe-bottom` / tabbar padding 生效 |
| APP-603 | 各端字号/圆角/色板 | 对齐 PRD 6.5 设计令牌，无硬编码色值 |
| APP-604 | 换网络后真机连不上 | 提示/排查（BASE_URL 需改局域网 IP）——记录为环境前置，非缺陷 |

---

## 6. 测试环境准备

1. 003 后端启动（`:3000`）连库。
2. HBuilderX 5.26 + 微信开发者工具 + DevEco 26.1（鸿蒙签名已配）。
3. 真机与电脑同一 Wi-Fi；真机 `BASE_URL` 已改为本机局域网 IP（192.168.1.8）。
4. 鸿蒙真机（若可用），否则以鸿蒙模拟器/构建产物验证图表 canvas 方案。
5. 测试账号同后端测试计划（A/B 两账号 + 空账号）。

---

## 7. 缺陷分级与出口准则

| 级别 | 定义 | 示例 |
|---|---|---|
| P0 致命 | 登录态失效、数据错乱、鸿蒙图表不可用 | 会话令牌不持久化、金额换算错、鸿蒙统计空白 |
| P1 严重 | 核心功能缺陷/某端不可用 | 某端主流程阻断、TabBar 失效 |
| P2 一般 | 非核心/单端样式 | 样式偏差、提示文案 |
| P3 建议 | 优化 | 过渡动画、性能 |

**出口准则**：H5 端 P0/P1 全关、主流程全绿；鸿蒙端统计图表（canvas）与主流程通过；至少覆盖 H5 + 鸿蒙 + 一个 App 端（Android 或 iOS）+ 微信小程序；会话持久化/守卫用例通过。

---

## 8. 风险与依赖

- **共用后端**：APP 无独立后端，接口缺陷归后端测试计划，但 APP 端需复验「对接正确」。
- **鸿蒙图表**是最大技术不确定性（SVG 不可用，须 canvas），需尽早专项验证，避免阻塞发布。
- **真机 IP 漂移**：局域网 IP 硬编码，换网络即失效，属环境配置项，需在测试报告单独说明。
- uniapp 项目为「起步」状态，需先确认 10 页已全部完成接口对接、无 TODO/占位，再进入正式测试。
