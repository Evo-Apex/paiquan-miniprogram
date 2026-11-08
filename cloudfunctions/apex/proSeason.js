/**
 * 比赛页的赛季（2026-11-08，照 August 的「赛季进度条」设计稿）：ALGS 这个赛季的五站 + 中国的小比赛 + 自己录入的比赛
 * + 所有 CN 战队。数据由定时器从 Liquipedia 抓好存进数据库（proSync 的 season / seasonResults 两步），这里只读数据库。
 *
 *   五站（SEASON.stages）：S1 联赛（亚太南）→ S1 季后赛 → S2 联赛（亚太南）→ S2 季后赛 → 冠军赛。
 *     **换赛季时改 SEASON**（页面名照 Liquipedia；联赛只看亚太南：国内战队都在这个赛区），重新部署 apex。
 *   小比赛：开赛日期落在 SEASON.from–to 里、办在中国的比赛（August 定的：只收中国的），全部等级都收。
 *   自己录入：集合 pro_manual_events（在云开发控制台手动加记录，字段见 normManual）。
 *   所有 CN 战队：S2 联赛（SEASON.cnLeague）里的国内队，按联赛名次排。怎么认国内队见 isCnTeam
 *     （Liquipedia 战队的"赛区"对国内队不可靠：TEC、Kirisame 写成 Southeast Asia，Black Hole、2C1M 空着，2026-11-08 实测）。
 *
 * 只回数字和原文（日期、名次、英文队名），中英文和"进行中 / 还有几天"由小程序的 pro/utils/seasonview.js 算。
 */
var lp = require("./liquipedia");

var SEASON = {
  year: 6,                            // ALGS 第 6 年
  from: "2026-02-01",                 // 小比赛：开赛日期在这两天之间
  to: "2027-02-28",
  stages: [
    { key: "s1pl", split: 1, kind: "league", page: "Apex_Legends_Global_Series/2026/Split_1/Pro_League/APAC_South" },
    { key: "s1po", split: 1, kind: "playoffs", page: "Apex_Legends_Global_Series/2026/Split_1/Playoffs" },
    { key: "s2pl", split: 2, kind: "league", page: "Apex_Legends_Global_Series/2026/Split_2/Pro_League/APAC_South" },
    { key: "s2po", split: 2, kind: "playoffs", page: "Apex_Legends_Global_Series/2026/Split_2/Playoffs" },
    { key: "champ", split: 0, kind: "championship", page: "Apex_Legends_Global_Series/2027/Championship" }
  ],
  cnLeague: "Apex_Legends_Global_Series/2026/Split_2/Pro_League/APAC_South"
};

var MANUAL_KINDS = ["cn", "qualifier", "invitational"];   // 国内 / 资格赛 / 邀请赛
var MAX_MANUAL = 50;

function stagePages() {
  return SEASON.stages.map(function (s) { return s.page; });
}

/** 比赛列表里要的：五站 + 这个赛季办在中国的小比赛（五站本身不算小比赛） */
function pickTournaments(list) {
  var stages = stagePages();
  var out = { stages: {}, minor: [] };
  (list || []).forEach(function (t) {
    if (stages.indexOf(t.page) >= 0) { out.stages[t.page] = t; return; }
    if (t.cn && t.start >= SEASON.from && t.start <= SEASON.to) out.minor.push(t);
  });
  return out;
}

/** 名次排序用：空的（还没打）排最后；"21-22" 这种按前一个数 */
function placeNum(p) {
  var n = parseInt(String(p || ""), 10);
  return isFinite(n) ? n : 9999;
}

/**
 * 国内战队：Liquipedia 的赛区写着 China，或者现役选手里至少 2 人国籍是中国（战队同步存的历史名单里有国籍）。
 * @param info    战队资料（readTeamInfos）；没有 → null
 * @param members 历史名单（readTeams）；没有 → null
 */
function isCnTeam(info, members) {
  if (info && info.region === "China") return true;
  var cn = (members || []).filter(function (m) {
    return (!m.type || m.type === "player") && m.status === "active" && !m.leave && m.nat === "China";
  });
  return cn.length >= 2;
}

function winnerOf(rows) {
  var w = (rows || []).filter(function (r) { return r.place === "1"; })[0];
  return w ? w.team : "";
}

/**
 * 自己录入的一场比赛（集合 pro_manual_events 的一条记录；在云开发控制台里加，字段都写英文）：
 *   name 比赛名（必填）、start 开赛日期 "2026-11-22"（必填）、end 结束日期（不填 = 当天）、
 *   kind "cn"（国内）/ "qualifier"（资格赛）/ "invitational"（邀请赛），不填当国内、
 *   teams 几支队、winner 冠军队名、teamsIn 参赛队名的数组（主队参加的会标出来）、note 一句说明。
 * 名字或日期不对的整条不要。
 */
