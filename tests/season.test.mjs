// 比赛页的赛季（2026-11-08，照 August 的「赛季进度条」设计稿）：pro/utils/seasonview.js 的视图模型。
// 云端部分（proSeason、同步两步）在 pro.test.mjs「比赛页的赛季（云端）」。样本照 2026 年真实的五站日期。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const MP = path.resolve(HERE, "..", "miniprogram");
const sv = require(path.join(MP, "pro", "utils", "seasonview.js"));
const i18n = require(path.join(MP, "utils", "i18n.js"));
const T = i18n.T("zh");
const NOW = Date.UTC(2026, 10, 8, 4, 0, 0);   // 北京时间 11 月 8 日中午

const st = (key, kind, start, end, winner, results, teams) => ({ key, split: 0, kind, page: "P_" + key, name: "LP " + key, start, end, teams: teams || 0, winner: winner || "", results: results || [] });
const RAW = {
  year: 6, at: 5,
  stages: [
    st("s1pl", "league", "2026-04-05", "2026-06-06", "Wolves Esports", [{ team: "Wolves Esports", place: "1" }, { team: "Team RRQ", place: "2" }], 30),
    st("s1po", "playoffs", "2026-07-07", "2026-07-11", "Team RRQ", [{ team: "Team RRQ", place: "1" }], 40),
    st("s2pl", "league", "2026-08-21", "2026-09-13", "Team RRQ", [{ team: "Team RRQ", place: "1" }], 30),
    st("s2po", "playoffs", "2026-10-29", "2026-11-01", "Team Liquid", [{ team: "Team Liquid", place: "1" }, { team: "Team RRQ", place: "11" }], 40),
    st("champ", "championship", "2027-01-28", "2027-01-31", "", [{ team: "Team Liquid", place: "" }, { team: "Team RRQ", place: "" }], 40),
  ],
  minor: [
    { page: "BiliBili/Stellar_Cup/Season_8", name: "BiliBili Stellar Cup - Season #8", start: "2026-09-25", end: "2026-10-04", kind: "cn", teams: 30, winner: "Black Hole", teamsIn: ["Black Hole"], note: "", manual: false },
    { page: "", name: "周末职业表演赛", start: "2026-11-22", end: "2026-11-22", kind: "invitational", teams: 8, winner: "", teamsIn: ["Team RRQ"], note: "", manual: true },
    { page: "", name: "国内周赛", start: "2026-11-07", end: "2026-11-09", kind: "cn", teams: 16, winner: "", teamsIn: [], note: "", manual: true },
  ],
  cnTeams: [
    { team: "Wolves Esports", page: "Wolves_Esports", place: "2", players: [{ page: "WenXx", id: "WenXx" }, { page: "CrazyCong", id: "CrazyCong" }, { page: "QQ", id: "QQ" }] },
    { team: "Black Hole", page: "Black_Hole", place: "", players: [] },
  ],
  teams: [{ team: "Team RRQ", page: "Team_RRQ", region: "Southeast Asia" }, { team: "Wolves Esports", page: "Wolves_Esports", region: "China" }, { team: "Team Liquid", page: "Team_Liquid", region: "" }],
};

