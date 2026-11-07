/**
 * 轮盘的候选池与几何计算（「小游戏」分类里的娱乐功能）。
 *
 * 两个轮盘、四种玩法（用户 2026-10 定的）：
 *   英雄轮盘 · 抽一位英雄        —— 从全部英雄里随机 1 位
 *   英雄轮盘 · 三人英雄组合      —— 随机 3 位**不重复**的英雄，凑一队
 *   武器轮盘 · 一把长枪 + 一把短枪 —— 长枪池抽 1 把、短枪池抽 1 把
 *   武器轮盘 · 两把枪纯随机      —— 从全部枪里随便抽 2 把（可能同枪种）
 *
 * ★ 为什么英雄名 / 枪名不写在这个文件里：
 *   `data/codex_data.js` 是**唯一**同时具备 id、中文名、英文名、头像路径的来源，
 *   而头像文件就在 `miniprogram/assets/heroes/` 下。在这里再抄一份名字，
 *   下次识别数据更新（出新英雄 / 改译名）两边就会打架 —— 一边多一个、一边少一个。
 *   所以这个文件只做三件事：**读、分类、洗牌**。
 *
 * ★ 枪种（长/短）codex 里没有，只能在这里定义 —— 这是玩法规则，不是数据。
 *   分法用国内玩家通行的口径：
 *     长枪 = 突击步枪 / 轻机枪 / 精确射手 / 狙击枪（能打中远距离）
 *     短枪 = 冲锋枪 / 霰弹枪 / 手枪（近距离）
 *
 * ★ 纯随机，不看选取率、不按胜率加权（用户要的是"图一乐"，不是推荐系统）。
 */

var codex = require("../data/codex_data.js");

/* ============================================================
   枪种
   ============================================================ */

var CLASSES = {
  ar: { zh: "突击步枪", en: "Assault rifle", side: "long" },
  lmg: { zh: "轻机枪", en: "LMG", side: "long" },
  marksman: { zh: "精确射手", en: "Marksman", side: "long" },
  sniper: { zh: "狙击枪", en: "Sniper", side: "long" },
  smg: { zh: "冲锋枪", en: "SMG", side: "short" },
  shotgun: { zh: "霰弹枪", en: "Shotgun", side: "short" },
  pistol: { zh: "手枪", en: "Pistol", side: "short" }
};

/**
 * 武器 id → 枪种。
 * ⚠️ 这张表必须覆盖 codex_data.weapons 里的**每一把枪**（投掷刀除外）——
 *    tests/wheel.test.mjs 有一条用例盯着：漏一把，那把枪就永远抽不到，
 *    而界面上完全看不出来。
 */
var WEAPON_CLASS = {
  r301: "ar", flatline: "ar", hemlok: "ar", havoc: "ar", nemesis: "ar",
  spitfire: "lmg", rampage: "lmg", devotion: "lmg", lstar: "lmg",
  g7: "marksman", tripletake: "marksman", "3030": "marksman", bocek: "marksman",
  longbow: "sniper", chargerifle: "sniper", sentinel: "sniper", kraber: "sniper",
  r99: "smg", car: "smg", alternator: "smg", volt: "smg", prowler: "smg",
  eva8: "shotgun", mastiff: "shotgun", peacekeeper: "shotgun", mozambique: "shotgun",
  p2020: "pistol", re45: "pistol", wingman: "pistol"
};

/** codex 里混进来的一件"不是枪"的东西（直播识别把近战投掷也算进去了） */
var NOT_GUNS = { throwknife: true };

/**
 * 轮盘上的短标签。
 * 为什么需要它：轮盘上 29 个名字是**径向排字**的，一片的弧长只有五十来 rpx，
 * 全名（"复仇女神连发突击步枪"）根本塞不进去。结果卡片里用的仍是全名。
 */
