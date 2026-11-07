/**
 * Liquipedia 数据库 API（LPDB v3）：职业选手的资料、队伍经历、历届成绩、合作过的队友。
 *
 * 2026-11-02 拿到授权（Key 是 August 申请的），给「比赛」页的选手页供数。
 * 条款里决定做法的几条（https://liquipedia.net/api-terms-of-use）：
 *   - **每小时最多 60 次请求**，结果要尽量缓存、别重复取 —— 所以用户打开页面时**不现查**，
 *     由定时器慢慢抓好存进数据库（见 proSync.js），页面只读数据库；
 *   - 数据是 CC-BY-SA 3.0，页面上要写明"数据来自 Liquipedia"；
 *   - Key 不许给第三方 —— 只放在云函数环境变量 LIQUIPEDIA_API_KEY 里，不下发到小程序端；
 *   - 只许走 API，不许抓网页。
 *
 * 请求格式（官方文档，登录 LPDB 后台才看得到）：
 *   GET https://api.liquipedia.net/api/v3/<类型>?wiki=apexlegends&conditions=...&query=...&limit=...
 *   请求头 Authorization: Apikey <key>；必须接受 gzip（fetcher.js 会解压）。
 *   返回 { result: [...], error?: [...], warning?: [...] }，出错时 HTTP 状态不是 200。
 *
 * 这里只有"拼请求 + 取数 + 归一化"，都是纯函数或可注入 fetchImpl 的函数，tests/liquipedia.test.mjs 直接测。
 * 取不到一律返回 null（不抛异常），调用方据此保留旧数据 —— 沿用项目铁律：宁可旧、不可编。
 */
var fetcher = require("./fetcher");
var URL = require("url").URL;

var BASE = "https://api.liquipedia.net/api/v3/";
var WIKI = "apexlegends";
// 条款要求标明是谁在用（通用的 node-fetch 之类会被封）
var UA = "PaiquanHelper/1.0 (WeChat mini program; Apex esports player pages)";
var TIMEOUT = 12000;
var NO_DATE = "0000-01-01";

/** 拼请求地址。params 里的值原样进 query string（URL 编码交给 searchParams） */
function buildUrl(type, params) {
  var u = new URL(BASE + type);
  u.searchParams.set("wiki", WIKI);
  Object.keys(params || {}).forEach(function (k) {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") u.searchParams.set(k, String(params[k]));
  });
  return u.toString();
}

/**
 * 发一次请求，返回 result 数组；HTTP 不是 200、有 error、解析失败、没 Key 都返回 null。
 * @param {{apiKey:string, fetchImpl?:Function}} deps
 */
function query(type, params, deps) {
  var key = deps && deps.apiKey ? String(deps.apiKey).trim() : "";
  if (!key) return Promise.resolve(null);
  var impl = (deps && deps.fetchImpl) || fetcher.requestText;
  var opts = {
    timeoutMs: TIMEOUT,
    headers: { "Authorization": "Apikey " + key, "Accept-Encoding": "gzip", "User-Agent": UA }
  };
  return Promise.resolve(impl(buildUrl(type, params), opts)).then(function (r) {
    if (!r || !r.ok) return null;
    return Promise.resolve(r.text()).then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { return null; }
      if (!j || !Array.isArray(j.result)) return null;
      if (Array.isArray(j.error) && j.error.length) return null;
      return j.result;
    });
  }).catch(function () { return null; });
}

/* ---------------- 条件拼接 ---------------- */

/** [[col::v1]] OR [[col::v2]] ... */
function anyOf(col, values) {
  return values.map(function (v) { return "[[" + col + "::" + v + "]]"; }).join(" OR ");
}

/**
 * 页面名 ↔ squadplayer 的 link 字段：页面名用下划线（Panic_(American_player)），
 * link 用空格（Panic (American player)）。
 */
function pageToLink(page) { return String(page || "").replace(/_/g, " "); }
function linkToPage(link) { return String(link || "").replace(/ /g, "_"); }

