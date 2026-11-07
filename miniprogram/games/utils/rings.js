/**
 * 猜圈练习：纯逻辑（不联网、不碰 wx API，所以能直接跑测试）。
 *
 * 玩法口径（**别对外说成和上游站一模一样**）：
 *   上游 /ring-guessr 是「给前 3 个圈，猜最终圈圈心」，而且答案在它服务端；
 *   我们手上只有接口给的 3 个圈，所以本项目的玩法是
 *   **「给第 1、2 圈，猜第 3 圈的圈心」** —— 同一类判断（圈是收缩且相切的），
 *   但难度和原站不同，界面上要写清楚。
 *
 * 为什么不去提交猜测拿真正的最终圈：那会写进上游 "已猜 N 次" 的统计里，
 * 属于给人家添污染。3 个圈已经够自己玩了。
 *
 * 坐标系：上游是 16384 x 16384。小程序里地图图是 2048x2048 ——
 * 所以渲染**一律用百分比**（x / 16384 * 100%），不引入缩放常量，换图也不用改代码。
 */

var DATA = require("../data/rings_data.js");
// 真实比赛 + 社区环库的完整圈序列（题库主体，见 match_rings_data.js）。
var MATCH = null;
try { MATCH = require("../data/match_rings_data.js"); } catch (e) { MATCH = null; }
var core = require("../../utils/core.js");

var COORD = (DATA && DATA.coord) || 16384;

/* 资产 id -> 上游英文展示名（中文名交给 core.translateMapName，别在这里再写一份译名） */
var MAP_EN = {
  "kings-canyon": "Kings Canyon",
  "worlds-edge": "World's Edge",
  "olympus": "Olympus",
  "storm-point": "Storm Point",
  "broken-moon": "Broken Moon",
  "e-district": "E-District"
};

/* 一局多少题（用户定的：8 题）。
   题库远大于这个数（见 rings_data.js，去重后 150 道）——
   一局是**从题库里随机抽 8 道不重复的**，所以同一局不会撞题、换一局又是新题。
   （上游原站是 10 轮；这里按用户的要求定，别自作主张改回去。） */
var ROUNDS = 10;   // 2026-10-18 用户要求：一局 10 题
var MAX_SCORE = 1000;     // 每轮满分

/* 一轮的时间线（用户 2026-10-16 定的）：
     第 0 秒出第 1 个提示圈、第 5 秒出第 2 个、第 10 秒出第 3 个，
     最多 20 秒时间猜圈 —— 猜的是**再下一个圈**（提示圈之后的那个）的圈心。
   ⚠️ 和上游的差别（界面上写清楚了）：上游给的三个圈之后要猜「最终圈」；
      我们手上两类题库合起来是"给 N 个圈猜下一个"，N = 2 或 3。 */
var T_RING2 = 5000;
var T_RING3 = 10000;
var T_END = 20000;
var T_FREE = 5000;        // 前 5 秒不计时折扣（用户定的：5 秒之内不衰减）

/**
 * 第 ms 毫秒时这一轮处于什么状态（纯函数，好测）。
 * @returns {{visible:number, canGuess:boolean, over:boolean, leftSec:number}}
 */
function stageAt(ms, hintCount) {
  var t = Math.max(0, Number(ms) || 0);
  var max = Math.max(1, Number(hintCount) || 3);   // 题目给几个提示圈（2 或 3）
  var shown = t >= T_RING3 ? 3 : (t >= T_RING2 ? 2 : 1);
  return {
    visible: Math.min(shown, max),
    // ★ 整轮都能猜（0~20 秒）。答案（下一个圈）**从头到尾都不显示**，
    //   所以不存在"看见了才猜"的问题 —— 这是和上一版最大的区别。
    canGuess: t < T_END,
    over: t >= T_END,
    leftSec: Math.max(0, Math.ceil((T_END - t) / 1000))
  };
}

