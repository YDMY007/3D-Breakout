#!/usr/bin/env bash
# 本地开发服务器：把 web/ 通过 HTTP 暴露出来，方便在浏览器里直接调试前端。
# 用法:
#   scripts/dev.sh            # 默认 127.0.0.1:5173
#   PORT=8080 scripts/dev.sh  # 自定义端口
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT/web"
PORT="${PORT:-5173}"
HOST="${HOST:-127.0.0.1}"

if [ ! -f "$WEB_DIR/index.html" ]; then
  echo "[dev] 错误: 找不到 $WEB_DIR/index.html" >&2
  exit 1
fi

echo "[dev] 服务目录: $WEB_DIR"
echo "[dev] 访问地址: http://$HOST:$PORT/"
echo "[dev] Ctrl+C 停止"
echo

cd "$WEB_DIR"
exec python -m http.server "$PORT" --bind "$HOST"