/** 队伍页面名 → 显示名（Team_Falcons → Team Falcons） */
function teamName(page) { return String(page || "").replace(/_/g, " ").trim(); }

function date10(s) {
  var d = String(s || "").slice(0, 10);
  return (!d || d === NO_DATE) ? "" : d;
}

function num(x) {
  var n = Number(x);
  return isFinite(n) ? n : 0;
}

/* ---------------- 归一化 ---------------- */

/**
 * 选手资料。extradata 里 Apex 维基用到的键（2026-11 实测）：
 *   signatureLegend1..N（常用传奇，英文名）、input（Controller / Mouse & Keyboard）、roles（数组，常常是空的）
 */
function normPlayer(row) {
  if (!row || !row.pagename) return null;
  var ex = row.extradata && typeof row.extradata === "object" ? row.extradata : {};
  var legends = [];
  for (var i = 1; i <= 6; i++) {
    var lg = ex["signatureLegend" + i];
    if (lg && legends.indexOf(String(lg)) < 0) legends.push(String(lg));
  }
  var roles = Array.isArray(ex.roles) ? ex.roles.filter(function (r) { return typeof r === "string" && r; }) : [];
  var nats = [row.nationality, row.nationality2, row.nationality3].filter(function (n) { return n; });
  return {
    page: String(row.pagename),
    id: String(row.id || row.pagename),
    name: String(row.name || ""),
    localName: String(row.localizedname || ""),
    nats: nats,
    region: String(row.region || ""),
    birth: date10(row.birthdate),
    status: String(row.status || ""),
    teamPage: String(row.teampagename || ""),
    team: teamName(row.teampagename),
    earnings: num(row.earnings),
    input: String(ex.input || ""),
    roles: roles,
    legends: legends
  };
}

/** 队伍经历（来自各队页面上的队员表）：一段 = 一支队 × 一次加入 */
function normSquad(row) {
  if (!row || !row.pagename) return null;
  return {
    teamPage: String(row.pagename),
    team: teamName(row.pagename),
    join: date10(row.joindate),
    leave: date10(row.leavedate),
    status: String(row.status || ""),       // active / inactive / former
    type: String(row.type || ""),           // player / staff
    role: String(row.role || "")            // 空 = 正式队员；Stand-in、Coach、Streamer…
  };
}

/** 某个参赛方里的选手页面名（p1..p4，三人队用到 p3，个别赛事四人） */
function playersOf(row) {
  var o = row && row.opponentplayers && typeof row.opponentplayers === "object" ? row.opponentplayers : {};
  var out = [];
  for (var i = 1; i <= 4; i++) {
    if (o["p" + i]) out.push({ page: String(o["p" + i]), id: String(o["p" + i + "dn"] || o["p" + i]).replace(/_/g, " ") });
  }
  return out;
}

/**
 * 一条成绩。名次是空的 = 还没打（Liquipedia 会提前列出已晋级的比赛）→ 返回 null，不当成绩。
 * 个人奖项（mode 带 award）也不是名次，同样跳过。
 */
function normPlacement(row) {
  if (!row || !row.placement) return null;
  if (/award/i.test(String(row.mode || ""))) return null;
  return {
    date: date10(row.date),
    event: String(row.parent || row.pagename || ""),
    tournament: String(row.tournament || ""),
    tier: String(row.liquipediatier || ""),
    tierType: String(row.liquipediatiertype || ""),
    place: String(row.placement),
    prize: num(row.prizemoney),
    team: String(row.opponentname || "")
  };
}

/**
 * 一场比赛的参赛队伍和队员（排位赛事的 placement 表：一队一行）。
 * 按名次排；名次空的（比赛还没打完）排在最后、保留 —— 名单本身是真的。
 */