/* 平面战术图（games/assets/flat/*.jpg，2026-11 随小游戏搬进分包 games；由 直播识别/build_flatmaps.py 生成）。
   猜圈必须用平面图：判断的是"圈心落在哪块地形上"，斜视宣传图根本没法定位。
   ⚠️ 这里**只列猜圈真正用到的那 3 张**（上游 ALGS 模式的地图池就是这三张）。
      另外 3 张（诸王峡谷/奥林匹斯/残月）的平面图原本是给"交互地图"页面用的，
      那个页面已经删了 —— 图也跟着删掉，省 ~230KB 包体。
      要加回来：先跑 build_flatmaps.py，再把 id 加进这张表。 */
var FLAT = {
  "storm-point": 1, "e-district": 1, "worlds-edge": 1,
  // 2026-10-17：奥林匹斯 / 残月也进了题库（社区环库），底图一起补齐
  "olympus": 1, "broken-moon": 1
};

function mapName(id, lang) {
  var en = MAP_EN[id] || id;
  if (i18n_lang(lang) === "en") return en;
  return core.translateMapName(en) || en;
}
function i18n_lang(lang) {
  return String(lang) === "en" ? "en" : "zh";
}
function mapImage(id) {
  if (!id) return "";
  return FLAT[id] ? ("/games/assets/flat/" + id + ".jpg") : ("/assets/maps/" + id + ".jpg");
}

/**
 * 题库：把两份数据合并成统一的「题」。
 *
 * 题的形状（★ 全部字段都是视图模型直接要用的，页面不再算）：
 *   { map, hints:[圈...], answer:圈, key }
 *   hints  = 0/5/10 秒依次出现的提示圈（2 或 3 个）
 *   answer = 再下一个圈（**从头到尾不显示**，猜的就是它）
 *
 * 两个来源：
 *   1) rings_data.js —— 上游猜圈接口给的 3 个圈（风暴点 65 + 电力区域 48）。
 *      只能出「给 2 猜 1」：hints = 第 1、2 圈，answer = 第 3 圈。
 *   2) match_rings_data.js —— 真实比赛的完整序列（build_matchrings.py 抓的）。
 *      一条 N 圈的序列能出 N-3 道「给 3 猜 1」的题（滑动窗口）。
 *
 * 为什么不用「给 3 猜最终圈」那一种：那份数据（最终圈）只在按时间门禁的
 * 提交接口里，程序化取不到（实测 0.6~11 秒各种时机都是 Invalid time）。
 * 现在的玩法在数学上是同一件事：**给定已经出现的圈，预测下一个圈心**。
 */
function allQuestions() {
  var out = [];

  // 来源 1：上游猜圈接口的三个圈 -> 给 2 猜第 3
  allSamples().forEach(function (s, i) {
    out.push({
      map: s.map,
      hints: [s.rings[0], s.rings[1]],
      answer: s.rings[2],
      key: "api-" + s.map + "-" + i
    });
  });

  // 来源 2：真实比赛 + 社区环库的完整序列 -> 给 3 猜第 4
  // （这批数据里每个圈是 [x,y,r] 数组，一律过 toRing 转成对象，见 toRing 的说明）
  //
  // ★ 只取「从第 1 圈开始」的窗口。
  //   一开始我用了滑动窗口（k=0,1,2…），一条 6 圈的序列会出 3 道题，
  //   但那些题**起点是第 2 圈或第 3 圈** —— 界面上就变成"一开始显示的就是二圈"
  //   （用户实测报过），和"第 0 秒出第 1 圈"的规则完全对不上。
  //   现在一条序列只出一题：圈 1、2、3 依次出现，猜圈 4。
  var games = (MATCH && MATCH.games) || [];
  games.forEach(function (g, gi) {
    var rs = g.rings || [];
    if (rs.length < 4) return;
    out.push({
      map: g.map,
      hints: [toRing(rs[0]), toRing(rs[1]), toRing(rs[2])],
      answer: toRing(rs[3]),
      key: "match-" + gi
    });
  });

  return out;
}

/** 旧名字：只给两份数据里"3 个圈"的那一种，测试和其它地方还在用 */
function allSamples() {
  var out = [];
  var maps = (DATA && DATA.maps) || {};
  Object.keys(maps).forEach(function (mid) {
    (maps[mid] || []).forEach(function (row) {
      // ⚠️ 布局是【先三个 x、再三个 y、最后三个半径】：[x1,x2,x3, y1,y2,y3, r1,r2,r3]
      //    不是 [x1,y1,x2,y2,...]。两边错位的表现是"圈画得莫名其妙"而**不会报错**。
      if (!row || row.length < 9) return;
      out.push({
        map: mid,
        rings: [
          { x: row[0], y: row[3], r: row[6] },
          { x: row[1], y: row[4], r: row[7] },
          { x: row[2], y: row[5], r: row[8] }
        ]
      });
    });
  });
  return out;
}