var SHORT = {
  nemesis: { zh: "复仇女神", en: "Nemesis" },
  car: { zh: "C.A.R.", en: "C.A.R." },
  prowler: { zh: "猎兽", en: "Prowler" },
  tripletake: { zh: "三重式", en: "Triple" },
  chargerifle: { zh: "充能", en: "Charge" },
  havoc: { zh: "哈沃克", en: "Havoc" },
  hemlok: { zh: "赫姆洛克", en: "Hemlok" },
  r99: { zh: "R-99", en: "R-99" },
  r301: { zh: "R-301", en: "R-301" },
  mozambique: { zh: "莫桑比克", en: "Mozam" },
  flatline: { zh: "平行", en: "VK-47" },
  wingman: { zh: "辅助手枪", en: "Wingman" },
  re45: { zh: "RE-45", en: "RE-45" },
  g7: { zh: "G7", en: "G7" },
  spitfire: { zh: "喷火", en: "M600" },
  kraber: { zh: "克雷贝尔", en: "Kraber" },
  alternator: { zh: "转换者", en: "Alt." },
  rampage: { zh: "暴走", en: "Rampage" },
  volt: { zh: "电能", en: "Volt" },
  devotion: { zh: "专注", en: "Devotion" },
  lstar: { zh: "L-STAR", en: "L-STAR" },
  "3030": { zh: "30-30", en: "30-30" },
  bocek: { zh: "波塞克", en: "Bocek" },
  longbow: { zh: "长弓", en: "Longbow" },
  sentinel: { zh: "哨兵", en: "Sentinel" },
  eva8: { zh: "EVA-8", en: "EVA-8" },
  mastiff: { zh: "敖犬", en: "Mastiff" },
  peacekeeper: { zh: "和平", en: "PK" },
  p2020: { zh: "P2020", en: "P2020" }
};

/* ============================================================
   池子
   ============================================================ */

var _heroes = null;
var _weapons = null;

/** 全部英雄：[{id, zh, en, icon}]。顺序沿用 codex（按职业选手选取率）。 */
function heroes() {
  if (_heroes) return _heroes;
  _heroes = (codex.heroes || []).map(function (h) {
    return { id: h.id, zh: h.zh || h.en, en: h.en || h.zh, icon: h.icon || "" };
  });
  return _heroes;
}

/** 全部枪：[{id, zh, en, shortZh, shortEn, cls, side}]。投掷刀这种非枪械会被剔掉。 */
function weapons() {
  if (_weapons) return _weapons;
  _weapons = [];
  (codex.weapons || []).forEach(function (w) {
    if (NOT_GUNS[w.id]) return;
    var cls = WEAPON_CLASS[w.id];
    if (!cls) return;                 // 没见过的新枪：宁可不进池，也不瞎归类（测试会红）
    var sh = SHORT[w.id] || {};
    _weapons.push({
      id: w.id,
      zh: w.zh || w.en,
      en: w.en || w.zh,
      shortZh: sh.zh || w.zh || w.en,
      shortEn: sh.en || w.en || w.zh,
      cls: cls,
      side: CLASSES[cls].side
    });
  });
  return _weapons;
}

function bySide(side) {
  return weapons().filter(function (w) { return w.side === side; });
}

/** 显示名：全名（结果卡片用） */
function nameOf(item, lang) {
  return lang === "en" ? item.en : item.zh;
}

/** 轮盘上的短标签 */
function shortOf(item, lang) {
  if (item.shortEn === undefined) return nameOf(item, lang);
  return lang === "en" ? item.shortEn : item.shortZh;
}

/** 枪种名 */
function className(item, lang) {
  var c = CLASSES[item.cls];
  if (!c) return "";
  return lang === "en" ? c.en : c.zh;
}

/** 池子规模（界面上写「29 把枪（长 17 / 短 12）」） */
function stats() {
  var w = weapons();
  var long = 0;
  var short = 0;
  w.forEach(function (x) { if (x.side === "short") short++; else long++; });
  return { heroes: heroes().length, weapons: w.length, long: long, short: short };
}

/* ============================================================
   随机
   ============================================================ */

/** 注入随机源是为了测试能跑出确定的顺序（默认 Math.random） */
function randFn(rand) {
  return typeof rand === "function" ? rand : Math.random;
}

/**
 * 从 list 里抽 k 个**不重复**的。
 * 只做前 k 次 Fisher–Yates，不把整池洗完 —— 29 个元素无所谓，但 300 个时就有所谓。
 */
function sample(list, k, rand) {
  var r = randFn(rand);
  var idx = [];
  for (var i = 0; i < list.length; i++) idx.push(i);
  var n = Math.min(k, list.length);
  for (var j = 0; j < n; j++) {
    var t = j + Math.floor(Math.min(r(), 0.999999) * (idx.length - j));
    var tmp = idx[j]; idx[j] = idx[t]; idx[t] = tmp;
  }
  return idx.slice(0, n).map(function (i) { return list[i]; });
}

