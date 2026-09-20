# -*- coding: utf-8 -*-
"""
噩梦关可通关性权威模拟器 + 修复器
==================================
引擎物理(读 webgl bundle 确认):
  - 位置: position.x = row*scale (横向), position.z = depth + column*scale (深度, 挡板在 column 小侧)
  - 球从挡板弹出沿 column+ 方向行进, 行进线固定 row; 同 row 上最近非空柱先被撞。
  - 柱 = (row, column) 竖直位; 同柱内方块沿竖直链下落(下层消失上层逐层落)。
  - 墙(type=1)不可破坏; 砖(2+)被打掉 → 该柱 levelDown, 上层逐层下落。
死局规则:
  同一条 row 线上, 按 column 从小到大, 第一个"柱底为墙"的柱会把球弹回,
  它之后(column 更大)的所有柱都打不到 → 其上的砖全部不可达。
  (第一个墙柱之前的柱都可正常打; 球绕行走别的 row 线, 不影响本线判定。)
修复策略(迭代到不动点):
  每轮: 打掉所有"柱底为砖"的柱的砖并下落; 然后对每条 row 线, 把"封锁墙柱"
  (该线第一个柱底为墙的柱)整柱墙改成砖(保证可击穿)。重复直到全部砖消光。
用法: python gen_nightmare_levels.py --verify  # 只校验
"""
import io
import os
import random
import sys

PC, BN, QS = 11, 13, 4
BLOCK = 9 + PC * BN * QS

WALL, BRICK = 1, 2

DAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "assets",
                   "leveldesign.b38b6a9611ae33ec_v7.dat")


def load_grid(data, off):
    """返回 g[row][column][h]"""
    blocks = data[off + 9: off + BLOCK]
    return [[[blocks[c * BN * QS + r * QS + h] for h in range(QS)] for c in range(PC)] for r in range(BN)]


def col_bottom(g, r, c):
    """当前柱底(最高实心位的层号); 空柱返回 -1"""
    for h in range(QS):
        if g[r][c][h]:
            return h
    return -1


def simulate_and_report(g):
    """按引擎规则迭代消解, 返回 (剩余砖, 被封锁砖数)"""
    g = [[list(col) for col in row] for row in g]
    for _ in range(400):
        progress = False
        # 每条 row 线: 从 column 0 找第一个非空柱
        for r in range(BN):
            for c in range(PC):
                b = col_bottom(g, r, c)
                if b == -1:
                    continue
                if g[r][c][b] >= BRICK:
                    # 可打: 打掉该柱最底层块(即整柱一次 levelDown 的最低块)
                    # 引擎一次碰撞只消一块(球撞柱底), 模拟为: 弹出柱底块
                    g[r][c][b] = 0
                    # 下落: 同柱上方块整体下移
                    col = [g[r][c][h] for h in range(QS) if g[r][c][h]]
                    for h in range(QS):
                        g[r][c][h] = col[h] if h < len(col) else 0
                    progress = True
                # 底为墙: 被弹回, 本线此列之后的都暂不可达 → 继续下一条 row
                break
        bricks = sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if g[r][c][h] >= 2)
        if bricks == 0:
            return 0, 0
        if not progress:
            blocked = bricks
            return blocked, blocked
    return -1, -1


