// 职业选手（Liquipedia）的测试：云函数的归一化 / 定时同步 / 两个读取接口，
// 选手页的视图模型，比赛页名字对 Liquipedia 的连接。
// 样本的形状照 2026-11-02 实测的 LPDB v3 返回裁小（字段名、取值写法都和真的一样）。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CF = path.resolve(HERE, "..", "cloudfunctions", "apex");
const MP = path.resolve(HERE, "..", "miniprogram");
const lp = require(path.join(CF, "liquipedia.js"));
const sync = require(path.join(CF, "proSync.js"));
const { docId } = require(path.join(CF, "proStore.js"));
const view = require(path.join(MP, "pro", "utils", "view.js"));
const names = require(path.join(MP, "utils", "pronames.js"));
const prolink = require(path.join(MP, "utils", "prolink.js"));

/* ---------------- 样本 ---------------- */

const HAL = {
  pagename: "ImperialHal", id: "ImperialHal", name: "Phillip Dosen", localizedname: "",
  nationality: "United States", nationality2: "", nationality3: "", region: "North America",
  birthdate: "1999-05-31", teampagename: "Team_Falcons", status: "Active", earnings: 1204549,
  extradata: { firstname: "Phillip", roles: [], signatureLegend1: "Bloodhound", lastname: "Dosen", input: "Controller" },
};
const CONG = {
  pagename: "CrazyCong", id: "CrazyCong", name: "Wang Yao", localizedname: "王耀",
  nationality: "China", region: "Asia-Pacific South", birthdate: "0000-01-01", teampagename: "Wolves_Esports",
  status: "Active", earnings: 0,
  extradata: { roles: [], signatureLegend1: "Mad Maggie", signatureLegend2: "Horizon", input: "Mouse & Keyboard" },
};
const placement = (o) => Object.assign({
  pagename: "X", parent: "X", tournament: "X", date: "2026-01-01 00:00:00", placement: "1", prizemoney: 0,
  liquipediatier: "1", liquipediatiertype: "", opponentname: "Team Falcons", opponenttype: "team",
  opponentplayers: { p1: "ImperialHal", p1dn: "ImperialHal", p2: "Wxltzy", p3: "Gild" }, mode: "",
}, o);
const RESULTS = [
  placement({ parent: "ALGS/2027/Championship", tournament: "ALGS: 2027 Championship", date: "2027-01-31", placement: "" }),
  placement({ parent: "ALGS/2026/S2/Playoffs", tournament: "ALGS: 2026 Split 2 Playoffs", date: "2026-11-01", placement: "16", prizemoney: 18000 }),
  placement({ parent: "ALGS/2026/S2/PL", tournament: "ALGS: 2026 Split 2 Pro League - Americas", date: "2026-09-13", placement: "4", prizemoney: 9000, liquipediatier: "2" }),
  placement({ parent: "RedBull/2025", tournament: "Red Bull Legends Inn 2025", date: "2025-12-05", placement: "4", prizemoney: 2000, liquipediatier: "2", liquipediatiertype: "Showmatch", opponentname: "IiTzTimmy / ImperialHal" }),
  placement({ parent: "ALGS/2025/Open", tournament: "ALGS: 2025 Open", date: "2025-05-04", placement: "1", prizemoney: 300000 }),
  placement({ parent: "ALGS/2025/Open", tournament: "ALGS: 2025 Open", date: "2025-05-04", placement: "1", mode: "award_individual", opponentname: "ImperialHal", opponenttype: "solo", opponentplayers: { p1: "ImperialHal" } }),
  placement({ parent: "BLGS/Q4", tournament: "BLGS: 2024 Qualifier #4 - Americas", date: "2024-12-10", placement: "21-22", liquipediatier: "3", liquipediatiertype: "Qualifier" }),
];

/** 假的 LPDB：按请求的类型回样本，记下每次请求 */
function fakeLpdb(handlers) {
  const calls = [];
  const impl = async (url, opts) => {
    const u = new URL(url);
    const type = u.pathname.split("/").pop();
    calls.push({ type, params: Object.fromEntries(u.searchParams), headers: opts.headers });
    const h = handlers[type];
    if (!h) return { ok: false, status: 404, text: async () => "" };
    const r = h(Object.fromEntries(u.searchParams));
    if (r === "fail") return { ok: false, status: 500, text: async () => "" };
    return { ok: true, status: 200, text: async () => JSON.stringify({ result: r }) };
  };
  return { impl, calls };
}