function eventRoster(rows) {
  if (!Array.isArray(rows)) return null;
  var teams = [];
  var name = "";
  var date = "";
  rows.forEach(function (r) {
    if (!r || r.opponenttype !== "team") return;
    if (/award/i.test(String(r.mode || ""))) return;
    var ps = playersOf(r);
    if (!ps.length) return;
    if (!name && r.tournament) name = String(r.tournament);
    if (!date && r.date) date = date10(r.date);
    teams.push({ place: String(r.placement || ""), team: String(r.opponentname || ""), players: ps });
  });
  if (!teams.length) return null;
  var placeNum = function (t) { var n = parseInt(t.place, 10); return isFinite(n) ? n : 9999; };
  teams.sort(function (a, b) { return placeNum(a) - placeNum(b); });
  return { name: name, date: date, teams: teams };
}

/* ---------------- 三种批量请求 ---------------- */

var PLAYER_COLS = "pagename,id,name,localizedname,nationality,nationality2,nationality3,region,birthdate,teampagename,status,earnings,extradata";
var SQUAD_COLS = "pagename,link,role,type,status,joindate,leavedate";
var RESULT_COLS = "pagename,parent,tournament,date,placement,prizemoney,liquipediatier,liquipediatiertype,opponentname,opponenttype,opponentplayers,mode";
var EVENT_COLS = "pagename,parent,tournament,date,placement,opponentname,opponenttype,opponentplayers,mode";
var RESULT_LIMIT = 1000;   // API 的上限

/** 一场比赛的参赛名单 → eventRoster 的形状；取不到 null */
function fetchEvent(eventPage, deps) {
  return query("placement", { conditions: "[[parent::" + eventPage + "]]", query: EVENT_COLS, limit: 300 }, deps)
    .then(function (rows) { return rows === null ? null : eventRoster(rows); });
}

/** 一批选手的资料 → { 页面名: normPlayer }；取不到 null */
function fetchPlayers(pages, deps) {
  return query("player", { conditions: anyOf("pagename", pages), query: PLAYER_COLS, limit: 500 }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      rows.forEach(function (r) { var p = normPlayer(r); if (p && pages.indexOf(p.page) >= 0) out[p.page] = p; });
      return out;
    });
}

/** 一批选手的队伍经历 → { 页面名: [段, ...] }（新的在前）；取不到 null */
function fetchSquads(pages, deps) {
  return query("squadplayer", { conditions: anyOf("link", pages.map(pageToLink)), query: SQUAD_COLS, limit: 1000 }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      pages.forEach(function (p) { out[p] = []; });
      var seen = {};
      rows.forEach(function (r) {
        var page = linkToPage(r.link);
        if (!out[page]) return;
        var s = normSquad(r);
        if (!s) return;
        var k = page + "|" + s.teamPage + "|" + s.join + "|" + s.role;
        if (seen[k]) return;                 // 文档说 API 里可能有重复，自己去重
        seen[k] = true;
        out[page].push(s);
      });
      Object.keys(out).forEach(function (p) {
        out[p].sort(function (a, b) { return (b.join || "").localeCompare(a.join || ""); });
      });
      return out;
    });
}

/**
 * 一批选手的历届成绩 → { rows: { 页面名: [成绩, ...] }, full: bool }。
 * full = 一次返回到了上限（1000 条），可能截掉了老比赛 —— 调用方应该把这一批拆小重查。
 */
function fetchResults(pages, deps) {
  var conds = [];
  pages.forEach(function (p) {
    for (var i = 1; i <= 4; i++) conds.push("[[opponentplayers_p" + i + "::" + p + "]]");
  });
  return query("placement", { conditions: conds.join(" OR "), query: RESULT_COLS, limit: RESULT_LIMIT, order: "date DESC" }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      pages.forEach(function (p) { out[p] = []; });
      var seen = {};
      rows.forEach(function (r) {
        var res = normPlacement(r);
        if (!res) return;
        playersOf(r).forEach(function (pl) {
          if (!out[pl.page]) return;
          var k = pl.page + "|" + res.event + "|" + res.team + "|" + res.place;
          if (seen[k]) return;
          seen[k] = true;
          out[pl.page].push(res);
        });
      });
      return { rows: out, full: rows.length >= RESULT_LIMIT };
    });
}

/* ---------------- 战队的历史名单（2026-11：先给选手页算队友，战队页也用） ---------------- */

