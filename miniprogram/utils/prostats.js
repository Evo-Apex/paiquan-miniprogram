/**
 * 排位专区：职业选手的排位数据（英雄选取 / 三人英雄组合 / 枪械选择 / 双武器搭配）。
 *
 * 数据来源**不是上游接口**，而是离线跑 B站直播回放识别出来的
 * （见项目根目录「直播识别」与交接说明）。
 *
 * 布局口径（2026-10 重做，参考国外数据站的做法）：
 *   · **先给头条数字，再给细节** —— 打开就看见"这个人最常玩什么"，
 *     而不是让用户自己在 24 行等权重的列表里找；
 *   · **英雄带头像**（28 张 88x88 的图标，见 assets/heroes/），三人组合同样用头像，
 *     比"万蒂奇 + 恶灵 + 罗芭"这种会折行的文字串好读得多；
 *   · **三层层次**：头条卡 -> top5 图标卡 -> 其余压缩成小行。
 *     全是同一字号字重的列表 = 眼睛没有入口（这是原版最大的毛病）。
 */

var i18n = require("./i18n.js");
var core = require("./core.js");
var codex = require("./codex_data.js");

/**
 * 数据来源：**包内快照 + 云端热更新**。
 *
 * 包内那份（prostats_data.js）是兜底：断网、云环境没配、集合还没建，都得能看。
 * 云端那份放在云数据库 `prostats/current`，识别脚本推一次就全端生效，
 * 不用重新发版（发版要审核，改一次数据等一天）。读云端走云函数，
 * 而不是小程序直连数据库 —— 少配一份集合权限，也不用担心被改。
 *
 * DATA 是**可变的**：setHot 会把云端那份换进来。页面读 buildAll 拿的永远是最新。
 */
var SNAPSHOT = require("./prostats_data.js");
// 注意：这里**不能**让 DATA 直接指向 SNAPSHOT —— 热更新是把内容换进来，
// 而 module.exports.DATA 是同一个对象的引用。换成新对象会让外面拿的那份变旧
// （测试里读 prostats.DATA 就会读到大盘数据，页面也会不同步）。
var DATA = {
  season: SNAPSHOT.season || "",
  updated: SNAPSHOT.updated || "",
  players: SNAPSHOT.players || []
};
var HOT = false;      // 当前用的数据是不是云端来的
var FETCHED = false;  // 本次启动是否已经问过云端（问一次就够，别每次切页都烧配额）

/* 中文名 -> 头像路径（图鉴那份数据里已经有） */
var ICON = {};
(codex.heroes || []).forEach(function (h) { ICON[h.zh] = h.icon; });
var EN = {};
(codex.heroes || []).forEach(function (h) { EN[h.zh] = h.en; });

function barWidth(pct, max) {
  if (!max || !isFinite(max) || max <= 0) return 0;
  var w = Math.round((pct / max) * 100);
  return w < 3 && pct > 0 ? 3 : w;   // 再小也留一点，别让"有数据"看起来像"没数据"
}
function fmtPct(v) { return (isFinite(v) ? v : 0).toFixed(1) + "%"; }

function heroName(zh, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  return { main: en ? (EN[zh] || zh) : zh, sub: en ? zh : (EN[zh] || "") };
}

/** 英雄条目的两种呈现：图标卡（top N）与紧凑行（其余） */
function heroCard(h, rank, max, lang) {
  var n = heroName(h.zh, lang);
  return {
    zh: h.zh, en: EN[h.zh] || h.en || "",
    main: n.main, sub: n.sub,
    icon: ICON[h.zh] || "", hasIcon: !!ICON[h.zh],
    rank: rank, pct: h.pct, pctText: fmtPct(h.pct), n: h.n,
    nText: core.num(h.n),
    bar: barWidth(h.pct, max)
  };
}