describe("赛季卡", () => {
  test("进度条：打到第 4 站（S2 季后赛刚打完），还剩冠军赛；下一站写日期和还有几天", () => {
    const v = sv.season(RAW, "zh", NOW, "");
    assert.equal(v.yearText, "ALGS 第 6 年");
    assert.equal(v.title, "打到第 4 站，还剩冠军赛");
    assert.deepEqual(v.track.map((t) => [t.label, t.state]), [["S1 联赛", "done"], ["S1 季后赛", "done"], ["S2 联赛", "done"], ["S2 季后赛", "now"], ["冠军赛", "next"]]);
    assert.deepEqual(v.next, { key: "champ", page: "P_champ", text: "下一站：冠军赛", sub: "1 月 28–31 日，还有 81 天" });
  });

  test("小比赛圆点落在开赛时的那一站下面；进行中的是红点，主队参加的是红圈", () => {
    const v = sv.season(RAW, "zh", NOW, "Team RRQ");
    assert.deepEqual(v.dots.map((d) => d.dots.map((x) => x.cls)), [[], [], [""], ["now", "mine"], []],
      "Stellar Cup 9 月底开赛 → S2 联赛下面；周赛进行中、表演赛主队参加 → S2 季后赛下面");
  });

  test("比赛页里的日期：同月写一次月份，跨月两头都写；英文", () => {
    assert.equal(sv.dateRange("2026-10-29", "2026-11-01", "zh"), "10 月 29 日–11 月 1 日");
    assert.equal(sv.dateRange("2027-01-28", "2027-01-31", "en"), "Jan 28–31");
    assert.equal(sv.dateRange("2026-11-22", "2026-11-22", "zh"), "11 月 22 日");
  });

  test("还没开始 / 正在打某一站 / 全部打完", () => {
    assert.equal(sv.season(RAW, "zh", Date.UTC(2026, 2, 1), "").title, "这个赛季还没开始");
    assert.equal(sv.season(RAW, "zh", Date.UTC(2026, 9, 30, 4), "").title, "正在打S2 季后赛");
    const over = sv.season(RAW, "zh", Date.UTC(2027, 1, 10), "");
    assert.equal(over.title, "这个赛季打完了");
    assert.equal(over.next, null);
  });
});

describe("主队", () => {
  test("主队卡：下一场是最早的、确定参加的、还没打完的；每一站的名次新的在前", () => {
    const v = sv.season(RAW, "zh", NOW, "Team RRQ");
    assert.equal(v.home.initials, "TR");
    assert.deepEqual(v.home.next, { name: "周末职业表演赛", date: "11 月 22 日", sub: "还有 14 天" });
    assert.deepEqual(v.home.results.map((r) => [r.label, r.place]), [["S2 季后赛", "第 11"], ["S2 联赛", "亚太南第 1"], ["S1 季后赛", "冠军"], ["S1 联赛", "亚太南第 2"]]);
    assert.deepEqual(v.track.map((t) => t.mine), [true, true, true, true, false], "冠军赛还没打，不标");
  });

  test("没选主队：没有主队卡、不出「主队」筛选；队名去空格大小写对得上就算", () => {
    assert.equal(sv.season(RAW, "zh", NOW, "").home, null);
    assert.ok(!sv.season(RAW, "zh", NOW, "").chips.some((c) => c.key === "mine"));
    assert.ok(sv.season(RAW, "zh", NOW, "team rrq").home.results.length > 0);
  });

  test("主队没有确定的下一场：写「还没有确定的下一场」（不编）", () => {
    const v = sv.season(RAW, "zh", NOW, "Black Hole");
    assert.equal(v.home.next, null);
    assert.deepEqual(v.home.results, []);
  });

  test("选主队弹层：有几个赛区出几个按钮；搜索去空格大小写包含就算；当前主队标出来", () => {
    const p = sv.picker(RAW, "zh", "", "", "Team RRQ");
    assert.deepEqual(p.regions.map((r) => r.text), ["全部", "东南亚", "中国"]);
    assert.deepEqual(p.teams.map((t) => [t.team, t.on]), [["Team RRQ", true], ["Wolves Esports", false], ["Team Liquid", false]]);
    assert.deepEqual(sv.picker(RAW, "zh", "wol", "", "").teams.map((t) => t.team), ["Wolves Esports"]);
    assert.deepEqual(sv.picker(RAW, "zh", "", "China", "").teams.map((t) => t.team), ["Wolves Esports"]);
  });
});

