#!/usr/bin/env bash
# 构建网页版游戏部署目录(引用链抽取 + 体积报告)
# 用法:
#   scripts/build-web.sh                 # 产出 dist/web/
#   scripts/build-web.sh --deploy-local  # 产出并同步到 Fntv-net public/game/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/web"
OUT="$ROOT/dist/web"

rm -rf "$OUT"
mkdir -p "$OUT"

MANIFEST="$(python "$ROOT/scripts/collect_refs.py" | tr -d '\015')"

echo "$MANIFEST" | while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  src="$WEB/$rel"
  if [ ! -f "$src" ]; then
    echo "[build-web] 跳过缺失引用: $rel"
    continue
  fi
  mkdir -p "$OUT/$(dirname "$rel")"
  cp "$src" "$OUT/$rel"
done

TOTAL=$(find "$OUT" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
COUNT=$(find "$OUT" -type f | wc -l)
WEB_KB=$(du -sk "$WEB" | awk '{print $1}')
echo "[build-web] 产物: $OUT — $COUNT 个文件, $((TOTAL / 1024)) KB"
echo "[build-web] 开发目录 ${WEB_KB} KB → 部署目录 $((TOTAL / 1024)) KB"

if [ "${1:-}" = "--deploy-local" ]; then
  DEST="/d/GitHub/Fntv-net/public/game"
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -r "$OUT/." "$DEST/"
  echo "[build-web] 已同步到 $DEST"
fi