/** 内存里的数据库（和 proStore 同样的接口） */
function memStore() {
  let state = null;
  const players = {};
  const teams = {};
  return {
    players, teams, get state() { return state; },
    readState: async () => (state ? JSON.parse(JSON.stringify(state)) : null),
    writeState: async (s) => { state = JSON.parse(JSON.stringify(s)); return true; },
    readEvents: async () => null,
    savePlayer: async (page, patch) => { players[page] = Object.assign({ page }, players[page] || {}, patch); return true; },
    readPlayer: async (page) => players[page] || null,
    saveTeam: async (page, data) => { teams[page] = Object.assign({ page }, data); return true; },
    readTeams: async (pages) => {
      const o = {};
      pages.forEach((p) => { if (teams[p]) o[p] = teams[p].members; });
      return o;
    },
    readBriefs: async (pages) => {
      const o = {};
      pages.forEach((p) => { const d = players[p]; if (d && d.profile) o[p] = { id: d.profile.id, nat: d.profile.nats[0] || "", input: d.profile.input }; });
      return o;
    },
  };
}

/* ---------------- 云函数：归一化 ---------------- */

describe("liquipedia.js 归一化", () => {
  test("选手资料：常用传奇按 signatureLegend1..N、键鼠/手柄、国籍去空；生日 0000-01-01 当没有", () => {
    const p = lp.normPlayer(CONG);
    assert.equal(p.page, "CrazyCong");
    assert.deepEqual(p.legends, ["Mad Maggie", "Horizon"]);
    assert.equal(p.input, "Mouse & Keyboard");
    assert.deepEqual(p.nats, ["China"]);
    assert.equal(p.birth, "", "0000-01-01 是 Liquipedia 的'没填'");
    assert.equal(p.team, "Wolves Esports", "队伍页面名的下划线换成空格");
    assert.equal(p.localName, "王耀");
  });

  test("成绩：还没打的（名次空）、个人奖项都不算成绩", () => {
    const rows = RESULTS.map(lp.normPlacement).filter(Boolean);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((r) => r.place), "名次不能是空的");
    assert.equal(rows.filter((r) => r.event === "ALGS/2025/Open").length, 1, "Open 只剩战队那条，MVP 奖项去掉");
  });

  test("参赛名单：只要战队，按名次排；队员页面名保留下划线和消歧义", () => {
    const r = lp.eventRoster([
      { opponenttype: "team", placement: "2", opponentname: "B", tournament: "T", date: "2026-11-01 00:00:00", opponentplayers: { p1: "Zach", p2: "LOTR31", p3: "Carter" } },
      { opponenttype: "team", placement: "1", opponentname: "A", opponentplayers: { p1: "Zer0", p2: "Sikezz", p3: "Panic_(American_player)", p3dn: "Panic" } },
      { opponenttype: "solo", placement: "1", opponentname: "Sikezz", mode: "award_individual", opponentplayers: { p1: "Sikezz" } },
    ]);
    assert.deepEqual(r.teams.map((t) => t.team), ["A", "B"]);
    assert.deepEqual(r.teams[0].players[2], { page: "Panic_(American_player)", id: "Panic" });
    assert.equal(r.name, "T");
  });

  test("请求：带 Apikey、gzip、自报身份的 User-Agent；没 Key 不发请求", async () => {
    const f = fakeLpdb({ player: () => [HAL] });
    const out = await lp.fetchPlayers(["ImperialHal"], { apiKey: "k", fetchImpl: f.impl });
    assert.equal(out.ImperialHal.id, "ImperialHal");
    assert.equal(f.calls[0].headers.Authorization, "Apikey k");
    assert.equal(f.calls[0].headers["Accept-Encoding"], "gzip");
    assert.match(f.calls[0].headers["User-Agent"], /PaiquanHelper/);
    assert.equal(f.calls[0].params.wiki, "apexlegends");
    assert.equal(f.calls[0].params.conditions, "[[pagename::ImperialHal]]");
    assert.equal(await lp.fetchPlayers(["ImperialHal"], { apiKey: "", fetchImpl: f.impl }), null);
    assert.equal(f.calls.length, 1, "没 Key 时不该发请求");
  });

  test("请求失败 / 返回 error / 不是 JSON → null（调用方保留旧数据）", async () => {
    const bad = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 403, text: async () => body });
    assert.equal(await lp.query("player", {}, { apiKey: "k", fetchImpl: bad("{}", false) }), null);
    assert.equal(await lp.query("player", {}, { apiKey: "k", fetchImpl: bad(JSON.stringify({ error: ["x"], result: [] })) }), null);
    assert.equal(await lp.query("player", {}, { apiKey: "k", fetchImpl: bad("<html>") }), null);
    assert.equal(await lp.query("player", {}, { apiKey: "k", fetchImpl: async () => { throw new Error("net"); } }), null);
  });

  test("队伍经历：squadplayer 的 link 是空格写法，对回页面名；去重、新的在前", async () => {
    const sq = (o) => Object.assign({ pagename: "Team_Liquid", link: "Panic (American player)", role: "", type: "player", status: "active", joindate: "2026-02-19", leavedate: "0000-01-01" }, o);
    const f = fakeLpdb({ squadplayer: () => [sq({}), sq({}), sq({ pagename: "TSM", status: "former", joindate: "2023-01-01", leavedate: "2026-01-01", role: "Captain" })] });
    const out = await lp.fetchSquads(["Panic_(American_player)"], { apiKey: "k", fetchImpl: f.impl });
    assert.equal(f.calls[0].params.conditions, "[[link::Panic (American player)]]");
    const h = out["Panic_(American_player)"];
    assert.equal(h.length, 2, "重复的那条去掉");
    assert.equal(h[0].team, "Team Liquid");
    assert.equal(h[0].leave, "", "0000-01-01 = 还在队里");
    assert.equal(h[1].role, "Captain");
  });
});

