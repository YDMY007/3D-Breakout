/*
 * dzk3d 本地记录浮标
 * 由于原游戏把"保存记录"请求发往已下线的 MSI 后端 (merci-michel.com/api/register)，
 * 在单机/飞牛 NAS 环境下永远失败。register() 已改为写入 localStorage，
 * 这里负责把"历史最高分"显示出来。
 */
(function () {
  'use strict';
  // ===== 本地存储健康探测：飞牛桌面小窗等嵌入式环境可能是沙箱源，
  // localStorage 一切写入会静默抛错（整个项目全部 try/catch 包裹），数据"看起来在玩、其实从没存上"。
  // 这里显式探测一次，失败时给出可见告警，不再静默。
  var storageState = (function () {
    try {
      localStorage.setItem('__dzk_probe', '1');
      localStorage.removeItem('__dzk_probe');
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e && e.message || e) };
    }
  })();
  window.__dzkStorageOk = storageState.ok;
  if (!storageState.ok) {
    var inFrame = false;
    try { inFrame = window.self !== window.top; } catch (_) { inFrame = true; }
    var bar = document.createElement('div');
    bar.className = 'dzk-storage-warn';
    bar.innerHTML = '<span>⚠ 本地存储不可用：设置与成绩<b>无法保存</b>' +
      (inFrame ? '（嵌入式小窗环境限制）。建议重新进入并选择「在新标签页中打开」。' : '（当前浏览环境限制）。') + '</span>' +
      '<button type="button" aria-label="关闭">×</button>';
    bar.querySelector('button').addEventListener('click', function () { bar.remove(); });
    document.body.appendChild(bar);
  }
  var BEST_KEY = 'dzk3d_best_score';
  var LAST_KEY = 'dzk3d_last_record';

  function getBest() {
    var v = Number(localStorage.getItem(BEST_KEY)) || 0;
    return v;
  }

  function fmt(n) {
    return Number(n).toLocaleString('zh-TW');
  }

  function build() {
    if (document.getElementById('dzk3d-best-badge')) return;
    var el = document.createElement('div');
    el.id = 'dzk3d-best-badge';
    el.setAttribute('data-v', 'dzk3d-record');
    el.style.cssText = [
      'position:fixed',
      'top:10px',
      'right:10px',
      'z-index:2147483647',
      'padding:6px 12px',
      'border-radius:999px',
      'font:600 13px/1.2 "Exo2",Arial,Helvetica,sans-serif',
      'color:#fff',
      'background:rgba(10,10,20,.55)',
      'border:1px solid rgba(250,0,255,.5)',
      'box-shadow:0 0 12px rgba(81,175,255,.35)',
      'backdrop-filter:blur(4px)',
      '-webkit-backdrop-filter:blur(4px)',
      'pointer-events:none',
      'user-select:none',
      'letter-spacing:.5px'
    ].join(';');
    el.innerHTML = '<span class="dzk-best">🏆 历史最高 <b style="color:#51AFFF">0</b></span>' +
                   '<span class="dzk-cur" style="opacity:.85">本局 <b style="color:#fff">-</b></span>';
    el.querySelector('.dzk-best').style.cssText = 'display:block;font-weight:600';
    el.querySelector('.dzk-cur').style.cssText = 'display:block;font-size:11px;margin-top:2px;font-weight:600';
    document.body.appendChild(el);
  }

  function refresh(forceNew) {
    var el = document.getElementById('dzk3d-best-badge');
    if (!el) return;
    var b = getBest();
    var label = b > 0 ? fmt(b) : '暂无记录';
    el.querySelector('.dzk-best').innerHTML = '🏆 历史最高 <b style="color:#51AFFF">' + label + '</b>';
    if (forceNew) {
      el.querySelector('.dzk-best').innerHTML = '🎉 新纪录! <b style="color:#FA00FF">' + fmt(b) + '</b>';
    }
    // 轻微高亮一下，提示刚更新
    el.animate(
      [{ boxShadow: '0 0 12px rgba(81,175,255,.35)' },
       { boxShadow: '0 0 22px rgba(250,0,255,.9)' },
       { boxShadow: '0 0 12px rgba(81,175,255,.35)' }],
      { duration: 900 }
    );
  }

  function setCurrent(score) {
    var el = document.getElementById('dzk3d-best-badge');
    if (!el) return;
    var cur = el.querySelector('.dzk-cur b');
    if (cur) cur.textContent = (score == null || isNaN(score)) ? '-' : fmt(score);
  }

  // ===== 奖杯按钮：替换汉堡菜单（Vue 渲染的 .menu-button） =====
  function replaceMenuButtonWithTrophy() {
    // Vue 每次渲染后都会重建 header，所以用 MutationObserver 兜底
    var inserted = false;
    function tryInsert() {
      var btn = document.getElementById('dzk-trophy-btn');
      if (btn) return;
      var menuBtn = document.querySelector('.app-header .buttons .menu-button');
      if (!menuBtn) return;
      // 隐藏汉堡
      menuBtn.style.display = 'none';
      // 创建奖杯按钮
      var trophy = document.createElement('button');
      trophy.id = 'dzk-trophy-btn';
      trophy.type = 'button';
      trophy.className = 'dzk-trophy-btn';
      trophy.setAttribute('aria-label', '歷史記錄');
      trophy.title = '历史最高分';
      trophy.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M8 21h8"></path><path d="M12 17v4"></path>' +
        '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>' +
        '<path d="M17 5h3v2a3 3 0 0 1-3 3"></path>' +
        '<path d="M7 5H4v2a3 3 0 0 0 3 3"></path></svg>';
      // 插到汉堡的位置
      menuBtn.parentNode.insertBefore(trophy, menuBtn.nextSibling);
      inserted = true;
      bindTrophy(trophy);
    }
    tryInsert();
    // Vue 重渲染兜底
    var obs = new MutationObserver(function () {
      tryInsert();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return {
      stop: function () { obs.disconnect(); }
    };
  }

  // ===== 奖杯按钮 -> 历史记录弹窗 =====
  // 注意：Vue 每次重建 header 都会重新插入奖杯按钮并再次调用 bindTrophy，
  // 因此弹窗级监听（X/背景/Esc）只能绑一次，暂停状态也必须放在模块级共享，
  // 否则多套闭包并存时，第一套先把弹窗关掉、带暂停状态的闭包会被"已关闭"挡住不恢复。
  var trophyModalBound = false;
  var trophyPaused = false;
  function isGameRouteNow() {
    try {
      var inst = window.__webglInstance;
      return !!(inst && inst.$router && inst.$router.currentRoute.value.name === 'Game');
    } catch (e) { return false; }
  }
  function bindTrophy(btn) {
    var modal = document.getElementById('dzk-records-modal');
    var bestEl = document.getElementById('dzk-records-best');
    var bestTimeEl = document.getElementById('dzk-records-best-time');
    var listEl = document.getElementById('dzk-records-list');
    var closeEl = document.getElementById('dzk-records-close');
    if (!btn || !modal) return;

    function fmtTime(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      var now = new Date();
      var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
      if (sameDay) return '今天 ' + hh + ':' + mm;
      var y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate();
      if (d.getFullYear() === now.getFullYear()) return mo + '/' + da + ' ' + hh + ':' + mm;
      return y + '/' + mo + '/' + da;
    }

    function getRecords() {
      try {
        var raw = localStorage.getItem('dzk3d_records');
        if (raw) {
          var p = JSON.parse(raw);
          if (Array.isArray(p)) return p.filter(function (x) { return x && typeof x.score === 'number'; });
        }
      } catch (_) {}
      return [];
    }

    // 游戏局内打开奖杯弹窗会自动暂停，关闭时恢复（与主菜单/选关暂停机制一致）
  var pausedByTrophy = false;
  function isGameRoute() {
    try {
      var inst = window.__webglInstance;
      return !!(inst && inst.$router && inst.$router.currentRoute.value.name === 'Game');
    } catch (e) { return false; }
  }
  function openModal() {
      var recs = getRecords();
      var best = getBest();
      // 最高记录 + 时间（优先取 dzk3d_best_time，兜底从记录数组里找最高分那条的日期）
      var bestTime = localStorage.getItem('dzk3d_best_time');
      if (!bestTime && recs.length) {
        var bestRec = null;
        recs.forEach(function (r) { if (!bestRec || r.score > bestRec.score) bestRec = r; });
        if (bestRec) bestTime = bestRec.date;
      }
      bestEl.textContent = best > 0 ? fmt(best) : '暂无记录';
      bestTimeEl.textContent = best > 0 && bestTime ? '记录于 ' + fmtTime(Number(bestTime)) : '';
      // 最近五局
      if (listEl) {
        var recent = recs.slice(-5).reverse();
        var html = '<div class="dzk-rl-title">最近五局</div>';
        if (!recent.length) {
          html += '<div style="text-align:center;opacity:.55;padding:6px 0">还没有游玩记录</div>';
        } else {
          recent.forEach(function (r, i) {
            html += '<div class="dzk-record-row">' +
              '<span class="rk">#' + (recs.length - i) + '</span>' +
              '<span class="sc">' + fmt(r.score || 0) + '</span>' +
              '<span class="tm">' + fmtTime(r.date) + '</span></div>';
          });
        }
        listEl.innerHTML = html;
      }
      trophyPaused = isGameRouteNow();
      if (trophyPaused) window.dispatchEvent(new Event('dzk3d-game-pause'));
      modal.classList.add('open');
    }
    function closeModal() {
      if (!modal.classList.contains('open')) return;
      modal.classList.remove('open');
      if (trophyPaused) {
        trophyPaused = false;
        try {
          if (isGameRouteNow()) window.dispatchEvent(new Event('dzk3d-game-play'));
        } catch (e) {}
      }
    }
    btn.addEventListener('click', openModal);
    if (!trophyModalBound) {
      trophyModalBound = true;
      if (closeEl) closeEl.addEventListener('click', closeModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }
  }

  // ===== 选关弹窗（27 关，按难度分组） =====
  // 关卡内部名（dat 文件）→ 中文显示名
  var LEVEL_NAMES_CN = {
    arrow: '箭头', chess: '棋盘', circle: '圆环', diamond: '菱形', drop: '水滴',
    face: '笑脸', gamepad: '手柄', home1: '小屋一', home2: '小屋二', hugo: '雨果',
    invader: '入侵者', joystick: '摇杆', laby: '迷宫', matches: '火柴', michel: '米其林',
    msint: '教学', pocket: '口袋', rainbow: '彩虹', shield: '盾牌', spceship: '飞船',
    stars: '星星', trap: '陷阱', trident: '三叉戟', umbrella: '雨伞', wallalt: '墙壁A',
    wallppr: '墙壁B', walls: '墙壁',
    r01: '教学A', r02: '教学B', r03: '教学C',
    r11: '简单A', r12: '简单B', r13: '简单C',
    r21: '普通A', r22: '普通B', r23: '普通C',
    r31: '困难A', r32: '困难B', r33: '困难C',
    r41: '专家A', r42: '专家B', r43: '专家C',
    dzkst1: '弹弹·直筒', dzkrg1: '弹弹·回字', dzkzp1: '弹弹·Z螺旋', dzktw1: '弹弹·双室', FULL: '弹弹·满屏',
    square: '方块', cross: '十字', pyramid: '金字塔', heart: '爱心', moon: '月牙',
    tree: '松树', flag: '旗帜', stair: '台阶', dice: '骰子', bridge: '小桥',
    cat: '猫脸', fish: '小鱼', boat: '帆船', key: '钥匙', cup: '杯子',
    kite: '风筝', bell: '铃铛', anchor: '船锚', candle: '蜡烛', hat: '草帽',
    skull: '骷髅', flower: '花朵', guitar: '吉他', rocket: '火箭', castle: '城堡',
    snake: '蛇', crown: '王冠', whale: '鲸鱼', camera: '相机', mushroom: '蘑菇',
    dragon: '龙头', spider: '蜘蛛', ghost: '幽灵', sword: '宝剑', tower: '塔楼',
    scorpion: '蝎子', phoenix: '凤凰', eagle: '雄鹰', wolf: '狼头', viking: '海盗船',
    tiger: '虎头', robot: '机器人', ufo: '飞碟', crystal: '水晶', fortress: '要塞',
    sun: '烈日', pumpkin: '南瓜', owl: '猫头鹰', cactus: '仙人掌', demon: '恶魔'
  };

  // ===== 无尽模式：程序化关卡生成器（难度随层数递增） =====
  // 数据格式与 leveldesign.dat 完全一致（每关 581 字节），由引擎 createLevelFromBytes 直接构造为 Level 对象
  var PC = 11, BN = 13, QS = 4, BLOCK = 9 + PC * BN * QS;
  var ENDLESS_DIFF_CONF = {
    0: { fill: [0.16, 0.26], layers: 1, weights: { 2: 1.0 } },
    1: { fill: [0.26, 0.36], layers: [1, 2], weights: { 2: 0.65, 3: 0.3, 1: 0.05 } },
    2: { fill: [0.36, 0.46], layers: [2, 2], weights: { 2: 0.5, 3: 0.3, 4: 0.15, 1: 0.05 } },
    3: { fill: [0.46, 0.56], layers: [2, 3], weights: { 2: 0.4, 3: 0.28, 4: 0.2, 1: 0.07, 5: 0.05 } },
    4: { fill: [0.56, 0.66], layers: [3, 4], weights: { 2: 0.32, 3: 0.26, 4: 0.24, 1: 0.1, 5: 0.08 } }
  };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function endlessDifficulty(floor) {
    // 前两层教学，之后每两层升一档，封顶专家(4)
    return Math.min(4, Math.floor((floor - 1) / 2));
  }
  function endlessWeightedType(weights, rng) {
    var keys = Object.keys(weights), total = 0, k;
    for (k = 0; k < keys.length; k++) total += weights[keys[k]];
    var r = rng() * total;
    for (k = 0; k < keys.length; k++) { r -= weights[keys[k]]; if (r <= 0) return +keys[k]; }
    return +keys[0];
  }
  function genEndlessLayer(floor) {
    var diff = endlessDifficulty(floor);
    var conf = ENDLESS_DIFF_CONF[diff];
    // 每次进入无尽都会重新随机一个 session 种子（见开始无尽按钮处赋值），
    // 与楼层组合后做种子 —— 这样每次进无尽第 1 层都不同，完全随机、不重复。
    var sess = window.__dzkEndlessSeed;
    if (sess === undefined || sess === null) {
      sess = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0) || 1;
    }
    var rng = mulberry32(((sess ^ (floor * 2654435761)) >>> 0) || 1);
    // 与楼层一起随机选一种「图案原型」——相邻层的结构完全不同，避免千篇一律
    var over = Math.max(0, floor - 11);
    var fillMin = Math.min(0.7, conf.fill[0] + over * 0.01);
    var fillMax = Math.min(0.78, conf.fill[1] + over * 0.01);
    var layMin = Array.isArray(conf.layers) ? conf.layers[0] : conf.layers;
    var layMax = Array.isArray(conf.layers) ? conf.layers[1] : conf.layers;

    var grid = [];
    for (var r = 0; r < BN; r++) { grid[r] = []; for (var c = 0; c < PC; c++) grid[r][c] = [0, 0, 0, 0]; }
    function ty() { return endlessWeightedType(conf.weights, rng); }
    function setB(rr, cc) {
      if (rr >= 0 && rr < BN && cc >= 0 && cc < PC && !grid[rr][cc][0]) { grid[rr][cc][0] = ty(); return 1; }
      return 0;
    }

    var target = Math.floor(PC * BN * (fillMin + rng() * (fillMax - fillMin)));
    var filled = 0;
    var arch = (rng() * 6) | 0;
    var i, j, rr, cc, t, x, tmp;

    if (arch === 0) {
      // 散簇：若干种子点随机生长成不规则砖簇
      var seeds = [];
      var k = 3 + ((rng() * 4) | 0);
      for (i = 0; i < k; i++) {
        rr = (rng() * BN) | 0; cc = (rng() * PC) | 0;
        if (setB(rr, cc)) { filled++; seeds.push([rr, cc]); }
      }
      var g0 = 0;
      while (filled < target && seeds.length && g0++ < 2000) {
        var si = (rng() * seeds.length) | 0;
        var s0 = seeds[si];
        rr = s0[0] + ((rng() * 3) | 0) - 1;
        cc = s0[1] + ((rng() * 3) | 0) - 1;
        if (setB(rr, cc)) { filled++; seeds.push([rr, cc]); }
        else if (rng() < 0.25) seeds.splice(si, 1);
      }
    } else if (arch === 1) {
      // 横带：1-3 条随机位置、随机厚度的横砖带，带内随机留缺
      var bands = 1 + ((rng() * 3) | 0);
      var usedZ = [];
      for (i = 0; i < bands; i++) {
        var thick = 1 + ((rng() * 2) | 0);
        var z0, tr = 0;
        do { z0 = 1 + ((rng() * Math.max(1, PC - 2 - thick)) | 0); tr++; }
        while (tr < 20 && usedZ.some(function (u) { return Math.abs(u - z0) < 2; }));
        usedZ.push(z0);
        for (t = z0; t < Math.min(PC - 1, z0 + thick); t++) {
          for (x = 0; x < BN; x++) if (rng() < 0.88) filled += setB(x, t);
        }
      }
    } else if (arch === 2) {
      // 纵条：2-5 根竖砖条，位置与 Z 跨度随机
      var nC = 2 + ((rng() * 4) | 0);
      var cols = [];
      for (i = 0; i < BN; i++) cols.push(i);
      for (i = cols.length - 1; i > 0; i--) { j = (rng() * (i + 1)) | 0; tmp = cols[i]; cols[i] = cols[j]; cols[j] = tmp; }
      for (i = 0; i < Math.min(nC, cols.length); i++) {
        var xx = cols[i];
        var len = 4 + ((rng() * (PC - 4)) | 0);
        var off = (rng() * (PC - len)) | 0;
        for (cc = off; cc < off + len; cc++) if (rng() < 0.9) filled += setB(xx, cc);
      }
    } else if (arch === 3) {
      // 棋盘：随机矩形区域内取 (r+c) 偶数格
      var cw = 6 + ((rng() * (BN - 6)) | 0);
      var ch = 4 + ((rng() * (PC - 4)) | 0);
      var cr = (rng() * (BN - cw)) | 0;
      var cc0 = (rng() * (PC - ch)) | 0;
      for (rr = cr; rr < cr + cw; rr++) for (cc = cc0; cc < cc0 + ch; cc++) {
        if ((rr + cc) % 2 === 0) filled += setB(rr, cc);
      }
    } else if (arch === 4) {
      // 环框：矩形砖圈（带随机缺口）+ 概率内芯
      var fw = 5 + ((rng() * (BN - 5)) | 0);
      var fh = 4 + ((rng() * (PC - 4)) | 0);
      var fr = (rng() * (BN - fw)) | 0;
      var fc = (rng() * (PC - fh)) | 0;
      for (rr = fr; rr < fr + fw; rr++) for (cc = fc; cc < fc + fh; cc++) {
        var edge = rr === fr || rr === fr + fw - 1 || cc === fc || cc === fc + fh - 1;
        if (edge) { if (rng() < 0.9) filled += setB(rr, cc); }
        else if (rng() < 0.3) filled += setB(rr, cc);
      }
    } else {
      // 塔形：居中菱形/金字塔
      var cx = (BN / 2) | 0;
      var half = 2 + ((rng() * 4) | 0);
      for (var dz = 0; dz < PC; dz++) {
        var wHalf = dz <= half ? dz : Math.max(0, half - (dz - half));
        for (x = cx - wHalf * 2; x <= cx + wHalf * 2; x++) {
          if (x >= 0 && x < BN && rng() < 0.92) filled += setB(x, dz);
        }
        if (dz > half + 2) break;
      }
    }

    // 密度收口：不足则随机撒单块；超出则随机剔单块（保持档位密度语义）
    var g1 = 0;
    while (filled < target && g1++ < 600) {
      rr = (rng() * BN) | 0; cc = (rng() * PC) | 0;
      if (setB(rr, cc)) filled++;
    }
    var cap = Math.floor(target * 1.3) + 6;
    var g2 = 0;
    while (filled > cap && g2++ < 500) {
      rr = (rng() * BN) | 0; cc = (rng() * PC) | 0;
      if (grid[rr][cc][0]) { grid[rr][cc][0] = 0; filled--; }
    }

    // 叠层：难度越高越常向上堆（必须踩在下方方块上，不生成悬浮块）
    var stackP = [0, 0.3, 0.42, 0.52, 0.6][diff] || 0;
    for (var h = 1; h < QS; h++) {
      for (rr = 0; rr < BN; rr++) for (cc = 0; cc < PC; cc++) {
        if (grid[rr][cc][h - 1] && !grid[rr][cc][h] && rng() < stackP) grid[rr][cc][h] = ty();
      }
    }

    // 硬规则：每根柱最高墙的上方不得留可破坏砖（墙打不掉，其上砖永远落不下来）
    for (rr = 0; rr < BN; rr++) for (cc = 0; cc < PC; cc++) {
      var wt = -1;
      for (h = 0; h < QS; h++) if (grid[rr][cc][h] === 1) wt = h;
      if (wt >= 0) for (h = wt + 1; h < QS; h++) if (grid[rr][cc][h] >= 2) grid[rr][cc][h] = 0;
    }

    var out = new Uint8Array(BLOCK);
    out[0] = diff; // name 字段留空（无尽模式 UI 不依赖引擎关卡名）
    var p = 9;
    for (var col2 = 0; col2 < PC; col2++) for (var row2 = 0; row2 < BN; row2++) for (var h2 = 0; h2 < QS; h2++) out[p++] = grid[row2][col2][h2];
    return out;
  }
  window.__dzkEndlessGenLayer = genEndlessLayer;
  // ===== 全球排行榜（无尽层数）=====
  // 成绩 = 单局无尽到达的层数，**只有打破个人纪录才上传**。
  // 后端：Fntv-net 项目的 Cloudflare Worker（地址见 LB_DEFAULT_API，改动需同步 Fntv-net）：
  //   GET  /api/lb/top?n=20      {ok, top:[{name,floor,ts}]}
  //   POST /api/lb/submit        {name, floor} → {ok, rank, best, improved}
  // ⚙ 面板可改服务器地址与昵称（存 localStorage dzk3d_lb）；拉不到远端自动显示本机战绩。
  var LB_KEY = 'dzk3d_lb';          // {name, api}
  var LB_LOCAL = 'dzk3d_lb_local';  // 本机战绩 [{name, floor, date}]
  var LB_CACHE = 'dzk3d_lb_cache';  // 远端最近一次成功结果 [{name, floor}]
  var LB_DEFAULT_API = 'https://690075.xyz';
  var LB_FETCH_KEY = 'dzk3d_lb_fetch'; // 上次拉取榜单的时间戳
  var LB_FETCH_TTL = 12 * 3600 * 1000; // 榜单拉取节流：12 小时一次
  var __lbSession = 0;              // 本局无尽到达层数
  var __lbPrevBest = 0;             // 本局开始前的个人最好层数（判断是否破纪录）
  var __lbBricks = 0;               // 本局累计破坏砖块数
  var __lbLevelStart = -1;          // 当前层开始时的可破坏砖数（用于差值累计）
  var __lbPrevScore = 0;            // 本局开始前的个人最好分数（判断是否破纪录）
  // 无尽成绩公式：score = 破坏砖块数 × 0.1 × 到达层数
  function lbHookBricks() {
    try {
      var g = window.__webglInstance.$webgl.game;
      if (g && g.addPointsFromBrokenBlock && !g.addPointsFromBrokenBlock.__dzkBrickHook) {
        var orig = g.addPointsFromBrokenBlock;
        g.addPointsFromBrokenBlock = function (data) {
          try { if (window.__dzkEndlessMode) __lbBricks++; } catch (_) {}
          return orig.call(this, data);
        };
        g.addPointsFromBrokenBlock.__dzkBrickHook = true;
      }
    } catch (_) {}
  }
  // 当前层加载完成后快照起始可破坏砖数（loadNewLevel 同步建块，setTimeout(0) 即可读到）
  function lbSnapshotLevelStart() {
    setTimeout(function () {
      try {
        var bl = window.__webglInstance.$webgl.game.blocks;
        __lbLevelStart = bl.breakableInstances ? bl.breakableInstances.size : -1;
      } catch (_) { __lbLevelStart = -1; }
    }, 0);
  }
  function lbCfg() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || {}; } catch (_) { return {}; }
  }
  function lbSaveCfg(c) {
    try { localStorage.setItem(LB_KEY, JSON.stringify(c)); } catch (_) {}
  }
  function lbApi() {
    var c = lbCfg();
    return (c.api && String(c.api).trim().replace(/\/+$/, '')) || LB_DEFAULT_API;
  }
  var LB_ADJ = ['闪电', '幻影', '烈焰', '寒冰', '雷霆', '星空', '疾风', '暗影', '彩虹', '机械', '像素', '霓虹'];
  var LB_NOUN = ['企鹅', '猎豹', '雄鹰', '鲨鱼', '火箭', '忍者', '骑士', '幽灵', '老虎', '熊猫', '凤凰', '战狼'];
  function lbRandomName() {
    return LB_ADJ[(Math.random() * LB_ADJ.length) | 0] +
      LB_NOUN[(Math.random() * LB_NOUN.length) | 0] +
      (10 + ((Math.random() * 90) | 0));
  }
  function lbName() {
    var c = lbCfg();
    if (c.name && String(c.name).trim()) return String(c.name).trim();
    // 第一次打开：随机生成昵称并记住
    var n = lbRandomName();
    c.name = n;
    lbSaveCfg(c);
    return n;
  }
  function lbLocalList() {
    try {
      var a = JSON.parse(localStorage.getItem(LB_LOCAL));
      return Array.isArray(a) ? a : [];
    } catch (_) { return []; }
  }
  function lbAddLocal(score, floors) {
    var list = lbLocalList();
    list.push({ name: lbName(), score: score, floor: floors, date: Date.now() });
    list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    try { localStorage.setItem(LB_LOCAL, JSON.stringify(list.slice(0, 50))); } catch (_) {}
  }
  function lbSubmit(score, floors) {
    try {
      // 不带 content-type 头（text/plain）→ CORS 简单请求，免预检：
      // 部分 Cloudflare 域名的 WAF 会拦 OPTIONS 预检，简单请求可绕开
      fetch(lbApi() + '/api/lb/submit', {
        method: 'POST',
        body: JSON.stringify({ name: lbName(), score: score, floors: floors })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          // 上报成功 → 下次打开选关弹窗时强制刷新一次榜单
          try { localStorage.setItem('dzk3d_lb_dirty', '1'); } catch (_) {}
          if (j.rank) { try { localStorage.setItem('dzk3d_lb_lastrank', String(j.rank)); } catch (_) {} }
        }
      }).catch(function () {});
    } catch (_) {}
  }
  function lbFetchRemote(done) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.timeout = 4000;
      xhr.open('GET', lbApi() + '/api/lb/top?n=20&_=' + Date.now());
      xhr.onload = function () {
        var rows = null;
        try {
          var o = JSON.parse(xhr.responseText);
          var players = o && o.top;
          if (!players && o && o.dreamlo && o.dreamlo.leaderboard) players = o.dreamlo.leaderboard.player;
          if (Array.isArray(players)) {
            rows = players.map(function (p) {
              return {
                name: String(p.name || '?'),
                score: Number(p.score) || 0,
                floors: p.floors != null ? Number(p.floors) || 0 : Number(p.floor) || 0,
              };
            });
            rows.sort(function (a, b) { return b.score - a.score; });
          }
        } catch (_) {}
        if (rows && rows.length) {
          try { localStorage.setItem(LB_CACHE, JSON.stringify(rows)); } catch (_) {}
        }
        done(rows);
      };
      xhr.onerror = xhr.ontimeout = function () { done(null); };
      xhr.send();
    } catch (_) { done(null); }
  }
  function lbRenderRows(listEl, rows, mineName) {
    var html = '';
    if (!rows || !rows.length) {
      html = '<div class="dzk-lb-empty">暂无战绩 · 打一局无尽上榜</div>';
    } else {
      rows.slice(0, 10).forEach(function (r, idx) {
        var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(idx + 1);
        var me = mineName && r.name === mineName ? ' me' : '';
        var sub = r.floors ? ' <span style="opacity:.6;font-weight:600">' + r.floors + '层</span>' : '';
        html += '<div class="dzk-lb-row' + me + '">' +
          '<span class="dzk-lb-rank">' + medal + '</span>' +
          '<span class="dzk-lb-name">' + String(r.name).replace(/[<>&]/g, '') + '</span>' +
          '<span class="dzk-lb-score">' + r.score + ' 分' + sub + '</span></div>';
      });
    }
    listEl.innerHTML = html;
  }
  function renderLeaderboard() {
    var listEl = document.getElementById('dzk-lb-list');
    var mineEl = document.getElementById('dzk-lb-mine');
    if (!listEl) return;
    var mineName = lbName();
    var myBestScore = Number(localStorage.getItem('dzk3d_lb_bestscore')) || 0;
    var myBestFloor = Number(localStorage.getItem('dzk3d_endless_best')) || 0;
    if (mineEl) {
      mineEl.textContent = '我: ' + (myBestScore > 0 ? myBestScore + ' 分' : '—') +
        (myBestFloor > 0 ? ' · ' + myBestFloor + ' 层' : '');
    }
    // 先画缓存/本机榜秒显，再拉远端刷新
    var cache = null;
    try {
      var c = JSON.parse(localStorage.getItem(LB_CACHE));
      if (Array.isArray(c)) cache = c;
    } catch (_) {}
    var local = lbLocalList().slice(0, 10);
    if (cache && cache.length) lbRenderRows(listEl, cache, mineName);
    else if (local.length) lbRenderRows(listEl, local, mineName);
    else lbRenderRows(listEl, null, mineName);
    // 拉取节流：只有「破纪录上传成功」或「距上次拉取满 12 小时」才请求远端，其余用缓存/本机榜
    var dirty = false, lastFetch = 0;
    try {
      dirty = localStorage.getItem('dzk3d_lb_dirty') === '1';
      lastFetch = Number(localStorage.getItem(LB_FETCH_KEY)) || 0;
    } catch (_) {}
    if (dirty || !lastFetch || Date.now() - lastFetch >= LB_FETCH_TTL) {
      try {
        localStorage.setItem(LB_FETCH_KEY, String(Date.now()));
        localStorage.removeItem('dzk3d_lb_dirty');
      } catch (_) {}
      lbFetchRemote(function (rows) {
        if (rows) lbRenderRows(listEl, rows, mineName);
        else if (!cache || !cache.length) lbRenderRows(listEl, local, mineName);
      });
    }
  }
  // 无尽最高层数跟踪：劫持 __dzkEndlessFloor 的写入，>1 时落盘到 localStorage。
  // （引擎在 finishLevel 时 +1、GAME_OVER 时重置为 1，只有这里能在重置前拿到到达层数）
  try {
    var __floor = window.__dzkEndlessFloor || 1;
    Object.defineProperty(window, '__dzkEndlessFloor', {
      configurable: true,
      get: function () { return __floor; },
      set: function (v) {
        __floor = v;
        try {
          if (v > 1) {
            // 局开始时记下"开打前的个人最好成绩/最好分数"，作为破纪录判定基准
            if (__lbSession === 0) {
              __lbPrevBest = Number(localStorage.getItem('dzk3d_endless_best')) || 0;
              __lbPrevScore = Number(localStorage.getItem('dzk3d_lb_bestscore')) || 0;
              __lbBricks = 0;
              lbHookBricks();
            }
            var bestFloor = Number(localStorage.getItem('dzk3d_endless_best')) || 0;
            if (v > bestFloor) localStorage.setItem('dzk3d_endless_best', String(v));
            // 累计本层破坏砖块 = 层开始砖数 - 剩余砖数（setter 时下一层尚未加载）
            try {
              var bl = window.__webglInstance.$webgl.game.blocks;
              var rem = bl.breakableInstances ? bl.breakableInstances.size : -1;
              if (__lbLevelStart >= 0 && rem >= 0) __lbBricks += Math.max(0, __lbLevelStart - rem);
            } catch (_) {}
            __lbLevelStart = -1;
            lbSnapshotLevelStart(); // 下一层加载完成后重新快照
            __lbSession = Math.max(__lbSession, v);
          } else if (v === 1 && (__lbSession > 0 || __lbBricks > 0)) {
            // 单局结束（层数被重置）：先把最后一层的破坏数累计完
            try {
              var bl2 = window.__webglInstance.$webgl.game.blocks;
              var rem2 = bl2.breakableInstances ? bl2.breakableInstances.size : -1;
              if (__lbLevelStart >= 0 && rem2 >= 0) __lbBricks += Math.max(0, __lbLevelStart - rem2);
            } catch (_) {}
            __lbLevelStart = -1;
            // 最终成绩 = 破坏砖块数 × 0.1 × 到达层数（死在第 1 层也算到达 1 层）
            var floorsReached = Math.max(__lbSession, 1);
            var finalScore = Math.round(__lbBricks * 0.1 * floorsReached);
            var brokeRecord = finalScore >= 1 && finalScore > __lbPrevScore;
            if (finalScore >= 1) {
              lbAddLocal(finalScore, floorsReached);
              // 本机最高分每次都更新；**只有打破个人最好分数才上传**（首局无历史，视为破纪录）
              try {
                if (brokeRecord) localStorage.setItem('dzk3d_lb_bestscore', String(finalScore));
              } catch (_) {}
              __lbPrevScore = Math.max(__lbPrevScore, finalScore);
              __lbPrevBest = Math.max(__lbPrevBest, __lbSession);
              if (brokeRecord) {
                lbSubmit(finalScore, floorsReached);
                try { localStorage.setItem('dzk3d_lb_lastsubmit', String(finalScore)); } catch (_) {}
              }
            }
            __lbBricks = 0;
            __lbSession = 0;
          }
        } catch (_) {}
      }
    });
  } catch (_) {}
  window.__dzkEndlessMode = window.__dzkEndlessMode || false;

  // ===== 作弊设置：特殊效果时长 + 出现频率 =====
  // 引擎 bonuses 系统共 6 种效果（id 见 webgl.js rx() 调用）：
  //   scalability=加长挡板, futureproof=护盾, simultaneity=多球(无限时长),
  //   power=激光, prebuilt=火力, mods=彩虹。每种默认时长 10 秒（cooldown=1e4）。
  var CHEAT_EFFECTS = [
    { id: 'scalability',  name: '加长挡板' },
    { id: 'futureproof',  name: '护盾' },
    { id: 'simultaneity', name: '多球(无限)' },
    { id: 'power',        name: '激光' },
    { id: 'prebuilt',     name: '火力' },
    { id: 'mods',         name: '彩虹' }
  ];
  var CHEAT_KEY = 'dzk3d_cheat';
  function loadCheat() {
    // dur 为单一数值（所有效果统一时长倍率）；lives 限 1-6；scoreMul 分数倍率；ballSpeedMul 小球速度倍率。
    // autoStick 终极作弊：小球落回挡板自动粘住，点击再弹出（Worker physics.autoStick）。
    var def = { freqMul: 1, dur: 1, lives: 3, scoreMul: 1, ballSpeedMul: 1, autoStick: false };
    try {
      var raw = localStorage.getItem(CHEAT_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (typeof o.freqMul === 'number') def.freqMul = o.freqMul;
        // 兼容旧数据：旧版 dur 是对象，新版本忽略它（回退到默认 1）
        if (typeof o.dur === 'number') def.dur = o.dur;
        if (typeof o.lives === 'number') def.lives = Math.min(6, Math.max(1, Math.round(o.lives)));
        if (typeof o.scoreMul === 'number') def.scoreMul = o.scoreMul;
        if (typeof o.ballSpeedMul === 'number') def.ballSpeedMul = Math.min(3, Math.max(0.1, o.ballSpeedMul));
        if (typeof o.autoStick === 'boolean') def.autoStick = o.autoStick;
      }
    } catch (e) {}
    return def;
  }
  function saveCheat() {
    try { localStorage.setItem(CHEAT_KEY, JSON.stringify(window.__dzkCheat)); } catch (e) {}
  }
  window.__dzkCheat = loadCheat();
  // ===== 小球效果设置：仅保留原版 6 种效果（名称与描述取自游戏原版数据）=====
  // 引擎 d()（webgl.js bonus 选择器）实时读取本对象：enabled===false 的类型永不掉落，
  // weight 量化(×4)放入轮转队列控制相对出现概率。默认全部启用、权重 1。
  // 注意：id 必须与引擎 nx() 注册的 bonus 完全一致。
  var BONUS_SETTING_IDS = [
    'scalability', 'futureproof', 'simultaneity', 'power', 'prebuilt', 'mods'
  ];
  var BONUS_SETTING_NAMES = {
    scalability: '輕鬆升級', futureproof: '未來之盾', simultaneity: '同時進行',
    power: '強大效能', prebuilt: '戰鬥就緒', mods: '個性化'
  };
  // 原版效果描述（游戏 intro「6 個 bonus 提升你的遊戲」页文案）
  var BONUS_SETTING_DESCS = {
    scalability:  '短板加長',
    futureproof:  '全面防護',
    simultaneity: '球數加倍',
    power:        '太空雷射光束',
    prebuilt:     '火球攻擊',
    mods:         '炫彩霓虹'
  };
  // 此前自行扩展的 4 种效果已下架：不再进设置面板，但保留设置项并强制停用——
  // 引擎选择器对"无设置对象"的效果默认放行，必须显式 enabled:false 才能确保永不掉落。
  var BONUS_REMOVED_IDS = ['split', 'sticky', 'extralife', 'explode'];
  var BONUS_SETTINGS_KEY = 'dzk3d_bonus_settings';
  function defaultBonusSettings() {
    var o = {};
    BONUS_SETTING_IDS.forEach(function (id) { o[id] = { enabled: true, weight: 1 }; });
    // 已下架效果强制停用（含老存档迁移：loadBonusSettings 只读 6 个在册 id 的覆盖值）
    BONUS_REMOVED_IDS.forEach(function (id) { o[id] = { enabled: false, weight: 0 }; });
    return o;
  }
  function loadBonusSettings() {
    var def = defaultBonusSettings();
    try {
      var raw = localStorage.getItem(BONUS_SETTINGS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        BONUS_SETTING_IDS.forEach(function (id) {
          if (saved[id]) {
            if (saved[id].enabled === false) def[id].enabled = false;
            if (typeof saved[id].weight === 'number') {
              def[id].weight = Math.min(3, Math.max(0, saved[id].weight));
            }
          }
        });
      }
    } catch (e) {}
    return def;
  }
  function saveBonusSettings() {
    try { localStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(window.__dzkBonusSettings)); } catch (e) {}
    window.__dzkBonusVer = (window.__dzkBonusVer || 0) + 1; // 通知引擎：候选池立即按新开关/权重重建
  }
  window.__dzkBonusSettings = loadBonusSettings();
  // 包住某个 store 的 set 方法：scoreMul>1 时把「增量」放大相应倍数。
  // set 是绝对赋值（score.set(score.value+delta)），用 prev 还原增量，避免影响重置(0)。
  function wrapStoreSet(store, mulKey) {
    if (!store || store.__dzkWrapped) return;
    var origSet = store.set;
    store.set = function (val) {
      var mul = (window.__dzkCheat && window.__dzkCheat[mulKey]) || 1;
      if (mul === 1) return origSet.call(this, val);
      var prev = this.value;
      var delta = val - prev;
      if (delta <= 0) return origSet.call(this, val); // 重置或不变，原样透传
      return origSet.call(this, prev + Math.round(delta * mul));
    };
    store.__dzkWrapped = true;
  }
  // 命数作弊：设置当前命数与 MAX_LIFE，并包住 game.reset（其内部会把命数写死成 3），
  // 让开新局/复活后命数也强制为作弊值。
  function applyLivesToEngine() {
    try {
      var inst = window.__webglInstance;
      var g = inst && inst.$webgl && inst.$webgl.game;
      if (!g) return;
      var n = Math.min(6, Math.max(1, window.__dzkCheat.lives || 3));
      g.MAX_LIFE = n;
      if (g.life && g.life.set) g.life.set(n);
      // 包住 game.reset（其内部会把命数写死成 3），开新局/复活后命数强制为作弊值
      if (g.reset && !g.reset.__dzkWrapped) {
        var origReset = g.reset;
        g.reset = function () {
          var r = origReset.apply(this, arguments);
          var m = Math.min(6, Math.max(1, window.__dzkCheat.lives || 3));
          this.MAX_LIFE = m;
          if (this.life && this.life.set) this.life.set(m);
          return r;
        };
        g.reset.__dzkWrapped = true;
      }
      // 包住 setState：每次进入 START_GAME（开新关/复活）都把命数刷成作弊值，
      // 兜底引擎内部任何把命数写死成 3 的复位路径。
      // 注意：g.states 可能在首次调用本函数时尚未初始化完，故包装时不强依赖它，
      // 真正的 START_GAME 匹配放到函数内部（那时 this.states 必然已就绪）。
      if (g.setState && !g.setState.__dzkWrapped) {
        var origSetState = g.setState;
        g.setState = function (state) {
          var r = origSetState.apply(this, arguments);
          try {
            if (this.states && state === this.states.START_GAME) {
              var m = Math.min(6, Math.max(1, window.__dzkCheat.lives || 3));
              this.MAX_LIFE = m;
              if (this.life && this.life.set) this.life.set(m);
            }
          } catch (e2) {}
          return r;
        };
        g.setState.__dzkWrapped = true;
      }
    } catch (e) {}
  }
  // 把作弊配置实时应用到引擎：统一时长（包每个效果 update 缩放 dt）、分数倍率（包 score store）、命数。
  // 频率由引擎 p() 内的 window.__dzkCheat.freqMul 实时读取，无需在此处理。
  function applyCheatToEngine() {
    try {
      var inst = window.__webglInstance;
      var g = inst && inst.$webgl && inst.$webgl.game;
      if (!g) return;
      // ---- 统一时长：所有效果用同一个倍率 ----
      var bonuses = g.bonuses;
      if (bonuses && bonuses.list) {
        Object.keys(bonuses.list).forEach(function (id) {
          var h = bonuses.list[id];
          if (!h || h.__dzkWrapped) return;
          var orig = h.update;
          h.update = function (dt) {
            var mul = (window.__dzkCheat && window.__dzkCheat.dur) || 1;
            return orig.call(this, dt / mul);
          };
          h.__dzkWrapped = true;
        });
      }
      // ---- 分数倍率：包 score store ----
      wrapStoreSet(g.score, 'scoreMul');
      try {
        var sceneScore = inst.$webgl.scene && inst.$webgl.scene.score;
        if (sceneScore && sceneScore !== g.score) wrapStoreSet(sceneScore, 'scoreMul');
      } catch (e) {}
      // ---- 命数 ----
      applyLivesToEngine();
      // ---- 小球速度：跨线程传给 PhysicsWorker（Worker 无 window，需走 setConfiguration 通道）----
      applyBallSpeedToEngine(g);
      // ---- 终极作弊·自动吸附：同通道发给 Worker ----
      applyAutoStickToEngine();
      // ---- 频率：同屏允许的效果球上限随频率提高（否则并发=1 限制下频率调节视觉无感）----
      applyFreqToEngine();
    } catch (e) {}
  }

  // 频率倍率：除 k 倍率外，放宽同屏效果球上限，让高频率时效果出现明显更密。
  function applyFreqToEngine() {
    try {
      var f = (window.__dzkCheat && window.__dzkCheat.freqMul) || 1;
      // 1× → 同屏 1 个；5× → 同屏最多 5 个；中间线性
      window.__dzkMaxBonusOnField = Math.min(5, Math.max(1, Math.round(f)));
    } catch (e) {}
  }

  // 球速倍率必须发到 Worker 线程（Worker 不共享主线程 window/变量），
  // 引擎 physics.setConfiguration 会把它复制到 Worker 的 physics 实例上。
  // 注意物理实例挂在 webgl.physics（不是 game.physics）。
  function applyBallSpeedToEngine(g) {
    try {
      var inst = window.__webglInstance;
      var phys = inst && inst.$webgl && inst.$webgl.physics;
      if (!phys || !phys.setConfiguration) return;
      var mul = (window.__dzkCheat && window.__dzkCheat.ballSpeedMul) || 1;
      phys.setConfiguration({ ballSpeedMul: mul });
    } catch (e) {}
  }

  // 终极作弊·自动吸附：把开关发给 Worker（physics.autoStick，黏板判定处 OR 注入）。
  // 同时包裹代理的 setConfiguration：引擎每次关卡加载都会重发关卡尺寸配置，
  // 包裹后强制携带当前 autoStick 值，否则关卡切换会把开关"冲掉"（之前"后几个球失灵"的根因）。
  // 注意：不要在这里按 isRunning 门控——关卡加载发生在开局倒计时里（isRunning=false），
  // 门控会把 false 注入整关。过渡期的安全由 Worker 端"场上有方块才兜底"守卫保证。
  function applyAutoStickToEngine() {
    try {
      var inst = window.__webglInstance;
      var phys = inst && inst.$webgl && inst.$webgl.physics;
      if (!phys || !phys.setConfiguration) return;
      if (!phys.__dzkCfgWrapped) {
        var orig = phys.setConfiguration;
        phys.setConfiguration = function (t) {
          t = t || {};
          t.autoStick = !!(window.__dzkCheat && window.__dzkCheat.autoStick);
          return orig.call(this, t);
        };
        phys.__dzkCfgWrapped = true;
      }
      phys.setConfiguration({ autoStick: !!(window.__dzkCheat && window.__dzkCheat.autoStick) });
    } catch (e) {}
  }

  // ===== 自动吸附自愈：页面刷新后开关即使是开着的，Worker 也无从得知（只有点击
  // 开关才会通知）。物理代理就绪后立即安装 setConfiguration 包裹并同步开关值，
  // 之后引擎每次关卡加载都会自动携带 autoStick，杜绝一切"刷新后/几关后失灵"。
  function startCatchAssist() {
    setInterval(function () {
      try {
        // 手机端游戏内让位 HUD：给 <html> 打/摘 dzk-in-game 类(样式见 index.html 手机端媒体块)
        document.documentElement.classList.toggle('dzk-in-game', !!document.querySelector('.page.page-game'));
        if (!window.__dzkCheat) return;
        var inst = window.__webglInstance;
        if (!inst || !inst.$webgl) return;
        var phys = inst.$webgl.physics;
        if (phys && phys.setConfiguration && !phys.__dzkCfgWrapped) applyAutoStickToEngine();
        lbHookBricks(); // 无尽成绩：破坏砖块计数钩子（游戏对象就绪后一次性安装）
      } catch (e) {}
    }, 120);
  }

  // ===== 无尽公平模式：进无尽时临时套用原始参数并锁定设置页，退回普通关卡后恢复 =====
  // 用户配置只存在 localStorage，这里在内存里换入/换出原始快照，不落盘、不丢配置。
  var fairStash = null; // 进入无尽前的用户设置快照（内存）
  function enterFairMode() {
    if (!window.__dzkFairMode) {
      fairStash = {
        cheat: JSON.parse(JSON.stringify(window.__dzkCheat)),
        bonus: JSON.parse(JSON.stringify(window.__dzkBonusSettings))
      };
    }
    window.__dzkFairMode = true;
    var v = vanillaSnapshot();
    window.__dzkCheat = v.cheat;
    window.__dzkBonusSettings = v.bonus;
    applyCheatToEngine(); // 命数/球速/频率/时长立即回到原始值
    window.__dzkBonusVer = (window.__dzkBonusVer || 0) + 1;
    updateFairLockUI();
  }
  function exitFairMode() {
    if (!window.__dzkFairMode) return;
    window.__dzkFairMode = false;
    if (fairStash) {
      window.__dzkCheat = fairStash.cheat;
      window.__dzkBonusSettings = fairStash.bonus;
      fairStash = null;
    } else {
      // 理论兜底：直接从 localStorage 恢复
      window.__dzkCheat = loadCheat();
      window.__dzkBonusSettings = loadBonusSettings();
    }
    applyCheatToEngine();
    window.__dzkBonusVer = (window.__dzkBonusVer || 0) + 1;
    updateFairLockUI();
  }
  function vanillaSnapshot() {
    return {
      cheat: { freqMul: 1, dur: 1, lives: 3, scoreMul: 1, ballSpeedMul: 1, autoStick: false },
      bonus: defaultBonusSettings()
    };
  }
  function updateFairLockUI() {
    var on = !!window.__dzkFairMode;
    var pane = document.getElementById('dzk-pane-settings');
    var notice = document.getElementById('dzk-fair-notice');
    var badge = document.getElementById('dzk-endless-fair');
    if (pane) pane.classList.toggle('fair-locked', on);
    if (notice) notice.style.display = on ? 'block' : 'none';
    // 公平模式徽章常驻：进行中显示"已锁定"，未进入显示"将锁定"
    if (badge) {
      badge.style.display = 'block';
      badge.textContent = on ? '🔒 公平模式进行中 · 全部参数已锁定为原始值' : '🔒 公平模式 · 进入后全部参数将锁定为原始值';
    }
  }

  var LEVELS = [
    { name: "arrow", diff: 3 }, { name: "chess", diff: 3 }, { name: "circle", diff: 4 },
    { name: "diamond", diff: 2 }, { name: "drop", diff: 2 }, { name: "face", diff: 1 },
    { name: "gamepad", diff: 3 }, { name: "home1", diff: 0 }, { name: "home2", diff: 0 },
    { name: "hugo", diff: 3 }, { name: "invader", diff: 1 }, { name: "joystick", diff: 2 },
    { name: "laby", diff: 4 }, { name: "matches", diff: 4 }, { name: "michel", diff: 1 },
    { name: "msint", diff: 0 }, { name: "pocket", diff: 4 }, { name: "rainbow", diff: 1 },
    { name: "shield", diff: 2 }, { name: "spceship", diff: 1 }, { name: "stars", diff: 2 },
    { name: "trap", diff: 2 }, { name: "trident", diff: 3 }, { name: "umbrella", diff: 3 },
    { name: "wallalt", diff: 4 }, { name: "wallppr", diff: 4 }, { name: "walls", diff: 3 },
    { name: "r01", diff: 0 }, { name: "r02", diff: 0 }, { name: "r03", diff: 0 },
    { name: "r11", diff: 1 }, { name: "r12", diff: 1 }, { name: "r13", diff: 1 },
    { name: "r21", diff: 2 }, { name: "r22", diff: 2 }, { name: "r23", diff: 2 },
    { name: "r31", diff: 3 }, { name: "r32", diff: 3 }, { name: "r33", diff: 3 },
    { name: "r41", diff: 4 }, { name: "r42", diff: 4 }, { name: "r43", diff: 4 },
    { name: "dzkst1", diff: 0 }, { name: "dzkrg1", diff: 0 },
    { name: "dzkzp1", diff: 0 }, { name: "dzktw1", diff: 0 },
    { name: "FULL", diff: 0 },
    // ===== 主题关卡：5 档 × 10 关（图案与名字对应，tools/gen_theme_levels.py 生成）=====
    { name: "square", diff: 0 }, { name: "cross", diff: 0 }, { name: "pyramid", diff: 0 },
    { name: "heart", diff: 0 }, { name: "moon", diff: 0 }, { name: "tree", diff: 0 },
    { name: "flag", diff: 0 }, { name: "stair", diff: 0 }, { name: "dice", diff: 0 },
    { name: "bridge", diff: 0 },
    { name: "cat", diff: 1 }, { name: "fish", diff: 1 }, { name: "boat", diff: 1 },
    { name: "key", diff: 1 }, { name: "cup", diff: 1 }, { name: "kite", diff: 1 },
    { name: "bell", diff: 1 }, { name: "anchor", diff: 1 }, { name: "candle", diff: 1 },
    { name: "hat", diff: 1 },
    { name: "skull", diff: 2 }, { name: "flower", diff: 2 }, { name: "guitar", diff: 2 },
    { name: "rocket", diff: 2 }, { name: "castle", diff: 2 }, { name: "snake", diff: 2 },
    { name: "crown", diff: 2 }, { name: "whale", diff: 2 }, { name: "camera", diff: 2 },
    { name: "mushroom", diff: 2 },
    { name: "dragon", diff: 3 }, { name: "spider", diff: 3 }, { name: "ghost", diff: 3 },
    { name: "sword", diff: 3 }, { name: "tower", diff: 3 }, { name: "scorpion", diff: 3 },
    { name: "phoenix", diff: 3 }, { name: "eagle", diff: 3 }, { name: "wolf", diff: 3 },
    { name: "viking", diff: 3 },
    { name: "tiger", diff: 4 }, { name: "robot", diff: 4 }, { name: "ufo", diff: 4 },
    { name: "crystal", diff: 4 }, { name: "fortress", diff: 4 }, { name: "sun", diff: 4 },
    { name: "pumpkin", diff: 4 }, { name: "owl", diff: 4 }, { name: "cactus", diff: 4 },
    { name: "demon", diff: 4 }
  ];
  var DIFF_NAMES = ['教学', '简单', '普通', '困难', '专家'];
  var DIFF_COLORS = ['#4CD97B', '#51AFFF', '#FFB84D', '#FF7A51', '#FF4D6A'];
  var DIFF_ICONS  = ['🌱', '⭐', '🔥', '⚡', '💀'];
  var levelModal = null;

  // ===== 设置页辅助：滑杆填充比例 / 权重格式化 =====
  // 滑杆轨道用 --pct 变量画彩色填充（CSS 渐变），拖动时同步百分比。
  function paintRange(el) {
    var min = Number(el.min) || 0, max = Number(el.max) || 100;
    var v = Number(el.value);
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--pct', pct.toFixed(2) + '%');
  }
  // 权重显示：1.00 → "1×"，0.25 → "0.25×"，去掉无意义的尾零
  function fmtWeight(w) {
    return Number(w).toFixed(2).replace(/\.?0+$/, '') + '×';
  }

  function bindLevelSelect() {
    // 选关完成后真正（重新）开局的入口。
    // 注意：选关流程必定经过 Home（开弹窗即 Home.onViewEnter 触发），最终由 Home 的
    // push Game 接管并触发引擎 m() 消费 __dzkEndlessMode/__dzkLevel。因此这里只在"确实已在
    // 游戏页内"时才强制 restart，避免与 Home 流程双重跳转。
    window.__dzkRestartLevel = function () {
      try {
        var inst = window.__webglInstance;
        var onGame = inst && inst.$router.currentRoute.value.name === 'Game';
        if (!onGame) return;
        if (window.__dzkEndlessMode) window.__dzkEndlessFloor = 1; // 回到第 1 层
        // 重开前恢复当前关卡：优先内存变量，fallback 读 localStorage，
        // 否则 loadNewLevel 会因 __dzkLevel 已被清空而落到固定默认关 msint。
        if (!window.__dzkEndlessMode) {
          var last = window.__dzkLastLevel || localStorage.getItem('dzk3d_last_level');
          if (last) window.__dzkLevel = last;
        }
        inst.$webgl.game.setState('START_GAME');
      } catch (e) { /* 安全兜底 */ }
    };
    window.addEventListener('dzk3d-request-level-select', function () {
      window.__dzkLevel = null;          // 每次进游戏都强制重新选关
      window.__dzkLevelPending = true;   // 挂起关卡加载，防止后台自动开局
      if (!levelModal) levelModal = buildLevelModal();
      renderLevelModal();
      levelModal.classList.add('open');
    });
    // 关闭弹窗且未选关：清除挂起标志；若正在 Game 局中则恢复游玩
    // （修复：游玩中打开选关又关闭后，游戏停在暂停态不自动继续）
    window.closeLevelModalNoPick = function () {
      if (levelModal) levelModal.classList.remove('open');
      window.__dzkLevelPending = false;
      try {
        var inst = window.__webglInstance;
        if (inst && inst.$router && inst.$router.currentRoute.value.name === 'Game') {
          window.dispatchEvent(new Event('dzk3d-game-play'));
        }
      } catch (e) {}
    };
    window.addEventListener('dzk3d-level-selected', function () {
      window.__dzkLevelPending = false; // 恢复关卡加载
      // 选关完成后恢复游戏（清除暂停），否则 isMenuOpen 残留 true 会让新关卡冻结
      window.dispatchEvent(new Event('dzk3d-game-play'));
      applyCheatToEngine();             // 把作弊时长配置实时包到引擎效果 update 上
      if (levelModal) levelModal.classList.remove('open');
      // 兼容从 Results 页等「非 Game 场景」直接选关：此时没有 Home 路由在 await，
      // 需由这里主动 push 到 Game 才能跳转开局（主菜单选关由 Home onViewEnter 负责，
      // 这里再 push 一次同名路由 Vue Router 会自动忽略，无副作用）。
      try {
        var inst = window.__webglInstance;
        if (inst && inst.$router) inst.$router.push({ name: 'Game' });
      } catch (e) {}
    });
    // Esc 关闭弹窗（与奖杯记录弹窗行为一致）
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && levelModal && levelModal.classList.contains('open')) {
        window.closeLevelModalNoPick();
      }
    });
  }

  function buildLevelModal() {
    var wrap = document.createElement('div');
    wrap.className = 'dzk-level-modal';
    // 作弊设置行（通用 range 行，复用到右侧游戏选项面板）；首行为终极作弊开关
    var cheatRows =
      '    <div class="dzk-ultimate-row">' +
      '      <button type="button" class="dzk-bonus-toggle dzk-ultimate-toggle' + (window.__dzkCheat.autoStick ? ' on' : '') + '" id="dzk-autostick-toggle" aria-pressed="' + (window.__dzkCheat.autoStick ? 'true' : 'false') + '" title="自动吸附开关"></button>' +
      '      <div class="dzk-ultimate-info">' +
      '        <div class="dzk-ultimate-name">终极作弊 · 自动吸附</div>' +
      '        <div class="dzk-ultimate-desc">小球落回挡板自动粘住，点击再弹出（无尽公平模式中强制关闭）</div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dzk-opt-row"><label>出现频率</label><input type="range" id="dzk-cheat-freq" min="0.1" max="5" step="0.1" value="' + window.__dzkCheat.freqMul + '"><span class="dzk-opt-val" id="dzk-cheat-freq-val">' + window.__dzkCheat.freqMul.toFixed(1) + '×</span></div>' +
      '    <div class="dzk-opt-row"><label>统一时长</label><input type="range" id="dzk-cheat-dur" min="0.1" max="5" step="0.1" value="' + window.__dzkCheat.dur + '"><span class="dzk-opt-val" id="dzk-cheat-dur-val">' + (10 * window.__dzkCheat.dur).toFixed(1) + 's</span></div>' +
      '    <div class="dzk-opt-row"><label>生命(条)</label><input type="range" id="dzk-cheat-lives" min="1" max="6" step="1" value="' + window.__dzkCheat.lives + '"><span class="dzk-opt-val" id="dzk-cheat-lives-val">' + window.__dzkCheat.lives + '</span></div>' +
      '    <div class="dzk-opt-row"><label>分数倍率</label><input type="range" id="dzk-cheat-score" min="0.1" max="10" step="0.1" value="' + window.__dzkCheat.scoreMul + '"><span class="dzk-opt-val" id="dzk-cheat-score-val">' + window.__dzkCheat.scoreMul.toFixed(1) + '×</span></div>' +
      '    <div class="dzk-opt-row"><label>小球速度</label><input type="range" id="dzk-cheat-ballspeed" min="0.1" max="5" step="0.1" value="' + window.__dzkCheat.ballSpeedMul + '"><span class="dzk-opt-val" id="dzk-cheat-ballspeed-val">' + window.__dzkCheat.ballSpeedMul.toFixed(1) + '×</span></div>';
    // 小球设置行：每个效果一行，含启用开关 + 概率滑块 + 说明文字
    var bonusRows = '';
    BONUS_SETTING_IDS.forEach(function (id) {
      var st = window.__dzkBonusSettings[id] || { enabled: true, weight: 1 };
      var nm = BONUS_SETTING_NAMES[id] || id;
      var desc = BONUS_SETTING_DESCS[id] || '';
      bonusRows +=
        '<div class="dzk-bonus-row' + (st.enabled ? '' : ' disabled') + '" data-bonus="' + id + '">' +
        '  <div class="dzk-bonus-line">' +
        '    <button type="button" class="dzk-bonus-toggle' + (st.enabled ? ' on' : '') + '" data-bonus="' + id + '" aria-pressed="' + (st.enabled ? 'true' : 'false') + '" title="启用/停用"></button>' +
        '    <span class="dzk-bonus-name">' + nm + '</span>' +
        '    <input type="range" class="dzk-bonus-weight" data-bonus="' + id + '" min="0" max="3" step="0.25" value="' + st.weight + '" aria-label="' + nm + ' 掉落权重">' +
        '    <span class="dzk-bonus-weight-val" data-bonus="' + id + '">' + fmtWeight(st.weight) + '</span>' +
        '  </div>' +
        (desc ? '  <div class="dzk-bonus-desc">' + desc + '</div>' : '') +
        '</div>';
    });
    wrap.innerHTML = [
      '<div class="dzk-level-card">',
      '  <button class="dzk-close" id="dzk-level-close">×</button>',
      '  <h2 id="dzk-level-title">🎮 选择关卡</h2>',
      '  <div class="dzk-tabs" role="tablist">',
      '    <button type="button" class="dzk-tab active" data-tab="levels" role="tab" aria-selected="true">关卡</button>',
      '    <button type="button" class="dzk-tab" data-tab="settings" role="tab" aria-selected="false">设置</button>',
      '  </div>',
      '  <div class="dzk-level-body">',
      '    <div class="dzk-tabpane active" id="dzk-pane-levels">',
      '      <div class="dzk-level-top">',
      '        <div class="dzk-endless-card" id="dzk-endless-card">',
      '          <div class="dzk-endless-info">',
      '            <div class="dzk-endless-title">♾️ 无尽模式</div>',
      '            <div class="dzk-endless-desc">',
      '              <div>· 关卡随机生成，每一次进入都不重样</div>',
      '              <div>· 每 2 层难度提升一档（教学 → 专家），砖更密更高</div>',
      '              <div>· 球速逐渐加快，越往后越考验反应</div>',
      '              <div>· 成绩 = 破坏砖块数 × 0.1 × 层数，破纪录自动上全球榜</div>',
      '            </div>',
      '            <div class="dzk-endless-floor">当前层数 <b id="dzk-endless-floor">1</b></div>',
      '            <div class="dzk-endless-fair" id="dzk-endless-fair">🔒 公平模式 · 进入后全部参数将锁定为原始值</div>',
      '          </div>',
      '          <button class="dzk-endless-btn" id="dzk-endless-btn">开始</button>',
      '        </div>',
      '        <div class="dzk-lb-card" id="dzk-lb-card">',
      '          <div class="dzk-lb-head">',
      '            <span class="dzk-lb-title">🌍 全球排行榜 · 无尽层数</span>',
      '            <span class="dzk-lb-spacer"></span>',
      '            <span class="dzk-lb-mine" id="dzk-lb-mine"></span>',
      '            <button type="button" class="dzk-lb-gear" id="dzk-lb-gear" title="排行榜设置">⚙</button>',
      '          </div>',
      '          <div class="dzk-lb-list" id="dzk-lb-list"></div>',
      '          <div class="dzk-lb-settings" id="dzk-lb-settings" style="display:none">',
      '            <label>昵称<input type="text" id="dzk-lb-name" maxlength="16" placeholder="点击换个名字"></label>',
      '            <div class="dzk-lb-hint">成绩数据保存至作者个人网站，更多软件欢迎前往<a class="dzk-lb-privacy-toggle" href="https://690075.xyz" target="_blank" rel="noopener">访问体验</a>。<a class="dzk-lb-privacy-toggle" id="dzk-lb-privacy-toggle">隐私条款</a></div>',
      '            <div class="dzk-lb-privacy" id="dzk-lb-privacy" style="display:none">收集内容：仅昵称（首次进入自动生成，可修改）、无尽模式到达层数、破坏砖块数、提交时间。<br>成绩算法：破坏砖块数 × 0.1 × 到达层数，按分数排名，层数同时展示。<br>用途：仅用于全球排行榜的展示与排序，不作其他用途。<br>不收集：邮箱、手机号、账号密码等任何身份信息。<br>IP 处理：为防刷屏，服务器以 IP 做短期（约 10 分钟）提交频率限制，不公开显示、不与榜单长期关联。<br>拉取频率：榜单数据每 12 小时自动刷新一次；打破个人纪录上传成功后立即刷新一次。<br>存储位置：Cloudflare Workers KV（全球边缘节点）；本机最高分与战绩存于浏览器本地，清除浏览器数据即删除。<br>想更换榜单身份：改昵称即可；需要删除榜单条目请联系站点管理员。</div>',
      '            <div class="dzk-lb-actions">',
      '              <button type="button" class="dzk-lb-save" id="dzk-lb-save">保存</button>',
      '              <button type="button" class="dzk-lb-close" id="dzk-lb-close">收起</button>',
      '            </div>',
      '          </div>',
      '        </div>',
      '        <div class="dzk-stats-card" id="dzk-stats-card">',
      '          <div class="dzk-stats-section">',
      '            <div class="dzk-stats-title">📊 关卡数据</div>',
      '            <div class="dzk-stats-levels" id="dzk-stats-levels"></div>',
      '          </div>',
      '          <div class="dzk-stats-section">',
      '            <div class="dzk-stats-title">🎮 游玩数据</div>',
      '            <div class="dzk-stats-play" id="dzk-stats-play"></div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div class="dzk-level-groups" id="dzk-level-groups"></div>',
      '    </div>',
      '    <div class="dzk-tabpane" id="dzk-pane-settings">',
      '      <div class="dzk-fair-notice" id="dzk-fair-notice" style="display:none">🔒 无尽模式进行中：全部选项已锁定为原始模式，保证分数公平</div>',
      '      <div class="dzk-settings-grid">',
      '        <div class="dzk-settings-col col-params">',
      '          <div class="dzk-settings-head"><span class="dzk-settings-title">游戏参数</span><span class="dzk-settings-hint">实时生效 · 本地保存</span></div>',
      cheatRows,
      '          <div class="dzk-param-tips">',
      '            <div class="dzk-param-tip"><b>出现频率</b>效果球掉得更勤，同屏上限同步放宽</div>',
      '            <div class="dzk-param-tip"><b>统一时长</b>所有效果的持续时间（多球不限时）</div>',
      '            <div class="dzk-param-tip"><b>生命</b>每局初始命数，上限 6 条</div>',
      '            <div class="dzk-param-tip"><b>分数倍率</b>得分放大，冲纪录更爽</div>',
      '            <div class="dzk-param-tip"><b>小球速度</b>球速越快越刺激</div>',
      '          </div>',
      '        </div>',
      '        <div class="dzk-settings-col col-bonus">',
      '          <div class="dzk-settings-head"><span class="dzk-settings-title">小球效果</span><span class="dzk-settings-hint">开关 × 权重（0 = 不掉落）</span></div>',
      '          <div class="dzk-bonus-list" id="dzk-bonus-list">',
      bonusRows,
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div class="dzk-settings-footer"><button type="button" class="dzk-opt-reset" id="dzk-opt-reset">↺ 恢复默认设置</button></div>',
      '      <p class="dzk-storage-line" id="dzk-storage-line"></p>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    var storageLine = document.getElementById('dzk-storage-line');
    if (storageLine) {
      if (storageState.ok) storageLine.innerHTML = '💾 本地存储：正常（' + location.host + '）';
      else storageLine.innerHTML = '⚠ 本地存储：不可用 — 设置与成绩无法保存，请改用「在新标签页中打开」';
    }
    // ===== 终极作弊·自动吸附开关 =====
    var autoStickBtn = wrap.querySelector('#dzk-autostick-toggle');
    autoStickBtn.addEventListener('click', function () {
      window.__dzkCheat.autoStick = !window.__dzkCheat.autoStick;
      autoStickBtn.classList.toggle('on', window.__dzkCheat.autoStick);
      autoStickBtn.setAttribute('aria-pressed', window.__dzkCheat.autoStick ? 'true' : 'false');
      saveCheat();
      applyAutoStickToEngine(); // 立即发到 Worker，下一颗球生效
    });
    // ===== 滑杆填充：委托监听 input，统一刷新 --pct 填充比例 =====
    wrap.addEventListener('input', function (e) {
      if (e.target && e.target.type === 'range') paintRange(e.target);
    });
    wrap.querySelectorAll('input[type=range]').forEach(paintRange);
    // ===== 作弊面板：出现频率 / 统一时长 / 生命 / 分数倍率（已整合到右侧游戏选项）=====
    var freqInput = wrap.querySelector('#dzk-cheat-freq');
    var freqVal = wrap.querySelector('#dzk-cheat-freq-val');
    freqInput.addEventListener('input', function () {
      window.__dzkCheat.freqMul = Number(freqInput.value);
      freqVal.textContent = window.__dzkCheat.freqMul.toFixed(1) + '×';
      saveCheat();
      applyFreqToEngine(); // 实时放宽同屏效果球上限，立刻生效
    });
    var durInput = wrap.querySelector('#dzk-cheat-dur');
    var durVal = wrap.querySelector('#dzk-cheat-dur-val');
    durInput.addEventListener('input', function () {
      window.__dzkCheat.dur = Number(durInput.value);
      durVal.textContent = (10 * window.__dzkCheat.dur).toFixed(1) + 's';
      saveCheat();
    });
    var livesInput = wrap.querySelector('#dzk-cheat-lives');
    var livesVal = wrap.querySelector('#dzk-cheat-lives-val');
    livesInput.addEventListener('input', function () {
      window.__dzkCheat.lives = Number(livesInput.value);
      livesVal.textContent = window.__dzkCheat.lives;
      saveCheat();
      applyLivesToEngine(); // 立即生效：当前命数也一并改
    });
    var scoreInput = wrap.querySelector('#dzk-cheat-score');
    var scoreVal = wrap.querySelector('#dzk-cheat-score-val');
    scoreInput.addEventListener('input', function () {
      window.__dzkCheat.scoreMul = Number(scoreInput.value);
      scoreVal.textContent = window.__dzkCheat.scoreMul.toFixed(1) + '×';
      saveCheat();
    });
    var ballSpeedInput = wrap.querySelector('#dzk-cheat-ballspeed');
    var ballSpeedVal = wrap.querySelector('#dzk-cheat-ballspeed-val');
    ballSpeedInput.addEventListener('input', function () {
      window.__dzkCheat.ballSpeedMul = Number(ballSpeedInput.value);
      ballSpeedVal.textContent = window.__dzkCheat.ballSpeedMul.toFixed(1) + '×';
      saveCheat();
      applyBallSpeedToEngine(); // 实时发给 Worker，立即改变球速
    });
    // ===== 小球效果设置：启用开关 + 概率滑块（实时写入 window.__dzkBonusSettings）=====
    wrap.querySelectorAll('.dzk-bonus-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-bonus');
        var st = window.__dzkBonusSettings[id];
        if (!st) return;
        st.enabled = !st.enabled;
        btn.classList.toggle('on', st.enabled);
        btn.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
        btn.closest('.dzk-bonus-row').classList.toggle('disabled', !st.enabled);
        saveBonusSettings();
      });
    });
    wrap.querySelectorAll('.dzk-bonus-weight').forEach(function (range) {
      range.addEventListener('input', function () {
        var id = range.getAttribute('data-bonus');
        var st = window.__dzkBonusSettings[id];
        if (!st) return;
        st.weight = Number(range.value);
        var val = wrap.querySelector('.dzk-bonus-weight-val[data-bonus="' + id + '"]');
        if (val) val.textContent = fmtWeight(st.weight);
        saveBonusSettings();
      });
    });
    // ===== 设置页 UI 与状态同步（恢复默认时调用）=====
    function syncSettingsUI() {
      var c = window.__dzkCheat;
      // 终极作弊开关
      var asBtn = wrap.querySelector('#dzk-autostick-toggle');
      if (asBtn) {
        asBtn.classList.toggle('on', !!c.autoStick);
        asBtn.setAttribute('aria-pressed', c.autoStick ? 'true' : 'false');
      }
      var fmtMap = [
        ['dzk-cheat-freq', 'freqMul', function (v) { return v.toFixed(1) + '×'; }],
        ['dzk-cheat-dur', 'dur', function (v) { return (10 * v).toFixed(1) + 's'; }],
        ['dzk-cheat-lives', 'lives', function (v) { return String(v); }],
        ['dzk-cheat-score', 'scoreMul', function (v) { return v.toFixed(1) + '×'; }],
        ['dzk-cheat-ballspeed', 'ballSpeedMul', function (v) { return v.toFixed(1) + '×'; }]
      ];
      fmtMap.forEach(function (m) {
        var input = wrap.querySelector('#' + m[0]);
        if (!input) return;
        input.value = c[m[1]];
        paintRange(input);
        var val = wrap.querySelector('#' + m[0] + '-val');
        if (val) val.textContent = m[2](Number(c[m[1]]));
      });
      BONUS_SETTING_IDS.forEach(function (id) {
        var st = window.__dzkBonusSettings[id] || { enabled: true, weight: 1 };
        var row = wrap.querySelector('.dzk-bonus-row[data-bonus="' + id + '"]');
        if (!row) return;
        var tgl = row.querySelector('.dzk-bonus-toggle');
        var rng = row.querySelector('.dzk-bonus-weight');
        var val = row.querySelector('.dzk-bonus-weight-val');
        if (tgl) {
          tgl.classList.toggle('on', !!st.enabled);
          tgl.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
        }
        row.classList.toggle('disabled', !st.enabled);
        if (rng) { rng.value = st.weight; paintRange(rng); }
        if (val) val.textContent = fmtWeight(st.weight);
      });
    }
    // ===== 选项卡切换（关卡 / 设置）=====
    var TAB_TITLES = { levels: '🎮 选择关卡', settings: '⚙️ 游戏设置' };
    var titleEl = wrap.querySelector('#dzk-level-title');
    wrap.querySelectorAll('.dzk-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-tab');
        wrap.querySelectorAll('.dzk-tab').forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        wrap.querySelectorAll('.dzk-tabpane').forEach(function (p) {
          p.classList.toggle('active', p.id === 'dzk-pane-' + name);
        });
        if (titleEl && TAB_TITLES[name]) titleEl.textContent = TAB_TITLES[name];
      });
    });
    // ===== 恢复默认：游戏参数 + 小球效果一键重置并回写 UI =====
    wrap.querySelector('#dzk-opt-reset').addEventListener('click', function () {
      window.__dzkCheat = { freqMul: 1, dur: 1, lives: 3, scoreMul: 1, ballSpeedMul: 1, autoStick: false };
      saveCheat();
      applyCheatToEngine(); // 包裹函数有 __dzkWrapped 防重入，可安全重复应用
      window.__dzkBonusSettings = defaultBonusSettings();
      saveBonusSettings();
      syncSettingsUI();
    });
    // ===== 无尽模式按钮（独立卡 #dzk-endless-btn）=====
    var endlessBtn = wrap.querySelector('#dzk-endless-btn');
    if (endlessBtn) {
      endlessBtn.addEventListener('click', function () {
        window.__dzkEndlessMode = true;
        enterFairMode();                     // 公平模式：全部选项临时切回原始值并锁定设置
        window.__dzkDecompress = false;      // 退出 AI 挡板(默认关闭)
        window.__dzkEndlessFloor = 1;        // 每次进入无尽都从第 1 层开始
        window.__dzkEndlessSeed = ((Math.random() * 0xFFFFFFFF) >>> 0) || 1;
        window.__dzkLevel = null;
        window.dispatchEvent(new Event('dzk3d-level-selected'));
        if (window.__dzkRestartLevel) window.__dzkRestartLevel();
      });
    }
    // ===== 排行榜设置（⚙ 弹出面板）=====
    var lbGear = wrap.querySelector('#dzk-lb-gear');
    var lbSettings = wrap.querySelector('#dzk-lb-settings');
    if (lbGear && lbSettings) {
      var lbNameInput = wrap.querySelector('#dzk-lb-name');
      lbGear.addEventListener('click', function () {
        lbNameInput.value = lbName();
        lbSettings.style.display = lbSettings.style.display === 'none' ? 'flex' : 'none';
      });
      wrap.querySelector('#dzk-lb-close').addEventListener('click', function () {
        lbSettings.style.display = 'none';
      });
      var lbPrivacy = wrap.querySelector('#dzk-lb-privacy');
      wrap.querySelector('#dzk-lb-privacy-toggle').addEventListener('click', function () {
        if (lbPrivacy) lbPrivacy.style.display = lbPrivacy.style.display === 'none' ? 'block' : 'none';
      });
      wrap.querySelector('#dzk-lb-save').addEventListener('click', function () {
        lbSaveCfg({
          name: lbNameInput.value.trim() || lbRandomName(),
          api: lbApi() // 服务器地址内置，仅保留 localStorage 覆盖能力
        });
        lbSettings.style.display = 'none';
        renderLeaderboard(); // 立即按新配置刷新（接上远端 / 回到本机榜）
      });
    }
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.id === 'dzk-level-close') window.closeLevelModalNoPick();
    });
    return wrap;
  }

  // ===== 数据卡：关卡数据（难度分布）+ 游玩数据（最高分/局数/无尽层数/上次关卡）=====
  function renderStatsCard() {
    var lvEl = document.getElementById('dzk-stats-levels');
    if (!lvEl) return;
    // 关卡数据：按难度分组的彩色徽章
    var groups = [[], [], [], [], []];
    LEVELS.forEach(function (lv) { groups[lv.diff].push(lv); });
    var chips = '';
    for (var d = 0; d < 5; d++) {
      if (!groups[d].length) continue;
      chips += '<span class="dzk-stat-chip" style="color:' + DIFF_COLORS[d] + '"><i>' + DIFF_ICONS[d] + '</i>' + DIFF_NAMES[d] + ' <b>' + groups[d].length + '</b></span>';
    }
    chips += '<span class="dzk-stat-chip dzk-stat-chip-total">共 <b>' + LEVELS.length + '</b> 关</span>';
    lvEl.innerHTML = chips;
    // 游玩数据：读本地记录（records 由引擎追加，封顶 50 局）
    var recs = [];
    try {
      var raw = localStorage.getItem('dzk3d_records');
      if (raw) {
        var p = JSON.parse(raw);
        if (Array.isArray(p)) recs = p.filter(function (x) { return x && typeof x.score === 'number'; });
      }
    } catch (_) {}
    var best = getBest();
    var lastLevel = localStorage.getItem('dzk3d_last_level');
    var lastCn = lastLevel ? (LEVEL_NAMES_CN[lastLevel] || lastLevel) : '—';
    var eBest = Number(localStorage.getItem('dzk3d_endless_best')) || 0;
    var items = [
      ['🏆 历史最高', best > 0 ? fmt(best) : '暂无'],
      ['🎮 游玩局数', recs.length ? (recs.length >= 50 ? '50+' : String(recs.length)) : '0'],
      ['♾️ 最高层数', eBest > 0 ? eBest + ' 层' : '—'],
      ['📌 上次关卡', lastCn]
    ];
    var playEl = document.getElementById('dzk-stats-play');
    if (playEl) {
      playEl.innerHTML = items.map(function (it) {
        return '<div class="dzk-stat-item"><span class="dzk-stat-k">' + it[0] + '</span><span class="dzk-stat-v">' + it[1] + '</span></div>';
      }).join('');
    }
  }

  function renderLevelModal() {
    var groupsEl = document.getElementById('dzk-level-groups');
    if (!groupsEl) return;
    renderStatsCard();
    renderLeaderboard(); // 每次打开弹窗刷新排行榜（缓存秒显 + 远端异步刷新）
    updateFairLockUI(); // 打开弹窗时同步公平模式锁定状态
    var groups = [[], [], [], [], []];
    LEVELS.forEach(function (lv) { groups[lv.diff].push(lv); });
    var html = '';
    // 无尽模式卡片已固定在 buildLevelModal 顶部（#dzk-endless-card），此处只同步层数
    var curFloor = window.__dzkEndlessFloor || 1;
    var curDiffName = DIFF_NAMES[endlessDifficulty(curFloor)];
    var floorEl = document.getElementById('dzk-endless-floor');
    if (floorEl) floorEl.textContent = curFloor + ' 层 · ' + curDiffName;
    // ===== 固定关卡（按难度分组） =====
    for (var d = 0; d < 5; d++) {
      if (!groups[d].length) continue;
      html += '<div class="dzk-level-group" data-diff="' + d + '">' +
        '<div class="dzk-level-diff" style="border-color:' + DIFF_COLORS[d] + ';color:' + DIFF_COLORS[d] + '">' +
        '<span class="dzk-level-diff-icon" aria-hidden="true">' + DIFF_ICONS[d] + '</span>' +
        DIFF_NAMES[d] +
        '<span class="dzk-level-diff-count">' + groups[d].length + ' 关</span></div>' +
        '<div class="dzk-level-list">';
      groups[d].forEach(function (lv, idx) {
        var cn = LEVEL_NAMES_CN[lv.name] || lv.name;
        var last = (localStorage.getItem('dzk3d_last_level') === lv.name) ? ' dzk-level-btn-last' : '';
        html += '<button class="dzk-level-btn' + last + '" data-level="' + lv.name + '" data-name-cn="' + cn + '" data-name-en="' + lv.name + '">' +
          '<span class="dzk-level-num">' + (idx + 1) + '</span>' +
          '<span class="dzk-level-name">' + cn + '</span>' +
          '<span class="dzk-level-en">' + lv.name + '</span>' +
          '</button>';
      });
      html += '</div></div>';
    }
    groupsEl.innerHTML = html;
    // 无尽模式按钮绑定已移至 buildLevelModal（独立 #dzk-endless-btn），此处仅绑定固定关卡
    // 固定关卡按钮
    groupsEl.querySelectorAll('.dzk-level-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lv = btn.getAttribute('data-level');
        window.__dzkEndlessMode = false;     // 退出无尽模式
        exitFairMode();                      // 退出公平模式：恢复用户自己的参数与效果配置
        window.__dzkLevel = lv;
        window.__dzkLastLevel = lv;
        localStorage.setItem('dzk3d_last_level', lv);
        window.dispatchEvent(new Event('dzk3d-level-selected'));
        if (window.__dzkRestartLevel) window.__dzkRestartLevel();
      });
    });
  }

  // ===== Home 键：替换左上角 MSI logo（Vue 渲染的 .logo-wrapper） =====
  var homeBtn = null;
  var refreshBtn = null;
  var homeModal = null;

  function replaceLogoWithHome() {
    function tryInsert() {
      if (document.getElementById('dzk-home-btn')) return;
      var logo = document.querySelector('.app-header .logo-wrapper');
      if (!logo) return;
      logo.style.display = 'none';
      var home = document.createElement('button');
      home.id = 'dzk-home-btn';
      home.type = 'button';
      home.className = 'dzk-home-btn';
      home.setAttribute('aria-label', '主菜单');
      home.title = '主菜单';
      home.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path>' +
        '<path d="M9 21v-6h6v6"></path></svg>';
      logo.parentNode.insertBefore(home, logo.nextSibling);
      homeBtn = home;

      // ===== 刷新按钮（home 键右侧）：卡死时强制重启 =====
      var refresh = document.createElement('button');
      refresh.id = 'dzk-refresh-btn';
      refresh.type = 'button';
      refresh.className = 'dzk-refresh-btn';
      refresh.setAttribute('aria-label', '强制重启');
      refresh.title = '如果发现游戏卡死，点击这里强制重启';
      refresh.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 12a9 9 0 1 1-2.64-6.36"></path>' +
        '<path d="M21 3v5h-5"></path></svg>';
      // 作为 home 按钮的子节点，用 absolute 紧贴其右侧（避免被 header 的 flex space-between 推开）
      home.appendChild(refresh);
      refreshBtn = refresh;

      bindHomeBtn();
      bindRefreshBtn();
    }
    tryInsert();
    var obs = new MutationObserver(function () { tryInsert(); });
    obs.observe(document.body, { childList: true, subtree: true });
    return { stop: function () { obs.disconnect(); } };
  }

  function bindRefreshBtn() {
    if (!refreshBtn) return;
    if (refreshBtn.dataset.bound) return;
    refreshBtn.dataset.bound = '1';
    refreshBtn.addEventListener('click', function () {
      // 强制重启：直接刷新页面，能解决任何卡死 / 状态错乱
      try {
        // 先尝试把游戏状态复位并立即重载，确保存档（作弊设置等）已写入 localStorage
        window.location.reload(true);
      } catch (e) {
        window.location.href = window.location.href;
      }
    });
  }

  function bindHomeBtn() {
    if (!homeBtn) return;
    if (homeBtn.dataset.bound) return;
    homeBtn.dataset.bound = '1';
    homeBtn.addEventListener('click', function () {
      // 点击 home 键：整个游戏立即暂停
      window.dispatchEvent(new Event('dzk3d-game-pause'));
      if (!homeModal) homeModal = buildHomeModal();
      homeModal.classList.add('open');
    });
  }

  function buildHomeModal() {
    var wrap = document.createElement('div');
    wrap.className = 'dzk-home-modal';
    wrap.innerHTML = [
      '<div class="dzk-home-actions">',
      '    <button class="dzk-home-btn-action" data-act="play" title="继续">',
      '      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>',
      '      <span>继续</span>',
      '    </button>',
      '    <button class="dzk-home-btn-action" data-act="restart" title="重新开始">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/></svg>',
      '      <span>重新开始</span>',
      '    </button>',
      '    <button class="dzk-home-btn-action" data-act="level" title="关卡选择">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/></svg>',
      '      <span>关卡选择</span>',
      '    </button>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      // 点空白处关闭 → 自动继续游戏（游戏在菜单打开时已暂停）
      if (e.target === wrap) {
        wrap.classList.remove('open');
        window.dispatchEvent(new Event('dzk3d-game-play'));
        return;
      }
      var actEl = e.target.closest ? e.target.closest('[data-act]') : null;
      var act = actEl && actEl.getAttribute('data-act');
      if (act) {
        if (act === 'play') {
          window.dispatchEvent(new Event('dzk3d-game-play'));
          wrap.classList.remove('open');
        } else if (act === 'restart') {
          window.dispatchEvent(new Event('dzk3d-game-restart'));
          wrap.classList.remove('open');
        } else if (act === 'level') {
          wrap.classList.remove('open');
          // 就地打开选关弹窗（不绕道 Home 路由）：Home 的选关等待是为"进页面前选关"设计的，
          // 局内换关直接弹窗 + 选定后 restart 更直接，两种作弊/普通模式行为一致
          window.dispatchEvent(new Event('dzk3d-request-level-select'));
        }
      }
    });
    return wrap;
  }

  // ===== 最终成绩弹窗优化：标题只保留「最終成績」，去掉 " / 等級X" =====
  function cleanResultsTitle() {
    var obs = new MutationObserver(function () {
      var t = document.querySelector('.popin .results-title');
      if (t && t.textContent.indexOf(' / ') !== -1) {
        t.innerHTML = t.textContent.split(' / ')[0];
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return { stop: function () { obs.disconnect(); } };
  }

  // ===== 结算页底部按钮：再试一次（沿用原生 cta-retry）+ 选择关卡（并排各占一半）=====
  function injectResultsButtons() {
    var obs = new MutationObserver(function () {
      var retry = document.querySelector('.popin .cta-retry');
      if (!retry) return;
      // 避免重复注入
      if (document.getElementById('dzk-results-level-btn')) return;
      var container = retry.parentElement;
      if (!container) return;
      // 容器设为 flex 均分（CSS 也已兜底）
      container.style.display = 'flex';
      container.style.gap = '12px';
      // 强制压住 Vue scoped 给 retry 加的样式（高度/换行），保证文字单行 + 与 level 同高
      retry.style.height = '50px';
      retry.style.minHeight = '50px';
      retry.style.maxHeight = '50px';
      retry.style.lineHeight = '1';
      retry.style.whiteSpace = 'nowrap';
      retry.style.overflow = 'hidden';
      retry.style.letterSpacing = '0.05em';
      retry.style.padding = '0 16px';
      retry.style.gap = '8px';
      // 删除"再試一次"里的重试图标：只保留文字
      var retrySvg = retry.querySelector('svg');
      if (retrySvg) retrySvg.remove();
      // retry 内部 .text span 也强制单行 + line-height:1，避免被行高撑高
      var tEl = retry.querySelector('.text');
      if (tEl) {
        tEl.style.whiteSpace = 'nowrap';
        tEl.style.lineHeight = '1';
        tEl.style.display = 'inline-flex';
        tEl.style.alignItems = 'center';
      }
      // 拦截原生「再试一次」：重开前先恢复当前关卡，否则 loadNewLevel 会因
      // __dzkLevel 已被清空而落到固定默认关 msint（即"变成固定关卡"的根因）。
      // capture 阶段抢在原生 Vue handler 之前执行，确保 setState(START_GAME) 触发
      // loadNewLevel 时 __dzkLevel 已就绪（命中第3分支加载本关）。
      retry.addEventListener('click', function () {
        if (!window.__dzkEndlessMode) {
          var last = window.__dzkLastLevel || localStorage.getItem('dzk3d_last_level');
          if (last) window.__dzkLevel = last;
        }
      }, true);

      // 新建「选择关卡」按钮，复用 cta-retry 外观 + cta-level-select 蓝色变体
      var btn = document.createElement('button');
      btn.id = 'dzk-results-level-btn';
      btn.type = 'button';
      btn.className = 'cta-retry cta-level-select';
      btn.textContent = '选择关卡';
      btn.addEventListener('click', function () {
        // 打开选关弹窗（dzk3d-level-selected 处理器会负责进入游戏）
        window.dispatchEvent(new Event('dzk3d-request-level-select'));
      });
      container.appendChild(btn);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return { stop: function () { obs.disconnect(); } };
  }

  function reconcileBest() {
    // 自愈：历史上 best 被"最近一局"覆盖过，这里用 records 里的真实最高分校正，
    // 并同步 best_time 为那条记录的日期（避免最高分与时间对不上）。
    try {
      var raw = localStorage.getItem('dzk3d_records');
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return;
      var maxRec = null;
      arr.forEach(function (r) { if (r && typeof r.score === 'number' && (!maxRec || r.score > maxRec.score)) maxRec = r; });
      if (!maxRec) return;
      var stored = Number(localStorage.getItem(BEST_KEY)) || 0;
      if (maxRec.score > stored) {
        localStorage.setItem(BEST_KEY, String(maxRec.score));
        localStorage.setItem('dzk3d_best_time', String(maxRec.date));
      } else if (stored > maxRec.score) {
        // best 高于真实记录（异常），同样校正回去
        localStorage.setItem(BEST_KEY, String(maxRec.score));
        localStorage.setItem('dzk3d_best_time', String(maxRec.date));
      }
    } catch (_) {}
  }

  function init() {
    reconcileBest();
    // 不再常驻右上角浮标（会挡画面），改为奖杯按钮点击查看
    replaceMenuButtonWithTrophy();
    replaceLogoWithHome();
    cleanResultsTitle();
    injectResultsButtons();
    // 移除可能残留的旧浮标
    var oldBadge = document.getElementById('dzk3d-best-badge');
    if (oldBadge) oldBadge.parentNode && oldBadge.parentNode.removeChild(oldBadge);
    // 记录更新事件：最高分与历史列表均由引擎(webgl/main.js)在派发事件前写入
    // localStorage（best 只在超过旧纪录时才更新，records 追加最近50局）。
    // 这里不再二次写入 BEST_KEY，否则会把"历史最高分"覆盖成"最近一局分数"。
    // 仅保留 storage 跨标签页同步即可。
    // 跨标签页 / 重新聚焦时同步
    window.addEventListener('storage', function (e) {
      if (e.key === BEST_KEY || e.key === LAST_KEY || e.key === 'dzk3d_records') refresh();
    });
    window.addEventListener('focus', refresh);
    // 奖杯按钮（Vue 渲染后注入）
    var t = document.getElementById('dzk-trophy-btn');
    if (t) bindTrophy(t);
    bindLevelSelect();
    startCatchAssist(); // 终极作弊·自动吸附的挡板接球辅助
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
