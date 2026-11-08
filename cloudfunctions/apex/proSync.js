/**
 * 职业选手数据（Liquipedia）：定时器慢慢抓、存进数据库；前端只读数据库。
 *
 * 为什么不在用户打开页面时现查：Liquipedia 数据库 API **每小时最多 60 次**（见 liquipedia.js 顶部），
 * 选手页一天被打开的次数远不止 60。所以拆成两半：
 *
 *   定时器（index.js 的 Timer，每 5 分钟一次）→ tick()：**每次最多发 1 个请求**（每小时最多 12 次），
 *     一轮 = 每场赛事 1 次（参赛名单）+ 选手资料 / 队伍经历各 40 人 1 次
 *       + 他们待过的战队：历史名单 30 队 1 次、资料 40 队 1 次、成绩 10 队 1 次、转会 15 队 1 次（战队页、算队友用）
 *       + 选手的历届成绩 5 人 1 次，
 *     季后赛 40 队 121 人、待过 339 支队，大约 120 次、十个小时抓完；抓完歇到 24 小时后再来一轮。
 *   前端 → proPlayer / proRoster / proTeam：只读数据库，不碰 Liquipedia。
 *
 * 收录谁：site_config 集合里 _id = "pro_events" 的 list（赛事页面名），没有就用 DEFAULT_EVENTS。
 * 换下一场比赛时在云开发控制台改那条记录即可，不用改代码、不用发版。
 *
 * 失败的处理：一个请求失败就留在队首，下次定时器再试；连续失败 3 次扔掉这一步（旧数据照旧留着）。
 * 任何异常都不往外抛（index.js 也会包 try/catch）：选手页是附加功能，不能拖累轮询和轮换记录。
 */
var lp = require("./liquipedia");
var season = require("./proSeason");
var photos = require("./proPhotos");

var DEFAULT_EVENTS = ["Apex_Legends_Global_Series/2026/Split_2/Playoffs"];
var BATCH = { players: 40, squads: 40, teams: 30, teamInfo: 40, teamResults: 10, transfers: 15, results: 5 };
var CYCLE_MS = 24 * 3600 * 1000;     // 一轮抓完后隔多久再抓
var MIN_GAP_MS = 4 * 60 * 1000;      // 两次请求至少隔 4 分钟（万一定时器被改成每分钟一次，也不会超额）
var MAX_FAILS = 3;
var MAX_EVENTS = 5;