/* ---------------- 云函数：定时同步 ---------------- */

describe("proSync 定时同步", () => {
  const T0 = Date.UTC(2026, 10, 2, 12, 0, 0);
  const handlers = () => ({
    placement: (q) => (q.conditions.indexOf("[[parent::") === 0
      ? [placement({ placement: "16", opponentname: "Team Falcons", tournament: "ALGS: 2026 Split 2 Playoffs", opponentplayers: { p1: "ImperialHal", p2: "Wxltzy", p3: "Gild" } })]
      : RESULTS),
    player: () => [HAL],
    // squadplayer 有两种查法：按选手（[[link::…]]，队伍经历）和按战队（"(…) AND [[type::player]]"，历史名单算队友）
    squadplayer: (q) => (q.conditions.indexOf("(") === 0
      ? [{ pagename: "Team_Falcons", link: "ImperialHal", id: "ImperialHal", role: "", type: "player", status: "active", joindate: "2024-05-28", leavedate: "0000-01-01" },
         { pagename: "Team_Falcons", link: "Gild", id: "Gild", role: "", type: "player", status: "active", joindate: "2025-01-01", leavedate: "0000-01-01" }]
      : [{ pagename: "Team_Falcons", link: "ImperialHal", role: "", type: "player", status: "active", joindate: "2024-05-28", leavedate: "0000-01-01" }]),
  });

  test("一次 tick 最多 1 个请求；一轮 = 名单 → 资料 → 经历 → 战队名单 → 成绩，抓完歇 24 小时", async () => {
    const store = memStore();
    const f = fakeLpdb(handlers());
    let t = T0;
    const deps = { apiKey: "k", store, fetchImpl: f.impl, now: () => t };
    const dids = [];
    for (let i = 0; i < 7; i++) {
      const before = f.calls.length;
      dids.push((await sync.tick(deps)).did);
      assert.ok(f.calls.length - before <= 1, "一次 tick 不能超过 1 个请求");
      t += 5 * 60 * 1000;
    }
    assert.deepEqual(dids.slice(0, 5), ["ok:event", "ok:players", "ok:squads", "ok:teams", "ok:results"]);
    assert.equal(dids[5], "fresh", "抓完了就歇着");
    assert.equal(store.players.ImperialHal.profile.id, "ImperialHal");
    assert.equal(store.players.Wxltzy.history.length, 0, "名单里有但经历没查到的，存空数组（查过了、确实没有）");
    assert.equal(store.players.ImperialHal.results.length, 5);
    assert.deepEqual(store.teams.Team_Falcons.members.map((m) => m.page), ["ImperialHal", "Gild"], "经历里出现过的战队都要查历史名单");
    assert.match(f.calls[3].params.conditions, /^\(\[\[pagename::Team_Falcons\]\]\) AND \[\[type::player\]\]$/);
    // 24 小时后重新来一轮
    t = T0 + sync.CYCLE_MS + 60 * 1000;
    assert.equal((await sync.tick(deps)).did, "ok:event");
  });

  test("两次请求至少隔 4 分钟（定时器被改成每分钟一次也不会超额）", async () => {
    const store = memStore();
    const f = fakeLpdb(handlers());
    let t = T0;
    const deps = { apiKey: "k", store, fetchImpl: f.impl, now: () => t };
    await sync.tick(deps);
    t += 60 * 1000;
    assert.equal((await sync.tick(deps)).did, "wait");
    assert.equal(f.calls.length, 1);
  });

  test("请求失败：留在队首下次再试；连续 3 次就扔掉这一步，旧数据不动", async () => {
    const store = memStore();
    let fail = true;
    const h = handlers();
    const f = fakeLpdb(Object.assign({}, h, { player: (q) => (fail ? "fail" : h.player(q)) }));
    let t = T0;
    const deps = { apiKey: "k", store, fetchImpl: f.impl, now: () => t };
    const step = async () => { const d = (await sync.tick(deps)).did; t += 5 * 60 * 1000; return d; };
    assert.equal(await step(), "ok:event");
    assert.equal(await step(), "fail:players");
    assert.equal(await step(), "fail:players");
    assert.equal(await step(), "fail:players");
    assert.equal(await step(), "ok:squads", "第 3 次失败后跳过资料这一步");
    assert.equal(store.players.ImperialHal.profile, undefined);
  });

  test("没配 Key / 没有数据库：什么都不做", async () => {
    assert.equal((await sync.tick({ apiKey: "", store: memStore() })).did, "nokey");
    assert.equal((await sync.tick({ apiKey: "k", store: null })).did, "nostore");
  });

  test("site_config 的赛事列表：只收字符串、不许带 [[ ]]，最多 5 场", () => {
    assert.deepEqual(sync._cleanEvents(["A", 3, "", "x]]", "B"]), ["A", "B"]);
    assert.equal(sync._cleanEvents("A"), null);
    assert.equal(sync._cleanEvents([]), null);
  });

  test("成绩一次返回到上限（可能截掉老比赛）：拆成两半重查，不存不完整的", async () => {
    const store = memStore();
    const state = { queue: [{ kind: "results", pages: ["A", "B", "C"] }], events: [], rosters: {}, cycleAt: T0, lastRequestAt: 0 };
    await store.writeState(state);
    const many = Array.from({ length: lp.RESULT_LIMIT }, (_, i) => placement({ parent: "E" + i, opponentplayers: { p1: "A" } }));
    const f = fakeLpdb({ placement: () => many });
    await sync.tick({ apiKey: "k", store, fetchImpl: f.impl, now: () => T0 });
    assert.deepEqual(store.state.queue.map((q) => q.pages), [["A", "B"], ["C"]]);
    assert.equal(store.players.A, undefined);
  });
});