/**
 * 某张图「最终圈可能落点」（圈心 + 最终圈半径）。
 *
 * 数据只在 map_ends_data.js 里（约 5KB，由 直播识别/build_mapdata.py 生成），
 * 不往 rings_data.js 里再抄一份 —— 抄一份就是冗余 + 两处会各自过期。
 * 取不到就返回空数组：界面上那个提示开关会什么都不画，但游戏照常能玩。
 */
var ENDS = null;
function endZones(mapId) {
  if (ENDS === null) {
    try {
      ENDS = require("../data/map_ends_data.js").maps || {};
    } catch (e) {
      ENDS = {};
    }
  }
  var rows = ENDS[mapId] || [];
  return rows.map(function (e) {
    return { x: e.x, y: e.y, r: e.radius };
  });
}

/** 圈 / 点 -> 百分比定位。
    直接给现成的 style 串：WXML 里不能做算术，页面上也不该再拼一遍字符串。
    （第一版 dotOf 只给 left/top，页面取 .style 取到 undefined，
     表现是"两个标记全堆在左上角"而且**不报错** —— 靠测试才逮到。） */
function boxOf(c) {
  var left = pct((c.x - c.r) / COORD * 100);
  var top = pct((c.y - c.r) / COORD * 100);
  var size = pct((c.r * 2) / COORD * 100);
  return {
    left: left, top: top, size: size,
    style: "left:" + left + ";top:" + top + ";width:" + size + ";height:" + size
  };
}
function dotOf(p) {
  var left = pct(p.x / COORD * 100);
  var top = pct(p.y / COORD * 100);
  return { left: left, top: top, style: "left:" + left + ";top:" + top };
}
function pct(v) {
  if (!isFinite(v)) return "0%";
  return (Math.round(v * 1000) / 1000) + "%";
}

/**
 * 把「圈」统一成 {x, y, r} 对象。
 *
 * ★ 这里修过一个很隐蔽的 bug：完整序列那批数据（真实对局 + 社区环库）里，
 *   每个圈是 **[x, y, r] 数组**，而 boxOf 读的是 c.x / c.y / c.r ——
 *   数组上这些字段都是 undefined，于是 boxOf 走 NaN 兜底算出 "0%"，
 *   **圈被画成 0×0、屏幕上就是没有圈**，而且不报错。
 *   奥林匹斯题量最大，所以最先在那里被用户看到（"奥林匹斯没显示第一圈"）。
 *   现在所有来源都在这里转成对象，别在别处再各自兼容。
 */
function toRing(a) {
  if (!a) return { x: 0, y: 0, r: 0 };
  if (typeof a.x === "number") return { x: a.x, y: a.y, r: a.r };
  return { x: a[0], y: a[1], r: a[2] };
}

function shuffle(arr, rng) {
  var r = rng || Math.random;
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(r() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * 把一局里的题排成「**相邻两题不同图**」的顺序。
 *
 * 原因（用户要求）：奥林匹斯题量占了大半，随机抽 8 题很容易连着好几题都是同一张图，
 * 玩起来像在刷同一张。"测试完马上换一张图"才像正常的练习节奏。
 *
 * 贪心：每次从剩下的里挑一道**和上一题不同图**的；实在没有（剩下的全是同一张图）
 * 就退而从第一个取 —— 这是尽力而为，不保证数学上一定成立。
 */
function demix(list) {
  var pool = list.slice();
  var out = [];
  var last = "";
  while (pool.length) {
    // 每次优先取"**剩下最多的**那张图"（且和上一题不同）——
    // 这样不会把某个图的一大堆题留到最后，才排得出"相邻不同图"。
    // 只要最多的那张不超过 ⌈n/2⌉，这个贪心一定排得开。
    var pick = -1;
    var bestCount = -1;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].map === last) continue;
      var c = 0;
      for (var j = 0; j < pool.length; j++) if (pool[j].map === pool[i].map) c++;
      if (c > bestCount) { bestCount = c; pick = i; }
    }
    if (pick < 0) pick = 0;               // 剩下的全是同一张图，认了
    var q = pool.splice(pick, 1)[0];
    out.push(q);
    last = q.map;
  }
  return out;
}

