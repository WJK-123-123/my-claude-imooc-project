---
name: text2image
description: 文生图工具：调用 APIMart 网关的 GPT-Image-2 模型生成图片（注意：走 https://api.apimart.ai，不是 OpenAI 官方地址）。当用户说「文生图」「画一张图」「生成图片」「帮我画」「AI 配图」「text to image」「t2i」「gpt-image」等需要 AI 生成图片时使用。自动提交任务、每 15 秒轮询状态、完成后立即下载图片。支持 15 种比例与 1k/2k/4k 三档清晰度。
---

# 文生图（APIMart GPT-Image-2）

## 接口说明（重要）

- **网关地址**：`https://api.apimart.ai`——这是 APIMart 的 API 网关，**不是 OpenAI 官方地址**，不要改用 `api.openai.com`。
- 流程是**异步**的：先 `POST /v1/images/generations` 提交任务拿 `task_id`，再 `GET /v1/tasks/{task_id}` 轮询状态，`completed` 后从 `result.images[].url` 取图。图片 URL 带 `expires_at` 时效，**完成即下载**（脚本已内置）。
- API key 从脚本同目录 `config.json` 读取，也可用环境变量 `APIMART_API_KEY` 覆盖。

## 使用方法

```bash
python {baseDir}/scripts/generate.py --prompt "<图片描述>" [--size 16:9] [--resolution 2k] [--n 1] [--out <目录>]
```

参数说明：

| 参数 | 默认 | 说明 |
|---|---|---|
| `--prompt` | 必填 | 图片描述，中英文均可 |
| `--size` | `1:1` | 比例。可选：`auto`、`1:1`、`3:2`、`2:3`、`4:3`、`3:4`、`5:4`、`4:5`、`16:9`、`9:16`、`2:1`、`1:2`、`3:1`、`1:3`、`21:9`、`9:21`，或具体像素如 `1881x836` |
| `--resolution` | `1k` | 清晰度档位：`1k` / `2k` / `4k`（档位越高越贵越慢） |
| `--n` | `1` | 生成张数 |
| `--out` | `temp` | **保存目录规则（用户约定）**：用户指定了目录就存指定目录；没指定就存当前目录下的 `temp/`（自动创建） |
| `--interval` | `15` | 轮询间隔秒数，**下限 15 秒，不得调短**（用户明确要求每隔 15 秒查询、间隔不要太短） |
| `--timeout` | `900` | 总超时秒数 |

## 执行流程

1. 收集用户需求：图片描述（必填）、比例、清晰度、张数、保存目录（用户没指定就留默认 `temp/`，**不要追问**，按约定走）。
2. 运行脚本。生成通常 20~60 秒，`2k/4k` 可能几分钟：默认前台跑（timeout 给足 300000ms 以上），`4k` 或多图建议后台跑。
3. 成功后 stdout 输出 JSON：`{"task_id": "...", "files": ["/绝对路径.png"], "elapsed_seconds": ...}`，把文件路径报给用户。
4. 需要确认效果时，用 Read 工具打开生成的图片给用户看。

## 常见错误

| HTTP 码 | 含义 | 处理 |
|---|---|---|
| 400 | 参数不合法（比例写错、prompt 为空等） | 检查 size 取值表 |
| 401 | 鉴权失败 | 检查 config.json 的 api_key |
| 402 | 余额不足 | 提醒用户充值 APIMart |
| 429 | 触发限流 | 等一会再试，不要高频重试 |
| 503 | 无可用渠道 | 稍后重试 |

## 注意

- key 属敏感信息：`scripts/config.json` 已被项目 `.gitignore` 排除，**不要**把 key 写进 SKILL.md、代码注释或任何会提交的文件。
- 轮询间隔固定 ≥15 秒是用户约定，脚本已强制下限，无需（也不要）在脚本外另起高频轮询。
