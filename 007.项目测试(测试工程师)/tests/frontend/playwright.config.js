// Playwright 配置（前端 E2E，对应 01-用户端Web前端-测试计划 的 L4 层）
// 报告产物输出到 007.项目测试(测试工程师)/测试报告/（HTML + JSON，含失败截图/轨迹）。
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 前端报告独立输出到 01-用户端Web前端/（与后端/APP 报告分开）
const REPORT_DIR = path.resolve(__dirname, '../../测试报告/01-用户端Web前端');

export default defineConfig({
  testDir: '.',      // 相对本配置文件目录 = tests/frontend，默认匹配 *.spec.js
  timeout: 30_000,
  retries: 0,
  workers: 1,        // 单 worker 顺序跑，避免并发注册/播种压垮后端连接池与 bcrypt
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: REPORT_DIR, open: 'never' }],
    ['json', { outputFile: path.join(REPORT_DIR, 'results.json') }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },   // 手机浏览器优先（近似 iPhone 12/13）
    locale: 'zh-CN',
    screenshot: 'only-on-failure',           // 失败自动截图，写入 HTML 报告
    trace: 'retain-on-failure',              // 失败保留轨迹，供报告内回放
  },
});