/**
 * 每张图一副「牌堆」：洗好一次，按顺序发牌，发完再重洗。
 *
 * ★ 为什么需要它（用户反馈："新开的一局和上一局的圈型重复度有点高"）：
 *   原来每一局都从池子里**重新随机抽 8 道** —— 局内不重复保证了，
 *   但跨局完全没有记忆。残月只有 6 道、电力区域 3 道、世界尽头 4 道，
 *   每局还都要各抽一道 → 这十几道题几乎**每局都会再见到**。
 *   改成牌堆后：一张图的所有题在一轮发完之前不会重复，
 *   也就是「先把 4 道世界尽头过一遍，才回到第 1 道」。
 *   状态只存在内存里（本项目不写本地存储），冷启动就重洗。
 */
var DECKS = {};

/**
 * 从某张图的牌堆里发一张；**这一轮发完了就返回 null**（不自动重洗）。
 *
 * 为什么不能自动重洗：电力区域只有 3 道、世界尽头 4 道。
 * 如果一耗尽就重洗，那么每 1~2 局就会把这几道再发一遍 ——
 * 而奥林匹斯还有上百道没用过的题。所以"发完就先不给"，
 * 等**所有图的牌堆都空了**再统一重洗（见 newGame）。
 */
function deckNext(map, pool, rng) {
  var d = DECKS[map];
  if (!d) d = DECKS[map] = { list: shuffle(pool, rng), i: 0 };
  if (d.i >= d.list.length) return null;
  return d.list[d.i++];
}

function resetDecks() {
  DECKS = {};
}

/** 这局覆盖了几张不同的地图 */
function distinctMaps(list) {
  var s = {};
  list.forEach(function (x) { s[x.map] = 1; });
  return Object.keys(s).length;
}

/**
 * 开一局。
 *
 * ★ 抽题方式：**按地图轮流发牌 + 优先用没发过的题**。
 *   三个要求同时满足：
 *     1) 一局里相邻两题不同图（用户要求"测完马上换一张图"）；
 *     2) 局内不重复；
 *     3) 跨局尽量不重样（用户反馈"和上一局重复太多"）——
 *        每张图一副牌堆，发完为止；只剩小池子时才会提前进入下一轮。
 *
 * @param {function} [rng] 注入随机源时走**无状态**路径（测试要可复现）
 * @returns {{rounds:Array, total:number}} rounds 是抽好的题（一局固定，避免中途换题）
 */
