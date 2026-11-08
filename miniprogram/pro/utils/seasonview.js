/**
 * 比赛页的赛季（2026-11-08，照 August 的「赛季进度条」设计稿）：云函数 proSeason 回的数据 → 界面字段。
 *
 * 纯函数，tests/season.test.mjs 直接测；组件 pro/components/season 只管取数 + setData。
 *   赛季卡：五站进度条（打完 / 现在这一站 / 还没到）+ 下面一排小圆点（一个点一场小比赛，落在它开赛时的那一站下面）+ 下一站；
 *   主队卡：主队下一场（这个赛季里主队已经确定参加、还没打完的最早那场）+ 主队每一站的名次；
 *   近期比赛：进行中、60 天内要开打、30 天内刚结束的，主队参加的置顶，可按类型筛；
 *   这个赛季：五站由近到远，小比赛夹在中间（开关）；所有 CN 战队：S2 亚太南联赛里的国内队，按联赛名次。
 * 不编数据：Liquipedia 只有日期没有几点开打，所以只写日期；没打完的不写冠军；没名次的不写名次。
 */
var i18n = require("../../utils/i18n.js");
var names = require("../../utils/pronames.js");
var prolink = require("../../utils/prolink.js");
var view = require("./view.js");

var RECENT_FIRST = 5;      // 近期比赛先显示几场
var CN_FIRST = 7;          // 所有 CN 战队先显示几支
var SOON_DAYS = 60;        // 多少天内开打的算"近期"
var RECENT_DONE_DAYS = 30; // 结束多少天内的还算"近期"
var MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var KIND_CLS = { major: "major", cn: "cn", qualifier: "q", invitational: "inv" };

/** 北京时间的今天 "YYYY-MM-DD" */
function todayIso(nowMs) {
  var t = new Date(nowMs + 8 * 3600 * 1000);
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return t.getUTCFullYear() + "-" + p(t.getUTCMonth() + 1) + "-" + p(t.getUTCDate());
}

function dayNum(d) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null;
}

/** "2026-11-22" → "11 月 22 日" / "Nov 22" */
function md(d, lang) {
  var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(d || ""));
  if (!m) return "";
  return lang === "en" ? MONTH_EN[Number(m[1]) - 1] + " " + Number(m[2]) : Number(m[1]) + " 月 " + Number(m[2]) + " 日";
}

/** 日期范围：同一天写一个；同一个月 "1 月 28–31 日" / "Jan 28–31"；跨月两头都写 */
function dateRange(a, b, lang) {
  if (!a) return "";
  if (!b || a === b) return md(a, lang);
  if (a.slice(0, 7) === b.slice(0, 7)) {
    return lang === "en" ? md(a, lang) + "–" + Number(b.slice(8)) : md(a, lang).replace(/ 日$/, "") + "–" + Number(b.slice(8)) + " 日";
  }
  return md(a, lang) + "–" + md(b, lang);
}

/** 还有几天开打 → "今天" / "明天" / "还有 14 天" */
function countdown(start, today, T) {
  var n = dayNum(start) - dayNum(today);
  if (!(n >= 0)) return "";
  if (n === 0) return T.seasonToday;
  if (n === 1) return T.seasonTomorrow;
  return T.seasonInDays.replace("{n}", String(n));
}

/** 一场比赛现在的状态：done（打完了）/ live（进行中）/ soon（还没开打）/ ""（没日期） */
function statusOf(e, today) {
  if (!e.start) return "";
  if ((e.end || e.start) < today) return "done";
  if (e.start <= today) return "live";
  return "soon";
}

function sameTeam(a, b) {
  var x = prolink.norm(a);
  return !!x && x === prolink.norm(b);
}

/** 主队在一组名次里的那一行 */
function homeRow(rows, home) {
  if (!home) return null;
  return (rows || []).filter(function (r) { return sameTeam(r.team, home); })[0] || null;
}

function stageLabel(s, T) { return T["stage_" + s.key] || s.name; }
function stageLong(s, T) { return T["stageLong_" + s.key] || s.name; }

/** 名次的说法：联赛 "亚太南第 1"，季后赛、冠军赛第 1 = "冠军"，别的 "第 11" */
function placeText(stageKind, place, T) {
  if (!place) return "";
  var n = parseInt(place, 10);
  if (stageKind === "league") return T.seasonLeaguePlace.replace("{n}", String(isFinite(n) ? n : place));
  if (place === "1") return T.seasonChamp;
  return T.seasonPlace.replace("{n}", String(isFinite(n) ? n : place));
}