/* ---------------- 云函数：前端读取 ---------------- */

describe("proPlayer / proRoster", () => {
  test("proPlayer：有就给，没有 data:null；参数不对报 badinput", async () => {
    const store = memStore();
    await store.savePlayer("ImperialHal", { profile: lp.normPlayer(HAL), profileAt: 5, history: [], historyAt: 9 });
    const r = await sync.proPlayer({ page: "ImperialHal" }, { store });
    assert.equal(r.ok, true);
    assert.equal(r.data.profile.id, "ImperialHal");
    assert.equal(r.data.results, null, "成绩还没抓到：null，不是空数组（空数组会被读成'没比过赛'）");
    assert.equal(r.data.mates, null, "战队名单还没抓到：null（页面不出队友这一块）");
    assert.equal(r.data.at, 9);
    assert.equal((await sync.proPlayer({ page: "Nobody" }, { store })).data, null);
    assert.equal((await sync.proPlayer({ page: "" }, { store })).kind, "badinput");
  });

  test("proPlayer 带队友：从战队历史名单算；我们收录了的人 hasPage = true", async () => {
    const store = memStore();
    await store.savePlayer("Zer0", { profile: { id: "Zer0", nats: [] }, history: [
      { teamPage: "Team_Liquid", team: "Team Liquid", join: "2025-11-05", leave: "", status: "active", type: "player", role: "" },
    ] });
    await store.savePlayer("Sikezz", { profile: { id: "Sikezz", nats: ["United Kingdom"], input: "Controller" } });
    await store.saveTeam("Team_Liquid", { members: [
      { page: "Zer0", id: "Zer0", join: "2025-11-05", leave: "", status: "active", role: "" },
      { page: "Sikezz", id: "Sikezz", join: "2025-11-05", leave: "", status: "active", role: "" },
      { page: "Jaguares", id: "Jaguares", join: "2024-05-02", leave: "2025-11-30", status: "former", role: "" },
    ] });
    const r = await sync.proPlayer({ page: "Zer0" }, { store, now: () => Date.UTC(2026, 10, 2) });
    assert.deepEqual(r.data.mates.map((m) => [m.page, m.current, m.hasPage]), [["Sikezz", true, true], ["Jaguares", false, false]]);
    assert.equal(r.data.mates[0].days, 362, "2025-11-05 到 2026-11-02");
    assert.equal(r.data.mates[1].days, 25, "只算重叠的那 25 天");
  });

  test("proRoster：给第一场赛事的名单，队员带国籍、键鼠/手柄", async () => {
    const store = memStore();
    await store.writeState({ events: ["E"], rosters: { E: { name: "T", date: "2026-11-01", at: 1, teams: [{ place: "16", team: "Team Falcons", players: [{ page: "ImperialHal", id: "ImperialHal" }, { page: "Gild", id: "Gild" }] }] } }, queue: [] });
    await store.savePlayer("ImperialHal", { profile: lp.normPlayer(HAL) });
    const r = await sync.proRoster({}, { store });
    assert.equal(r.data.event, "E");
    assert.deepEqual(r.data.teams[0].players[0], { page: "ImperialHal", id: "ImperialHal", nat: "United States", input: "Controller", hasProfile: true });
    assert.equal(r.data.teams[0].players[1].hasProfile, false);
    assert.equal((await sync.proRoster({ event: "Other" }, { store })).data, null);
  });

  test("文档 _id：只有字母数字和 - _，括号、空格编码掉，不同页面不会撞", () => {
    assert.equal(docId("Zer0"), "p_Zer0");
    assert.match(docId("Panic_(American_player)"), /^p_[A-Za-z0-9_~-]+$/);
    assert.notEqual(docId("a b"), docId("a_b"));
  });
});

