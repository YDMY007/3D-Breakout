# -*- coding: utf-8 -*-
"""把 gen_nightmare 重写为"保守可通关结构"(墙只做线深处收尾柱)。"""
import io

p = "tools/gen_nightmare_levels.py"
s = io.open(p, encoding="utf-8").read()

i = s.find("def gen_nightmare(rng):")
j = s.find("def build_level(")
assert i > -1 and j > i

new_fn = '''def gen_nightmare(rng):
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


'''

s = s[:i] + new_fn + s[j:]
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("gen_nightmare 已重写")
