#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 5 张自定义 "弹弹弹解压地图" (dzkst1/dzkrg1/dzkzp1/dzktw1/FULL)，
追加到 leveldesign.dat 末尾并输出为新文件名（换文件名以击穿浏览器缓存）。

编码规则（沿用用户约定）:
  1 = 不可破坏墙 (黑色, 打不掉)
  0 = 可破坏砖   (能打碎)
  每格只放 1 层 (n=0)，与原版 27 关一致——原版从未叠层，
  旧版铺满 4 层导致每关 572 块、变成 4 格高的砖墙堡垒。

设计约束（关键，违反会导致关卡无法通关/球卡死）:
  - 球在地面 (X-Z 平面) 滚动，墙 = 地面障碍物。
  - 每个可破坏区域必须有 >=2 格宽的开口与外界连通（1 格宽球挤不过去），
    否则腔内砖块永久不可达，breakable 永远清零不了。
  - 密度对齐原版（40~130 块），解压图 90~145 块可破坏砖。

引擎网格: X=13 列(BN), Z=11 行(PC), 高度 n=0..3(QS)。
unpack: r = t*BN*QS + i*QS + n ; t=Z行, i=X列, n=高度。
"""
import os

PC, BN, QS = 11, 13, 4          # PC=Z行数, BN=X列数, QS=高度层数
BLOCK = 9 + PC * BN * QS        # 581

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DAT = os.path.join(TOOLS_DIR, '..', 'web', 'assets', 'leveldesign.b38b6a9611ae33ec_v2.dat')
DST_DAT = os.path.join(TOOLS_DIR, '..', 'web', 'assets', 'leveldesign.b38b6a9611ae33ec_v3.dat')

MAPS = {
    # 直筒: 3 道纵向墙隔出 4 条弹道，墙上各留一处 2 格宽的交错豁口，球在筒间穿行
    "dzkst1": [
        "0001001001000",
        "0001001001000",
        "0001001001000",
        "0000001001000",
        "0000001001000",
        "0001001001000",
        "0001000001000",
        "0001000001000",
        "0001001000000",
        "0001001000000",
        "0001001001000",
    ],
    # 回字: 外圈墙(上下留大门) + 砖廊 + 内圈墙(底部留宽口) + 中央砖阵
    "dzkrg1": [
        "1110000000111",
        "1000000000001",
        "1011111111101",
        "1010000000101",
        "1010000000101",
        "1010000000101",
        "1010000000101",
        "1010000000101",
        "1011100000101",
        "1000000000001",
        "1110000000111",
    ],
    # Z螺旋: 4 道横墙左右交错留 2 格豁口，球走 S 形弹道逐层深入
    "dzkzp1": [
        "1111111111100",
        "0000000000000",
        "0011111111111",
        "0000000000000",
        "1111111111100",
        "0000000000000",
        "0011111111111",
        "0000000000000",
        "1111111111100",
        "0000000000000",
        "0000000000000",
    ],
    # 双室: 左右两个对称房间，左房右侧门、右房左侧门(各 2 格宽)，外圈留空场
    "dzktw1": [
        "0000000000000",
        "0000000000000",
        "1111110111111",
        "1000010100001",
        "1000000100001",
        "1000000000001",
        "1000010000001",
        "1000010100001",
        "1111110111111",
        "0000000000000",
        "0000000000000",
    ],
    # 满屏: 143 块全可破坏砖，无墙，纯解压
    "FULL": [
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
        "0000000000000",
    ],
}

def encode(name, rows):
    """编码一关: 只写 n=0 层，n=1..3 留空（与原版关卡一致）。"""
    assert len(rows) == PC, name
    for ln in rows:
        assert len(ln) == BN, '%s bad width: %r' % (name, ln)
    buf = bytearray(BLOCK)
    buf[0] = 0  # difficulty 0（进选关 UI 的「教学」组）
    nb = name[:8].encode('ascii')
    buf[1:1 + len(nb)] = nb
    for t in range(PC):            # Z 行
        line = rows[t]
        for i in range(BN):        # X 列
            ch = line[i]
            if ch == '1':
                v = 1              # 不可破坏墙
            elif ch == '0':
                v = 2              # 可破坏砖
            else:
                v = 0              # 空
            r = t * BN * QS + i * QS + 0   # 只放最底层 n=0
            buf[r + 9] = v
    return bytes(buf)

def verify(rows, name):
    """连通性检查: 每个可破坏区域必须与边界空场连通（4 邻接, 经过 0 或空格）。"""
    grid = [[1 if c == '1' else 0 for c in ln] for ln in rows]
    seen = [[False] * BN for _ in range(PC)]
    # 从四条边上的所有非墙格子出发洪水填充
    stack = []
    for t in range(PC):
        for i in range(BN):
            if t in (0, PC - 1) or i in (0, BN - 1):
                if grid[t][i] != 1 and not seen[t][i]:
                    seen[t][i] = True
                    stack.append((t, i))
    while stack:
        t, i = stack.pop()
        for dt, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nt, ni = t + dt, i + di
            if 0 <= nt < PC and 0 <= ni < BN and not seen[nt][ni] and grid[nt][ni] != 1:
                seen[nt][ni] = True
                stack.append((nt, ni))
    for t in range(PC):
        for i in range(BN):
            if grid[t][i] == 0 and not seen[t][i]:
                raise AssertionError('%s: 可破坏砖 (%d,%d) 被墙围死, 不可达!' % (name, i, t))
    walls = sum(map(sum, grid))
    print('  verify %s: %d walls, %d breakable, connectivity OK' % (name, walls, PC * BN - walls))

def main():
    data = bytearray(open(SRC_DAT, 'rb').read())
    assert len(data) % BLOCK == 0, 'dat size not multiple of block'
    # 去掉旧的 dzk/FULL 关, 保留原版 + 随机关作为基础
    old = len(data) // BLOCK
    while old > 0:
        base = (old - 1) * BLOCK
        nm = data[base + 1:base + 9].split(b'\x00')[0].decode('ascii', 'replace')
        if nm.startswith('dzk') or nm == 'FULL':
            data = data[:base]
            old -= 1
        else:
            break
    print('base levels kept:', len(data) // BLOCK)
    for name, rows in MAPS.items():
        verify(rows, name)
        data += encode(name, rows)
    open(DST_DAT, 'wb').write(data)
    print('written %s: %d levels, %d bytes' % (DST_DAT, len(data) // BLOCK, len(data)))

if __name__ == '__main__':
    main()