function newGame(rng) {
  var all = allQuestions();
  if (!all.length) return { rounds: [], total: 0 };
  if (rng) resetDecks();         // 测试注入随机源 → 清空牌堆，保证可复现

  var byMap = {};
  all.forEach(function (q) { (byMap[q.map] = byMap[q.map] || []).push(q); });
  var keys = shuffle(Object.keys(byMap), rng);

  var out = [];
  var rounds = 0;
  // 每张图这局已经用了几道：**每次都挑用得最少的那张**，
  // 这样 8 道题在地图之间是均衡的（8 题 3 张图就是 3/3/2），
  // 均衡之后 demix 才排得开"相邻不同图"；否则奥林匹斯一多就会连着两题同图。
  var used = {};
  keys.forEach(function (k) { used[k] = 0; });

  while (out.length < ROUNDS) {
    var best = null;
    var cap = Math.ceil(ROUNDS / 2);          // 单张图最多占一半（8 题最多 4 张同一图）
    for (var bi = 0; bi < keys.length; bi++) {
      var bk = keys[bi];
      var bd = DECKS[bk];
      if (bd && bd.i >= bd.list.length) continue;      // 这张图这一轮发完了
      if (used[bk] >= cap) continue;                   // 已经到上限：再多就排不开"相邻不同图"
      if (best === null || used[bk] < used[best]) best = bk;
    }
    if (best === null) {
      // 要么都发完了、要么都到上限了 —— 先试重洗，还不行就放宽上限
      if (rounds++ > 300) break;                       // 极端兜底，防止死循环
      var anyEmpty = false;
      for (var ei = 0; ei < keys.length; ei++) {
        var ed = DECKS[keys[ei]];
        if (!ed || ed.i >= ed.list.length) { anyEmpty = true; break; }
      }
      if (anyEmpty) { resetDecks(); continue; }
      cap = ROUNDS;                                    // 放宽：只剩一种图可选了
      for (var fi = 0; fi < keys.length; fi++) {
        var fd = DECKS[keys[fi]];
        if (!fd || fd.i >= fd.list.length) continue;
        if (best === null || used[keys[fi]] < used[best]) best = keys[fi];
      }
      if (best === null) break;
    }
    var q = deckNext(best, byMap[best], rng);
    if (!q) continue;
    used[best]++;
    out.push(q);
  }

  /**
   * 补地图多样性：小池子（电力区域 3 / 世界尽头 4 / 残月 6）发完之后，
   * 一局可能只剩风暴点 + 奥林匹斯两张图 —— 虽然不重复，但玩着单调。
   * 这里从"这局还没有的图"里挑一道，替换掉一个同图重复的位置（不动总题数）。
   * 代价：这一道会用到已经发过的题（小池子不可避免），但每局最多补一两道。
   */
  var guard = 0;
  while (distinctMaps(out) < 3 && guard++ < 12) {
    var have = {};
    out.forEach(function (x) { have[x.map] = 1; });
    var inGame = {};
    out.forEach(function (x) { inGame[x.key] = 1; });
    var cand = shuffle(all, rng).filter(function (x) { return !have[x.map] && !inGame[x.key]; });
    if (!cand.length) break;
    // 找一个"同图出现两次以上"的位置来替换（从后往前，尽量不动前面的节奏）
    var dupIdx = -1;
    for (var j = out.length - 1; j >= 0; j--) {
      var m = out[j].map;
      if (out.filter(function (x) { return x.map === m; }).length > 1) { dupIdx = j; break; }
    }
    if (dupIdx < 0) break;
    out[dupIdx] = cand[0];
  }

  var ordered = demix(out);      // 兜底：万一某张图只有 1 道，轮转仍可能贴在一起
  return { rounds: ordered, total: ordered.length };
}

/**
 * 判定一次猜测。**计分 = 精度 × 时间系数**（用户要求：越早猜分越高，很晚猜即使准也打折）。
 *
 *   精度 acc  = 1 - (误差 / 2 个圈半径)，夹到 0~1
 *               → 圈心正中 1.0；正好落在圈边 (ratio=1) 0.5；误差 2 个半径 0
 *   时间系数   = 前 5 秒恒为 1.0；5~20 秒线性降到 0.55
 *               （5 秒 1.0、12.5 秒 0.775、20 秒 0.55）
 *               → 20 秒时正中靶心只拿 550 分；5 秒内中能拿满 1000 分
 *   得分       = round(1000 × acc × 时间系数)
 *
 * 为什么时间系数**保留 0.55 的地板**而不是降到 0：
 * 猜得晚本身已经是惩罚（圈都露出来了，答案是"看得见"的），
 * 时间系数再归零就变成"晚交卷 = 白交"，会让玩家干脆不玩最后一秒。
 *
 * @param {object} q 一局里抽到的那道题
 * @param {{x:number,y:number}} guess 相对坐标（0~1，相对整张图）
 * @param {number} [elapsedMs] 本题已用毫秒数；不给就按"刚开局"算（测试用）
 * @returns {{dist:number, ratio:number, score:number, hit:boolean, parts:object}}
 */
