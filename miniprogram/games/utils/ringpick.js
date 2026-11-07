/**
 * 圈型速判：看第一个安全区圈，猜**下一个圈的圈心**在哪个方向（四选一）。
 *
 * 为什么和「猜圈练习」（games/ringguessr）分开：
 *   猜圈练习是**精修模式** —— 拖动地图 + 双指缩放 + 20 秒 + 8 题，重、慢、要两只手；
 *   这个是**快判模式** —— 一屏、四个字母、10 秒一题、5 题一局，滑开就能玩一把。
 *   两个模式共用一个题库来源，但玩法不同，所以是两个页面、不是同一页的两个 tab。
 *
 * ★ 为什么选项是"四个方向"而不是"四个随机点"：
 *   把 260 局真实数据（上游三圈样本 65 局 + 比赛整局序列 195 局）逐局算了一遍，
 *   **下一个圈全部与当前圈内切**：圈心距离恰好等于 R1 - R2，260/260 全中。
 *   也就是说"距离"是定死的，唯一不确定的是"方向"。
 *   所以四个候选点摆在同一圈半径上 —— 既和真实数据一致，也不会出现
 *   "三个点在图外/在圈外"这种一眼就能排除的假选项。
 *
 * ★ 只出「给第一圈猜第二圈」这一种：
 *   再往后猜（给 2~3 个圈猜下一个）时，当前圈在屏幕上的半径只剩 80~100rpx，
 *   四个候选点会挤在一起、点都点不准（还要放大底图，640px 的图会糊）。
 *   第一圈的半径约 4000~5000 地图单位 = 屏幕半径 170~210rpx，正好够摆四个点。
 *
 * ★ 不计"误差分"：四选一只有对/错。真实圈心到选中点的距离会折算成
 *   "差几个圈半径"写在结果里 —— 那是给玩家的信息，不是分数。
 */

var rings = require("./rings.js");

var COORD = rings.COORD || 16384;      // 地图坐标尺度（和 rings.js 同一套）

var ROUNDS = 5;                        // 一局 5 题
var T_ANSWER = 10000;                  // 每题 10 秒
var PER_SCORE = 20;                    // 答对一题 20 分（5 题满分 100）
var LETTERS = ["A", "B", "C", "D"];
var MIN_SEP = (70 * Math.PI) / 180;    // 两个候选点至少隔 70°（屏幕上约 100rpx，手指点得准）
var ROT_JITTER = Math.PI / 3;          // 90° 均布时允许 ±30° 的抖动，免得每一题都长得一样
var EDGE = 0.04;                       // 候选点离地图边界至少 4%（否则会落在图外）
var TAU = Math.PI * 2;

/* ---------- 视口（为什么需要放大） ----------
   四个候选点摆在"真实圆心到当前圆心的距离"上，而这个距离在 260 局里中位数只有 1635
   地图单位 = 屏幕上 68rpx。不放大时四个点会挤在 136rpx 的范围里，96rpx 的热区互相压住。
   所以按"把这个圆撑到半径 88rpx"来定放大倍数（1.0~1.9 倍）：
     中位数那一档只要 1.3 倍 —— 底图 640×640 在这个倍数下几乎不糊；
     只有圆心几乎没移动的题（d 很小）会顶到 1.9 倍上限，再小就干脆不进题库。
   ⚠️ BOX 必须和 games/ringpick/ringpick.wxss 里 .qmap 的宽高（686rpx）一致。 */
var BOX = 686;
var K = BOX / COORD;                   // 1 个地图单位 = 多少 rpx（未放大时）
var ZOOM_DOT = 88;                     // 候选点圆圈的期望屏幕半径（rpx）
var Z_MIN = 1;
var Z_MAX = 1.9;
var MIN_D = 1100;                      // 圆心移动距离的下限（地图单位）——更小的题四个点会挤在一起

var _bank = null;

function randFn(rng) {
  return typeof rng === "function" ? rng : Math.random;
}

/* ============================================================
   题库
   ============================================================ */

/**
 * 原始序列：上游三圈样本 + 真实比赛整局序列。都从**第一圈**开始。
 * 只借数据，不改数据 —— 匹配数据里的圈是 [x,y,r] 数组，这里统一成对象。
 */
function sequences() {
  var out = [];
  rings.allSamples().forEach(function (s, i) {
    out.push({ key: "api-" + i, map: s.map, rings: s.rings });
  });
  var match = null;
  try { match = require("../data/match_rings_data.js"); } catch (e) { match = null; }
  ((match && match.games) || []).forEach(function (g, i) {
    var rs = (g.rings || []).map(function (a) {
      return Array.isArray(a) ? { x: a[0], y: a[1], r: a[2] } : a;
    });
    if (rs.length >= 2) out.push({ key: "match-" + i, map: g.map, rings: rs });
  });
  return out;
}