/** 把一站、一场小比赛都摊成同一种"比赛"（近期比赛、时间线、主队下一场共用） */
function eventsOf(raw, lang, T, today, home) {
  var out = [];
  (raw.stages || []).forEach(function (s, i) {
    var hr = homeRow(s.results, home);
    out.push({
      key: "s|" + s.key, major: true, stageIndex: i, stageKey: s.key, stageKind: s.kind, page: s.page,
      kind: "major", name: stageLong(s, T), short: stageLabel(s, T),
      start: s.start, end: s.end, teams: s.teams || 0, winner: s.winner || "",
      mine: !!hr, minePlace: hr ? hr.place : "", status: statusOf(s, today)
    });
  });
  (raw.minor || []).forEach(function (m, i) {
    var mine = !!home && (m.teamsIn || []).some(function (t) { return sameTeam(t, home); });
    out.push({
      key: "m|" + i + "|" + (m.page || m.name), major: false, page: m.page || "",
      kind: KIND_CLS[m.kind] ? m.kind : "cn", name: m.name, short: m.name,
      start: m.start, end: m.end, teams: m.teams || 0, winner: m.winner || "", note: m.note || "",
      mine: mine, minePlace: "", status: statusOf(m, today)
    });
  });
  return out;
}

function kindText(kind, T) { return T["seasonKind_" + kind] || ""; }

/** 近期比赛的一行 */
function recentRow(e, lang, T, today) {
  var teams = e.teams ? T.seasonTeamsN.replace("{n}", String(e.teams)) : "";
  var sub = "";
  var right = "";
  var rightSub = "";
  if (e.status === "live") {
    sub = [T.seasonLive, teams].filter(Boolean).join(T.seasonSep);
    right = T.seasonLive;
  } else if (e.status === "soon") {
    sub = [T.seasonStarts.replace("{d}", dateRange(e.start, e.end, lang)), teams].filter(Boolean).join(T.seasonSep);
    right = md(e.start, lang);
    rightSub = countdown(e.start, today, T);
  } else {
    sub = [T.seasonEventDone, teams].filter(Boolean).join(T.seasonSep);
    right = e.winner || md(e.end || e.start, lang);
    rightSub = e.winner ? T.seasonChamp : "";
  }
  if (e.note) sub = [sub, e.note].filter(Boolean).join(T.seasonSep);
  return {
    key: e.key, page: e.page, stageKey: e.stageKey || "", major: e.major,
    kind: e.kind, kindCls: KIND_CLS[e.kind], kindText: kindText(e.kind, T),
    name: e.name, sub: sub, right: right, rightSub: rightSub, live: e.status === "live",
    mine: e.mine, mineText: e.mine ? T.seasonHomeIn : ""
  };
}

/**
 * @param raw   proSeason 的 data（{ year, stages, minor, cnTeams, teams, at }）
 * @param lang  "zh" / "en"
 * @param nowMs 打开页面的时刻（按北京时间的日期算进行中、还有几天）
 * @param home  主队的队名（Liquipedia 写法，界面偏好里存的）；没选 → ""
 */
