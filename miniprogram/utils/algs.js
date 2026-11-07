/**
 * ALGS 职业赛场：官方赛事（ALGS 冠军赛 / 季后赛 / 职业联赛…）的赛后统计。
 *
 * 和排位专区、图鉴一样是**纯本地的离线数据**（algs_data.js 由
 * 直播识别/build_algs.py 生成），不联网、不耗云函数配额。
 *
 * 为什么不做成"实时接口"——这是实测定的，别改回去：
 *   数据源 apexlegendsstatus.com/algs 的**赛事总览页**可以直接抓，
 *   但同站其他页（含它自己的 /algs/public-api/*）全是 Cloudflare 人机校验，
 *   非浏览器客户端一律 403。云函数也是非浏览器，所以同样拿不到。
 *   → 只能是快照，界面上必须写"更新于"。
 *
 * 两个刻意的设计：
 *   1. **英雄名和头像不在数据文件里**，只存英文名，渲染时查 codex_data.js。
 *      单一数据源，免得两处译名打架；也不会有"图鉴里有、这里没头像"的情况。
 *   2. **认不出的英雄照原样显示英文**（数据源上了新英雄时会出现），
 *      不猜中文名 —— 项目口径：猜错的名字比没有更糟。
 */

var i18n = require("./i18n.js");
var core = require("./core.js");
var DATA = require("../data/algs_data.js");
var codex = require("../data/codex_data.js");

/* 英文名 -> 图鉴里的那一条（含中文名和头像） */
var HERO = {};
(codex.heroes || []).forEach(function (h) {
  if (h.en) HERO[h.en.toLowerCase()] = h;
});

function heroOf(en) {
  var h = HERO[String(en || "").toLowerCase()];
  if (h) return { zh: h.zh, en: h.en, icon: h.icon || "", known: true };
  // 图鉴里没有这个英雄：露英文原文，不给假译名，也不给假头像
  return { zh: en, en: en, icon: "", known: false };
}

/* 赛事名的中文写法。
   ⚠️ 这是**手维护的小词表**，不是自动翻译：ALGS 的赛事名在中文社区里
      有约定俗成的叫法（冠軍賽 / 季後賽 / 職業聯賽…），机器翻会翻错。
      数据源上了新赛事（词表里查不到）就原样显示英文 —— 不猜。 */
var LEAGUE_ZH = {
  "ALGS-Championships": "冠军赛",
  "ALGS-Playoffs": "季后赛",
  "ALGS-Open": "公开赛",
  "EWC": "电竞世界杯",
  "Pro-League": "职业联赛",
  "LCQ": "最后机会赛",
  "PLQ": "职业联赛资格赛",
  "BLGS": "BLGS",
  "ENC-Qualifiers": "国家杯资格赛"
};
var LEAGUE_EN = {
  "ALGS-Championships": "Championship",
  "ALGS-Playoffs": "Playoffs",
  "ALGS-Open": "Open",
  "EWC": "EWC",
  "Pro-League": "Pro League",
  "LCQ": "LCQ",
  "PLQ": "PLQ",
  "BLGS": "BLGS",
  "ENC-Qualifiers": "ENC Qualifiers"
};
var REGION_ZH = {
  Global: "全球", EMEA: "欧洲中东非洲", NA: "美洲",
  APAC_N: "亚太北", APAC_S: "亚太南", SA: "南美"
};

function splitShort(split) {                    // "Y5-Split2" -> "Y5S2"
  var m = /^Y(\d+)-Split(\d)$/.exec(String(split || ""));
  return m ? ("Y" + m[1] + "S" + m[2]) : String(split || "");
}

function splitText(split, lang) {               // "Y5-Split2" -> 中文「第 5 赛季 第 2 阶段」
  var en = i18n.normalizeLang(lang) === "en";
  var m = /^Y(\d+)-Split(\d)$/.exec(String(split || ""));
  if (!m) return String(split || "");
  return en ? ("Year " + m[1] + " \u00b7 Split " + m[2])
            : ("第 " + m[1] + " 赛季 \u00b7 第 " + m[2] + " 阶段");
}