/* ---------------- 队友（liquipedia.mates） ---------------- */

describe("合作过的队友", () => {
  const m = (page, join, leave, status = leave ? "former" : "active") => ({ page, id: page, join, leave, status, role: "" });

  test("同队、在队时间重叠才算；按天数相加；现在的队友在前，其余按时间从长到短", () => {
    const teams = {
      Team_Falcons: [m("Me", "2024-05-28", "2025-11-05"), m("Hal", "2024-05-28", ""), m("Gild", "2025-01-01", "2025-06-01")],
      DarkZero: [m("Me", "2022-07-05", "2024-05-28"), m("Hal", "2010-01-01", "2011-01-01"), m("Gen", "2022-07-05", "2024-05-28")],
      Team_Liquid: [m("Me", "2025-11-05", ""), m("Sik", "2025-11-05", "")],
    };
    const out = lp.mates("Me", teams, "2026-11-02");
    assert.deepEqual(out.map((x) => x.page), ["Sik", "Gen", "Hal", "Gild"], "Hal 在 DarkZero 和我没重叠，只算 Falcons 那段");
    assert.equal(out[0].current, true);
    assert.equal(out.find((x) => x.page === "Hal").current, false, "我已经离开 Falcons 了，他还在也不算现在的队友");
    assert.deepEqual(out.find((x) => x.page === "Hal").teams, ["Team Falcons"]);
    assert.equal(out.find((x) => x.page === "Gild").days, 151);
  });

  test("日期不全的那段不算（宁可少一个人，也不编时长）", () => {
    const out = lp.mates("Me", { T: [m("Me", "2024-01-01", ""), m("A", "", ""), { page: "B", id: "B", join: "2024-01-01", leave: "", status: "former", role: "" }] }, "2026-11-02");
    assert.deepEqual(out, []);
  });
});

/* ---------------- 选手页视图模型 ---------------- */