function season(raw, lang, nowMs, home) {
  var T = i18n.T(lang);
  var today = todayIso(nowMs);
  var stages = raw && Array.isArray(raw.stages) ? raw.stages : [];
  var all = eventsOf(raw || {}, lang, T, today, home);
  var majors = all.filter(function (e) { return e.major; });
  var minors = all.filter(function (e) { return !e.major; }).sort(function (a, b) { return (a.start || "").localeCompare(b.start || ""); });

  // ---- 进度条：现在这一站 = 已经开打的最后一站 ----
  var cur = -1;
  majors.forEach(function (e, i) { if (e.start && e.start <= today) cur = i; });
  var track = majors.map(function (e, i) {
    return { key: e.stageKey, label: e.short, state: i < cur ? "done" : (i === cur ? "now" : "next"), mine: e.mine && i <= cur };
  });
  var seg = function (start) {
    var k = 0;
    majors.forEach(function (e, i) { if (e.start && e.start <= start) k = i; });
    return k;
  };
  var dots = majors.map(function (e) { return { key: e.stageKey, dots: [] }; });
  minors.forEach(function (m) {
    if (!m.start || !dots.length) return;
    dots[seg(m.start)].dots.push({ key: m.key, cls: m.status === "live" ? "now" : (m.mine ? "mine" : "") });
  });
  var title;
  var left = majors.slice(cur + 1).map(function (e) { return e.short; });
  if (cur < 0) title = T.seasonNotStarted;
  else if (majors[cur].status === "live") title = T.seasonLiveStage.replace("{s}", majors[cur].short);
  else if (!left.length) title = T.seasonOver;
  else title = T.seasonAt.replace("{n}", String(cur + 1)).replace("{rest}", left.join(T.seasonListSep));
  var nextStage = majors.filter(function (e, i) { return i > cur && e.status !== "done"; })[0] || null;

  // ---- 主队卡 ----
  var homeCard = null;
  if (home) {
    var upcoming = all.filter(function (e) { return e.mine && (e.status === "soon" || e.status === "live"); })
      .sort(function (a, b) { return a.start.localeCompare(b.start); })[0] || null;
    homeCard = {
      name: home,
      initials: view.initials(home),
      next: upcoming ? {
        name: upcoming.name,
        date: upcoming.status === "live" ? T.seasonLive : dateRange(upcoming.start, upcoming.end, lang),
        sub: upcoming.status === "live" ? "" : countdown(upcoming.start, today, T)
      } : null,
      // 主队这个赛季每一站的名次（打完的、有名次的），新的在前
      results: majors.filter(function (e) { return e.mine && e.minePlace && e.status === "done"; }).reverse().map(function (e) {
        return { key: e.key, label: e.short, place: placeText(e.stageKind, e.minePlace, T) };
      })
    };
  }

  // ---- 近期比赛 ----
  var t0 = dayNum(today);
  var recent = all.filter(function (e) {
    if (e.status === "live") return true;
    if (e.status === "soon") return dayNum(e.start) - t0 <= SOON_DAYS;
    if (e.status === "done") return t0 - dayNum(e.end || e.start) <= RECENT_DONE_DAYS;
    return false;
  });
  var rank = function (e) { return e.mine && e.status !== "done" ? 0 : (e.status === "live" ? 1 : (e.status === "soon" ? 2 : 3)); };
  recent.sort(function (a, b) {
    var d = rank(a) - rank(b);
    if (d) return d;
    if (a.status === "done") return (b.end || b.start).localeCompare(a.end || a.start);
    return a.start.localeCompare(b.start);
  });
  var recentRows = recent.map(function (e) { return recentRow(e, lang, T, today); });
  var chips = [{ key: "all", text: T.seasonChipAll }];
  if (home && recentRows.some(function (r) { return r.mine; })) chips.push({ key: "mine", text: T.seasonChipMine });
  if (recentRows.some(function (r) { return r.live; })) chips.push({ key: "live", text: T.seasonLive });
  ["major", "cn", "qualifier", "invitational"].forEach(function (k) {
    if (recentRows.some(function (r) { return r.kind === k; })) chips.push({ key: k, text: kindText(k, T) });
  });

  // ---- 这个赛季（由近到远；小比赛夹在开赛日期的位置上） ----
  var timeline = all.filter(function (e) { return e.major || e.start; }).sort(function (a, b) {
    var x = a.start || "9999";
    var y = b.start || "9999";
    return y.localeCompare(x);
  }).map(function (e) {
    var right = "";
    var rightSub = "";
    if (e.status === "done" && e.winner) {
      right = e.winner;
      rightSub = e.major && e.stageKind === "league" ? T.seasonLeagueFirst : T.seasonChamp;
    } else if (e.status === "live") {
      right = T.seasonLive;
    } else if (e.start) {
      right = dateRange(e.start, e.end, lang);
      rightSub = e.status === "soon" ? countdown(e.start, today, T) : "";
    } else {
      right = T.seasonTbd;
    }
    var sub = "";
    if (e.major) sub = e.stageKind === "league" ? T.seasonLeagueSub : (e.teams ? T.seasonGlobalN.replace("{n}", String(e.teams)) : T.seasonGlobal);
    return {
      key: e.key, major: e.major, page: e.page, stageKey: e.stageKey || "", name: e.name, sub: sub,
      right: right, rightSub: rightSub, state: e.status === "done" ? "done" : (e.status === "live" ? "now" : ""),
      mine: e.mine, mineText: e.mine ? (e.minePlace ? T.seasonHomePlace.replace("{p}", placeText(e.stageKind, e.minePlace, T)) : T.seasonHomeIn) : ""
    };
  });

  // ---- 所有 CN 战队 ----
  var sep = lang === "en" ? ", " : "、";
  var cn = (raw && raw.cnTeams || []).map(function (c) {
    var n = parseInt(c.place, 10);
    return {
      key: c.page, page: c.page, name: c.team, initials: view.initials(c.team),
      players: (c.players || []).map(function (p) { return p.id; }).join(sep),
      rank: isFinite(n) ? T.seasonPlace.replace("{n}", String(n)) : "",
      mine: !!home && sameTeam(c.team, home)
    };
  });

  return {
    has: majors.length > 0,
    yearText: T.seasonYear.replace("{n}", String(raw && raw.year || "")),
    title: title,
    track: track,
    dots: dots,
    hasDots: minors.length > 0,
    next: nextStage ? {
      key: nextStage.stageKey, page: nextStage.page,
      text: T.seasonNextUp.replace("{s}", nextStage.short),
      sub: nextStage.start ? [dateRange(nextStage.start, nextStage.end, lang), countdown(nextStage.start, today, T)].filter(Boolean).join(T.seasonSep) : T.seasonTbd
    } : null,
    home: homeCard,
    recent: recentRows,
    chips: chips,
    timeline: timeline,
    hasMinor: minors.length > 0,
    todayText: T.seasonRecentToday.replace("{d}", md(today, lang)),
    cn: cn,
    cnCountText: T.seasonCnCount.replace("{n}", String(cn.length)),
    at: Number(raw && raw.at) || 0
  };
}

