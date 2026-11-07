/**
 * 比赛页 → 选手页的连接：把比赛页上的战队名、选手名对到 Liquipedia 的选手页面名。
 *
 * 为什么要对：比赛页的名次、选手榜来自 ALS（写法如 "TL PanicApex"、"Team RRQ"），
 * 选手页的数据来自 Liquipedia（"Panic_(American_player)"、"Rex Regum Qeon"），两边叫法不一样。
 * 云函数给的参赛名单（proRoster）是 Liquipedia 上**这场比赛**的 40 队 × 3 人，所以：
 *
 *   战队：名字去掉空格、大小写后相等 → 一边包含另一边（只有一个候选时）→ 名次相同（同一场比赛的最终名次）。
 *   选手：只在**对上的那支队**的 3 个人里找：去掉队名缩写前缀后相等 → 一边包含另一边（只有一个候选时）。
 *
 * 对不上就不连（那一行不能点），不猜。纯函数，tests/pro.test.mjs 直接测。
 */
var names = require("./pronames.js");

function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

/** 页面名去掉消歧义后缀：Panic_(American_player) → panic */
function pageCore(page) { return norm(String(page || "").replace(/_?\(.*\)$/, "")); }

function uniqueBy(list, pred) {
  var hits = list.filter(pred);
  return hits.length === 1 ? hits[0] : null;
}

/** ALS 战队名 + 名次 → 名单里那支队（找不到 null） */
function findTeam(roster, teamName, rank) {
  var teams = roster && roster.teams || [];
  var n = norm(teamName);
  if (!n) return null;
  var t = uniqueBy(teams, function (x) { return norm(x.team) === n; });
  if (t) return t;
  t = uniqueBy(teams, function (x) {
    var m = norm(x.team);
    return m.length >= 3 && n.length >= 3 && (m.indexOf(n) >= 0 || n.indexOf(m) >= 0);
  });
  if (t) return t;
  if (rank) {
    var r = String(rank);
    t = uniqueBy(teams, function (x) { return x.place === r; });
    if (t) return t;
  }
  return null;
}

/** ALS 选手名（可能带队名缩写，如 "TL PanicApex"）→ 那支队里的一个人（找不到 null） */
function findPlayer(team, alsName) {
  if (!team) return null;
  var raw = String(alsName || "").trim();
  var parts = raw.split(/\s+/);
  var bare = parts.length > 1 ? parts.slice(1).join("") : raw;
  var cands = [norm(bare), norm(raw)];
  var ps = team.players || [];
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    if (!c) continue;
    var hit = uniqueBy(ps, function (p) { return norm(p.id) === c || pageCore(p.page) === c; });
    if (hit) return hit;
  }
  var b = cands[0];
  if (b.length < 3) return null;
  return uniqueBy(ps, function (p) {
    var m = pageCore(p.page);
    var d = norm(p.id);
    return (m.length >= 3 && (b.indexOf(m) >= 0 || m.indexOf(b) >= 0)) ||
           (d.length >= 3 && (b.indexOf(d) >= 0 || d.indexOf(b) >= 0));
  });
}

/** 队员弹层的一行 */
function sheetPlayer(p, lang) {
  return { name: p.id, meta: names.playerMeta(p.nat, p.input, lang), page: p.page };
}

/**
 * 给 matchresult.build() 的结果补上连接（原地不改，返回新对象）：
 *   champTeamPage：冠军队的战队页（还没有战队页 / 没对上为空）
 *   champChips[]：冠军队员 { name, page }（对不上的 page 为空）
 *   rows[i].ti：名次表这一行对上了名单里第几支队（-1 = 没对上，不能点）
 *   playerRows[i].page：选手榜这一行的选手页
 *   rosterTeams[]：名单里每支队 { name, place, teamPage, players: [sheetPlayer] }，点名次行时弹层用
 */
function decorate(result, roster, lang) {
  if (!result) return result;
  var out = Object.assign({}, result);
  var teams = roster && Array.isArray(roster.teams) ? roster.teams : [];
  out.rosterTeams = teams.map(function (t) {
    return { name: t.team, place: t.place, teamPage: t.teamPage || "", players: (t.players || []).map(function (p) { return sheetPlayer(p, lang); }) };
  });

  var champ = findTeam(roster, result.champTeam, "1");
  out.champTeamPage = champ && champ.teamPage ? champ.teamPage : "";
  out.champChips = (result.champList || []).map(function (n) {
    var p = findPlayer(champ, n);
    return { name: n, page: p ? p.page : "" };
  });

  out.rows = (result.rows || []).map(function (r) {
    var t = findTeam(roster, r.team, r.rank);
    return Object.assign({}, r, { ti: t ? teams.indexOf(t) : -1 });
  });

  // 选手榜只写了战队名：名次从名次表里查（「Team RRQ」这种只能靠名次对上）
  var rankOf = {};
  (result.rows || []).forEach(function (r) { rankOf[r.team] = r.rank; });
  out.playerRows = (result.playerRows || []).map(function (r) {
    var p = findPlayer(findTeam(roster, r.team, rankOf[r.team] || ""), r.player);
    return Object.assign({}, r, { page: p ? p.page : "" });
  });
  return out;
}

module.exports = {
  findTeam: findTeam,
  findPlayer: findPlayer,
  decorate: decorate,
  norm: norm
};
