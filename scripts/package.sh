#!/usr/bin/env bash
# 把 web/ + fpk/ 模板组装成 dist/<appname>.fpk
#
# 优先调用官方 fnpack（若 tools/bin/ 或 PATH 中存在）；
# 找不到时回退到纯 bash + tar + gzip + md5sum，产物结构与 fnpack 输出一致。
#
# 用法:
#   scripts/package.sh                 # 默认从 fpk/manifest.template 读 appname/version
#   VERSION=1.2.0 scripts/package.sh   # 覆盖版本号
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FPK_TEMPLATE="$ROOT/fpk"
WEB_DIR="$ROOT/web"
DIST_DIR="$ROOT/dist"
MANIFEST_TEMPLATE="$FPK_TEMPLATE/manifest.template"

# ---- 解析 manifest 字段 ----
parse_manifest_field() {
  local key="$1"
  sed -n "s/^${key}[[:space:]]*=[[:space:]]*//p" "$MANIFEST_TEMPLATE" | head -1
}

APPNAME="$(parse_manifest_field appname)"
VERSION="${VERSION:-$(parse_manifest_field version)}"

if [ -z "$APPNAME" ]; then
  echo "[package] 错误: manifest.template 中找不到 appname" >&2
  exit 1
fi

echo "[package] appname = $APPNAME"
echo "[package] version = $VERSION"

# ---- 准备 staging 目录 ----
STAGING="$DIST_DIR/staging/$APPNAME"
rm -rf "$STAGING"
mkdir -p "$STAGING"

# 复制 fpk 模板（manifest.template 单独处理）
cp -r "$FPK_TEMPLATE/cmd" "$STAGING/cmd"
cp -r "$FPK_TEMPLATE/config" "$STAGING/config"
cp -r "$FPK_TEMPLATE/app" "$STAGING/app"
cp "$FPK_TEMPLATE/ICON.PNG" "$STAGING/ICON.PNG"
cp "$FPK_TEMPLATE/ICON_256.PNG" "$STAGING/ICON_256.PNG"

# 注入前端资源到 app/www
mkdir -p "$STAGING/app/www"
cp -r "$WEB_DIR/." "$STAGING/app/www/"

# 清除可能混入的备份/探针/缓存垃圾，避免污染 .fpk
find "$STAGING/app/www" \( \
  -name "*.bak" -o -name "_probe*" -o -name "*.tmp" -o \
  -name ".DS_Store" -o -name "Thumbs.db" -o -name "__pycache__" \
\) -exec rm -rf {} + 2>/dev/null || true

# 确保 cmd/* 和 ui/index.cgi 有可执行位（Linux 上需要，Windows 上 chmod 是 noop）
chmod +x "$STAGING/cmd/"* 2>/dev/null || true
chmod +x "$STAGING/app/ui/index.cgi" 2>/dev/null || true

# 渲染 manifest（先占位，checksum 后面填）
sed "s/{{CHECKSUM}}/__CHECKSUM_PLACEHOLDER__/g; s/^version[[:space:]]*=.*/version               = $VERSION/" \
  "$MANIFEST_TEMPLATE" > "$STAGING/manifest"

# ---- 查找 fnpack ----
find_fnpack() {
  local candidates=(
    "$ROOT/tools/bin/fnpack"
    "$ROOT/tools/bin/fnpack.exe"
    "$ROOT/fnpack"
    "$ROOT/fnpack.exe"
  )
  for c in "${candidates[@]}"; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  command -v fnpack 2>/dev/null && return 0
  return 1
}

FNPACK="$(find_fnpack || true)"

if [ -n "$FNPACK" ]; then
  echo "[package] 使用 fnpack: $FNPACK"
  # fnpack 会自己算 checksum、打 app.tgz、打外层 .fpk
  # 先把 manifest 里的占位符清掉（fnpack 会重写）
  sed -i "s/__CHECKSUM_PLACEHOLDER__//g" "$STAGING/manifest"
  (cd "$DIST_DIR" && "$FNPACK" build -d "$STAGING")
  # fnpack 默认把 .fpk 输出到 staging 的父目录或当前目录，统一搬到 dist/
  find "$DIST_DIR" -maxdepth 3 -name "*.fpk" -newer "$STAGING/manifest" -exec mv {} "$DIST_DIR/" \;
  echo "[package] 完成: $DIST_DIR/$APPNAME-$VERSION.fpk"
  exit 0
fi

# ---- 回退: 纯 bash 打包 ----
echo "[package] 未找到 fnpack，使用 bash + tar 回退方案"
echo "[package] (把 fnpack 放到 tools/bin/ 可启用官方打包)"

WORK="$DIST_DIR/.build"
rm -rf "$WORK"
mkdir -p "$WORK"

# 1) 打 app.tgz（内层: config/ ui/ www/）
tar czf "$WORK/app.tgz" -C "$STAGING/app" .

# 2) 算 checksum = md5(app.tgz)
CHECKSUM="$(md5sum "$WORK/app.tgz" | awk '{print $1}')"
echo "[package] checksum = $CHECKSUM"

# 3) 渲染最终 manifest
sed "s/__CHECKSUM_PLACEHOLDER__/$CHECKSUM/g" "$STAGING/manifest" > "$WORK/manifest"

# 4) 组装外层目录
cp "$STAGING/ICON.PNG" "$WORK/ICON.PNG"
cp "$STAGING/ICON_256.PNG" "$WORK/ICON_256.PNG"
cp -r "$STAGING/cmd" "$WORK/cmd"
cp -r "$STAGING/config" "$WORK/config"
# app.tgz 已在 WORK 中

# 5) 打外层 .fpk（gzip tar）
OUT="$DIST_DIR/$APPNAME-$VERSION.fpk"
tar czf "$OUT" -C "$WORK" manifest ICON.PNG ICON_256.PNG cmd config app.tgz

# 6) 清理
rm -rf "$WORK" "$STAGING"

echo
echo "[package] 完成: $OUT"
echo "[package] 大小: $(du -h "$OUT" | awk '{print $1}')"
echo "[package] 安装: 飞牛 NAS → 应用中心 → 手动安装 → 选择此 .fpk"