function leagueName(league, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var map = en ? LEAGUE_EN : LEAGUE_ZH;
  if (Object.prototype.hasOwnProperty.call(map, league)) {
    // 中文那边带上 ALGS 前缀（社区里就是这么写的），英文用全称；
    // EWC / BLGS 本身是缩写，不加前缀。
    if (en) return "ALGS " + map[league];
    return (league === "EWC" || league === "BLGS") ? map[league] : ("ALGS " + map[league]);
  }
  return league;                                // 认不出：原样给，不猜
}

/** 赛区名。比赛专区的「下一场比赛」也要用，所以单独导出（别在下游再维护一份）。 */
function regionName(region, lang) {
  var s = String(region || "");
  if (i18n.normalizeLang(lang) === "en") return s;
  return REGION_ZH[s] || s;
}

function fmtPct(v) { return (isFinite(v) ? v : 0).toFixed(1) + "%"; }
function bar(pct, max) {
  if (!max || !isFinite(max) || max <= 0) return 0;
  var w = Math.round((pct / max) * 100);
  return w < 3 && pct > 0 ? 3 : w;
}

/** 名次来源不同，口径说明必须跟着变 —— 不能拿小组赛积分冒充最终名次。 */
function rankNote(ev, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var stage = ev.stage || "";
  if (ev.rankBy === "bracket" && stage === "Finals") {
    return i18n.t(lang, "algsRankFinal");
  }
  if (ev.rankBy === "bracket") {
    return i18n.t(lang, "algsRankStage").replace("{stage}", stage || "—");
  }
  return en
    ? "Ranked by total points across the whole event (group stage included), which is not the final placement."
    : "按赛事全程累计积分排序（含小组赛阶段），不等于最终名次。";
}

function eventView(ev, lang) {
  var en = i18n.normalizeLang(lang) === "en";

  var heroes = (ev.legends || []).map(function (l) {
    var h = heroOf(l.en);
    return {
      key: l.en,
      main: en ? h.en : h.zh,
      sub: en ? (h.known ? h.zh : "") : h.en,
      icon: h.icon, hasIcon: !!h.icon,
      pctText: fmtPct(l.pct),
      nText: core.num(l.n),
      winText: fmtPct(l.win),
      top5Text: fmtPct(l.top5)
    };
  });

  var combos = (ev.combos || []).map(function (c) {
    var hs = (c.heroes || []).map(heroOf);
    return {
      key: (c.heroes || []).join("|"),
      text: hs.map(function (h) { return en ? h.en : h.zh; }).join(" \u00b7 "),
      avatars: hs.map(function (h) { return h.icon; }),
      hasAvatars: hs.every(function (h) { return !!h.icon; }),
      pctText: fmtPct(c.pct),
      nText: core.num(c.n) + (en ? " games" : " 局")
    };
  });

  var st = (ev.standings || []).map(function (s) {
    return {
      // 前三名由视图模型给标记，**不在 WXSS 里用 :nth-child** ——
      // 小程序官方明确不支持带参数的伪类（项目设计文档「硬约束」第一条）。
      top3: s.rank <= 3,
      rank: s.rank, team: s.team,
      scoreText: core.num(s.score),
      winsText: s.wins ? (s.wins + (en ? " wins" : " 胜")) : ""
    };
  });

  var hMax = 0, cMax = 0;
  (ev.legends || []).forEach(function (l) { if (l.pct > hMax) hMax = l.pct; });
  (ev.combos || []).forEach(function (c) { if (c.pct > cMax) cMax = c.pct; });
  heroes.forEach(function (h, i) { h.bar = bar((ev.legends[i] || {}).pct, hMax); });
  combos.forEach(function (c, i) { c.bar = bar((ev.combos[i] || {}).pct, cMax); });

  return {
    id: ev.id,
    label: leagueName(ev.league, lang),
    sub: splitText(ev.split, lang) + " \u00b7 " +
         (en ? ev.region : (REGION_ZH[ev.region] || ev.region)),
    // 只留赛事路径用于追溯，不留完整 URL —— 小程序端不许出现外部域名
    path: ev.path || "",
    champion: ev.champion || "",
    // 没有决赛名次时，榜首只能叫「全程积分第一」—— 那是另一件事，不能写"冠军"
    championLabel: i18n.t(lang, ev.champion ? "algsChampion" : "algsTopPoints"),
    championText: ev.champion || ev.pointsLeader || "",
    teamsText: ev.teams ? (ev.teams + (en ? " teams" : " 支战队")) : "",
    gamesText: ev.games ? (ev.games + (en ? " games" : " 局")) : "",
    mapsText: (ev.maps || []).map(function (m) {
      var n = en ? m.en : (core.translateMapName(m.en) || m.en);
      return n + " " + m.n;
    }).join(" \u00b7 "),
    hasStandings: st.length > 0,
    standings: st,
    rankNote: rankNote(ev, lang),
    hasLegends: heroes.length > 0,
    legends: heroes,
    legendTotalText: core.num(ev.legendTotal || 0) + (en ? " picks" : " 次英雄选取"),
    hasCombos: combos.length > 0,
    combos: combos
  };
}