function judge(q, guess, elapsedMs) {
  var t = q.answer;
  var gx = guess.x * COORD, gy = guess.y * COORD;
  var dist = Math.sqrt((gx - t.x) * (gx - t.x) + (gy - t.y) * (gy - t.y));
  var ratio = t.r > 0 ? dist / t.r : 99;

  // 精度分（0~1）
  var acc = Math.max(0, Math.min(1, 1 - ratio / 2));

  // 时间系数：**前 5 秒不衰减**，之后线性降到 0.55
  var elapsed = typeof elapsedMs === "number" && elapsedMs >= 0 ? Math.min(elapsedMs, T_END) : 0;
  var timeMul = elapsed <= T_FREE
    ? 1
    : 1 - 0.45 * ((elapsed - T_FREE) / (T_END - T_FREE));

  var base = Math.round(MAX_SCORE * acc);            // 只看精度的分
  var score = Math.round(base * timeMul);            // 打完时间折扣的分

  return {
    dist: Math.round(dist),
    ratio: Math.round(ratio * 100) / 100,
    score: score,
    // 落在真实圈内就算"圈内"，这是玩家最直观的成功判据
    hit: dist <= t.r,
    // 得分明细（界面上要逐项列出来，别让玩家猜为什么分低）
    parts: {
      acc: Math.round(acc * 100) / 100,      // 精度系数 0~1
      base: base,                            // 精度分（未打折）
      timeMul: Math.round(timeMul * 1000) / 1000,  // 时间系数 0.55~1
      elapsedSec: Math.round(elapsed / 100) / 10,  // 用时（秒，一位小数）
      hit: dist <= t.r
    }
  };
}

function gradeText(ratio, lang) {
  var ratioTxt = (Math.round(ratio * 100) / 100) + (i18n_lang(lang) === "en" ? " rings" : " 个圈半径");
  return ratioTxt;
}

/* ============================================================
   地图视口（选点那套交互的全部数学）
   ============================================================

   手机上的选点，全世界的做法都一样（高德/百度选点、Uber 上车点、游戏里标点）：
   **准星钉在屏幕正中，手指拖动的是地图，双指捏合缩放** —— 选中的永远是"地图上正好
   压在准星下面那一点"。

   这么做的关键好处：**落点精度不取决于手指**。
   手指点哪儿会有 ±十几像素的误差，但"拖动地图、松手"没有这个误差 ——
   你松手时地图停在哪就是哪。z=1 时一个屏幕像素约 42 个地图单位（16384/390），
   相对第 3 圈半径（约 1400）才 3%，随手一拖就够准；捏合放大 4 倍就是 1% 以内。

   约定：地图内容是一块宽高 W*z 的正方形，左上角在容器坐标 (tx, ty)。
   容器中心 (W/2, H/2) 对应的地图比例：
       fx = (W/2 - tx) / (W*z)
   ------------------------------------------------------------ */

var VP_MIN_Z = 1;
var VP_MAX_Z = 5;

/** 初始视口：不缩放、不偏移（中心正好是地图正中） */
function vpInit() {
  return { z: VP_MIN_Z, tx: 0, ty: 0 };
}

/**
 * 把偏移夹回合法范围。
 *
 * ★★ 这里踩过一个严重的坑（用户实测报的）：一开始我按**地图必须始终铺满容器**
 *    来夹（tx ∈ [w-size, 0]），结果 —— 准星永远到不了地图边上：
 *        z=2.5 时中心只能落在 0.20 ~ 0.80，z=5 时只能落在 0.10 ~ 0.90。
 *    也就是**放得越大，反而越看不到边**，贴边的圈永远选不到。
 *    数学上很清楚：中心比例 fx = (w/2 - tx)/size，要 fx=0 就得 tx = w/2，
 *    而旧夹取把 tx 死死压在 ≤ 0。
 *
 *    选点工具的正确约束是「**地图边缘能拖到准星下面**」：
 *        tx ∈ [w/2 - size, w/2]   →   fx ∈ [0, 1]，整个地图都点得到。
 *    代价是拖到极限时容器另一侧会露底（地图之外）。这里露底是**对的** ——
 *    它明确告诉你已经到地图边了，而容器底色就是主题的 --sunken。
 */
function vpClamp(vp, w) {
  var size = w * vp.z;
  var lo = w / 2 - size;
  var hi = w / 2;
  var tx = Math.min(hi, Math.max(lo, vp.tx));
  var ty = Math.min(hi, Math.max(lo, vp.ty));
  return { z: vp.z, tx: tx, ty: ty };
}

/** 准星（容器正中）压在哪个地图比例上 —— 这就是玩家选的"点" */
function vpCenter(vp, w) {
  var size = w * vp.z;
  return {
    x: (w / 2 - vp.tx) / size,
    y: (w / 2 - vp.ty) / size
  };
}