var TEAM_COLS = "pagename,link,id,role,type,status,joindate,leavedate,nationality";
var TEAM_LIMIT = 1000;

/**
 * 队里的身份 → 几类（队员表、转会表的 role 都是这种写法）：
 *   player（正式队员：role 是空的；Captain、Loan、Tryout 也算）、sub（替补 / 临时替补）、
 *   inactive（不活跃 / 停赛）、coach（教练、主教练、助理教练）、coachInactive（不活跃的教练）、
 *   other（主播、经理、老板这些工作人员）。战队页只看选手和教练（August 2026-11-07 定的）。
 */
function roleKind(role) {
  var r = String(role || "").trim().toLowerCase();
  if (!r || /^(captain|loan|tryout)$/.test(r)) return "player";
  if (/coach/.test(r)) return /inactive/.test(r) ? "coachInactive" : "coach";
  if (/stand-?in|substitute/.test(r)) return "sub";
  if (/inactive|suspended/.test(r)) return "inactive";
  return "other";
}

/** 跨维基的链接（"leagueoflegends:LiQuiD112"）不是 Apex 维基的页面：页面名留空（点不进去），名字去掉前缀 */
function crossWiki(link) { return /^[a-z0-9]+:/i.test(String(link || "")); }
function plainId(link) { return String(link || "").replace(/^[a-z0-9]+:/i, "").replace(/_/g, " ").replace(/\s*\([^)]*\)$/, ""); }

/**
 * 一支队历史名单里的一个人（squadplayer）：选手全要；工作人员只要教练（主播、经理、老板这些不要）。
 * type 缺的（这一版之前存的数据只有选手）当选手。
 */
function normMember(row) {
  if (!row || !row.link) return null;
  var type = String(row.type || "player");
  var role = String(row.role || "");
  if (type === "staff" && !/coach/i.test(role)) return null;
  return {
    page: crossWiki(row.link) ? "" : linkToPage(row.link),
    id: String(row.id || plainId(row.link)),
    type: type,
    nat: String(row.nationality || ""),
    join: date10(row.joindate),
    leave: date10(row.leavedate),
    status: String(row.status || ""),
    role: role
  };
}

/**
 * 一批战队的历史名单（选手 + 教练）→ { rows: { 战队页面名: [人, ...] }, full: bool }。
 * full = 返回到了上限，可能截掉了一部分 —— 调用方拆小重查（同 fetchResults）。
 * 主播、经理这些工作人员也会返回、在 normMember 里扔掉：LPDB 的条件写不出"role 里有 coach"。
 */
function fetchTeams(teamPages, deps) {
  return query("squadplayer", { conditions: anyOf("pagename", teamPages), query: TEAM_COLS, limit: TEAM_LIMIT }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      teamPages.forEach(function (t) { out[t] = []; });
      var seen = {};
      rows.forEach(function (r) {
        if (!out[r.pagename]) return;
        var m = normMember(r);
        if (!m) return;
        var k = r.pagename + "|" + m.id + "|" + m.join + "|" + m.role;
        if (seen[k]) return;
        seen[k] = true;
        out[r.pagename].push(m);
      });
      return { rows: out, full: rows.length >= TEAM_LIMIT };
    });
}

/* ---------------- 战队页（2026-11，照 August 的战队页设计稿） ---------------- */

var TEAMINFO_COLS = "pagename,name,region,status,createdate,disbanddate,earnings";
var TEAMRES_COLS = "pagename,parent,tournament,date,placement,prizemoney,liquipediatier,liquipediatiertype,opponentname,opponenttype,mode";
var TRANSFER_COLS = "player,nationality,fromteam,toteam,role1,role2,date";
var TRANSFER_LIMIT = 1000;

/**
 * 战队资料。Apex 维基的 locations 只填了赛区（"North America"），没有国家，所以不要它。
 * createdate 各队写法不一（Alliance 写的是俱乐部 2013 年成立，Team Liquid 写的是 Apex 分部 2019 年），
 * 页面上的「进入 Apex」由 view 结合最早的队员、比赛日期再算。
 */
