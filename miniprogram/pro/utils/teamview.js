/**
 * 战队页：云函数 proTeam 回的数据（Liquipedia 归一化过的）→ 界面字段。
 *
 * 纯函数，tests/proteam.test.mjs 直接测；页面只管"取数 + setData"（AI-CONTEXT §3）。
 * 版式照 August 的战队页设计稿（2026-11-07，战队页设计稿-浅色.svg）：
 *   深色大卡（队名缩写方块 + 队名 + 赛区标签，下面进入 Apex / 累计奖金）
 *   → 现役阵容（选手卡 + 教练、替补一行一个）→ 重要比赛成绩 → 阵容变动（+ / −）→ 历任队员 → 数据来源入口。
 * 和设计稿不一样的地方（数据没有，不编）：
 *   - 没有「所在地」：Apex 维基的战队只写了赛区，没写国家；赛区放在大卡的标签里；
 *   - 选手卡上没有指挥 / 突击这类分工：Liquipedia 没记；卡上写国籍（队长写上"队长"）；
 *     照片是 ALGS 定妆照（云函数给 cloud:// 地址，2026-11-07 起），没有照片的照旧剪影；
 *   - 阵容变动里没有"退役"：转会记录只写去了哪队，没有下家就只写"离队"。
 * 「进入 Apex」取最早的队员加入、比赛、转会日期：维基上的成立日期各队写法不一（有的写的是俱乐部成立那年）。
 */
var i18n = require("../../utils/i18n.js");
var names = require("../../utils/pronames.js");
var view = require("./view.js");

var MOVES_FIRST = 4;    // 阵容变动先显示几次（设计稿：最近 4 次）
var FORMER_FIRST = 5;   // 历任队员先显示几个
var APEX_START = "2019-02-04";   // Apex 发售那天；比它早的日期不是 Apex 分部的

// 赛区标签左边的缩写（设计稿的红底 NA）；没有的赛区只写名字
var REGION_CODE = {
  "north america": "NA", "south america": "SA", "latin america": "LATAM", "americas": "AMER",
  "europe": "EU", "emea": "EMEA", "middle east": "ME", "africa": "AF", "cis": "CIS",
  "asia-pacific north": "APAC-N", "asia-pacific south": "APAC-S", "asia-pacific": "APAC",
  "asia": "ASIA", "southeast asia": "SEA", "south asia": "SAS", "oceania": "OCE",
  "china": "CN", "japan": "JP", "korea": "KR"
};

/** 队里的身份 → 几类（和云端 liquipedia.roleKind 同一套） */
function roleKind(role) {
  var r = String(role || "").trim().toLowerCase();
  if (!r || /^(captain|loan|tryout)$/.test(r)) return "player";
  if (/coach/.test(r)) return /inactive/.test(r) ? "coachInactive" : "coach";
  if (/stand-?in|substitute/.test(r)) return "sub";
  if (/inactive|suspended/.test(r)) return "inactive";
  return "other";
}

function dayNum(d) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null;
}

function isPlayer(m) { return !m.type || m.type === "player"; }
function onTeam(m) { return !m.leave && (m.status === "active" || m.status === "inactive"); }
function personKey(m) { return m.page || ("id:" + m.id); }

/* ---------------- 大卡 ---------------- */

function badgeOf(region, lang, T) {
  var key = String(region || "").toLowerCase();
  if (!key) return null;
  var label = names.region(region, lang);
  return { code: REGION_CODE[key] || "", label: lang === "en" ? label : T.proTeamRegion.replace("{r}", label) };
}

/** 进入 Apex 那年：最早的队员加入、比赛、转会日期；都没有才用维基上的成立日期 */
function enteredYear(info, members, results, transfers) {
  var first = "";
  var take = function (d) {
    d = String(d || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= APEX_START && (!first || d < first)) first = d;
  };
  (members || []).forEach(function (m) { take(m.join); });
  (results || []).forEach(function (r) { take(r.date); });
  (transfers || []).forEach(function (t) { take(t.date); });
  if (!first && info) take(info.created);
  return first ? first.slice(0, 4) : "";
}

function factsOf(info, members, results, transfers, lang, T) {
  var facts = [];
  var y = enteredYear(info, members, results, transfers);
  if (y) facts.push({ k: T.proTeamEntered, v: T.proYearVal.replace("{y}", y) });
  if (info && /^disbanded$/i.test(info.status || "")) {
    var dy = String(info.disbanded || "").slice(0, 4);
    facts.push(dy ? { k: T.proTeamDisbanded, v: T.proYearVal.replace("{y}", dy) } : { k: T.proTeamStatus, v: T.proTeamDisbandedYes });
  }
  var earn = view.money(info && info.earnings);
  if (earn) facts.push({ k: T.proEarnings, v: earn });
  return facts;
}