/** 单指拖动：手指往右拖 = 地图跟着往右走（内容是往右下移动） */
function vpPan(vp, dx, dy, w) {
  return vpClamp({ z: vp.z, tx: vp.tx + dx, ty: vp.ty + dy }, w);
}

/**
 * 双指缩放：**以容器中心为锚点**（准星那一点保持不动）。
 * @param {number} factor 相对起始距离的倍数（>1 放大）
 */
function vpZoom(vp, factor, w) {
  var z = Math.min(VP_MAX_Z, Math.max(VP_MIN_Z, vp.z * factor));
  if (z === vp.z) return vp;
  var c = vpCenter(vp, w);           // 缩放前准星下的比例
  var size = w * z;
  // 让同一个比例继续落在中心：tx = W/2 - fx*size
  return vpClamp({ z: z, tx: w / 2 - c.x * size, ty: w / 2 - c.y * size }, w);
}

/** 让某个地图比例出现在准星下（点一下地图 = 跳到那里，省得一路拖） */
function vpCenterOn(vp, fx, fy, w) {
  var size = w * vp.z;
  return vpClamp({ z: vp.z, tx: w / 2 - fx * size, ty: w / 2 - fy * size }, w);
}

/**
 * 把视口定到「某个比例 + 某个缩放」上（点一下地图之后用它）。
 *
 * ⚠️ 为什么点地图要顺带放大：**z=1 时地图正好填满容器，根本没法平移**
 *    （夹取之后 tx 只能是 0）—— 也就是说 z=1 时准星永远指着地图正中，
 *    选不了别的点。所以点一下就聚焦到那个点并把 z 提到 2.5，
 *    这时地图比容器大，拖动才有意义。这不是取巧，是所有手机地图选点的做法：
 *    先点大概位置 → 放大 → 再拖准。
 */
var VP_TAP_Z = 2.5;
function vpFocus(vp, fx, fy, z, w) {
  var zz = Math.min(VP_MAX_Z, Math.max(VP_MIN_Z, z));
  var size = w * zz;
  return vpClamp({ z: zz, tx: w / 2 - fx * size, ty: w / 2 - fy * size }, w);
}

module.exports = {
  COORD: COORD,
  ROUNDS: ROUNDS,
  MAX_SCORE: MAX_SCORE,
  T_RING2: T_RING2,
  T_RING3: T_RING3,
  T_END: T_END,
  stageAt: stageAt,
  vpInit: vpInit,
  vpClamp: vpClamp,
  vpCenter: vpCenter,
  vpPan: vpPan,
  vpZoom: vpZoom,
  vpCenterOn: vpCenterOn,
  vpFocus: vpFocus,
  VP_TAP_Z: VP_TAP_Z,
  VP_MAX_Z: VP_MAX_Z,
  MAP_EN: MAP_EN,
  allSamples: allSamples,
  allQuestions: allQuestions,
  endZones: endZones,
  newGame: newGame,
  judge: judge,
  roundView: roundView,
  resultView: resultView,
  boxOf: boxOf,
  dotOf: dotOf,
  mapName: mapName,
  mapImage: mapImage
};

/** 页面要的整轮视图：提示圈 + 答案圈的定位都算好（答案圈由页面决定什么时候渲染） */
function roundView(q, lang) {
  if (!q) return null;
  return {
    map: q.map,
    mapName: mapName(q.map, lang),
    image: mapImage(q.map),
    // 提示圈：0/5/10 秒依次出现的那 2~3 个
    hints: q.hints.map(boxOf),
    hintCount: q.hints.length,
    // 答案圈：**只在判定之后**渲染
    answer: boxOf(q.answer),
    answerR: q.answer.r
  };
}

/** 结果视图：真实圈心 + 猜测点 + 误差 */
function resultView(q, guess, res, lang) {
  var t = q.answer;
  return {
    answer: boxOf(t),
    guessDot: dotOf({ x: guess.x * COORD, y: guess.y * COORD }),
    centerDot: dotOf(t),
    ratioText: gradeText(res.ratio, lang),
    score: res.score,
    hit: res.hit,
    distText: core.num(res.dist)
  };
}