/** 英雄轮盘：抽 1 位 / 抽 3 位（不重复） */
function drawHeroes(count, rand) {
  return sample(heroes(), count === 3 ? 3 : 1, rand);
}

/**
 * 武器轮盘：
 *   "pair" —— 一把长枪 + 一把短枪（两个池子各抽一把，所以不可能抽到同枪种）
 *   "any"  —— 两把纯随机（同一个池子，但仍不重复：两把一模一样的枪没有意义）
 */
function drawWeapons(mode, rand) {
  var r = randFn(rand);
  if (mode === "pair") {
    return sample(bySide("long"), 1, r).concat(sample(bySide("short"), 1, r));
  }
  return sample(weapons(), 2, r);
}

/** 按玩法抽：kind = hero | weapon，mode = one | triple | pair | any */
function draw(kind, mode, rand) {
  if (kind === "weapon") return drawWeapons(mode === "pair" ? "pair" : "any", rand);
  return drawHeroes(mode === "triple" ? 3 : 1, rand);
}

/* ============================================================
   转盘几何
   ============================================================ */

var ARC_STEPS = 4;    // 每片圆弧用 4 段折线近似：最大径向误差 < 0.5%，肉眼看不出来

function rad(deg) {
  return (deg * Math.PI) / 180;
}

function pct(v) {
  return Math.round(v * 100) / 100;
}

/**
 * 把 n 等分的转盘算成 WXML 能直接用的样式字符串。
 *
 * 坐标系：0° = **正上方**，顺时针增加（和转盘的直觉一致）。
 *
 * ⚠️ 扇形一律用 `clip-path: polygon(...)` + **百分比** 画：
 *    小程序里 clip-path 用 rpx 会被编译期替换搞坏（docs/design/README.md 有记载），
 *    百分比是安全的。
 *
 * @param {number} n      片数
 * @param {number} [radius] 标签离圆心的距离（0~1，占半径的比例）
 * @returns {Array<{i:number, clip:string, lx:number, ly:number, rot:number}>}
 *   lx/ly 是标签中心在容器里的百分比坐标；rot 是让文字**沿半径方向**排的旋转角。
 */
function layout(n, radius) {
  var total = Math.max(1, Math.floor(n || 0));
  var r = radius == null ? 0.76 : radius;
  var step = 360 / total;
  var out = [];
  for (var i = 0; i < total; i++) {
    var a0 = i * step;
    var a1 = a0 + step;
    var pts = ["50% 50%"];
    for (var k = 0; k <= ARC_STEPS; k++) {
      var a = a0 + (a1 - a0) * (k / ARC_STEPS);
      pts.push(pct(50 + 50 * Math.sin(rad(a))) + "% " + pct(50 - 50 * Math.cos(rad(a))) + "%");
    }
    var mid = a0 + step / 2;
    // 径向排字：转到"沿半径"的方向；左下那一半再翻 180°，否则字是倒着的。
    var rot = mid - 90 + (mid > 90 && mid < 270 ? 180 : 0);
    out.push({
      i: i,
      clip: "polygon(" + pts.join(", ") + ")",
      lx: pct(50 + r * 50 * Math.sin(rad(mid))),
      ly: pct(50 - r * 50 * Math.cos(rad(mid))),
      rot: pct(rot)
    });
  }
  return out;
}

/** 第 i 片的中线角度（0° = 正上方） */
function midAngle(i, n) {
  var total = Math.max(1, Math.floor(n || 1));
  return (i + 0.5) * (360 / total);
}

/**
 * 让第 i 片停在正上方的指针下：转盘要转到的角度（0~360）。
 * 转盘顺时针转 θ 度，第 i 片的中线就从 mid 挪到 mid + θ，所以要 θ = 360 - mid。
 */
function angleFor(i, n) {
  var a = (360 - midAngle(i, n)) % 360;
  return pct(a < 0 ? a + 360 : a);
}

module.exports = {
  CLASSES: CLASSES,
  WEAPON_CLASS: WEAPON_CLASS,
  heroes: heroes,
  weapons: weapons,
  bySide: bySide,
  nameOf: nameOf,
  shortOf: shortOf,
  className: className,
  stats: stats,
  sample: sample,
  drawHeroes: drawHeroes,
  drawWeapons: drawWeapons,
  draw: draw,
  layout: layout,
  midAngle: midAngle,
  angleFor: angleFor
};