/**
 * 可出的题：{key, map, ring:第一圈, answer:第二圈}
 * 过滤掉"圆心几乎没动"的题（见 MIN_D）：那种题四个候选点会挤成一团、点不准。
 * 题库规模来自数据本身，不写死。
 */
function bank() {
  if (_bank) return _bank;
  _bank = sequences().filter(function (s) {
    if (s.rings.length < 2 || !s.rings[0] || !s.rings[1]) return false;
    if (!rings.mapImage(s.map)) return false;
    return dist(s.rings[0], s.rings[1]) >= MIN_D;
  }).map(function (s) {
    return { key: s.key, map: s.map, ring: s.rings[0], answer: s.rings[1] };
  });
  return _bank;
}

/* ============================================================
   抽题
   ============================================================ */

function shuffle(list, rng) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.min(rng(), 0.999999) * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 抽一局：5 道不重复的题，且**连续两题不同图**（同一张图连着刷会腻） */
function newGame(rng) {
  var r = randFn(rng);
  var list = shuffle(bank(), r);
  var out = [];
  var lastMap = "";
  for (var i = 0; i < list.length && out.length < ROUNDS; i++) {
    if (list[i].map === lastMap) continue;
    out.push(list[i]);
    lastMap = list[i].map;
  }
  return out;
}

/* ============================================================
   几何
   ============================================================ */

