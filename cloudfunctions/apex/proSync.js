/**
 * 职业选手数据（Liquipedia）：定时器慢慢抓、存进数据库；前端只读数据库。
 *
 * 为什么不在用户打开页面时现查：Liquipedia 数据库 API **每小时最多 60 次**（见 liquipedia.js 顶部），
 * 选手页一天被打开的次数远不止 60。所以拆成两半：
 *
 *   定时器（index.js 的 Timer，每 5 分钟一次）→ tick()：**每次最多发 1 个请求**（每小时最多 12 次），
 *     一轮 = 每场赛事 1 次（参赛名单）+ 选手资料 / 队伍经历各 40 人 1 次 + 历届成绩 5 人 1 次，
 *     季后赛 40 队 120 人大约 30 次、两个多小时抓完；抓完歇到 24 小时后再来一轮。
 *   前端 → proPlayer / proRoster：只读数据库，不碰 Liquipedia。
 *
 * 收录谁：site_config 集合里 _id = "pro_events" 的 list（赛事页面名），没有就用 DEFAULT_EVENTS。
 * 换下一场比赛时在云开发控制台改那条记录即可，不用改代码、不用发版。
 *
 * 失败的处理：一个请求失败就留在队首，下次定时器再试；连续失败 3 次扔掉这一步（旧数据照旧留着）。
 * 任何异常都不往外抛（index.js 也会包 try/catch）：选手页是附加功能，不能拖累轮询和轮换记录。
 */
var lp = require("./liquipedia");

var DEFAULT_EVENTS = ["Apex_Legends_Global_Series/2026/Split_2/Playoffs"];
var BATCH = { players: 40, squads: 40, results: 5 };
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

/** 一轮开头：每场赛事一步，最后一个 plan 标记（等名单到了再展开成选手的几步） */
function planCycle(events) {
  return events.map(function (e) { return { kind: "event", event: e }; }).concat([{ kind: "plan" }]);
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
    chunk(pages, BATCH.results).map(function (c) { return { kind: "results", pages: c }; })
  );
}

function emptyState() {
  return { queue: [], events: [], rosters: {}, cycleAt: 0, doneAt: 0, lastRequestAt: 0 };
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
        var mid = Math.ceil(item.pages.length / 2);
        state.queue.splice(1, 0,
          { kind: "results", pages: item.pages.slice(0, mid) },
          { kind: "results", pages: item.pages.slice(mid) });
        return true;
      }
      return Promise.all(item.pages.map(function (page) {
        return store.savePlayer(page, { results: r.rows[page] || [], resultsAt: now });
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
        state.cycleAt = now;
      });
    }

    return start.then(function () {
      // plan 标记不花请求：名单已经到了，展开成选手的几步
      while (state.queue.length && state.queue[0].kind === "plan") {
        state.queue.shift();
        state.queue = expandPlan(state).concat(state.queue);
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

/** 选手页：一位选手存下来的全部内容。数据库里没有 → data:null（页面写"还没有这位选手的资料"） */
function proPlayer(event, deps) {
  var page = event && event.page;
  if (!validPage(page)) return Promise.resolve({ ok: false, kind: "badinput", message: "选手参数不对" });
  if (!deps.store) return Promise.resolve({ ok: true, kind: "ok", message: "", data: null });
  return Promise.resolve(deps.store.readPlayer(page)).then(function (doc) {
    if (!doc) return { ok: true, kind: "ok", message: "", data: null };
    return {
      ok: true, kind: "ok", message: "",
      data: {
        page: page,
        profile: doc.profile || null,
        history: Array.isArray(doc.history) ? doc.history : null,
        results: Array.isArray(doc.results) ? doc.results : null,
        at: latest(doc.profileAt, doc.historyAt, doc.resultsAt)
      }
    };
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
    return Promise.resolve(deps.store.readBriefs(pages)).then(function (briefs) {
      briefs = briefs || {};
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
  // 给测试用
  _planCycle: planCycle,
  _expandPlan: expandPlan,
  _cleanEvents: cleanEvents,
  DEFAULT_EVENTS: DEFAULT_EVENTS,
  BATCH: BATCH,
  CYCLE_MS: CYCLE_MS,
  MIN_GAP_MS: MIN_GAP_MS
};