function normTeam(row) {
  if (!row || !row.pagename) return null;
  return {
    page: String(row.pagename),
    name: String(row.name || teamName(row.pagename)),
    region: String(row.region || ""),
    status: String(row.status || ""),          // active / disbanded
    created: date10(row.createdate),
    disbanded: date10(row.disbanddate),
    earnings: num(row.earnings)
  };
}

/** 一批战队的资料 → { 页面名: normTeam }；取不到 null */
function fetchTeamInfo(teamPages, deps) {
  return query("team", { conditions: anyOf("pagename", teamPages), query: TEAMINFO_COLS, limit: 500 }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      rows.forEach(function (r) { var t = normTeam(r); if (t && teamPages.indexOf(t.page) >= 0) out[t.page] = t; });
      return out;
    });
}

/**
 * 一批战队的历届成绩（placement 表里 opponentname = 队名，就是页面名把下划线换成空格）
 * → { rows: { 战队页面名: [成绩, ...] }, full: bool }；full 的意思同 fetchResults。
 */
function fetchTeamResults(teamPages, deps) {
  var byName = {};
  teamPages.forEach(function (p) { byName[teamName(p)] = p; });
  return query("placement", {
    conditions: anyOf("opponentname", Object.keys(byName)), query: TEAMRES_COLS, limit: RESULT_LIMIT, order: "date DESC"
  }, deps).then(function (rows) {
    if (rows === null) return null;
    var out = {};
    teamPages.forEach(function (p) { out[p] = []; });
    var seen = {};
    rows.forEach(function (r) {
      var page = byName[String(r.opponentname || "")];
      if (!page || (r.opponenttype && r.opponenttype !== "team")) return;
      var res = normPlacement(r);
      if (!res) return;
      var k = page + "|" + res.event + "|" + res.place;
      if (seen[k]) return;
      seen[k] = true;
      out[page].push(res);
    });
    return { rows: out, full: rows.length >= RESULT_LIMIT };
  });
}

/**
 * 一条转会记录（从队名 name 这支队看）。role1 是在原来那队的身份，role2 是去新队以后的身份：
 *   加入（toteam 是这队）看 role2，离队（fromteam 是这队）看 role1，队内变动（两边都是这队）看两边。
 * 只是主播、经理、老板这些工作人员的变动 → null。
 */
function normTransfer(row, name) {
  if (!row || !row.player) return null;
  var from = String(row.fromteam || "");
  var to = String(row.toteam || "");
  var k1 = roleKind(row.role1);
  var k2 = roleKind(row.role2);
  var move, mine;
  if (from === name && to === name) { move = "role"; mine = [k1, k2]; }
  else if (to === name) { move = "join"; mine = [k2]; }
  else if (from === name) { move = "leave"; mine = [k1]; }
  else return null;
  if (mine.every(function (k) { return k === "other"; })) return null;
  var link = String(row.player);
  return {
    date: date10(row.date),
    page: crossWiki(link) ? "" : linkToPage(link),
    id: plainId(link),
    nat: String(row.nationality || ""),
    move: move,                               // join / leave / role（队内换身份）
    from: move === "join" ? from : "",        // 从哪队来（空 = 自由选手）
    to: move === "leave" ? to : "",           // 去了哪队（空 = 没有下家）
    k1: k1,
    k2: k2,
    r1: String(row.role1 || ""),              // 原样的身份（"Head Coach"、"Streamer"），页面写"转为主播"这类用
    r2: String(row.role2 || "")
  };
}