describe("选手页 view.player（照 August 的设计稿）", () => {
  const NOW = Date.UTC(2026, 10, 2, 4, 0, 0);
  const T = require(path.join(MP, "utils", "i18n.js")).T("zh");
  const TE = require(path.join(MP, "utils", "i18n.js")).T("en");
  const raw = (o) => Object.assign({
    page: "ImperialHal",
    profile: lp.normPlayer(HAL),
    history: [
      { teamPage: "Team_Falcons", team: "Team Falcons", join: "2024-05-28", leave: "", status: "active", type: "player", role: "" },
      { teamPage: "TSM", team: "TSM", join: "2019-03-06", leave: "2024-05-13", status: "former", type: "player", role: "Captain" },
    ],
    results: RESULTS.map(lp.normPlacement).filter(Boolean),
    mates: [
      { page: "Gild", id: "Gild", teams: ["Team Falcons"], days: 670, current: true, hasPage: true },
      { page: "Reps", id: "Reps", teams: ["TSM"], days: 1500, current: false, hasPage: false },
    ],
    at: Date.UTC(2026, 10, 2, 3, 0, 0),
  }, o);

  test("大卡：国籍 / 年龄 / 累计奖金；现在的战队带缩写队标和加入时间", () => {
    const v = view.player(raw(), "zh", NOW);
    assert.equal(v.id, "ImperialHal");
    assert.equal(v.realName, "Phillip Dosen");
    assert.deepEqual(v.facts, [{ k: "国籍", v: "美国" }, { k: "年龄", v: "27 岁" }, { k: "累计奖金", v: "$1,204,549" }]);
    assert.deepEqual(v.team, { name: "Team Falcons", initials: "TF", since: "2024 年 5 月加入" });
    assert.equal(v.retired, null);
    assert.equal(view.player(raw(), "en", NOW).team.since, "Joined May 2024");
  });

  test("资料卡：出生日期、输入设备、赛区", () => {
    assert.deepEqual(view.player(raw(), "zh", NOW).profile, [
      { k: "出生日期", v: "1999-05-31" }, { k: "输入设备", v: "手柄" }, { k: "赛区", v: "北美" },
    ]);
  });

  test("不编数据：没生日不出年龄、出生日期，奖金 0 不写，没写常用传奇就没有这一块", () => {
    const v = view.player(raw({ profile: lp.normPlayer(Object.assign({}, CONG, { extradata: { input: "" } })) }), "zh", NOW);
    assert.deepEqual(v.facts.map((f) => f.k), ["国籍"]);
    assert.deepEqual(v.profile.map((f) => f.k), ["赛区"]);
    assert.deepEqual(v.legends, []);
  });

  test("退役：大卡底部换成「已退役 · 最后效力于」，队友不分现在 / 以前", () => {
    const p = lp.normPlayer(Object.assign({}, HAL, { status: "Retired", teampagename: "" }));
    const hist = [{ teamPage: "TSM", team: "TSM", join: "2019-03-06", leave: "2024-05-13", status: "former", type: "player", role: "" }];
    const v = view.player(raw({ profile: p, history: hist }), "zh", NOW);
    assert.equal(v.team, null);
    assert.deepEqual(v.retired, { text: "已退役", last: "最后效力于 TSM" });
    assert.equal(v.mates.now.length, 0);
    assert.equal(v.mates.past.length, 2);
  });

  test("中文界面：本国名字是中日韩文字就一起写；常用传奇中文名下面再写英文", () => {
    const zh = view.player(raw({ profile: lp.normPlayer(CONG) }), "zh", NOW);
    const en = view.player(raw({ profile: lp.normPlayer(CONG) }), "en", NOW);
    assert.equal(zh.realName, "王耀 · Wang Yao");
    assert.equal(en.realName, "Wang Yao");
    assert.deepEqual(zh.legends.map((l) => [l.name, l.en, l.hasIcon]), [["疯马吉", "Mad Maggie", true], ["地平线", "Horizon", true]]);
    assert.deepEqual(en.legends.map((l) => [l.name, l.en]), [["Mad Maggie", ""], ["Horizon", ""]], "英文界面不重复写英文名");
  });

  test("队友：现在的和以前的分开；一起多久写成年月；没收录的人不能点", () => {
    const v = view.player(raw(), "zh", NOW);
    assert.equal(v.mates.countText, "共 2 人");
    assert.deepEqual(v.mates.now, [{ key: "Gild", page: "Gild", name: "Gild", initial: "G", text: "同队 1 年 10 个月" }]);
    assert.deepEqual(v.mates.past, [{ key: "Reps", page: "", name: "Reps", initial: "R", teams: "TSM", dur: "4 年 1 个月" }]);
    assert.equal(view.duration(10, T), "不到 1 个月");
    assert.equal(view.duration(365, TE), "1 yr");
    const many = raw({ mates: Array.from({ length: 9 }, (_, i) => ({ page: "P" + i, id: "P" + i, teams: ["X"], days: 100 - i, current: false })) });
    const vm = view.visibleMates(view.player(many, "zh", NOW).mates, false, T);
    assert.equal(vm.past.length, view.MATES_FIRST);
    assert.equal(vm.moreText, "查看全部 9 人");
    assert.equal(view.visibleMates(view.player(many, "zh", NOW).mates, true, T).past.length, 9);
  });

  test("战队经历：色条老的在左、现在的标红；刻度 起点年 / 中间年 / 现在；时间线新的在前，队长翻成中文", () => {
    const c = view.player(raw(), "zh", NOW).career;
    assert.equal(c.countText, "共 2 支战队");
    assert.deepEqual(c.strip.map((s) => s.now), [false, true]);
    assert.ok(c.strip[0].flex > c.strip[1].flex, "TSM 待了五年多，色条比 Falcons 那段长");
    assert.deepEqual(c.axis.map((a) => a.t), ["2019", "2023", "现在"]);
    assert.deepEqual(c.items.map((i) => [i.team, i.range, i.sub, i.now]), [
      ["Team Falcons", "2024-05 – ", "", true],
      ["TSM", "2019-03 – 2024-05", "队长", false],
    ]);
  });

  test("比赛成绩：默认 S、A 级（1、2 级正式比赛），名次放大、冠军标出；当时的队和现在不一样才写", () => {
    const v = view.player(raw(), "zh", NOW);
    assert.equal(v.results.defaultMode, "major");
    const r = view.visibleResults(v.results, "major", false, T);
    assert.equal(r.sub, "S 级和 A 级赛事");
    assert.deepEqual(r.rows.map((x) => [x.place, x.win, x.event]), [
      ["16", false, "ALGS: 2026 Split 2 Playoffs"], ["4", false, "ALGS: 2026 Split 2 Pro League - Americas"], ["1", true, "ALGS: 2025 Open"],
    ]);
    assert.equal(r.rows[0].prize, "$18,000");
    assert.equal(r.rows[0].sub, "2026-11-01", "Team Falcons 就是现在的队，不重复写");
    assert.equal(r.moreText, "", "不到 5 场不用「查看全部」");
    assert.equal(r.minorText, "也看小比赛（另 2 场）", "S、A 级看完了，给「也看小比赛」（用户 11-02 要的可以切到全部）");
    const all = view.visibleResults(v.results, "all", false, T);
    assert.equal(all.sub, "全部比赛");
    assert.equal(all.majorText, "只看 S 级和 A 级");
    assert.equal(all.rows.find((x) => /Red Bull/.test(x.event)).sub, "2025-12-05 · IiTzTimmy / ImperialHal · 表演赛");
    assert.equal(view.player(raw(), "en", NOW).results.major[2].sup, "st");
  });

  test("比赛成绩多于 5 场：先 5 场 +「查看全部 N 场」，展开以后才给「也看小比赛」", () => {
    const many = Array.from({ length: 8 }, (_, i) => lp.normPlacement(placement({ parent: "E" + i, tournament: "ALGS " + i, placement: String(i + 1) })));
    const v = view.player(raw({ results: many.concat([lp.normPlacement(RESULTS[6])]) }), "zh", NOW);
    const closed = view.visibleResults(v.results, "major", false, T);
    assert.equal(closed.rows.length, view.RES_FIRST);
    assert.equal(closed.moreText, "查看全部 8 场");
    assert.equal(closed.minorText, "");
    const open = view.visibleResults(v.results, "major", true, T);
    assert.equal(open.rows.length, 8);
    assert.equal(open.minorText, "也看小比赛（另 1 场）");
  });

  test("一场 S、A 级都没有：直接列全部", () => {
    const v = view.player(raw({ results: [lp.normPlacement(RESULTS[6])] }), "zh", NOW);
    assert.equal(v.results.defaultMode, "all");
    assert.equal(view.visibleResults(v.results, "all", false, T).majorText, "");
  });

  test("资料还没抓到：ID 从页面名来（去掉消歧义），各块都不出", () => {
    const v = view.player({ page: "Panic_(American_player)", profile: null, history: null, results: null, mates: null, at: 0 }, "zh", NOW);
    assert.equal(v.id, "Panic");
    assert.deepEqual([v.facts, v.profile, v.legends], [[], [], []]);
    assert.equal(v.team, null);
    assert.equal(v.mates.has, false);
    assert.equal(v.career.has, false);
    assert.equal(v.results.has, false);
  });

  test("数据来源页：上次同步时间按北京时间写到分钟；没有就不写", () => {
    assert.equal(view.syncedText(Date.UTC(2026, 10, 1, 20, 0, 0), T), "每天同步一次，上次同步于 2026-11-02 04:00。");
    assert.equal(view.syncedText(0, T), "");
  });

  test("队名缩写当队标占位；年龄按北京时间的日期算周岁", () => {
    assert.deepEqual(["Team Liquid", "Wolves Esports", "REJECT", "Gen.G Citadel"].map(view.initials), ["TL", "WE", "RE", "GGC"]);
    assert.equal(view.age("1999-11-02", Date.UTC(2026, 10, 1, 17, 0, 0)), "27", "北京时间已经是 11-02");
    assert.equal(view.age("1999-11-03", Date.UTC(2026, 10, 2, 4, 0, 0)), "26");
    assert.equal(view.age("2024-01-01", NOW), "");
  });
});