/** 三人组合：三个头像 + 一行名字（不再让名字串折行） */
function comboRow(c, max, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var zhList = c.heroes || [];
  var names = zhList.map(function (zh) { return en ? (EN[zh] || zh) : zh; });
  return {
    avatars: zhList.map(function (zh) { return ICON[zh] || ""; }),
    hasAvatars: zhList.every(function (zh) { return !!ICON[zh]; }),
    text: names.join(" · "),
    sub: zhList.join(" + "),
    pctText: fmtPct(c.pct), nText: c.n + (en ? " games" : " 局"),
    bar: barWidth(c.pct, max)
  };
}

function weaponRow(w, rank, max, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var main = en ? w.en : (w.zhShort || w.zh);
  var sub = en ? w.zh : (w.en || "");
  // 短名和英文名一样时（C.A.R. / R-99 / G7）就别重复显示了
  if (sub && main && sub.toLowerCase() === main.toLowerCase()) sub = "";
  return {
    rank: rank,
    main: main, sub: sub,
    pctText: fmtPct(w.pct), nText: core.num(w.n) + (en ? "" : " 次"),
    bar: barWidth(w.pct, max)
  };
}

function pairRow(c, rank, max, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var zhList = c.zh || [], enList = c.en || [];
  return {
    rank: rank,
    main: (en ? enList : zhList).join(" + "),
    sub: (en ? zhList : enList).join(" + "),
    pctText: fmtPct(c.pct), nText: c.n + (en ? " loadouts" : " 次"),
    bar: barWidth(c.pct, max)
  };
}

function maxOf(list, key) {
  var m = 0;
  (list || []).forEach(function (x) { if (x[key] > m) m = x[key]; });
  return m;
}

var TOP_N = 5;    // 收起时显示前五
// 展开后**最多也只显示到第十**（用户 2026-10 的要求）：
// 这一页本来就长，全量铺开会把下面的内容顶到很远。
var SHOW_N = 10;

