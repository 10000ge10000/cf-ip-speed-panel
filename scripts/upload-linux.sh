#!/usr/bin/env bash
set -euo pipefail

WORKER_URL="${WORKER_URL:-}"
UPLOAD_TOKEN="${UPLOAD_TOKEN:-}"
CARRIER="${CARRIER:-other}"
REGION="${REGION:-}"
SOURCE="${SOURCE:-$(hostname 2>/dev/null || echo local)}"
RESULT_FILE="${RESULT_FILE:-result.csv}"

if [ -z "$WORKER_URL" ]; then
  echo "ERROR: 请设置 WORKER_URL，例如 https://cf-ip-speed-panel.xxx.workers.dev" >&2
  exit 1
fi

if [ -z "$UPLOAD_TOKEN" ]; then
  echo "ERROR: 请设置 UPLOAD_TOKEN，且必须与 Cloudflare Worker Secret 一致" >&2
  exit 1
fi

if ! command -v cfst >/dev/null 2>&1; then
  echo "ERROR: 未找到 cfst 命令。请先安装 CloudflareSpeedTest/cfst，并确保 cfst 在 PATH 中。" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: 未找到 python3。脚本需要 python3 将 result.csv 转换为 JSON。" >&2
  exit 1
fi

cfst

if [ ! -f "$RESULT_FILE" ]; then
  echo "ERROR: 未找到 $RESULT_FILE。请确认 cfst 已生成测速结果。" >&2
  exit 1
fi

python3 - "$RESULT_FILE" "$CARRIER" "$REGION" "$SOURCE" > upload-payload.json <<'PY'
import csv
import json
import sys

path, carrier, region, source = sys.argv[1:5]

def pick(row, names, default=""):
    lowered = {key.lower().strip(): value for key, value in row.items()}
    for name in names:
        if name.lower() in lowered and lowered[name.lower()].strip():
            return lowered[name.lower()].strip()
    return default

def to_float(value, default=0):
    try:
        return float(str(value).replace("MB/s", "").replace("ms", "").replace("%", "").strip())
    except ValueError:
        return default

nodes = []
with open(path, newline="", encoding="utf-8-sig") as handle:
    reader = csv.DictReader(handle)
    for row in reader:
        ip = pick(row, ["IP 地址", "IP", "ip"])
        if not ip:
            continue
        nodes.append({
            "ip": ip,
            "port": int(to_float(pick(row, ["端口", "port"], "443"), 443)),
            "latency": to_float(pick(row, ["平均延迟", "延迟", "latency", "Delay"], "0")),
            "speed": to_float(pick(row, ["下载速度", "速度", "speed", "Download Speed"], "0")),
            "loss": to_float(pick(row, ["丢包率", "loss", "Packet Loss"], "0")),
            "tls": True,
            "colo": pick(row, ["数据中心", "colo", "Colo"]),
        })

payload = {
    "source": source,
    "region": region,
    "carrier": carrier,
    "nodes": nodes,
}
print(json.dumps(payload, ensure_ascii=False))
PY

curl -fsS \
  -X POST "${WORKER_URL%/}/api/upload" \
  -H "Authorization: Bearer ${UPLOAD_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @upload-payload.json

echo
echo "上传完成"