/* ---------------- 名称翻译 ---------------- */

describe("pronames", () => {
  test("查得到才翻，查不到保留英文；台湾按国内规范；不代表国家的不写", () => {
    assert.equal(names.nat("Taiwan", "zh"), "中国台湾");
    assert.equal(names.nat("Atlantis", "zh"), "Atlantis");
    assert.equal(names.nat("Non-representing", "zh"), "");
    assert.equal(names.nat("Japan", "en"), "Japan");
    assert.equal(names.region("emea", "en"), "EMEA");
    assert.equal(names.region("Asia-Pacific South", "zh"), "亚太南");
    assert.equal(names.input("Hybrid", "zh"), "键鼠、手柄混用");
    assert.equal(names.role("Stand-in", "zh"), "临时替补");
    assert.equal(names.role("Stand-in", "en"), "Stand-in");
    assert.equal(names.playerMeta("China", "", "zh"), "中国");
  });
});

/* ---------------- 比赛页 → 选手页的连接 ---------------- */

describe("prolink", () => {
  const roster = { teams: [
    { place: "3", team: "Forged Wolves Gaming", players: [{ page: "DIGVIBEZZ", id: "DIGVIBEZZ" }, { page: "Dark", id: "Dark" }, { page: "Kaydnw", id: "kaydnw" }] },
    { place: "18", team: "PARIVISION", players: [{ page: "LighT", id: "lighT" }] },
    { place: "19", team: "KINOTROPE Club", players: [] },
    { place: "38", team: "KINOTROPE gaming", players: [] },
  ] };

  test("战队：去掉空格大小写相等 → 包含 → 同名次；两个都像就不连", () => {
    assert.equal(prolink.findTeam(roster, "Forged Wolves", "3").team, "Forged Wolves Gaming");
    assert.equal(prolink.findTeam(roster, "KINOTROPE CLUB", "19").team, "KINOTROPE Club");
    assert.equal(prolink.findTeam(roster, "PVISION", "18").team, "PARIVISION", "名字对不上，按名次");
    assert.equal(prolink.findTeam(roster, "PVISION", ""), null, "没名次就不猜");
    assert.equal(prolink.findTeam(roster, "KINOTROPE", ""), null, "两个 KINOTROPE 都包含它：不连");
  });

  test("选手：只在那支队里找；去掉队名缩写；包含也算，但两个都像就不连", () => {
    const fwg = roster.teams[0];
    assert.equal(prolink.findPlayer(fwg, "FWG kaydnw").page, "Kaydnw");
    assert.equal(prolink.findPlayer(fwg, "FWG Dark").page, "Dark");
    assert.equal(prolink.findPlayer(fwg, "Dig").page, "DIGVIBEZZ");
    assert.equal(prolink.findPlayer(fwg, "Nobody"), null);
    assert.equal(prolink.findPlayer(null, "Dark"), null);
    const twins = { players: [{ page: "Ace", id: "Ace" }, { page: "Acer", id: "Acer" }] };
    assert.equal(prolink.findPlayer(twins, "Ac"), null, "太短、又两个都像：不连");
  });
});