function buildOne(p, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var heroes = p.heroes || [], combos = p.combos || [];
  var weapons = p.weapons || [], pairs = p.weaponPairs || [];
  var hMax = maxOf(heroes, "pct"), cMax = maxOf(combos, "pct");
  var wMax = maxOf(weapons, "pct"), pMax = maxOf(pairs, "pct");
  var heroTotal = heroes.reduce(function (s, h) { return s + h.n; }, 0);
  var slotTotal = weapons.reduce(function (s, w) { return s + w.n; }, 0);

  var top = (p.id === "__all__")
    ? { main: i18n.t(lang, "proAll"), sub: "", icon: "", hasIcon: false }
    : (heroes[0] ? heroName(heroes[0].zh, lang) : { main: "—", sub: "" });
  // 「综合」也要显示真正的头号英雄 —— 之前这里写成"综合"，等于头条卡什么信息都没给。
  if (heroes[0]) {
    var hn = heroName(heroes[0].zh, lang);
    top = { main: hn.main, sub: (p.id === "__all__" ? i18n.t(lang, "proAll") : hn.sub) };
  }
  var topIcon = heroes[0] ? (ICON[heroes[0].zh] || "") : "";

  return {
    id: p.id, name: p.name, tag: p.tag || "", role: p.role || "",
    source: p.source || "", hoursText: p.hours ? (p.hours + (en ? " h" : " 小时")) : "",
    note: p.note || "",
    // —— 头条层：一眼回答"这人最常玩什么、怎么配枪、样本多大" ——
    headline: {
      hero: {
        main: top.main, sub: top.sub, icon: topIcon, hasIcon: !!topIcon,
        pctText: heroes[0] ? fmtPct(heroes[0].pct) : "—",
        label: i18n.t(lang, "proTopHero")
      },
      pair: {
        main: pairs[0] ? (en ? pairs[0].en : pairs[0].zh).join(" + ") : "—",
        sub: pairs[0] ? (en ? pairs[0].zh : pairs[0].en).join(" + ") : "",
        pctText: pairs[0] ? fmtPct(pairs[0].pct) : "—",
        label: i18n.t(lang, "proTopPair")
      },
      sample: {
        value: core.num(heroTotal),
        unit: en ? "legend picks" : "次英雄选取",
        label: i18n.t(lang, "proSample"),
        sub: core.num(slotTotal) + (en ? " weapon slots" : " 个武器槽")
      }
    },
    topHeroes: heroes.slice(0, TOP_N).map(function (h, i) { return heroCard(h, i + 1, hMax, lang); }),
    restHeroes: heroes.slice(TOP_N, SHOW_N).map(function (h, i) { return heroCard(h, i + TOP_N + 1, hMax, lang); }),
    restCountText: heroes.length > TOP_N
      ? i18n.t(lang, "proMoreHeroes").replace("{n}", String(heroes.length - TOP_N)) : "",
    heroTotal: heroTotal,          // 数字版，测试用它验证合并（列表可能被显示上限截断）
    heroTotalText: core.num(heroTotal) + (en ? " picks" : " 次"),
    // 用户 2026-10 的要求：三个榜单都**只显示前五**，其余要点一下才展开。
    // topX 是前五，restX 是剩下的；hasMoreX 决定要不要画那个"展开/收起"按钮。
    // 全量列表（combos/weapons/pairs）保留着，页面测试和别处还在用。
    topCombos: combos.slice(0, TOP_N).map(function (c) { return comboRow(c, cMax, lang); }),
    restCombos: combos.slice(TOP_N, SHOW_N).map(function (c) { return comboRow(c, cMax, lang); }),
    moreCombos: combos.length > TOP_N
      ? i18n.t(lang, "proMoreCombos").replace("{n}", String(combos.length - TOP_N)) : "",
    hasMoreCombos: combos.length > TOP_N,
    topWeapons: weapons.slice(0, TOP_N).map(function (w, i) { return weaponRow(w, i + 1, wMax, lang); }),
    restWeapons: weapons.slice(TOP_N, SHOW_N).map(function (w, i) { return weaponRow(w, i + TOP_N + 1, wMax, lang); }),
    moreWeapons: weapons.length > TOP_N
      ? i18n.t(lang, "proMoreWeapons").replace("{n}", String(weapons.length - TOP_N)) : "",
    hasMoreWeapons: weapons.length > TOP_N,
    topPairs: pairs.slice(0, TOP_N).map(function (c, i) { return pairRow(c, i + 1, pMax, lang); }),
    restPairs: pairs.slice(TOP_N, SHOW_N).map(function (c, i) { return pairRow(c, i + TOP_N + 1, pMax, lang); }),
    morePairs: pairs.length > TOP_N
      ? i18n.t(lang, "proMorePairs").replace("{n}", String(pairs.length - TOP_N)) : "",
    hasMorePairs: pairs.length > TOP_N,
    combos: combos.map(function (c) { return comboRow(c, cMax, lang); }),
    weapons: weapons.map(function (w, i) { return weaponRow(w, i + 1, wMax, lang); }),
    pairs: pairs.map(function (c, i) { return pairRow(c, i + 1, pMax, lang); }),
    hasHeroes: heroes.length > 0, hasCombos: combos.length > 0,
    hasWeapons: weapons.length > 0, hasPairs: pairs.length > 0
  };
}

function merge(players, key, nameOf) {
  var acc = {}, order = [];
  players.forEach(function (p) {
    (p[key] || []).forEach(function (it) {
      var k = nameOf(it);
      if (!acc[k]) { acc[k] = { sample: it, n: 0 }; order.push(k); }
      acc[k].n += it.n;
    });
  });
  var rows = order.map(function (k) { return { sample: acc[k].sample, n: acc[k].n }; });
  rows.sort(function (a, b) { return b.n - a.n; });
  var tot = 0;
  rows.forEach(function (r) { tot += r.n; });
  return rows.map(function (r) {
    var it = JSON.parse(JSON.stringify(r.sample));
    it.n = r.n;
    it.pct = tot ? Math.round(1000.0 * r.n / tot) / 10 : 0;
    return it;
  });
}