/* ---------------- 现役阵容 ---------------- */

function rosterOf(members, lang, T) {
  var sep = T.proSep;
  var cards = [];
  var rows = [];
  var subs = [];
  var coaches = 0;
  var players = 0;
  (members || []).forEach(function (m, i) {
    if (!onTeam(m)) return;
    var kind = roleKind(m.role);
    var since = view.sinceText(m.join, lang, T);
    var base = { key: i + "|" + personKey(m), page: m.hasPage ? m.page : "", name: m.id, initial: view.firstChar(m.id) };
    if (!isPlayer(m)) {
      if (kind !== "coach" || m.status !== "active") return;   // 暂停执教的教练不列
      coaches += 1;
      rows.push(Object.assign(base, { text: [names.role(m.role, lang), since].filter(Boolean).join(sep) }));
      return;
    }
    players += 1;
    if (m.status === "active" && kind === "player") {
      var meta = [names.nat(m.nat, lang), /^captain$/i.test(m.role || "") ? names.role("Captain", lang) : ""].filter(Boolean).join(" · ");
      cards.push(Object.assign(base, { meta: meta, photo: String(m.photo || "") }));   // 照片没有 → ""，卡上用剪影
    } else {
      // 替补、暂停比赛的队员：一行一个，写身份和加入时间
      var what = m.status === "inactive" || kind === "inactive" ? names.status("inactive", lang) : names.role(m.role, lang);
      subs.push(Object.assign(base, { text: [what, since].filter(Boolean).join(sep) }));
    }
  });
  if (!players && !coaches) return { has: false, cards: [], rows: [], countText: "" };
  return {
    has: true,
    cards: cards,
    rows: rows.concat(subs),   // 设计稿：教练紧跟在选手卡下面
    countText: coaches
      ? T.proRosterCountPC.replace("{p}", String(players)).replace("{c}", String(coaches))
      : T.proRosterCountP.replace("{p}", String(players))
  };
}

/* ---------------- 阵容变动 ---------------- */

/**
 * 一条转会记录 → { text, sign }（sign：in = 进了阵容，out = 离开阵容）；
 * 队内身份没变（比如队长换成普通队员）→ null，不算变动。
 */
function moveOf(t, lang, T) {
  var sep = T.mvSep;
  var from = t.from ? T.mvFrom.replace("{t}", t.from) : "";
  var to = t.to ? T.mvTo.replace("{t}", t.to) : "";
  var k1 = t.k1;
  var k2 = t.k2;
  var coach1 = k1 === "coach" || k1 === "coachInactive";
  if (t.move === "join") {
    if (k2 === "coach" || k2 === "coachInactive") return { sign: "in", text: [T.mvJoinCoach, from].filter(Boolean).join(sep) };
    if (k2 === "sub") return { sign: "in", text: [T.mvJoinSub, from].filter(Boolean).join(sep) };
    return { sign: "in", text: from ? [T.mvJoin, from].join(sep) : T.mvJoinFree };
  }
  if (t.move === "leave") {
    return { sign: "out", text: [coach1 ? T.mvCoachLeave : T.mvLeave, to].filter(Boolean).join(sep) };
  }
  if (k1 === k2) return null;
  if (k2 === "coach") return { sign: "in", text: k1 === "coachInactive" ? T.mvCoachBack : T.mvToCoach };
  if (k2 === "coachInactive") return { sign: "out", text: T.mvCoachPause };
  if (k2 === "inactive") return { sign: "out", text: T.mvToInactive };
  if (k2 === "sub") return { sign: "out", text: T.mvToSub };
  if (k2 === "player") {
    if (k1 === "inactive") return { sign: "in", text: T.mvBack };
    if (k1 === "sub") return { sign: "in", text: T.mvPromoted };
    return { sign: "in", text: T.mvToPlayer };
  }
  // 转成主播、经理这些工作人员
  var r2 = names.role(t.r2, lang) || T.mvStaff;
  return { sign: "out", text: (coach1 ? T.mvCoachToRole : T.mvToRole).replace("{r}", r2) };
}

/* ---------------- 历任队员 ---------------- */

