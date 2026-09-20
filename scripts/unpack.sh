#!/usr/bin/env bash
# 解包 .fpk 到指定目录，方便调试和对比。
# 用法:
#   scripts/unpack.sh dist/breakout3d-1.0.0.fpk [output-dir]
set -euo pipefail

FPK="${1:?用法: scripts/unpack.sh <file.fpk> [output-dir]}"
OUT="${2:-${FPK%.fpk}-unpacked}"

if [ ! -f "$FPK" ]; then
  echo "[unpack] 错误: 找不到 $FPK" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"
tar xzf "$FPK" -C "$OUT"

echo "[unpack] 已解包到: $OUT"
echo "[unpack] 顶层内容:"
ls -la "$OUT"

if [ -f "$OUT/app.tgz" ]; then
  echo
  echo "[unpack] 内层 app.tgz 内容:"
  mkdir -p "$OUT/_app_inner"
  tar xzf "$OUT/app.tgz" -C "$OUT/_app_inner"
  find "$OUT/_app_inner" -maxdepth 3 -type d | sed "s|$OUT/_app_inner|.|"
fi