def fix_level(g):
    """修复 v2: 跑一遍完整模拟, 记录过程中所有"封锁墙柱"(row,column) 集合
    (含砖消光后露出的墙), 然后在原始网格上把这些柱的墙全部改成砖。"""
    work = [[list(col) for col in row] for row in g]
    seal_set = set()
    for _ in range(400):
        progress = False
        for r in range(BN):
            for c in range(PC):
                b = col_bottom(work, r, c)
                if b == -1:
                    continue
                if work[r][c][b] >= BRICK:
                    work[r][c][b] = 0
                    col = [work[r][c][h] for h in range(QS) if work[r][c][h]]
                    for h in range(QS):
                        work[r][c][h] = col[h] if h < len(col) else 0
                    progress = True
                    break
                if work[r][c][b] == WALL:
                    has_brick_behind = any(
                        any(work[r][c2][h] >= BRICK for h in range(QS))
                        for c2 in range(c + 1, PC)
                    )
                    if has_brick_behind:
                        seal_set.add((r, c))
                        # 模拟中视为已修复(变砖,可消解),让过程继续暴露后续封锁点
                        for h in range(QS):
                            if work[r][c][h] == WALL:
                                work[r][c][h] = BRICK
                        progress = True
                    break
        bricks = sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if work[r][c][h] >= 2)
        if bricks == 0:
            break
        if not progress:
            break
    fixed = [[list(col) for col in row] for row in g]
    for (r, c) in seal_set:
        for h in range(QS):
            if fixed[r][c][h] == WALL:
                fixed[r][c][h] = BRICK
    # ---- 墙补偿:把"纯砖柱的顶部砖"换成墙,使墙占比回到 ~70% ----
    # 规则:墙只能放在该柱最顶(砖上叠墙合法:砖消完墙落地收尾,不产生新封锁);
    # 逐个挑选直到墙/总比例 >= 0.68 或候选用尽。
    def count_walls(gg):
        return sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if gg[r][c][h] == 1)
    def count_bricks(gg):
        return sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if gg[r][c][h] >= 2)
    candidates = []
    for r in range(BN):
        for c in range(PC):
            if (r, c) in seal_set:
                continue  # 封锁修复柱不再加墙
            # 该柱当前无墙且顶层是砖 → 顶砖可换墙
            if not any(fixed[r][c][h] == WALL for h in range(QS)):
                top = -1
                for h in range(QS):
                    if fixed[r][c][h]:
                        top = h
                if top >= 0 and fixed[r][c][top] >= BRICK:
                    # 后方(同线更深)还有砖柱 → 落底后的墙会封锁它们 → 跳过
                    has_brick_behind = any(
                        any(fixed[r][c2][h] >= BRICK for h in range(QS))
                        for c2 in range(c + 1, PC)
                    )
                    if not has_brick_behind:
                        candidates.append((r, c, top))
    total = count_walls(fixed) + count_bricks(fixed)
    target = int(total * 0.68)
    import random as _rnd
    rng = _rnd.Random(20260920)
    rng.shuffle(candidates)
    for (r, c, top) in candidates:
        if count_walls(fixed) >= target:
            break
        fixed[r][c][top] = WALL
        # 复验:补偿墙不得产生新封锁,失败则恢复原砖
        left, _ = simulate_and_report(fixed)
        if left != 0:
            fixed[r][c][top] = g[r][c][top] if g[r][c][top] >= BRICK else BRICK
    changed = any(fixed[r][c][h] != g[r][c][h] for r in range(BN) for c in range(PC) for h in range(QS))
    return fixed, (0 if changed else -1)


def main():
    data = open(DAT, "rb").read()
    assert len(data) % BLOCK == 0
    out = bytearray()
    fixed_cnt = 0
    for off in range(0, len(data), BLOCK):
        name = data[off + 1: off + 9].split(b"\x00")[0].decode("ascii", "ignore")
        chunk = bytearray(data[off: off + BLOCK])
        if name.startswith("nm"):
            g = load_grid(data, off)
            for attempt in range(12):  # 改砖可能暴露新封锁点, 迭代至可通关
                left, _ = simulate_and_report(g)
                if left == 0:
                    break
                g, _ = fix_level(g)
            left, _ = simulate_and_report(g)
            if left == 0:
                if attempt > 0 or True:
                    # 写回(仅当有过修改: 与原 chunk 比较)
                    g_orig = load_grid(data, off)
                    modified = any(g[r][c][h] != g_orig[r][c][h] for r in range(BN) for c in range(PC) for h in range(QS))
                    if modified:
                        for c in range(PC):
                            for r in range(BN):
                                for h in range(QS):
                                    chunk[9 + c * BN * QS + r * QS + h] = g[r][c][h]
                        fixed_cnt += 1
                        print(f"FIXED {name} (迭代 {attempt + 1} 轮)")
                    else:
                        print(f"OK     {name}")
            else:
                print(f"STILL-BAD {name} 剩 {left}")
        out += chunk
    if fixed_cnt:
        open(DAT, "wb").write(bytes(out))
        print(f"\n已修复 {fixed_cnt} 关并写回 {DAT}")
    else:
        print("\n无需修复")


if __name__ == "__main__":
    main()
