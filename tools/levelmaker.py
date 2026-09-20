#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dzk3d 关卡生成工具
==================
向 leveldesign.dat 追加新关卡（每关 581 字节）。

数据格式（每关）：
  [0]         : difficulty (0-4)
  [1..8]      : 关卡名 (最多 8 字符, 0 结尾)
  [9..580]    : 方块数据 572 字节 = 11列 x 13行 x 4高
                索引 = col*13*4 + row*4 + height
                值: 0=空, 1=不可破坏, 2/3/4=可破坏(颜色亮度递增), 5=奖励

方块类型:
  0 = 空
  1 = 不可破坏 (黑色)
  2 = 可破坏 (深蓝)
  3 = 可破坏 (更亮)
  4 = 可破坏 (最亮)
  5 = 奖励方块

用法:
  python3 levelmaker.py "新关卡名" <difficulty> "图1" "图2" ... "图4"
  每行 11 字符, 13 行一层; 最多 4 层(从下往上)
  字符映射: . = 空, # = 普通可破坏(2), X = 不可破坏(1), B = 奖励(5), 3/4 = 对应类型
"""
import sys, os

PC, BN, QS = 11, 13, 4
BLOCK = 9 + PC * BN * QS  # 581

def parse_ascii(layers, name):
    """把 ASCII 层转换成 572 字节方块数据。layers: 从下往上最多4层, 每层13行x11列"""
    grid = [[[0] * QS for _ in range(PC)] for _ in range(BN)]
    for h, layer in enumerate(layers):
        rows = layer.strip().split('\n')
        assert len(rows) <= BN, f'{name} 层{h} 行数超过 {BN}'
        for ri, line in enumerate(rows):
            line = line.rstrip()
            assert len(line) <= PC, f'{name} 层{h} 行{ri} 列数超过 {PC}: "{line}"'
            # 从下往上: 第0行(底部)对应 row=0
            row = ri
            for ci, ch in enumerate(line):
                t = {'.': 0, '#': 2, 'X': 1, 'B': 5, '3': 3, '4': 4}.get(ch)
                assert t is not None, f'{name} 非法字符 "{ch}"'
                grid[row][ci][h] = t
    out = bytearray(PC * BN * QS)  # 572 字节，纯方块数据
    for col in range(PC):
        for row in range(BN):
            for h in range(QS):
                idx = col * BN * QS + row * QS + h
                out[idx] = grid[row][col][h]
    return bytes(out)

def build_level(name, difficulty, layers):
    assert 0 <= difficulty <= 4, 'difficulty 必须是 0-4'
    assert 1 <= len(name) <= 8, '关卡名 1-8 字符'
    hdr = bytearray(9)
    hdr[0] = difficulty
    nb = name.encode('ascii')
    assert len(nb) <= 8, '关卡名必须是 ASCII 且 <= 8 字符'
    hdr[1:1 + len(nb)] = nb
    return bytes(hdr) + parse_ascii(layers, name)

def append_to_dat(level_bytes, dat_path):
    data = open(dat_path, 'rb').read()
    assert len(data) % BLOCK == 0, f'dat 文件大小不是 {BLOCK} 的整数倍!'
    open(dat_path, 'wb').write(data + level_bytes)
    return len(data) // BLOCK  # 返回新关卡索引

def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    name = sys.argv[1]
    diff = int(sys.argv[2])
    layers = sys.argv[3:]
    if len(layers) > QS:
        print(f'最多 {QS} 层!'); sys.exit(1)
    # 不足 4 层补空层
    while len(layers) < QS:
        layers.append('\n'.join('.' * PC for _ in range(BN)))
    # 每层补足 13 行
    padded = []
    for layer in layers:
        rows = layer.split('\n')
        while len(rows) < BN:
            rows.append('.' * PC)
        padded.append('\n'.join(rows))
    lvl = build_level(name, diff, padded)
    dat_path = os.path.join(os.path.dirname(__file__), 'leveldesign.b38b6a9611ae33ec.dat')
    idx = append_to_dat(lvl, dat_path)
    print(f'OK: 关卡 "{name}" (难度{diff}) 已追加, 索引={idx}, 共 {idx+1} 关')

if __name__ == '__main__':
    main()
