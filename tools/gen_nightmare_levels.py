# -*- coding: utf-8 -*-
"""
噩梦难度关卡生成器（diff=5）：7 成不可破坏墙 + 3 成可破坏砖，多层结构。
生成后追加到 web/assets/leveldesign.b38b6a9611ae33ec_v6.dat（另存为 _v7，
由调用方走改名链），并打印 records.js 需要的 LEVELS / LEVEL_NAMES_CN 片段。

硬规则与 random_levels.py 相同：柱内最高墙的上方不得留可破坏砖（否则永远无法通关）。
 nightmare 特有结构策略：
  - "墙阵骨架"：支撑列以墙(1)为主，砖只以约 30% 比例混入，形成打不穿的迷宫感；
  - 多层堆叠（3-4 层），中上层以墙为梁、砖为填充，砖只出现在有支撑的位置；
  - 每关保证至少 12 块可破坏砖（否则没有通关目标）。
"""
import os
import random
import sys

PC, BN, QS = 11, 13, 4
BLOCK = 9 + PC * BN * QS  # 581

SRC_DAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "assets",
                       "leveldesign.b38b6a9611ae33ec_v6.dat")
OUT_DAT = SRC_DAT.replace("_v6.dat", "_v7.dat")

WALL, BRICK = 1, 2  # 不可破坏 / 可破坏（基础亮度）


def gen_nightmare(rng):
    """保守可通关结构:
    1. 先布"纯砖柱"(2-4 层全砖,无墙)——任何砖天然可达;
    2. 部分行线的深处(大 column 端)放"纯墙柱收尾段":墙柱之后(更大 column)无砖柱,
       墙阵只是把线尾堵住,不封锁任何砖;
    3. 墙占比由收尾墙柱的数量与层数控制。
    玩家视角:大量砖柱之间夹着整片的深色墙阵收尾,仍然有"墙堵住"的压迫感,
    但所有砖都在墙阵之前,必然可通关。
    """
    grid = [[[0] * QS for _ in range(PC)] for _ in range(BN)]
    # 1) 砖柱
    for c in range(PC):
        for r in range(BN):
            if rng.random() < 0.62:
                n_layers = rng.randint(2, QS)
                for h in range(n_layers):
                    grid[r][c][h] = BRICK
    # 2) 行线深处收尾墙阵:35% 的线完全无墙;其余从 c0 起整段改纯墙柱
    for r in range(BN):
        if rng.random() < 0.35:
            continue
        c0 = rng.randint(max(1, PC - 5), PC - 1)
        for c in range(c0, PC):
            n_layers = rng.randint(2, QS)
            for h in range(QS):
                grid[r][c][h] = WALL if h < n_layers else 0
    # 3) 校验+自愈:任何墙柱之后(更大 column)不得有砖柱,违规砖柱改成纯墙柱
    for r in range(BN):
        wall_started = False
        for c in range(PC):
            has_any = any(grid[r][c][h] for h in range(QS))
            if not has_any:
                continue
            is_pure_wall = all(grid[r][c][h] == WALL for h in range(QS) if grid[r][c][h])
            if is_pure_wall:
                wall_started = True
                continue
            if wall_started:
                # 违规:墙柱后面有砖柱 → 该砖柱改纯墙柱(并入收尾段)
                n_layers = sum(1 for h in range(QS) if grid[r][c][h])
                for h in range(QS):
                    grid[r][c][h] = WALL if h < max(1, n_layers) else 0
    bricks = sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if grid[r][c][h] >= BRICK)
    assert bricks >= 30, "砖太少: %d" % bricks
    return _encode(grid), bricks


def _encode(grid):
    out = bytearray(PC * BN * QS)
    for col in range(PC):
        for row in range(BN):
            for h in range(QS):
                out[col * BN * QS + row * QS + h] = grid[row][col][h]
    return bytes(out)


def build_level(name, diff, blockdata):
    hdr = bytearray(9)
    hdr[0] = diff
    nb = name.encode("ascii")
    assert len(nb) <= 8
    hdr[1:1 + len(nb)] = nb
    return bytes(hdr) + blockdata


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    prefix = sys.argv[2] if len(sys.argv) > 2 else "nm"
    rng = random.Random(20260920)  # 固定种子，结果可复现
    src = open(SRC_DAT, "rb").read()
    assert len(src) % BLOCK == 0, "源 dat 大小异常"
    data = src
    js_levels, js_names = [], []
    for i in range(count):
        name = f"{prefix}{i + 1}"
        blocks, bricks = gen_nightmare(rng)
        lvl = build_level(name, 5, blocks)
        data += lvl
        js_levels.append(f'{{ name: "{name}", diff: 5 }}')
        js_names.append(f'{name}: "{name}"')
        walls = sum(1 for x in blocks if x == WALL)
        print(f"OK: {name} 墙={walls} 砖={bricks} 比例={walls / (walls + bricks):.0%}")
    open(OUT_DAT, "wb").write(data)
    print(f"\n写入: {OUT_DAT}")
    print(f"总关卡: {len(data) // BLOCK}")
    print("\n=== 追加到 records LEVELS ===")
    print("    " + ", ".join(js_levels) + ",")
    print("\n=== 追加到 LEVEL_NAMES_CN ===")
    cn = ["门", "闸", "锁", "链", "狱", "渊", "噬", "骸", "墓", "湮",
          "烬", "锥", "阱", "幂", "咒", "蚀", "坍", "寂", "墟", "终"]
    for idx, n in enumerate(js_names):
        key, _ = n.split(":")
        print(f"    {key}: \"噩梦·{cn[idx]}\",")


if __name__ == "__main__":
    main()