/**
 * 以前在队、现在不在的选手（教练不算），一人一行：
 * 在队时间是几段相加（每段都要有加入和离队日期，缺一段就不写时长 —— 宁可空着，不写一个偏短的数）；
 * 时间范围写最早加入到最后离队；最近离开的在前。
 */
function formerOf(members, T) {
  var now = {};
  (members || []).forEach(function (m) { if (isPlayer(m) && onTeam(m)) now[personKey(m)] = true; });
  var acc = {};
  var order = [];
  (members || []).forEach(function (m) {
    if (!isPlayer(m)) return;
    var k = personKey(m);
    if (now[k]) return;
    var x = acc[k];
    if (!x) {
      x = acc[k] = { key: k, page: m.hasPage ? m.page : "", name: m.id, initial: view.firstChar(m.id), first: "", last: "", days: 0, exact: true };
      order.push(k);
    }
    if (m.join && (!x.first || m.join < x.first)) x.first = m.join;
    if (m.leave && (!x.last || m.leave > x.last)) x.last = m.leave;
    var a = dayNum(m.join);
    var b = dayNum(m.leave);
    if (a === null || b === null || b < a) x.exact = false;
    else x.days += b - a;
  });
  var all = order.map(function (k) { return acc[k]; });
  all.sort(function (a, b) { return (b.last || "").localeCompare(a.last || ""); });
  return {
    has: all.length > 0,
    countText: T.proMatesCount.replace("{n}", String(all.length)),
    all: all.map(function (x) {
      var a = view.ym(x.first) || "?";
      var b = view.ym(x.last) || "?";
      return {
        key: x.key, page: x.page, name: x.name, initial: x.initial,
        range: a === "?" && b === "?" ? "" : a + " – " + b,
        dur: x.exact && x.days >= 1 ? view.duration(x.days, T) : ""
      };
    })
  };
}

/* ---------------- 整页 ---------------- */

/**
 * @param raw  proTeam 的 data（{ page, info, members, results, transfers, at }）
 * @param lang "zh" / "en"
 */
function team(raw, lang) {
  var T = i18n.T(lang);
  var info = raw && raw.info ? raw.info : null;
  var page = raw && raw.page ? raw.page : "";
  var members = Array.isArray(raw && raw.members) ? raw.members : [];
  var results = Array.isArray(raw && raw.results) ? raw.results : [];
  var transfers = Array.isArray(raw && raw.transfers) ? raw.transfers : [];
  var name = (info && info.name) || String(page).replace(/_/g, " ");

  var moves = [];
  transfers.forEach(function (t, i) {
    var mv = moveOf(t, lang, T);
    if (!mv) return;
    moves.push({ key: i + "|" + (t.page || t.id) + "|" + t.date, page: t.hasPage ? t.page : "", name: t.id,
      text: mv.text, sign: mv.sign, date: view.ym(t.date) });
  });

  return {
    name: name,
    initials: view.initials(name),
    badge: info ? badgeOf(info.region, lang, T) : null,
    facts: factsOf(info, members, results, transfers, lang, T),
    roster: rosterOf(members, lang, T),
    results: view.resultsOf(results, name, lang, T),
    moves: { has: moves.length > 0, all: moves },
    former: formerOf(members, T),
    at: Number(raw && raw.at) || 0
  };
}

/** 阵容变动当前要显示的那几次 */
function visibleMoves(moves, open, T) {
  var all = (moves && moves.all) || [];
  var cut = !open && all.length > MOVES_FIRST;
  return {
    rows: cut ? all.slice(0, MOVES_FIRST) : all,
    sub: cut ? T.proMovesRecent.replace("{n}", String(MOVES_FIRST)) : T.proMovesAll.replace("{n}", String(all.length)),
    moreText: cut ? T.proMovesMore.replace("{n}", String(all.length)) : ""
  };
}

/** 历任队员当前要显示的那几个 */
function visibleFormer(former, open, T) {
  var all = (former && former.all) || [];
  var cut = !open && all.length > FORMER_FIRST;
  return {
    rows: cut ? all.slice(0, FORMER_FIRST) : all,
    moreText: cut ? T.proMatesMore.replace("{n}", String(all.length)) : ""
  };
}

module.exports = {
  team: team,
  visibleMoves: visibleMoves,
  visibleFormer: visibleFormer,
  roleKind: roleKind,
  moveOf: moveOf,
  enteredYear: enteredYear,
  MOVES_FIRST: MOVES_FIRST,
  FORMER_FIRST: FORMER_FIRST
};