function dist(a, b) {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

/** 候选点必须落在地图内侧（贴边的点会让"圈内切"这件事看着不对） */
function inMap(p) {
  return p.x > COORD * EDGE && p.x < COORD * (1 - EDGE) &&
         p.y > COORD * EDGE && p.y < COORD * (1 - EDGE);
}

function pointAt(c, radius, angle) {
  return { x: c.x + radius * Math.cos(angle), y: c.y + radius * Math.sin(angle) };
}

/** 两个角度之间的夹角（0~π） */
function separation(a, b) {
  var d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

function setOk(center, radius, angles, minSep) {
  for (var i = 0; i < angles.length; i++) {
    if (!inMap(pointAt(center, radius, angles[i]))) return false;
    for (var j = i + 1; j < angles.length; j++) {
      if (separation(angles[i], angles[j]) < minSep) return false;
    }
  }
  return true;
}

/**
 * 四个候选方向：第 0 个是**真实方向**（答案圈心的角度），另外三个散开。
 *
 * 所有候选点**都在同一个半径上**（真实圆心到当前圆心的距离）—— 这样四个点全是"合法位置"，
 * 不会出现"有一个明显在图外/圈外"的假选项。摆的时候按这个顺序试：
 *   1) 90° 均布 + 抖动（看起来最像"四个方向"）；
 *   2) 系统扫描（换更小的间隔下限），**半径不动**；
 *   3) 真摆不下就均匀四等分（260 局实测没走到过这一步，留着兜底）。
 *
 * @returns {Array<{a:number, r:number}>}
 */
function directions(center, radius, base, rng) {
  // 1) 90° 均布 + 抖动
  for (var k = 0; k < 200; k++) {
    var j1 = (rng() - 0.5) * ROT_JITTER;
    var j2 = (rng() - 0.5) * ROT_JITTER;
    var j3 = (rng() - 0.5) * ROT_JITTER;
    var set = [base, base + Math.PI / 2 + j1, base + Math.PI + j2, base + Math.PI * 1.5 + j3];
    if (setOk(center, radius, set, MIN_SEP)) {
      return set.map(function (a) { return { a: a, r: radius }; });
    }
  }

  // 2) 兜底：按 2° 扫描，间隔下限逐步放宽（但半径不动）
  var limits = [MIN_SEP, (62 * Math.PI) / 180, (56 * Math.PI) / 180];
  for (var li = 0; li < limits.length; li++) {
    var picked = [base];
    for (var step = 56; step <= 304 && picked.length < 4; step += 2) {
      var a = base + (step * Math.PI) / 180;
      if (!inMap(pointAt(center, radius, a))) continue;
      var clash = false;
      for (var p = 0; p < picked.length; p++) {
        if (separation(picked[p], a) < limits[li]) { clash = true; break; }
      }
      if (!clash) picked.push(a);
    }
    if (picked.length === 4) {
      return picked.map(function (a) { return { a: a, r: radius }; });
    }
  }

  // 3) 理论上到不了这里。真到了就均匀四等分，至少不崩。
  return [0, 1, 2, 3].map(function (i) {
    return { a: base + (i * Math.PI) / 2, r: radius };
  });
}

/* ============================================================
   视口
   ============================================================ */

/**
 * 算出"把当前圈心放在框正中、并且四个候选点撑得开"的放大倍数与平移量。
 * 平移量以**框宽的比例**表示（CSS 的 translate 百分比就是相对自身尺寸的）。
 *
 * ★ 平移必须夹住：理想平移会让放大后的底图在某条边上露出空白（黑边），
 *   看起来像"地图缺了一块"。夹在 [1-z, 0] 里就等于相机贴到地图边界为止，
 *   所以任何情况下底图都铺满整个框，圈和点在框内也一定看得见。
 */
function viewport(ring, d) {
  var z = ZOOM_DOT / (d * K);
  z = Math.min(Z_MAX, Math.max(Z_MIN, z));
  z = Math.round(z * 1000) / 1000;
  var clamp = function (t) { return Math.min(0, Math.max(1 - z, t)); };
  return {
    z: z,
    tx: clamp(0.5 - (ring.x / COORD) * z),
    ty: clamp(0.5 - (ring.y / COORD) * z)
  };
}

/**
 * 地图坐标 → 屏幕上的百分比（0~100）。
 * ⚠️ x 用 v.tx、y 用 v.ty —— 两个方向各有一套平移量，写成一个函数很容易两边都用 tx，
 *    表现是"圈的上下和点的上下错开一点点"，不报错、只是看着歪（这里踩过一次）。
 */
function screenX(v, u) {
  return Math.round(((u / COORD) * v.z + v.tx) * 100 * 1000) / 1000;
}
function screenY(v, u) {
  return Math.round(((u / COORD) * v.z + v.ty) * 100 * 1000) / 1000;
}

/** 圈 → 屏幕上的定位 style */
function ringStyle(v, ring) {
  var left = Math.round(((ring.x - ring.r) / COORD * v.z + v.tx) * 100 * 1000) / 1000;
  var top = Math.round(((ring.y - ring.r) / COORD * v.z + v.ty) * 100 * 1000) / 1000;
  var size = Math.round((ring.r * 2 / COORD) * v.z * 100 * 1000) / 1000;
  return "left:" + left + "%;top:" + top + "%;width:" + size + "%;height:" + size + "%";
}

/* ============================================================
   视图
   ============================================================ */

/**
 * 一题的 WXML 视图。全部 style 在这里算好：
 *   · 底图用 transform 放大（百分比平移，避免 inline rpx）；
 *   · 圈和候选点都画在**屏幕空间**（不跟着放大），这样描边粗细、热区大小都不变。
 */
function view(q, lang, rng) {
  var r = randFn(rng);
  var ring = q.ring;
  var ans = q.answer;
  var d = dist(ring, ans);
  var base = Math.atan2(ans.y - ring.y, ans.x - ring.x);
  var v = viewport(ring, d);
  var dirs = directions(ring, d, base, r);

  // 先按真实方向摆好（第 0 个是对的），再整体打乱，免得答案永远在同一个方位
  var raw = dirs.map(function (o, i) {
    var p = pointAt(ring, o.r, o.a);
    return {
      x: p.x,
      y: p.y,
      correct: i === 0,
      style: "left:" + screenX(v, p.x) + "%;top:" + screenY(v, p.y) + "%;"
    };
  });

  var order = shuffle([0, 1, 2, 3], r);
  var options = order.map(function (k, i) {
    return {
      label: LETTERS[i],
      style: raw[k].style,
      correct: raw[k].correct,
      x: raw[k].x,
      y: raw[k].y
    };
  });

  var answerIndex = 0;
  for (var i = 0; i < options.length; i++) if (options[i].correct) answerIndex = i;

  return {
    key: q.key,
    map: q.map,
    mapName: rings.mapName(q.map, lang),
    image: rings.mapImage(q.map),
    // 底图放大 + 平移（百分比，WXML 里不用再算）
    world: "transform-origin:0 0;transform:translate(" +
      Math.round(v.tx * 100 * 1000) / 1000 + "%," +
      Math.round(v.ty * 100 * 1000) / 1000 + "%) scale(" + v.z + ");",
    zoom: v.z,
    ring: { style: ringStyle(v, ring) },
    answer: { style: ringStyle(v, ans) },
    options: options,
    answerIndex: answerIndex,
    answerR: ans.r,
    center: { x: ans.x, y: ans.y }
  };
}

/**
 * 判定：返回是否答对 + 选中的点离真实圈心多远（折算成"几个圈半径"）。
 * 时间到（没选）由页面传 null，不经过这里。
 */
function judge(v, index) {
  var o = v.options[index];
  if (!o) return { hit: false, off: 0 };
  return {
    hit: !!o.correct,
    off: v.answerR ? dist(o, v.center) / v.answerR : 0
  };
}

/** 图名（页面切语言时要用） */
function mapNameOf(map, lang) {
  return rings.mapName(map, lang);
}

module.exports = {
  ROUNDS: ROUNDS,
  T_ANSWER: T_ANSWER,
  PER_SCORE: PER_SCORE,
  LETTERS: LETTERS,
  bank: bank,
  newGame: newGame,
  view: view,
  judge: judge,
  mapNameOf: mapNameOf
};