describe("近期比赛、这个赛季、CN 战队", () => {
  test("近期比赛：主队参加的置顶，再是进行中、快开打的，最后是刚结束的；类型标签写字", () => {
    const v = sv.season(RAW, "zh", NOW, "Team RRQ");
    assert.deepEqual(v.recent.map((r) => [r.name, r.kindText, r.right, r.rightSub]), [
      ["周末职业表演赛", "邀请赛", "11 月 22 日", "还有 14 天"],
      ["国内周赛", "国内", "进行中", ""],
      ["Split 2 季后赛", "ALGS", "Team Liquid", "冠军"],
    ], "主队参加的在前；冠军赛还有 81 天、Stellar Cup 结束超过 30 天，都不算近期（主队卡照样写冠军赛之前的下一场）");
    assert.equal(v.recent[0].mineText, "主队参赛");
    assert.equal(v.recent[1].sub, "进行中，16 支战队");
    assert.deepEqual(v.chips.map((c) => c.text), ["全部", "主队", "进行中", "ALGS", "国内", "邀请赛"]);
    assert.deepEqual(sv.visibleRecent(v, "cn", false, T).rows.map((r) => r.name), ["国内周赛"]);
    assert.deepEqual(sv.visibleRecent(v, "mine", false, T).rows.map((r) => r.name), ["周末职业表演赛", "Split 2 季后赛"], "主队筛选也包括主队刚打完的");
  });

  test("这个赛季：由近到远；五站写冠军（联赛写亚太南第一）、主队名次；开关关掉只看五站", () => {
    const v = sv.season(RAW, "zh", NOW, "Team RRQ");
    const all = sv.visibleTimeline(v, true);
    assert.deepEqual(all.map((e) => e.name), ["冠军赛", "周末职业表演赛", "国内周赛", "Split 2 季后赛", "BiliBili Stellar Cup - Season #8", "Split 2 职业联赛", "Split 1 季后赛", "Split 1 职业联赛"]);
    const s2po = all.find((e) => e.stageKey === "s2po");
    assert.deepEqual([s2po.right, s2po.rightSub, s2po.mineText, s2po.sub], ["Team Liquid", "冠军", "主队第 11", "全球，40 队"]);
    const s2pl = all.find((e) => e.stageKey === "s2pl");
    assert.deepEqual([s2pl.rightSub, s2pl.mineText, s2pl.sub], ["亚太南第一", "主队亚太南第 1", "亚太南常规赛"]);
    assert.equal(all[0].right, "1 月 28–31 日");
    assert.deepEqual(sv.visibleTimeline(v, false).map((e) => e.stageKey), ["champ", "s2po", "s2pl", "s1po", "s1pl"]);
  });

  test("所有 CN 战队：首发三人、联赛名次（没名次的空着）；先 7 支", () => {
    const v = sv.season(RAW, "zh", NOW, "");
    assert.deepEqual(v.cn.map((c) => [c.name, c.players, c.rank]), [["Wolves Esports", "WenXx、CrazyCong、QQ", "第 2"], ["Black Hole", "", ""]]);
    assert.equal(v.cnCountText, "2 支");
    const many = Object.assign({}, RAW, { cnTeams: Array.from({ length: 9 }, (_, i) => ({ team: "T" + i, page: "T" + i, place: String(i + 1), players: [] })) });
    const c = sv.visibleCn(sv.season(many, "zh", NOW, ""), false, T);
    assert.equal(c.rows.length, 7);
    assert.equal(c.moreText, "展开全部 9 支");
  });

  test("一站的详情页：头写日期、冠军；冠军赛还没打，名单是「已晋级的队」", () => {
    const s2 = sv.stage(RAW, "s2po", "zh", NOW, "Team RRQ");
    assert.deepEqual([s2.name, s2.dates, s2.status, s2.winner, s2.rowsTitle], ["Split 2 季后赛", "10 月 29 日–11 月 1 日", "已结束", "Team Liquid", "名次"]);
    assert.deepEqual(s2.rows.map((r) => [r.placeText, r.mine]), [["第 1", false], ["第 11", true]]);
    const ch = sv.stage(RAW, "champ", "zh", NOW, "");
    assert.deepEqual([ch.status, ch.winner, ch.rowsTitle, ch.rows[0].placeText], ["还有 81 天", "", "已晋级的队", "已晋级"]);
    assert.equal(sv.stage(RAW, "nope", "zh", NOW, ""), null);
  });

  test("英文界面", () => {
    const v = sv.season(RAW, "en", NOW, "Team RRQ");
    assert.equal(v.title, "Stage 4 done, Champs to go");
    assert.equal(v.next.sub, "Jan 28–31 · in 81 days");
    assert.equal(v.home.results[1].place, "APAC-S #1");
  });
});