function chunk(list, n) {
  var out = [];
  for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

function cleanEvents(list) {
  if (!Array.isArray(list)) return null;
  var out = list.filter(function (e) {
    return typeof e === "string" && e.length > 0 && e.length <= 200 && e.indexOf("]]") < 0 && e.indexOf("[[") < 0;
  }).slice(0, MAX_EVENTS);
  return out.length ? out : null;
}

/**
 * 一轮开头：每场赛事一步；比赛页的赛季两步（season 取比赛列表，planSeason 标记展开成取名次的几步，2026-11-08）；
 * 最后一个 plan 标记（等名单到了再展开成选手的几步）
 */
function planCycle(events) {
  return events.map(function (e) { return { kind: "event", event: e }; })
    .concat([{ kind: "season" }, { kind: "planSeason" }, { kind: "plan" }]);
}

/** 不花请求的标记步：plan（名单到了，展开成选手的几步）、planTeams（队伍经历到了，展开成战队名单的几步）、planSeason（比赛列表到了，展开成取名次） */
function isMarker(item) { return !!item && (item.kind === "plan" || item.kind === "planTeams" || item.kind === "planSeason"); }

var SEASON_BATCH = 10;   // 名次一次取几场比赛（季后赛、冠军赛各 40 队，十场也到不了 1000 行的上限）

/** 比赛列表到了：五站 + 中国的小比赛，每 10 场取一次名次 */
function expandSeason(state) {
  var pages = season.stagePages().concat(state.seasonMinor || []);
  return chunk(pages, SEASON_BATCH).map(function (c) { return { kind: "seasonResults", pages: c }; });
}

/** 所有赛事名单里的选手页面名（去重，按赛事、名次的顺序） */
function rosterPages(state) {
  var pages = [];
  (state.events || []).forEach(function (e) {
    var r = state.rosters && state.rosters[e];
    (r && r.teams || []).forEach(function (t) {
      (t.players || []).forEach(function (p) { if (p.page && pages.indexOf(p.page) < 0) pages.push(p.page); });
    });
  });
  return pages;
}

function expandPlan(state) {
  var pages = rosterPages(state);
  if (!pages.length) return [];
  return [].concat(
    chunk(pages, BATCH.players).map(function (c) { return { kind: "players", pages: c }; }),
    chunk(pages, BATCH.squads).map(function (c) { return { kind: "squads", pages: c }; }),
    [{ kind: "planTeams" }],
    chunk(pages, BATCH.results).map(function (c) { return { kind: "results", pages: c }; })
  );
}

/** 赛事名单里的战队（页面名 = 队名把空格换成下划线） */
function rosterTeams(state) {
  var out = [];
  (state.events || []).forEach(function (e) {
    var r = state.rosters && state.rosters[e];
    (r && r.teams || []).forEach(function (t) {
      var p = String(t.team || "").trim().replace(/ /g, "_");
      if (p && out.indexOf(p) < 0) out.push(p);
    });
  });
  return out;
}

/**
 * 队伍经历都到了：这些选手作为正式队员待过的所有战队（加上赛事名单里的队），
 * 历史名单、资料、成绩、转会各按批量查。正在比赛的队排在前面，先有战队页。
 */
function expandTeams(state) {
  var now = rosterTeams(state);
  // 比赛页「所有 CN 战队」那个联赛的队（2026-11-08）：也要有战队页，排在正在比赛的队后面
  (state.seasonTeams || []).forEach(function (p) { if (now.indexOf(p) < 0) now.push(p); });
  var rest = (state.teamPages || []).filter(function (p) { return now.indexOf(p) < 0; }).sort();
  var teams = now.concat(rest);
  var steps = function (kind) { return chunk(teams, BATCH[kind]).map(function (c) { return { kind: kind, pages: c }; }); };
  return [].concat(steps("teams"), steps("teamInfo"), steps("teamResults"), steps("transfers"));
}

function expandMarker(item, state) {
  if (item.kind === "plan") return expandPlan(state);
  if (item.kind === "planSeason") return expandSeason(state);
  return expandTeams(state);
}

function emptyState() {
  return { queue: [], events: [], rosters: {}, teamPages: [], cycleAt: 0, doneAt: 0, lastRequestAt: 0 };
}

/** 拆半重查（一次返回到了 API 上限，可能截掉了一部分）：两半插在当前这一步后面 */
function splitAfter(state, item) {
  var mid = Math.ceil(item.pages.length / 2);
  state.queue.splice(state.queue.indexOf(item) + 1, 0,
    { kind: item.kind, pages: item.pages.slice(0, mid) },
    { kind: item.kind, pages: item.pages.slice(mid) });
}

/** 做一步（发一个请求 + 存结果）。返回 true = 这一步完成，可以出队 */
function runStep(item, state, deps, now) {
  var store = deps.store;
  if (item.kind === "event") {
    return lp.fetchEvent(item.event, deps).then(function (r) {
      if (!r) return false;
      state.rosters = state.rosters || {};
      state.rosters[item.event] = { name: r.name, date: r.date, teams: r.teams, at: now };
      return true;
    });
  }
  if (item.kind === "players") {
    return lp.fetchPlayers(item.pages, deps).then(function (map) {
      if (!map) return false;
      return Promise.all(Object.keys(map).map(function (page) {
        return store.savePlayer(page, { profile: map[page], profileAt: now });
      })).then(function () { return true; });
    });
  }
  if (item.kind === "squads") {
    return lp.fetchSquads(item.pages, deps).then(function (map) {
      if (!map) return false;
      // 记下这些选手作为正式队员待过的队，后面查这些队的历史名单算队友
      state.teamPages = state.teamPages || [];
      Object.keys(map).forEach(function (page) {
        (map[page] || []).forEach(function (h) {
          if (h.type === "player" && h.teamPage && state.teamPages.indexOf(h.teamPage) < 0) state.teamPages.push(h.teamPage);
        });
      });
      return Promise.all(item.pages.map(function (page) {
        return store.savePlayer(page, { history: map[page] || [], historyAt: now });
      })).then(function () { return true; });
    });
  }
  if (item.kind === "results") {
    return lp.fetchResults(item.pages, deps).then(function (r) {
      if (!r) return false;
      // 一次返回到了上限：可能截掉了老比赛，拆成两半重查（不存这次不完整的）
      if (r.full && item.pages.length > 1) {
        splitAfter(state, item);
        return true;
      }
      return Promise.all(item.pages.map(function (page) {
        return store.savePlayer(page, { results: r.rows[page] || [], resultsAt: now });
      })).then(function () { return true; });
    });
  }
  if (item.kind === "season") {
    // 比赛页：这个赛季的比赛列表（五站 + 办在中国的小比赛）；只存要的那些
    return lp.fetchTournaments(season.SEASON.from, season.SEASON.to, deps).then(function (list) {
      if (!list) return false;
      var picked = season.pickTournaments(list);
      var keep = Object.keys(picked.stages).map(function (p) { return picked.stages[p]; }).concat(picked.minor);
      state.seasonMinor = picked.minor.map(function (t) { return t.page; });
      return Promise.resolve(store.saveSeason ? store.saveSeason({ tournaments: keep, at: now }) : true).then(function () { return true; });
    });
  }
  if (item.kind === "seasonResults") {
    return lp.fetchEventResults(item.pages, deps).then(function (r) {
      if (!r) return false;
      if (r.full && item.pages.length > 1) {
        splitAfter(state, item);
        return true;
      }
      var league = r.rows[season.SEASON.cnLeague];
      if (league) state.seasonTeams = league.map(function (x) { return x.team.replace(/ /g, "_"); });
      // 名次按比赛分开存：已经有的比赛换成新的，别的照旧
      return Promise.resolve(store.readSeason ? store.readSeason() : null).then(function (doc) {
        var results = (doc && Array.isArray(doc.results)) ? doc.results.filter(function (x) { return item.pages.indexOf(x.page) < 0; }) : [];
        item.pages.forEach(function (p) { results.push({ page: p, rows: r.rows[p] || [] }); });
        return store.saveSeason ? store.saveSeason({ results: results, at: now }) : true;
      }).then(function () { return true; });
    });
  }
  if (item.kind === "teams") {
    return lp.fetchTeams(item.pages, deps).then(function (r) {
      if (!r) return false;
      if (r.full && item.pages.length > 1) {
        splitAfter(state, item);
        return true;
      }
      return Promise.all(item.pages.map(function (team) {
        return store.saveTeam(team, { members: r.rows[team] || [], membersAt: now });
      })).then(function () { return true; });
    });
  }
  if (item.kind === "teamInfo") {
    return lp.fetchTeamInfo(item.pages, deps).then(function (map) {
      if (!map) return false;
      // 维基上没有这支队的资料（改名、合并过）就不写，名单、成绩照常
      return Promise.all(Object.keys(map).map(function (team) {
        return store.saveTeam(team, { info: map[team], infoAt: now });
      })).then(function () { return true; });
    });
  }
  if (item.kind === "teamResults" || item.kind === "transfers") {
    var fetch = item.kind === "teamResults" ? lp.fetchTeamResults : lp.fetchTransfers;
    var field = item.kind === "teamResults" ? "results" : "transfers";
    return fetch(item.pages, deps).then(function (r) {
      if (!r) return false;
      if (r.full && item.pages.length > 1) {
        splitAfter(state, item);
        return true;
      }
      return Promise.all(item.pages.map(function (team) {
        var patch = {};
        patch[field] = r.rows[team] || [];
        patch[field + "At"] = now;
        return store.saveTeam(team, patch);
      })).then(function () { return true; });
    });
  }
  return Promise.resolve(true);   // 认不出的步骤直接扔掉
}

/**
 * 定时器每次调一下。
 * @param {{apiKey:string, store:object, now?:Function, fetchImpl?:Function}} deps
 * @returns {Promise<{did:string}>} 只用来打日志、写测试
 */
function tick(deps) {
  var now = (deps.now || Date.now)();
  var store = deps.store;
  if (!deps.apiKey) return Promise.resolve({ did: "nokey" });
  if (!store) return Promise.resolve({ did: "nostore" });

  return Promise.resolve(store.readState()).then(function (saved) {
    var state = saved && typeof saved === "object" ? saved : emptyState();
    if (!Array.isArray(state.queue)) state.queue = [];
    if (state.lastRequestAt && now - state.lastRequestAt < MIN_GAP_MS) return { did: "wait" };

    var start = Promise.resolve(null);
    if (!state.queue.length) {
      if (state.cycleAt && now - state.cycleAt < CYCLE_MS) return { did: "fresh" };
      start = Promise.resolve(store.readEvents()).then(function (list) {
        state.events = cleanEvents(list) || DEFAULT_EVENTS.slice();
        state.queue = planCycle(state.events);
        state.teamPages = [];
        state.cycleAt = now;
      });
    }

    return start.then(function () {
      // 标记步不花请求：要的东西已经到了，展开成实际的几步
      while (state.queue.length && isMarker(state.queue[0])) {
        var marker = state.queue.shift();
        state.queue = expandMarker(marker, state).concat(state.queue);
      }
      if (!state.queue.length) {
        state.doneAt = now;
        return Promise.resolve(store.writeState(state)).then(function () { return { did: "done" }; });
      }
      var item = state.queue[0];
      state.lastRequestAt = now;
      return runStep(item, state, deps, now).then(function (ok) {
        if (ok) {
          state.queue.splice(state.queue.indexOf(item), 1);
        } else {
          item.fails = (item.fails || 0) + 1;
          if (item.fails >= MAX_FAILS) state.queue.shift();
        }
        if (!state.queue.length) state.doneAt = now;
        return Promise.resolve(store.writeState(state)).then(function () {
          return { did: (ok ? "ok:" : "fail:") + item.kind };
        });
      });
    });
  }).catch(function (e) {
    console.warn("选手数据同步失败：" + (e && e.message ? e.message : String(e)));
    return { did: "error" };
  });
}

/* ---------------- 前端调用：只读数据库 ---------------- */

function validPage(p) {
  return typeof p === "string" && p.length > 0 && p.length <= 150;
}

function latest() {
  var m = 0;
  for (var i = 0; i < arguments.length; i++) if (Number(arguments[i]) > m) m = Number(arguments[i]);
  return m;
}

function todayIso(ms) {
  var d = new Date(ms + 8 * 3600 * 1000);   // 北京时间的日期
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}

/**
 * 合作过的队友：读这名选手待过的队的历史名单，算重叠（liquipedia.mates），
 * 再看每个队友我们有没有资料（有才能点进他的页面）。
 * → { mates, teamPages }：mates 战队名单还没抓到时是 null（页面不出这一块）；
 *   teamPages = 他待过的队里有战队页的那些（{ 页面名: true }，战队经历那几行能不能点）。
 */
function matesOf(page, history, deps) {
  var teams = [];
  (history || []).forEach(function (h) {
    if (h.teamPage && teams.indexOf(h.teamPage) < 0) teams.push(h.teamPage);
  });
  if (!teams.length || !deps.store.readTeams) return Promise.resolve({ mates: null, teamPages: {} });
  return Promise.resolve(deps.store.readTeams(teams)).then(function (map) {
    map = map || {};
    var teamPages = {};
    Object.keys(map).forEach(function (t) { teamPages[t] = true; });
    if (!Object.keys(map).length) return { mates: null, teamPages: teamPages };
    var list = lp.mates(page, map, todayIso((deps.now || Date.now)()));
    return Promise.resolve(deps.store.readBriefs(list.map(function (m) { return m.page; }))).then(function (briefs) {
      briefs = briefs || {};
      return {
        mates: list.map(function (m) { return Object.assign({}, m, { hasPage: !!briefs[m.page] }); }),
        teamPages: teamPages
      };
    });
  });
}

/** 选手页：一位选手存下来的全部内容 + 队友。数据库里没有 → data:null（页面写"还没有这位选手的资料"） */
function proPlayer(event, deps) {
  var page = event && event.page;
  if (!validPage(page)) return Promise.resolve({ ok: false, kind: "badinput", message: "选手参数不对" });
  if (!deps.store) return Promise.resolve({ ok: true, kind: "ok", message: "", data: null });
  return Promise.resolve(deps.store.readPlayer(page)).then(function (doc) {
    if (!doc) return { ok: true, kind: "ok", message: "", data: null };
    var history = Array.isArray(doc.history) ? doc.history : null;
    return matesOf(page, history, deps).catch(function () { return { mates: null, teamPages: {} }; }).then(function (m) {
      return {
        ok: true, kind: "ok", message: "",
        data: {
          page: page,
          profile: doc.profile || null,
          history: history,
          results: Array.isArray(doc.results) ? doc.results : null,
          mates: m.mates,
          teamPages: m.teamPages,
          photo: photos.photoOf(page, "hero"),   // 选手照片（cloud:// 地址）；没有 → ""，页面用剪影
          at: latest(doc.profileAt, doc.historyAt, doc.resultsAt)
        }
      };
    });
  });
}

/**
 * 战队页：一支队存下来的全部内容。队员、转会里的人带上 hasPage（有选手页才能点进去）和国籍。
 * 数据库里没有 → data:null（页面写"还没有这支战队的资料"）。
 */
function proTeam(event, deps) {
  var page = event && event.page;
  if (!validPage(page)) return Promise.resolve({ ok: false, kind: "badinput", message: "战队参数不对" });
  if (!deps.store || !deps.store.readTeam) return Promise.resolve({ ok: true, kind: "ok", message: "", data: null });
  return Promise.resolve(deps.store.readTeam(page)).then(function (doc) {
    if (!doc) return { ok: true, kind: "ok", message: "", data: null };
    var members = Array.isArray(doc.members) ? doc.members : null;
    var transfers = Array.isArray(doc.transfers) ? doc.transfers : null;
    var pages = [];
    (members || []).concat(transfers || []).forEach(function (x) {
      if (x && x.page && pages.indexOf(x.page) < 0) pages.push(x.page);
    });
    return Promise.resolve(pages.length ? deps.store.readBriefs(pages) : {}).catch(function () { return {}; }).then(function (briefs) {
      briefs = briefs || {};
      var mark = function (x) {
        var b = x.page ? briefs[x.page] : null;
        return Object.assign({}, x, { hasPage: !!b, nat: x.nat || (b && b.nat) || "" });
      };
      // 名单里的选手带上照片（战队页的选手卡用，教练不放）
      var markMember = function (x) {
        var o = mark(x);
        o.photo = x.page && (!x.type || x.type === "player") ? photos.photoOf(x.page, "card") : "";
        return o;
      };
      return {
        ok: true, kind: "ok", message: "",
        data: {
          page: page,
          info: doc.info || null,
          members: members ? members.map(markMember) : null,
          results: Array.isArray(doc.results) ? doc.results : null,
          transfers: transfers ? transfers.map(mark) : null,
          at: latest(doc.at, doc.membersAt, doc.infoAt, doc.resultsAt, doc.transfersAt)
        }
      };
    });
  });
}

/**
 * 一场赛事的参赛队伍和队员（比赛页用它把战队、选手名连到选手页）。
 * 不传 event 就给收录的第一场。每个队员带上国籍、键鼠/手柄（有资料的话），队员弹层直接用。
 */
function proRoster(event, deps) {
  if (!deps.store) return Promise.resolve({ ok: true, kind: "ok", message: "", data: null });
  return Promise.resolve(deps.store.readState()).then(function (state) {
    var events = state && Array.isArray(state.events) ? state.events : [];
    var want = event && typeof event.event === "string" ? event.event : events[0];
    var r = want && state && state.rosters ? state.rosters[want] : null;
    if (!r || !Array.isArray(r.teams)) return { ok: true, kind: "ok", message: "", data: null };
    var pages = [];
    r.teams.forEach(function (t) { (t.players || []).forEach(function (p) { pages.push(p.page); }); });
    var teamPageOf = function (t) { return String(t.team || "").trim().replace(/ /g, "_"); };
    var index = deps.store.teamIndex
      ? Promise.resolve(deps.store.teamIndex(r.teams.map(teamPageOf))).catch(function () { return {}; })
      : Promise.resolve({});
    return Promise.all([deps.store.readBriefs(pages), index]).then(function (got) {
      var briefs = got[0] || {};
      var teamIdx = got[1] || {};
      return {
        ok: true, kind: "ok", message: "",
        data: {
          event: want,
          name: r.name || "",
          date: r.date || "",
          at: r.at || 0,
          teams: r.teams.map(function (t) {
            return {
              place: t.place,
              team: t.team,
              teamPage: teamIdx[teamPageOf(t)] ? teamPageOf(t) : "",   // 空 = 还没有战队页
              players: (t.players || []).map(function (p) {
                var b = briefs[p.page] || null;
                return {
                  page: p.page,
                  id: (b && b.id) || p.id,
                  nat: (b && b.nat) || "",
                  input: (b && b.input) || "",
                  hasProfile: !!b
                };
              })
            };
          })
        }
      };
    });
  });
}

module.exports = {
  tick: tick,
  proPlayer: proPlayer,
  proRoster: proRoster,
  proTeam: proTeam,
  // 给测试用
  _planCycle: planCycle,
  _expandPlan: expandPlan,
  _expandTeams: expandTeams,
  _expandSeason: expandSeason,
  _todayIso: todayIso,
  _cleanEvents: cleanEvents,
  DEFAULT_EVENTS: DEFAULT_EVENTS,
  BATCH: BATCH,
  CYCLE_MS: CYCLE_MS,
  MIN_GAP_MS: MIN_GAP_MS
};
