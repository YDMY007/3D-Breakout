#!/usr/bin/env python3
"""生成4个新特殊效果的PNG图标，并打包成独立精灵图集 bonus_new.png + bonus_new.json。
风格贴近原版 bonus 图标：发光几何 + 主题色 + 透明背景。
图标顺序（网格坐标）：
  (0,0)=split  (1,0)=sticky  (0,1)=extralife  (1,1)=bomb
"""
import math
from PIL import Image, ImageDraw, ImageFilter

CELL = 100          # 单图标尺寸
GRID = 2            # 2x2
SIZE = CELL * GRID  # 200

def new_layer():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))

def glow(draw, fn, color, blur=3, passes=3):
    """对 fn(draw, rgba) 做多次放大模糊形成外发光。"""
    # 先画到临时层做模糊
    tmp = new_layer()
    td = ImageDraw.Draw(tmp)
    fn(td, color)
    for _ in range(passes):
        tmp = tmp.filter(ImageFilter.GaussianBlur(blur))
        base = new_layer()
        base.alpha_composite(tmp)
        tmp = base
    return tmp

def draw_split(d, color):
    # 主球（右下）
    cx, cy, r = 62, 60, 22
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    # 高光
    d.ellipse([cx - r + 6, cy - r + 4, cx - r + 16, cy - r + 14], fill=(255, 255, 255, 200))
    # 分裂出的虚影小球（左上）带箭头
    sx, sy, sr = 34, 36, 14
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(color[0], color[1], color[2], 150))
    # 分裂箭头
    arrow = [(48, 44), (56, 52), (51, 52), (54, 58), (62, 50), (57, 50), (60, 44)]
    d.polygon(arrow, fill=color)

def draw_sticky(d, color):
    # 挡板长条（底部）
    bx0, by0, bx1, by1 = 20, 70, 80, 82
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=5, fill=color)
    d.rounded_rectangle([bx0 + 3, by0 + 3, bx1 - 3, by1 - 3], radius=3, fill=(255, 255, 255, 120))
    # 粘在挡板上的小球
    cx, cy, r = 50, 54, 14
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.ellipse([cx - r + 4, cy - r + 3, cx - r + 11, cy - r + 10], fill=(255, 255, 255, 200))
    # 粘性小点（连接处）
    for dx in (-6, 0, 6):
        d.ellipse([cx + dx - 2, by0 - 6, cx + dx + 2, by0 - 2], fill=(color[0], color[1], color[2], 180))

def draw_extralife(d, color):
    # 心形路径
    cx, cy = 50, 46
    def heart(cxx, cyy, s):
        pts = []
        for a in range(0, 360, 4):
            t = math.radians(a)
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((cxx + x * s, cyy - y * s))
        return pts
    d.polygon(heart(cx, cy, 2.4), fill=color)
    # 高光
    d.ellipse([cx - 12, cy - 14, cx - 2, cy - 4], fill=(255, 255, 255, 160))
    # 加号
    mx, my, t = 50, 70, 7
    d.rectangle([mx - t, my - 2.5, mx + t, my + 2.5], fill=(255, 255, 255, 235))
    d.rectangle([mx - 2.5, my - t, mx + 2.5, my + t], fill=(255, 255, 255, 235))

def draw_bomb(d, color):
    # 球
    cx, cy, r = 50, 58, 20
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.ellipse([cx - r + 6, cy - r + 4, cx - r + 15, cy - r + 13], fill=(255, 255, 255, 210))
    # 爆炸星芒
    n = 10
    R = 38
    outer = []
    for i in range(n * 2):
        ang = math.pi * i / n - math.pi / 2
        rad = R if i % 2 == 0 else R * 0.5
        outer.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    d.polygon(outer, fill=(color[0], color[1], color[2], 150))
    # 引线火花
    d.ellipse([cx + 14, cy - 30, cx + 22, cy - 22], fill=(255, 240, 180, 230))

COLORS = {
    "split": (76, 254, 170, 255),      # 青绿 #4cfeaa
    "sticky": (27, 211, 252, 255),     # 蓝 #1bd3fc
    "extralife": (255, 60, 120, 255),  # 粉红
    "bomb": (255, 200, 40, 255),       # 橙黄
}

DRAW = {
    "split": draw_split,
    "sticky": draw_sticky,
    "extralife": draw_extralife,
    "bomb": draw_bomb,
}

# 网格顺序: 行优先 (col,row)
ORDER = [("split", 0, 0), ("sticky", 1, 0), ("extralife", 0, 1), ("bomb", 1, 1)]

atlas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
frames = {}
for name, gx, gy in ORDER:
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    # 外发光
    glow_layer = glow(d, DRAW[name], COLORS[name], blur=4, passes=2)
    layer.alpha_composite(glow_layer)
    # 主体（清晰）
    DRAW[name](d, COLORS[name])
    # 合成到图集
    ox, oy = gx * CELL, gy * CELL
    atlas.alpha_composite(layer, (ox, oy))
    frames[name] = (ox, oy, CELL, CELL)

# 保存图集（保留alpha -> 用png）
atlas.save("bonus_new.png")
print("saved bonus_new.png", atlas.size)

# 生成 JSON（TexturePacker 风格，单图集）
meta = {
    "app": "custom",
    "version": "1.0",
    "image": "bonus_new.png",
    "format": "RGBA8888",
    "size": {"w": SIZE, "h": SIZE},
    "scale": "1",
}
out = {"frames": {}, "meta": meta}
for name, (x, y, w, h) in frames.items():
    out["frames"]["bonus_" + name] = {
        "frame": {"x": x, "y": y, "w": w, "h": h},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
        "sourceSize": {"w": w, "h": h},
        "anchor": {"x": 0.5, "y": 0.5},
    }
with open("bonus_new.json", "w", encoding="utf-8") as f:
    import json
    json.dump(out, f, indent=2)
print("saved bonus_new.json with frames:", list(out["frames"].keys()))