/** 一批战队的转会记录 → { rows: { 战队页面名: [记录, ...]（新的在前） }, full: bool } */
function fetchTransfers(teamPages, deps) {
  var names = teamPages.map(teamName);
  var cond = anyOf("fromteam", names) + " OR " + anyOf("toteam", names);
  return query("transfer", { conditions: cond, query: TRANSFER_COLS, limit: TRANSFER_LIMIT, order: "date DESC" }, deps)
    .then(function (rows) {
      if (rows === null) return null;
      var out = {};
      teamPages.forEach(function (p) { out[p] = []; });
      var seen = {};
      rows.forEach(function (r) {
        teamPages.forEach(function (p, i) {
          var t = normTransfer(r, names[i]);
          if (!t) return;
          var k = p + "|" + t.id + "|" + t.date + "|" + t.move + "|" + t.k1 + "|" + t.k2;
          if (seen[k]) return;
          seen[k] = true;
          out[p].push(t);
        });
      });
      Object.keys(out).forEach(function (p) {
        out[p].sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      });
      return { rows: out, full: rows.length >= TRANSFER_LIMIT };
    });
}

/** "2024-05-28" → 天数（UTC）；不是完整日期 → null */
function dayNum(d) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/** 一段在队时间的结束日：有离队日就用；还在队（active、没离队日）用今天；别的（离队日没记）算不出 → null */
function stintEnd(m, today) {
  if (m.leave) return dayNum(m.leave);
  return m.status === "active" ? today : null;
}

/**
 * 合作过的队友：同一支队、在队时间有重叠的人。
 * @param page   这名选手的页面名
 * @param teams  { 战队页面名: [队员, ...] }（这名选手待过的队的历史名单）
 * @param todayIso 今天（"YYYY-MM-DD"，还在队的人算到今天）
 * @returns [{ page, id, teams: [队名], days: 一起的天数, current: 现在还是队友 }]，现在的队友在前，其余按一起的时间从长到短；最多 40 人
 *
 * 日期不全（加入或离队日期没记）的那一段不算 —— 算不出一起多久，宁可少一个人也不编时长。
 */
function mates(page, teams, todayIso) {
  var today = dayNum(todayIso);
  var acc = {};
  Object.keys(teams || {}).forEach(function (tp) {
    var ms = teams[tp] || [];
    var mine = ms.filter(function (m) { return m.page === page && (!m.type || m.type === "player"); });
    if (!mine.length) return;
    ms.forEach(function (o) {
      if (o.page === page || !o.page || (o.type && o.type !== "player")) return;   // 教练不算队友
      mine.forEach(function (me) {
        var a1 = dayNum(me.join);
        var b1 = stintEnd(me, today);
        var a2 = dayNum(o.join);
        var b2 = stintEnd(o, today);
        if (a1 === null || a2 === null || b1 === null || b2 === null) return;
        var days = Math.min(b1, b2) - Math.max(a1, a2);
        if (days < 1) return;
        var x = acc[o.page] || (acc[o.page] = { page: o.page, id: o.id, teams: [], days: 0, current: false });
        x.days += days;
        var tn = teamName(tp);
        if (x.teams.indexOf(tn) < 0) x.teams.push(tn);
        if (!me.leave && me.status === "active" && !o.leave && o.status === "active") x.current = true;
      });
    });
  });
  return Object.keys(acc).map(function (k) { return acc[k]; }).sort(function (a, b) {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return b.days - a.days;
  }).slice(0, 40);
}

module.exports = {
  buildUrl: buildUrl,
  query: query,
  anyOf: anyOf,
  pageToLink: pageToLink,
  linkToPage: linkToPage,
  normPlayer: normPlayer,
  normSquad: normSquad,
  normPlacement: normPlacement,
  eventRoster: eventRoster,
  fetchEvent: fetchEvent,
  fetchPlayers: fetchPlayers,
  fetchSquads: fetchSquads,
  fetchResults: fetchResults,
  fetchTeams: fetchTeams,
  normMember: normMember,
  mates: mates,
  roleKind: roleKind,
  normTeam: normTeam,
  fetchTeamInfo: fetchTeamInfo,
  fetchTeamResults: fetchTeamResults,
  normTransfer: normTransfer,
  fetchTransfers: fetchTransfers,
  teamName: teamName,
  RESULT_LIMIT: RESULT_LIMIT,
  TEAM_LIMIT: TEAM_LIMIT,
  TRANSFER_LIMIT: TRANSFER_LIMIT
};
