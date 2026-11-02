#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""APIMart GPT-Image-2 文生图：提交任务 → 每 15 秒轮询状态 → 下载图片到本地。

接口走 APIMart 网关 https://api.apimart.ai（非 OpenAI 官方地址）：
  1) POST /v1/images/generations          提交生图任务，返回 task_id
  2) GET  /v1/tasks/{task_id}?language=zh 每 15 秒查询，completed 后取 result.images[].url
  3) 下载图片 URL（有时效 expires_at，完成即下载）

API key 解析顺序：环境变量 APIMART_API_KEY > 同目录 config.json 的 api_key 字段。
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = "https://api.apimart.ai"
SCRIPT_DIR = Path(__file__).resolve().parent
MIN_INTERVAL = 15  # 轮询间隔下限（秒），按约定不得低于 15 秒

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def die(msg):
    print("[错误] " + msg, file=sys.stderr)
    sys.exit(1)


def load_key():
    k = os.environ.get("APIMART_API_KEY", "").strip()
    if k:
        return k
    cfg = SCRIPT_DIR / "config.json"
    if cfg.exists():
        try:
            k = str(json.loads(cfg.read_text(encoding="utf-8")).get("api_key", "")).strip()
            if k:
                return k
        except Exception:
            pass
    die("未找到 API key：请设置环境变量 APIMART_API_KEY，或在 scripts/config.json 里填 api_key")


def request_json(url, key, payload=None, timeout=60):
    headers = {"Authorization": "Bearer " + key}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST" if payload is not None else "GET", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            body = json.loads(body).get("error", {}).get("message", body)
        except Exception:
            pass
        die("HTTP %s：%s" % (e.code, body))
    except urllib.error.URLError as e:
        die("网络请求失败：%s" % getattr(e, "reason", e))


def submit(key, prompt, size, resolution, n):
    payload = {"model": "gpt-image-2", "prompt": prompt, "n": n, "size": size, "resolution": resolution}
    _, body = request_json(BASE + "/v1/images/generations", key, payload)
    items = body.get("data") or []
    if not isinstance(items, list) or not items:
        die("提交失败，响应异常：" + json.dumps(body, ensure_ascii=False)[:300])
    item = items[0]
    if item.get("task_id"):
        return item["task_id"], None
    # 兜底：若网关同步返回了图片（b64/url），直接透传
    if item.get("url") or item.get("b64_json"):
        return None, [item]
    die("提交失败，未返回 task_id：" + json.dumps(item, ensure_ascii=False)[:300])


def poll(key, task_id, interval, timeout):
    deadline = time.time() + timeout
    time.sleep(interval)  # 提交后先等一个间隔再查，间隔固定 ≥15 秒
    while True:
        _, body = request_json(BASE + "/v1/tasks/%s?language=zh" % urllib.parse.quote(task_id), key)
        d = body.get("data") or {}
        st = str(d.get("status", ""))
        print("[轮询] status=%s progress=%s%%" % (st or "?", d.get("progress", 0)), file=sys.stderr)
        if st == "completed":
            return d
        if st in ("failed", "cancelled"):
            err = d.get("error") or {}
            die("任务%s：%s" % ("失败" if st == "failed" else "被取消", err.get("message", "未知原因")))
        if time.time() >= deadline:
            die("超时（>%s 秒）。task_id=%s，可稍后重试查询" % (timeout, task_id))
        time.sleep(interval)


def collect_urls(data):
    urls = []
    result = (data or {}).get("result") or {}
    for img in result.get("images") or []:
        u = img.get("url")
        if isinstance(u, list):
            urls.extend(x for x in u if x)
        elif isinstance(u, str) and u:
            urls.append(u)
    return urls


def download(urls, out_dir, key):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    files = []
    for i, u in enumerate(urls, 1):
        suffix = Path(urllib.parse.urlparse(u).path).suffix.lower()
        ext = suffix if suffix in (".png", ".jpg", ".jpeg", ".webp") else ".png"
        dest = out / ("img_%s_%d%s" % (ts, i, ext))
        req = urllib.request.Request(u, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                dest.write_bytes(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):  # 个别情况图片 URL 需要带鉴权重试
                req.add_header("Authorization", "Bearer " + key)
                with urllib.request.urlopen(req, timeout=120) as r:
                    dest.write_bytes(r.read())
            else:
                raise
        files.append(str(dest.resolve()))
        print("[下载] %s" % files[-1], file=sys.stderr)
    return files


def main():
    ap = argparse.ArgumentParser(description="APIMart GPT-Image-2 文生图（提交 + 15 秒轮询 + 下载）")
    ap.add_argument("--prompt", required=True, help="图片描述（必填）")
    ap.add_argument("--size", default="1:1", help="比例，默认 1:1；可选 auto/3:2/4:3/5:4/16:9/2:1/3:1/21:9/2:3/3:4/4:5/9:16/1:2/1:3/9:21 或具体像素如 1881x836")
    ap.add_argument("--resolution", default="1k", choices=["1k", "2k", "4k"], help="清晰度档位，默认 1k")
    ap.add_argument("--n", type=int, default=1, help="生成张数，默认 1")
    ap.add_argument("--out", default="temp", help="保存目录；默认当前目录下的 temp/（自动创建）")
    ap.add_argument("--interval", type=int, default=MIN_INTERVAL, help="轮询间隔秒数，默认 15，下限 15")
    ap.add_argument("--timeout", type=int, default=900, help="总超时秒数，默认 900")
    args = ap.parse_args()

    interval = max(args.interval, MIN_INTERVAL)
    key = load_key()
    t0 = time.time()

    task_id, direct = submit(key, args.prompt, args.size, args.resolution, args.n)
    if direct:
        urls = collect_urls({"result": {"images": direct}})
    else:
        print("[提交] task_id=%s（每 %d 秒轮询一次）" % (task_id, interval), file=sys.stderr)
        data = poll(key, task_id, interval, args.timeout)
        urls = collect_urls(data)
    if not urls:
        die("任务完成但未取到图片 URL，请检查任务结果：" + task_id)

    files = download(urls, args.out, key)
    print(json.dumps({"task_id": task_id, "files": files, "elapsed_seconds": round(time.time() - t0, 1)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
