#!/bin/bash

# 脚本名称: index.cgi
# 描述: 把 /var/apps/breakout3d/target/www 下的静态文件通过 CGI 暴露给桌面 iframe
# 许可证: MIT

# 【注意】修改你自己的静态文件根目录：
BASE_PATH="/var/apps/breakout3d/target/www"

# 1. 从 REQUEST_URI 里拿到 index.cgi 后面的路径
#    例如：/cgi/ThirdParty/breakout3d/index.cgi/index.html?foo=bar
#    先去掉 ? 后面的 query string
URI_NO_QUERY="${REQUEST_URI%%\?*}"

# 默认值（如果没匹配到 index.cgi）
REL_PATH="/"

# 用 index.cgi 作为切割点，取后面的部分
case "$URI_NO_QUERY" in
    *index.cgi*)
        REL_PATH="${URI_NO_QUERY#*index.cgi}"
        ;;
esac

# 如果为空或只有 /，就默认 /index.html
if [ -z "$REL_PATH" ] || [ "$REL_PATH" = "/" ]; then
    REL_PATH="/index.html"
fi

# 【兼容修复版 URL 解码】使用 sed 替换 % 为 \x，然后通过 printf 转换为真实字符（处理空格等）
HEX_PATH=$(echo "$REL_PATH" | sed 's/%/\\x/g')
REL_PATH=$(printf '%b' "$HEX_PATH")

# ===== 路径安全校验（防路径穿越）=====
# 拒绝可疑字符：反斜杠、控制字符、空字节；拒绝任何 ".." 段（含解码后的变体）
case "$REL_PATH" in
    *'..'*|*'\'*|*$'\t'*|*$'\r'*|*$'\n'*)
        echo "Status: 400 Bad Request"
        echo "Content-Type: text/plain; charset=utf-8"
        echo ""
        echo "Bad Request"
        exit 0
        ;;
esac

# 规范化后必须仍位于 BASE_PATH 之内（realpath 解析符号链接与 . / .. 后再比对前缀）
CANON_BASE=$(readlink -f "$BASE_PATH" 2>/dev/null)
TARGET_FILE="${BASE_PATH}${REL_PATH}"
CANON_TARGET=$(readlink -m "$TARGET_FILE" 2>/dev/null)
case "$CANON_TARGET" in
    "$CANON_BASE"/*) ;;   # 合法：位于应用静态目录内
    *)
        echo "Status: 403 Forbidden"
        echo "Content-Type: text/plain; charset=utf-8"
        echo ""
        echo "Forbidden"
        exit 0
        ;;
esac
TARGET_FILE="$CANON_TARGET"

# 仅允许白名单静态资源类型，避免误暴露其他文件
ext="${TARGET_FILE##*.}"
case "$ext" in
    html|htm|css|js|jpg|jpeg|png|gif|svg|webp|avif|ico|woff|woff2|ttf|\
    m4a|mp3|ogg|json|txt|log|dat|webmanifest|map|xml) ;;
    *)
        echo "Status: 403 Forbidden"
        echo "Content-Type: text/plain; charset=utf-8"
        echo ""
        echo "Forbidden"
        exit 0
        ;;
esac

# 2. 判断文件是否存在
if [ ! -f "$TARGET_FILE" ]; then
    echo "Status: 404 Not Found"
    echo "Content-Type: text/plain; charset=utf-8"
    echo ""
    echo "404 Not Found: ${REL_PATH}"
    exit 0
fi

# 3. 根据扩展名简单判断 Content-Type
ext="${TARGET_FILE##*.}"
no_cache=""
case "$ext" in
    html|htm)
        mime="text/html; charset=utf-8"
        # HTML 入口不带版本号后缀，必须禁缓存，否则 fpk 升级后浏览器吃旧缓存
        no_cache="1"
        ;;
    css)
        mime="text/css; charset=utf-8"
        ;;
    js)
        mime="application/javascript; charset=utf-8"
        ;;
    jpg|jpeg)
        mime="image/jpeg"
        ;;
    png)
        mime="image/png"
        ;;
    gif)
        mime="image/gif"
        ;;
    svg)
        mime="image/svg+xml"
        ;;
    txt|log)
        mime="text/plain; charset=utf-8"
        ;;
    m4a)
        mime="audio/mp4"
        ;;
    webmanifest)
        mime="application/manifest+json; charset=utf-8"
        ;;
    *)
        mime="application/octet-stream"
        ;;
esac

# 4. 输出头 + 文件内容
echo "Content-Type: $mime"
if [ -n "$no_cache" ]; then
    echo "Cache-Control: no-cache"
fi
echo ""

cat "$TARGET_FILE"