function normManual(doc) {
  if (!doc || typeof doc.name !== "string" || !doc.name.trim()) return null;
  var date = function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : ""; };
  var start = date(doc.start);
  if (!start) return null;
  var end = date(doc.end);
  return {
    page: "",
    name: doc.name.trim().slice(0, 60),
    start: start,
    end: end && end >= start ? end : start,
    kind: MANUAL_KINDS.indexOf(doc.kind) >= 0 ? doc.kind : "cn",
    teams: Number(doc.teams) > 0 ? Math.floor(Number(doc.teams)) : 0,
    winner: typeof doc.winner === "string" ? doc.winner.trim().slice(0, 60) : "",
    teamsIn: Array.isArray(doc.teamsIn) ? doc.teamsIn.filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, 60) : [],
    note: typeof doc.note === "string" ? doc.note.trim().slice(0, 80) : "",
    manual: true
  };
}

/**
 * 比赛页：这个赛季的全部内容。
 * @param deps.store  readSeason / readTeamInfos / readManualEvents
 */
function proSeason(event, deps) {
  var store = deps.store;
  if (!store || !store.readSeason) return Promise.resolve({ ok: true, kind: "ok", message: "", data: null });
  return Promise.resolve(store.readSeason()).then(function (doc) {
    if (!doc || !Array.isArray(doc.tournaments)) return { ok: true, kind: "ok", message: "", data: null };
    // 名次存成 [{ page, rows }]（页面名里可能有点号，不能当数据库的字段名）
    var results = {};
    (Array.isArray(doc.results) ? doc.results : []).forEach(function (x) { if (x && x.page) results[x.page] = x.rows || []; });
    var picked = pickTournaments(doc.tournaments);
    var league = results[SEASON.cnLeague] || [];
    var leaguePages = league.map(function (r) { return r.team.replace(/ /g, "_"); });
    // 选主队用：这个赛季五站里出现过的队（去重，联赛的在前）
    var allTeams = [];
    [SEASON.cnLeague].concat(stagePages()).forEach(function (p) {
      (results[p] || []).forEach(function (r) { if (allTeams.indexOf(r.team) < 0) allTeams.push(r.team); });
    });
    var allPages = allTeams.map(function (t) { return t.replace(/ /g, "_"); });
    return Promise.all([
      store.readTeamInfos ? Promise.resolve(store.readTeamInfos(allPages)).catch(function () { return {}; }) : {},
      store.readManualEvents ? Promise.resolve(store.readManualEvents()).catch(function () { return []; }) : [],
      store.readTeams ? Promise.resolve(store.readTeams(leaguePages)).catch(function () { return {}; }) : {}
    ]).then(function (got) {
      var infos = got[0] || {};
      var manual = (got[1] || []).map(normManual).filter(Boolean).slice(0, MAX_MANUAL);
      var rosters = got[2] || {};
      var stages = SEASON.stages.map(function (s) {
        var t = picked.stages[s.page] || {};
        var rows = (results[s.page] || []).slice().sort(function (a, b) { return placeNum(a.place) - placeNum(b.place); });
        return {
          key: s.key, split: s.split, kind: s.kind, page: s.page,
          name: t.name || "", start: t.start || "", end: t.end || "", teams: t.teams || rows.length,
          winner: winnerOf(rows),
          results: rows.map(function (r) { return { team: r.team, place: r.place }; })
        };
      });
      var minor = picked.minor.map(function (t) {
        var rows = results[t.page] || [];
        return {
          page: t.page, name: t.name, start: t.start, end: t.end, tier: t.tier, kind: "cn",
          teams: t.teams || rows.length, winner: winnerOf(rows),
          teamsIn: rows.map(function (r) { return r.team; }), note: "", manual: false
        };
      }).concat(manual).sort(function (a, b) { return a.start.localeCompare(b.start); });
      var cnTeams = league.filter(function (r, i) {
        return isCnTeam(infos[leaguePages[i]], rosters[leaguePages[i]]);
      }).map(function (r) {
        return {
          team: r.team, page: r.team.replace(/ /g, "_"), place: r.place,
          players: (r.players || []).map(function (p) { return { page: p.page, id: p.id }; })
        };
      }).sort(function (a, b) { return placeNum(a.place) - placeNum(b.place); });
      return {
        ok: true, kind: "ok", message: "",
        data: {
          year: SEASON.year, stages: stages, minor: minor, cnTeams: cnTeams,
          teams: allTeams.map(function (t, i) { var info = infos[allPages[i]]; return { team: t, page: allPages[i], region: info ? info.region || "" : "" }; }),
          at: Number(doc.at) || 0
        }
      };
    });
  });
}

module.exports = {
  SEASON: SEASON,
  stagePages: stagePages,
  pickTournaments: pickTournaments,
  normManual: normManual,
  isCnTeam: isCnTeam,
  proSeason: proSeason
};