function chipList(lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var list = DATA.events || [];

  // 同一个赛段下的职业联赛会按赛区各出一份（亚太北 / 亚太南），
  // 光看「Y6S2 职业联赛」有两个一模一样的 chip，用户根本分不清点的是哪个。
  // 所以只在**名字会撞车**的时候补上赛区，别让所有 chip 都变长。
  var seen = {};
  list.forEach(function (ev) {
    var k = ev.split + "|" + ev.league;
    seen[k] = (seen[k] || 0) + 1;
  });

  return list.map(function (ev) {
    var map = en ? LEAGUE_EN : LEAGUE_ZH;
    var lg = Object.prototype.hasOwnProperty.call(map, ev.league)
      ? map[ev.league] : ev.league;
    var name = splitShort(ev.split) + " " + lg;
    if (seen[ev.split + "|" + ev.league] > 1) {
      name += " " + (en ? ev.region : (REGION_ZH[ev.region] || ev.region));
    }
    return { id: ev.id, name: name };
  });
}

function byId(id) {
  var list = DATA.events || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/** 页面入口：events 为空时返回 null，界面据此整块不渲染。 */
function buildAll(activeId, lang) {
  var list = DATA.events || [];
  if (!list.length) return null;
  var en = i18n.normalizeLang(lang) === "en";
  var id = activeId;
  if (!byId(id)) id = list[0].id;
  var chips = chipList(lang).map(function (c) {
    c.active = (c.id === id);
    return c;
  });
  var ev = byId(id) || list[0];
  var view = eventView(ev, lang);
  return {
    updatedText: DATA.updated
      ? (en ? "snapshot " + DATA.updated : "快照更新于 " + DATA.updated) : "",
    sourceText: DATA.source || "",
    eventCountText: list.length + (en ? " events" : " 个赛事"),
    chips: chips,
    active: id,
    ev: view,
    // 快照口径：数据不是实时的，且云函数取不到 —— 用户有权知道这一点
    caveat: i18n.t(lang, "algsCaveat")
  };
}

module.exports = {
  DATA: DATA,
  buildAll: buildAll,
  chipList: chipList,
  eventView: eventView,
  heroOf: heroOf,
  // 比赛专区「下一场比赛」也复用同一套赛事名 / 阶段名写法，避免两处译名打架
  leagueName: leagueName,
  splitText: splitText,
  regionName: regionName
};
