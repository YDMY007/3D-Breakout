# -*- coding: utf-8 -*-
"""收集网页版游戏的完整资源引用闭包,每行输出一个相对 web/ 的文件路径(二进制 stdout,无 CR)。

入口: web/index.html
规则:
  1. HTML 里的 src/href;
  2. records JS 内的 ./assets/... / ./icons/... 字符串;
  3. 引擎 bundle(main/webgl/vendor/PhysicsWorker)内 import 语句与
     "assets/xxx" 字符串引用(关卡 dat、模型、图集、音频等);
  4. CSS 里的 url(...)。
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")

refs = set()
work = []


def norm(ref, base_dir=""):
    ref = ref.lstrip("./")
    if base_dir and not ref.startswith(("assets/", "icons/", "favicon")):
        ref = base_dir + "/" + ref
    return ref


def add(ref):
    if ref and ref not in refs:
        refs.add(ref)
        work.append(ref)


# 1) index.html
html = io.open(os.path.join(WEB, "index.html"), encoding="utf-8").read()
for m in re.finditer(r'(?:src|href)="\.?/?(assets/[^"]+|favicon\.ico|icons/[^"]+)"', html):
    add(m.group(1))

# 2) 递归扫 JS/CSS
while work:
    rel = work.pop()
    p = os.path.join(WEB, rel)
    if not os.path.exists(p):
        continue
    base = os.path.dirname(rel)
    try:
        t = io.open(p, encoding="utf-8", errors="ignore").read()
    except Exception:
        continue
    for m in re.finditer(r'import\s*\(?\s*["\'](?:\./)?([^"\']+)["\']', t):
        if re.search(r'\.(js|mjs)$', m.group(1)):
            add(norm(m.group(1), base))
    for m in re.finditer(r'["\'](?:\./)?(assets/[A-Za-z0-9_.\-]+)["\']', t):
        add(m.group(1))
    if rel.endswith(".css"):
        for m in re.finditer(r'url\(["\']?(\./)?([^"\')]+)["\']?\)', t):
            u = m.group(2)
            if not re.search(r'\.(woff2?|ttf|svg|png|jpg|avif|m4a)$', u):
                continue
            add(norm(u.replace("../", ""), base))

refs.add("index.html")
if os.path.exists(os.path.join(WEB, "launcher.html")):
    refs.add("launcher.html")

NL = b"\x0A"
out = sys.stdout.buffer
for f in sorted(refs):
    out.write(f.strip().encode("ascii", "ignore") + NL)
out.flush()
