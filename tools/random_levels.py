#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dzk3d 随机关卡生成器
====================
按难度随机生成关卡并追加到 leveldesign.dat，同时打印需同步到 records.js 的 JS 片段。

难度设计:
  0 教学: 低密度, 1层, 几乎全可破坏2
  1 简单: 中低密度, 1-2层, 可破坏2/3为主, 少量不可破坏
  2 普通: 中密度, 2层, 2/3/4混合, 少量X和B
  3 困难: 高密度, 2-3层, 2/3/4/X混合, 适量B
  4 专家: 最高密度, 3-4层, 全部类型混合, X和B更多

用法: python3 random_levels.py <难度> <数量> [名前缀]
"""
import sys, os, random

PC, BN, QS = 11, 13, 4
BLOCK = 9 + PC * BN * QS  # 581

DIFF_CONF = {
    0: dict(fill=(0.16, 0.26), layers=1, type_weights={2: 1.0}, max_regions=2),
    1: dict(fill=(0.26, 0.36), layers=(1, 2), type_weights={2: 0.65, 3: 0.3, 1: 0.05}, max_regions=3),
    2: dict(fill=(0.36, 0.46), layers=(2, 2), type_weights={2: 0.5, 3: 0.3, 4: 0.15, 1: 0.05}, max_regions=4),
    3: dict(fill=(0.46, 0.56), layers=(2, 3), type_weights={2: 0.4, 3: 0.28, 4: 0.2, 1: 0.07, 5: 0.05}, max_regions=5),
    4: dict(fill=(0.56, 0.66), layers=(3, 4), type_weights={2: 0.32, 3: 0.26, 4: 0.24, 1: 0.1, 5: 0.08}, max_regions=6),
}

def weighted_type(weights, rng):
    keys = list(weights.keys())
    vals = [weights[k] for k in keys]
    return rng.choices(keys, weights=vals)[0]

def gen_level(diff, rng):
    conf = DIFF_CONF[diff]
    fill_min, fill_max = conf['fill']
    lay_min, lay_max = conf['layers'] if isinstance(conf['layers'], tuple) else (conf['layers'], conf['layers'])
    n_layers = rng.randint(lay_min, lay_max)
    grid = [[[0] * QS for _ in range(PC)] for _ in range(BN)]
    total_cells = PC * BN
    # 底层必须实心（从下往上堆叠），保证方块有支撑、破坏后能连锁下落
    # 策略: 先选"支撑列"(随机列集合), 这些列从底部连续堆到随机高度
    # 1. 底层密度 = 目标密度
    base_density = rng.uniform(fill_min, fill_max)
    base_target = int(total_cells * base_density)
    # 随机选择支撑列
    all_cols = list(range(PC))
    rng.shuffle(all_cols)
    n_cols = max(3, int(PC * base_density))
    support_cols = all_cols[:n_cols]
    for c in support_cols:
        # 该列堆叠高度(至少1层, 随难度加深)
        max_h = rng.randint(1, n_layers)
        for h in range(max_h):
            for r in range(BN):
                t = weighted_type(conf['type_weights'], rng)
                grid[r][c][h] = t
    # 2. 额外随机填充(连通游走) 补足密度, 但只填"已有方块的正上方或同层邻居旁", 避免悬浮
    filled = sum(1 for r in range(BN) for c in range(PC) for h in range(QS) if grid[r][c][h])
    target_total = int(total_cells * rng.uniform(fill_min, fill_max))
    attempts = 0
    while filled < target_total and attempts < 300:
        attempts += 1
        r = rng.randint(0, BN - 1)
        c = rng.randint(0, PC - 1)
        # 找该列最顶层
        top = -1
        for h in range(QS):
            if grid[r][c][h]:
                top = h
        if top >= 0:
            # 已有方块 → 在其上方堆叠(有支撑)
            if top + 1 < QS and rng.random() < 0.6:
                t = weighted_type(conf['type_weights'], rng)
                grid[r][c][top + 1] = t
                filled += 1
            # 或横向扩展(同层邻居), 高度=该列top, 有支撑
            else:
                nr, nc = r + rng.choice([-1, 0, 1]), c + rng.choice([-1, 0, 1])
                if 0 <= nr < BN and 0 <= nc < PC and grid[nr][nc][top] == 0 and (top == 0 or grid[nr][nc][top - 1]):
                    t = weighted_type(conf['type_weights'], rng)
                    grid[nr][nc][top] = t
                    filled += 1
        else:
            # 空列 → 从底部起一列(有支撑)
            if rng.random() < 0.5:
                grid[r][c][0] = weighted_type(conf['type_weights'], rng)
                filled += 1
    # 3. 硬规则收尾: 每根柱最高处的墙, 其上方不得留可破坏砖。
    #    球只能打到柱底, 靠"下方被打掉→上方方块下落"逐层消;
    #    墙永远不破, 墙上方的砖永远落不下来 → 关卡无法通关。
    #    (反向的"砖上叠墙"是允许的: 砖打掉后墙落到底, 原版关大量存在。)
    for r in range(BN):
        for c in range(PC):
            wall_top = -1
            for h in range(QS):
                if grid[r][c][h] == 1:
                    wall_top = h
            if wall_top >= 0:
                for h in range(wall_top + 1, QS):
                    if grid[r][c][h] >= 2:
                        grid[r][c][h] = 0
    # 编码
    out = bytearray(PC * BN * QS)
    for col in range(PC):
        for row in range(BN):
            for h in range(QS):
                out[col * BN * QS + row * QS + h] = grid[row][col][h]
    return bytes(out)

def assert_no_brick_above_wall(blockdata):
    """校验: 任何柱里, 最高墙的上方不得有可破坏砖(否则关卡无法通关)。"""
    for col in range(PC):
        for row in range(BN):
            ch = [blockdata[col * BN * QS + row * QS + h] for h in range(QS)]
            wall_top = -1
            for h in range(QS):
                if ch[h] == 1:
                    wall_top = h
            if wall_top >= 0 and any(ch[h] >= 2 for h in range(wall_top + 1, QS)):
                raise AssertionError(f'砖叠在墙上: (col={col},row={row}) {ch}')

def build_level(name, diff, blockdata):
    hdr = bytearray(9)
    hdr[0] = diff
    nb = name.encode('ascii')
    hdr[1:1 + len(nb)] = nb
    return bytes(hdr) + blockdata

def append_to_dat(level_bytes, dat_path):
    data = open(dat_path, 'rb').read()
    assert len(data) % BLOCK == 0
    open(dat_path, 'wb').write(data + level_bytes)
    return len(data) // BLOCK

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    diff = int(sys.argv[1])
    count = int(sys.argv[2])
    prefix = sys.argv[3] if len(sys.argv) > 3 else f'r{diff}'
    dat_path = os.path.join(os.path.dirname(__file__), 'leveldesign.b38b6a9611ae33ec.dat')
    rng = random.Random()
    js_levels = []
    js_names = []
    for i in range(count):
        name = f'{prefix}{i+1}'
        if len(name) > 8:
            name = name[:8]
        lvl = build_level(name, diff, gen_level(diff, rng))
        assert_no_brick_above_wall(lvl[9:])  # 硬规则: 墙上不得悬砖
        idx = append_to_dat(lvl, dat_path)
        filled = sum(1 for x in lvl[9:] if x)
        print(f'OK: {name} (难度{diff}) idx={idx} filled={filled}')
        js_levels.append(f'{{ name: "{name}", diff: {diff} }}')
        js_names.append(f'{name}: "{name}"')
    print()
    print('=== 同步到 records.js LEVELS 追加: ===')
    print('    ' + ', '.join(js_levels) + ',')
    print()
    print('=== 同步到 LEVEL_NAMES_CN: ===')
    for n in js_names:
        print(f'    {n},')

if __name__ == '__main__':
    main()