function buildAllPlayers(lang) {
  var ps = DATA.players || [];
  return {
    id: "__all__", name: i18n.t(lang, "proAll"), tag: "", role: "",
    source: ps.map(function (p) { return p.tag ? (p.name + "·" + p.tag) : p.name; }).join(" / "),
    hours: Math.round(ps.reduce(function (s, p) { return s + (p.hours || 0); }, 0) * 10) / 10,
    note: i18n.t(lang, "proAllNote"),
    heroes: merge(ps, "heroes", function (x) { return x.zh; }),
    combos: merge(ps, "combos", function (x) { return x.heroes.join("|"); }),
    weapons: merge(ps, "weapons", function (x) { return x.zh; }),
    weaponPairs: merge(ps, "weaponPairs", function (x) { return x.zh.join("|"); })
  };
}

function playerById(id) {
  var ps = DATA.players || [];
  for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
  return null;
}

function chipList(lang) {
  // chips 里只放 id 和名字：**不放"主播/职业选手"这类身份标签**（用户要求）。
  // 那个标签当初是为区分两个同名 QQ 加的，QQ 合并后就没必要了。
  var out = [{ id: "__all__", name: i18n.t(lang, "proAll") }];
  (DATA.players || []).forEach(function (p) {
    out.push({ id: p.id, name: p.name });
  });
  return out;
}

/** 页面入口 */
function buildAll_view(activeId, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var id = activeId || "__all__";
  var stat = (id === "__all__")
    ? buildOne(buildAllPlayers(lang), lang)
    : buildOne(playerById(id) || (DATA.players || [])[0] || {}, lang);
  var chips = chipList(lang).map(function (c) {
    c.active = (c.id === id);
    return c;
  });
  return {
    updatedText: DATA.updated ? (en ? "updated " + DATA.updated : "更新于 " + DATA.updated) : "",
    chips: chips,
    active: id,
    stat: stat
  };
}

module.exports = { DATA: DATA, buildAll: buildAll_view, chipList: chipList, playerById: playerById, ICON: ICON };

/* ============================================================
   云端热更新
   ============================================================ */

/**
 * 校验云端 payload。宁可不换，也不能把半截数据换上去 ——
 * 换上去之后页面就是一片空白，而用户完全不知道发生了什么。
 */
function validPayload(p) {
  if (!p || typeof p !== "object") return false;
  if (!Array.isArray(p.players) || !p.players.length) return false;
  for (var i = 0; i < p.players.length; i++) {
    var x = p.players[i];
    if (!x || !x.id || !x.name) return false;
    if (!Array.isArray(x.heroes) || !Array.isArray(x.combos) || !Array.isArray(x.weapons)) return false;
  }
  return true;
}

/**
 * 用云端数据替换包内快照。返回是否真的换了（测试直接调它，不碰 wx）。
 */
function setHot(payload) {
  if (!validPayload(payload)) return false;
  // 原地改，保持对象引用不变（见 DATA 定义处的注释）
  DATA.season = String(payload.season || (SNAPSHOT.season || ""));
  DATA.updated = String(payload.updated || "");
  DATA.players = payload.players;
  HOT = true;
  return true;
}

/** 恢复成包内快照（云端数据被判定有问题时用；也方便测试） */
function useSnapshot() {
  DATA.season = SNAPSHOT.season || "";
  DATA.updated = SNAPSHOT.updated || "";
  DATA.players = SNAPSHOT.players || [];
  HOT = false;
  return true;
}

function isHot() { return HOT; }

/**
 * 拉一次云端数据。
 * **永远回调，绝不抛异常**：这里失败只是"数据旧一点"，不该让页面报错。
 * @param {function(boolean)} cb 参数 = 是否真的换了数据
 */
function refresh(cb) {
  var done = typeof cb === "function" ? cb : function () {};
  if (FETCHED) { done(false); return; }
  FETCHED = true;

  var cloud = require("./cloud.js");
  cloud.callCloud({ action: "prostats" }).then(function (r) {
    if (!r || !r.ok || !r.data) { done(false); return; }
    done(setHot(r.data));
  }, function () {
    done(false);
  });
}

module.exports.refresh = refresh;
module.exports.setHot = setHot;
module.exports.useSnapshot = useSnapshot;
module.exports.isHot = isHot;
module.exports.validPayload = validPayload;