/**
 * 一站的详情页的头和 Liquipedia 名次（pro/event）。没有这一站 → null。
 * 还没打的站名次是空的：名单写成"已晋级的队"。
 */
function stage(raw, key, lang, nowMs, home) {
  var T = i18n.T(lang);
  var today = todayIso(nowMs);
  var s = (raw && raw.stages || []).filter(function (x) { return x.key === key; })[0];
  if (!s) return null;
  var status = statusOf(s, today);
  var played = (s.results || []).some(function (r) { return r.place; });
  return {
    key: s.key,
    name: stageLong(s, T),
    lpName: s.name || "",
    dates: dateRange(s.start, s.end, lang) || T.seasonTbd,
    status: status === "done" ? T.seasonEventDone : (status === "live" ? T.seasonLive : (status === "soon" ? countdown(s.start, today, T) : "")),
    teams: s.teams ? String(s.teams) : "",
    winner: status === "done" ? s.winner || "" : "",
    winnerSub: s.kind === "league" ? T.seasonLeagueFirst : T.seasonChamp,
    rowsTitle: played ? T.stageStandings : T.stageQualifiedTitle,
    rows: (s.results || []).map(function (r) {
      var n = parseInt(r.place, 10);
      return {
        key: r.team, team: r.team, page: r.team.replace(/ /g, "_"),
        placeText: r.place ? T.seasonPlace.replace("{n}", String(isFinite(n) ? n : r.place)) : T.stageQualified,
        mine: !!home && sameTeam(r.team, home)
      };
    })
  };
}

/** 近期比赛当前要显示的那几行（筛选 + 展开） */
function visibleRecent(v, chip, open, T) {
  var rows = (v && v.recent || []).filter(function (r) {
    if (!chip || chip === "all") return true;
    if (chip === "mine") return r.mine;
    if (chip === "live") return r.live;
    return r.kind === chip;
  });
  var cut = !open && rows.length > RECENT_FIRST;
  return { rows: cut ? rows.slice(0, RECENT_FIRST) : rows, moreText: cut ? T.seasonRecentMore.replace("{n}", String(rows.length)) : "" };
}

/** 这个赛季：开关关着时只看五站 */
function visibleTimeline(v, showMinor) {
  return (v && v.timeline || []).filter(function (e) { return showMinor || e.major; });
}

/** 所有 CN 战队：先 7 支 */
function visibleCn(v, open, T) {
  var all = v && v.cn || [];
  var cut = !open && all.length > CN_FIRST;
  return { rows: cut ? all.slice(0, CN_FIRST) : all, moreText: cut ? T.seasonCnMore.replace("{n}", String(all.length)) : "" };
}

/**
 * 选主队弹层：赛区按钮（有几个赛区出几个）+ 搜索 + 队伍格子。
 * @param query  搜索框里的字（去空格大小写后包含就算）
 * @param region 选中的赛区（Liquipedia 写法）；"" = 全部
 */
function picker(raw, lang, query, region, home) {
  var teams = raw && Array.isArray(raw.teams) ? raw.teams : [];
  var regions = [];
  teams.forEach(function (t) { if (t.region && regions.indexOf(t.region) < 0) regions.push(t.region); });
  var q = prolink.norm(query);
  return {
    regions: [{ key: "", text: i18n.T(lang).seasonPickAll, on: !region }].concat(regions.map(function (r) {
      return { key: r, text: names.region(r, lang), on: r === region };
    })),
    teams: teams.filter(function (t) {
      return (!region || t.region === region) && (!q || prolink.norm(t.team).indexOf(q) >= 0);
    }).map(function (t) {
      return { key: t.page || t.team, team: t.team, initials: view.initials(t.team), on: !!home && sameTeam(t.team, home) };
    })
  };
}

module.exports = {
  season: season,
  stage: stage,
  visibleRecent: visibleRecent,
  visibleTimeline: visibleTimeline,
  visibleCn: visibleCn,
  picker: picker,
  dateRange: dateRange,
  todayIso: todayIso,
  RECENT_FIRST: RECENT_FIRST,
  CN_FIRST: CN_FIRST
};
