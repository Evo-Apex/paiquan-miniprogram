/**
 * 选手页：云函数 proPlayer 回的数据（Liquipedia 归一化过的）→ 界面字段。
 *
 * 纯函数，tests/pro.test.mjs 直接测；页面只管"取数 + setData"（AI-CONTEXT §3）。
 * 不编数据：哪项没有就不出那一格 / 那一块（不写 0、不写"未知"）；生涯奖金是 0 也不写（Liquipedia 没记到 ≠ 没拿过）。
 *
 * 用户 2026-11-02 定的：资料在前（基本资料 → 常用传奇 → 历届成绩 → 队伍经历）；
 * 历届成绩默认只列「大赛」（Liquipedia 1、2 级的正式比赛，不含表演赛、预选赛），列表上方可以切到全部。
 */
var i18n = require("../../utils/i18n.js");
var names = require("../../utils/pronames.js");
var codex = require("../../utils/codex_data.js");

// 常用传奇：Liquipedia 写英文名（"Mad Maggie"），按去掉空格、大小写后的英文名对图鉴
var HERO_BY_EN = {};
codex.heroes.forEach(function (h) { HERO_BY_EN[String(h.en).toLowerCase().replace(/[^a-z]/g, "")] = h; });

function money(n) {
  var v = Math.round(Number(n) || 0);
  if (v <= 0) return "";
  return "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 生日 → 周岁（按打开页面的那一天算）；生日没有 / 不合理 → "" */
function age(birth, nowMs) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birth || ""));
  if (!m) return "";
  var now = new Date(nowMs + 8 * 3600 * 1000);   // 按北京时间的日期算
  var y = now.getUTCFullYear() - Number(m[1]);
  var md = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  if (md < Number(m[2]) * 100 + Number(m[3])) y -= 1;
  return (y >= 10 && y <= 80) ? String(y) : "";
}

function hasCJK(s) { return /[぀-ヿ㐀-鿿가-힯]/.test(String(s || "")); }

function ym(d) { return String(d || "").slice(0, 7); }

function placeText(place, T) {
  return T.proPlace.replace("{n}", String(place));
}

function isMajor(r) {
  return (r.tier === "1" || r.tier === "2") && !r.tierType;
}

function resultRow(r, i, T, lang) {
  var top = parseInt(r.place, 10);
  return {
    key: i + "|" + r.event + "|" + r.team,
    date: ym(r.date),
    tournament: r.tournament || r.event,
    team: r.team || "",
    place: placeText(r.place, T),
    top3: String(top) === String(r.place) && top >= 1 && top <= 3,
    prize: money(r.prize),
    tag: r.tierType ? names.tierType(r.tierType, lang) : ""
  };
}

function historyRow(h, i, T, lang) {
  var current = h.status === "active" && !h.leave;
  var end = h.leave ? ym(h.leave) : (current ? T.proNow : "");
  var start = ym(h.join);
  var range = start || end ? (start || "?") + " — " + (end || "?") : "";
  return {
    key: i + "|" + h.teamPage + "|" + h.join,
    team: h.team || h.teamPage,
    range: range,
    role: names.role(h.role, lang),
    current: current
  };
}

function dateText(ms) {
  if (!ms) return "";
  var d = new Date(Number(ms) + 8 * 3600 * 1000);
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}

/**
 * @param raw  proPlayer 的 data（{ page, profile, history, results, at }）
 * @param lang "zh" / "en"
 * @param nowMs 打开页面的时刻（算年龄）
 */
function player(raw, lang, nowMs) {
  var T = i18n.T(lang);
  var p = raw && raw.profile ? raw.profile : null;
  var page = raw && raw.page ? raw.page : "";
  var out = {
    id: p ? p.id : String(page).replace(/_\(.*\)$/, "").replace(/_/g, " "),
    hasProfile: !!p
  };

  if (p) {
    // 真名：中文界面下，本国文字的名字是中日韩文字就一起写（王耀 · Wang Yao）；俄文、泰文这些不写
    var real = p.name || "";
    if (lang !== "en" && p.localName && hasCJK(p.localName)) real = real ? p.localName + " · " + real : p.localName;
    out.realName = real;
    out.team = p.team || "";
    out.status = names.status(p.status, lang);

    var cells = [];
    var nat = (p.nats || []).map(function (n) { return names.nat(n, lang); }).filter(Boolean).join(" / ");
    if (nat) cells.push({ k: T.proNat, v: nat });
    if (p.region) cells.push({ k: T.proRegion, v: names.region(p.region, lang) });
    var a = age(p.birth, nowMs);
    if (a) cells.push({ k: T.proAge, v: T.proAgeVal.replace("{n}", a) });
    if (p.input) cells.push({ k: T.proInput, v: names.input(p.input, lang) });
    out.cells = cells;
    out.earnings = money(p.earnings);
    out.earningsLabel = T.proEarnings;

    out.legends = (p.legends || []).map(function (en) {
      var h = HERO_BY_EN[String(en).toLowerCase().replace(/[^a-z]/g, "")];
      return {
        key: en,
        name: h ? (lang === "en" ? h.en : h.zh) : en,
        icon: h ? h.icon : "",
        hasIcon: !!h
      };
    });
  } else {
    out.cells = [];
    out.legends = [];
    out.earnings = "";
  }

  var results = Array.isArray(raw && raw.results) ? raw.results : [];
  var all = results.map(function (r, i) { return resultRow(r, i, T, lang); });
  var major = results.filter(isMajor).map(function (r, i) { return resultRow(r, i, T, lang); });
  out.results = {
    has: all.length > 0,
    all: all,
    major: major,
    // 一场大赛都没有：直接列全部，不给切换（切过去是空的没有意义）
    canToggle: major.length > 0 && major.length < all.length,
    majorOnlyDefault: major.length > 0,
    // 列表上方「大赛 N ｜ 全部 N」的两段（大赛动辄三四十场，切换放在底下要滑很久才看得到）
    countMajor: T.proResultsMajor.replace("{n}", String(major.length)),
    countAll: T.proResultsAll.replace("{n}", String(all.length))
  };

  var hist = Array.isArray(raw && raw.history) ? raw.history : [];
  out.history = hist.map(function (h, i) { return historyRow(h, i, T, lang); });

  var d = dateText(raw && raw.at);
  out.sourceText = d ? T.proSource.replace("{d}", d) : T.proSourceNoDate;
  return out;
}

module.exports = { player: player, age: age, money: money, isMajor: isMajor };
