/**
 * 选手页：云函数 proPlayer 回的数据（Liquipedia 归一化过的）→ 界面字段。
 *
 * 纯函数，tests/pro.test.mjs 直接测；页面只管"取数 + setData"（AI-CONTEXT §3）。
 * 版式照 August 的设计稿（2026-11-02，派圈选手页设计稿.html）：
 *   深色大卡（剪影 + ID + 真名，下面国籍 / 年龄 / 累计奖金，再下面现在的战队；退役了换成「已退役 · 最后效力于」）
 *   → 资料（出生日期、输入设备、赛区）→ 合作过的队友 → 常用传奇 → 战队经历（时长色条 + 时间线）
 *   → 重要比赛成绩（S、A 级，先 5 条；用户之前要的"可以切到全部"放在最后）→ 数据来源入口。
 * 不编数据：哪项没有就不出那一项 / 那一块（不写 0、不写"未知"）；奖金 0 不写（Liquipedia 没记到 ≠ 没拿过）。
 */
var i18n = require("../../utils/i18n.js");
var names = require("../../utils/pronames.js");
var codex = require("../../data/codex_data.js");

var RES_FIRST = 5;     // 比赛成绩先显示几条
var MATES_FIRST = 6;   // 以前的队友先显示几个

// 常用传奇：Liquipedia 写英文名（"Mad Maggie"），按去掉空格、大小写后的英文名对图鉴
var HERO_BY_EN = {};
codex.heroes.forEach(function (h) { HERO_BY_EN[String(h.en).toLowerCase().replace(/[^a-z]/g, "")] = h; });

var MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function money(n) {
  var v = Math.round(Number(n) || 0);
  if (v <= 0) return "";
  return "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 北京时间的今天 → { y, m, d, iso } */
function today(nowMs) {
  var t = new Date(nowMs + 8 * 3600 * 1000);
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    iso: t.getUTCFullYear() + "-" + p(t.getUTCMonth() + 1) + "-" + p(t.getUTCDate()) };
}

/** 生日 → 周岁（按打开页面那天的北京时间算）；生日没有 / 不合理 → "" */
function age(birth, nowMs) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birth || ""));
  if (!m) return "";
  var t = today(nowMs);
  var y = t.y - Number(m[1]);
  if (t.m * 100 + t.d < Number(m[2]) * 100 + Number(m[3])) y -= 1;
  return (y >= 10 && y <= 80) ? String(y) : "";
}

function hasCJK(s) { return /[぀-ヿ㐀-鿿가-힯]/.test(String(s || "")); }

function ym(d) { return String(d || "").slice(0, 7); }

/** "YYYY-MM-DD" → 月序号（年*12+月）；不是完整日期 → null */
function monthNum(d) {
  var m = /^(\d{4})-(\d{2})/.exec(String(d || ""));
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

/** 一起的天数 → "1 年 8 个月" / "1 yr 8 mo"；不到一个月单说 */
function duration(days, T) {
  var months = Math.round(Number(days || 0) / 30.44);
  if (months < 1) return T.proDurLess;
  var y = Math.floor(months / 12);
  var mo = months % 12;
  var parts = [];
  if (y) parts.push(T.proDurY.replace("{n}", String(y)));
  if (mo) parts.push(T.proDurM.replace("{n}", String(mo)));
  return parts.join(" ");
}

/** 队名缩写：没有队标（或队标加载失败）时写在队标的位置。Team Liquid → TL，Wolves Esports → WE，REJECT → RE */
function initials(team) {
  var words = String(team || "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map(function (w) { return w.charAt(0); }).join("").toUpperCase();
}

function firstChar(s) { return String(s || "").charAt(0).toUpperCase(); }

/** 云函数给的 { 战队页面名: 队标地址 } 里查一支队；没有 → "" */
function logoOf(logos, page) {
  var u = logos && page && Object.prototype.hasOwnProperty.call(logos, page) ? logos[page] : "";
  return typeof u === "string" ? u : "";
}

/** 英文序数后缀（1st / 2nd / 3rd / 4th / 11th / 21st）；中文不加 */
function ordinal(n, lang) {
  if (lang !== "en") return "";
  var v = Number(n);
  if (!isFinite(v) || String(v) !== String(n)) return "";
  var t = v % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][v % 10] || "th";
}

/** 加入日期 → "2025 年 1 月加入" / "Joined January 2025"；没有日期 → "" */
function sinceText(join, lang, T) {
  var m = /^(\d{4})-(\d{2})/.exec(String(join || ""));
  if (!m) return "";
  return lang === "en"
    ? T.proSince.replace("{m}", MONTH_EN[Number(m[2]) - 1]).replace("{y}", m[1])
    : T.proSince.replace("{y}", m[1]).replace("{m}", String(Number(m[2])));
}

function isMajor(r) {
  return (r.tier === "1" || r.tier === "2") && !r.tierType;
}

/* ---------------- 各块 ---------------- */

function heroOf(p, hist, lang, T, nowMs, logos) {
  var out = { facts: [], team: null, retired: null };
  if (!p) return out;
  var nat = "";
  (p.nats || []).some(function (n) { nat = names.nat(n, lang); return !!nat; });
  if (nat) out.facts.push({ k: T.proNat, v: nat });
  var a = age(p.birth, nowMs);
  if (a) out.facts.push({ k: T.proAge, v: T.proAgeVal.replace("{n}", a) });
  var earn = money(p.earnings);
  if (earn) out.facts.push({ k: T.proEarnings, v: earn });

  if (/^retired$/i.test(p.status || "")) {
    var last = hist.length ? hist[0].team : "";
    out.retired = { text: T.proRetired, last: last ? T.proLastTeam.replace("{t}", last) : "" };
  } else if (p.team) {
    var cur = hist.filter(function (h) { return h.teamPage === p.teamPage && !h.leave; })[0];
    out.team = {
      name: p.team, page: p.teamPage || "", initials: initials(p.team),
      logo: logoOf(logos, p.teamPage),   // 队标（云存储地址）；没有 → ""，写缩写
      since: cur ? sinceText(cur.join, lang, T) : ""
    };
  }
  return out;
}

function profileOf(p, lang, T) {
  if (!p) return [];
  var kv = [];
  if (p.birth) kv.push({ k: T.proBorn, v: p.birth });
  if (p.input) kv.push({ k: T.proInput, v: names.input(p.input, lang) });
  if (p.region) kv.push({ k: T.proRegion, v: names.region(p.region, lang) });
  return kv;
}

function matesOf(list, retired, lang, T) {
  if (!Array.isArray(list) || !list.length) return { has: false, now: [], past: [], countText: "" };
  var sep = lang === "en" ? ", " : "、";
  var now = retired ? [] : list.filter(function (m) { return m.current; });
  var past = list.filter(function (m) { return retired || !m.current; });
  return {
    has: true,
    countText: T.proMatesCount.replace("{n}", String(now.length + past.length)),
    now: now.map(function (m) {
      return { key: m.page, page: m.hasPage ? m.page : "", name: m.id, initial: firstChar(m.id),
        text: T.proMateTogether.replace("{d}", duration(m.days, T)) };
    }),
    past: past.map(function (m) {
      return { key: m.page, page: m.hasPage ? m.page : "", name: m.id, initial: firstChar(m.id),
        teams: (m.teams || []).join(sep), dur: duration(m.days, T) };
    })
  };
}

function legendsOf(p, lang) {
  return ((p && p.legends) || []).map(function (en) {
    var h = HERO_BY_EN[String(en).toLowerCase().replace(/[^a-z]/g, "")];
    return {
      key: en,
      name: h ? (lang === "en" ? h.en : h.zh) : en,
      // 中文界面下面再写一行英文名（设计稿）；英文界面就不重复了
      en: lang === "en" ? "" : (h ? h.en : ""),
      icon: h ? h.icon : "",
      hasIcon: !!h,
      initial: firstChar(en)
    };
  });
}

/**
 * 战队经历：时长色条（老的在左、现在的队标红）+ 时间线（新的在前）。
 * 色条只用日期齐全的几段；时间线全列。
 */
function careerOf(hist, lang, T, nowMs, teamPages, logos) {
  if (!hist.length) return { has: false };
  var t = today(nowMs);
  var nowM = t.y * 12 + t.m - 1;
  var items = hist.map(function (h, i) {
    var current = h.status === "active" && !h.leave;
    var start = ym(h.join);
    var end = h.leave ? ym(h.leave) : "";
    return {
      key: i + "|" + h.teamPage + "|" + h.join,
      page: teamPages[h.teamPage] ? h.teamPage : "",   // 有战队页才能点进去
      team: h.team || h.teamPage,
      logo: logoOf(logos, h.teamPage),
      initials: initials(h.team || String(h.teamPage || "").replace(/_/g, " ")),
      sub: names.role(h.role, lang),
      range: start ? (start + " – " + end) : (end ? "? – " + end : ""),
      now: current
    };
  });
  var strip = [];
  var first = null;
  var last = null;
  var anyNow = false;
  hist.slice().reverse().forEach(function (h, i) {
    var a = monthNum(h.join);
    var current = h.status === "active" && !h.leave;
    var b = h.leave ? monthNum(h.leave) : (current ? nowM : null);
    if (a === null || b === null || b < a) return;
    strip.push({ key: "s" + i, flex: Math.max(1, b - a), now: current });
    if (first === null || a < first) first = a;
    if (last === null || b > last) last = b;
    if (current) anyNow = true;
  });
  var axis = [];
  if (strip.length && first !== null) {
    var y1 = Math.floor(first / 12);
    var y2 = Math.floor(last / 12);
    // 三个刻度：起点年、中间年（不到两年就空着）、现在 / 终点年（左中右对齐，wx:for 要稳定的 key）
    axis = [
      { k: "a", t: String(y1) },
      { k: "b", t: y2 - y1 >= 2 ? String(Math.round((y1 + y2) / 2)) : "" },
      { k: "c", t: anyNow ? T.proNow : String(y2) }
    ];
  }
  var teams = [];
  hist.forEach(function (h) { if (teams.indexOf(h.teamPage) < 0) teams.push(h.teamPage); });
  return {
    has: true,
    countText: T.proCareerCount.replace("{n}", String(teams.length)),
    strip: strip,
    axis: axis,
    items: items
  };
}

function resultRow(r, i, curTeam, lang, T) {
  var place = String(r.place);
  var bits = [r.date];
  if (r.team && r.team !== curTeam) bits.push(r.team);   // 和现在的队不一样时才写当时的队
  if (r.tierType) bits.push(names.tierType(r.tierType, lang));
  return {
    key: i + "|" + r.event + "|" + r.team,
    place: place,
    sup: ordinal(place, lang),
    win: place === "1",
    event: r.tournament || r.event,
    sub: bits.filter(Boolean).join(" · "),
    prize: money(r.prize)
  };
}

function resultsOf(raw, curTeam, lang, T) {
  var list = Array.isArray(raw) ? raw : [];
  var all = list.map(function (r, i) { return resultRow(r, i, curTeam, lang, T); });
  var major = list.filter(isMajor).map(function (r, i) { return resultRow(r, i, curTeam, lang, T); });
  return {
    has: all.length > 0,
    all: all,
    major: major,
    // 一场 S/A 级都没有：直接列全部
    defaultMode: major.length ? "major" : "all",
    minorCount: all.length - major.length
  };
}

/**
 * 比赛成绩当前要显示的样子（页面里的「查看全部」「也看小比赛」两个开关）。
 * @param mode "major"（S、A 级）/ "all"
 * @param open 是否已经展开全部
 */
function visibleResults(res, mode, open, T) {
  if (!res || !res.has) return { rows: [], sub: "", moreText: "", minorText: "", majorText: "" };
  var rows = mode === "all" ? res.all : res.major;
  return {
    rows: open ? rows : rows.slice(0, RES_FIRST),
    sub: mode === "all" ? T.proResultsSubAll : T.proResultsSubMajor,
    moreText: !open && rows.length > RES_FIRST ? T.proResultsMore.replace("{n}", String(rows.length)) : "",
    // 大赛都看完了，才给"也看小比赛"（用户 11-02 要的"可以切到全部"）
    minorText: mode === "major" && res.minorCount > 0 && (open || rows.length <= RES_FIRST)
      ? T.proResultsMinor.replace("{n}", String(res.minorCount)) : "",
    majorText: mode === "all" && res.major.length ? T.proResultsMajorOnly : ""
  };
}

/** 以前的队友当前要显示几个 */
function visibleMates(mates, open, T) {
  var past = (mates && mates.past) || [];
  return {
    past: open ? past : past.slice(0, MATES_FIRST),
    moreText: !open && past.length > MATES_FIRST ? T.proMatesMore.replace("{n}", String(past.length)) : ""
  };
}

/**
 * @param raw  proPlayer 的 data（{ page, profile, history, results, mates, teamPages, teamLogos, photo, at }）
 * @param lang "zh" / "en"
 * @param nowMs 打开页面的时刻（算年龄、在队时长）
 */
function player(raw, lang, nowMs) {
  var T = i18n.T(lang);
  var p = raw && raw.profile ? raw.profile : null;
  var page = raw && raw.page ? raw.page : "";
  var hist = Array.isArray(raw && raw.history) ? raw.history : [];

  var real = p ? (p.name || "") : "";
  // 中文界面下，本国文字的名字是中日韩文字就一起写（王耀 · Wang Yao）；俄文、泰文这些不写
  if (p && lang !== "en" && p.localName && hasCJK(p.localName)) real = real ? p.localName + " · " + real : p.localName;

  // 有战队页的队（{ 页面名: true }）：大卡上现在的战队、战队经历那几行能点进去
  var teamPages = (raw && raw.teamPages) || {};
  var logos = (raw && raw.teamLogos) || {};
  var hero = heroOf(p, hist, lang, T, nowMs, logos);
  if (hero.team && !teamPages[hero.team.page]) hero.team.page = "";
  return {
    id: p ? p.id : String(page).replace(/_\(.*\)$/, "").replace(/_/g, " "),
    hasProfile: !!p,
    // 选手照片（云存储的 cloud:// 地址，ALGS 定妆照）；没有 → ""，大卡用剪影
    photo: String((raw && raw.photo) || ""),
    realName: real,
    facts: hero.facts,
    team: hero.team,
    retired: hero.retired,
    profile: profileOf(p, lang, T),
    mates: matesOf(raw && raw.mates, !!hero.retired, lang, T),
    legends: legendsOf(p, lang),
    career: careerOf(hist, lang, T, nowMs, teamPages, logos),
    results: resultsOf(raw && raw.results, p ? p.team : "", lang, T),
    at: Number(raw && raw.at) || 0
  };
}

/** 数据来源页：上次同步时间（北京时间，到分钟）；没有 → "" */
function syncedText(atMs, T) {
  var at = Number(atMs);
  if (!(at > 0)) return "";
  var d = new Date(at + 8 * 3600 * 1000);
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  var s = d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  return T.proSrcSynced.replace("{t}", s);
}

module.exports = {
  player: player,
  visibleResults: visibleResults,
  visibleMates: visibleMates,
  syncedText: syncedText,
  age: age,
  money: money,
  duration: duration,
  initials: initials,
  logoOf: logoOf,
  isMajor: isMajor,
  // 战队页（teamview.js）也用
  resultsOf: resultsOf,
  sinceText: sinceText,
  firstChar: firstChar,
  ym: ym,
  RES_FIRST: RES_FIRST,
  MATES_FIRST: MATES_FIRST
};
