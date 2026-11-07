// 战队页的视图模型（pro/utils/teamview.js）：照 August 的战队页设计稿（2026-11-07）。
// 样本照 2026-11-07 实测的 Team Liquid 裁小（字段是云端 proTeam 回的形状）。云端部分的测试在 pro.test.mjs。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const MP = path.resolve(HERE, "..", "miniprogram");
const tv = require(path.join(MP, "pro", "utils", "teamview.js"));
const i18n = require(path.join(MP, "utils", "i18n.js"));
const T = i18n.T("zh");
const TE = i18n.T("en");

const mem = (o) => Object.assign({ page: o.id, type: "player", nat: "", leave: "", status: "active", role: "", hasPage: false }, o);
const mv = (o) => Object.assign({ page: o.id, nat: "", from: "", to: "", r1: "", r2: "", hasPage: false }, o);

const TL = {
  page: "Team_Liquid", at: 7,
  info: { page: "Team_Liquid", name: "Team Liquid", region: "North America", status: "active", created: "2000-01-01", disbanded: "", earnings: 186400 },
  members: [
    mem({ id: "Zer0", nat: "United States", join: "2025-11-05", hasPage: true }),
    mem({ id: "Sikezz", nat: "United Kingdom", join: "2025-11-05", role: "Captain" }),
    mem({ id: "Panic", page: "Panic_(American_player)", nat: "United States", join: "2026-02-19", hasPage: true }),
    mem({ id: "Kapreme", type: "staff", join: "2025-01-03", role: "Head Coach" }),
    mem({ id: "Tiltedwinnie", type: "staff", join: "2025-11-05", leave: "2026-04-21", status: "former", role: "Coach" }),
    mem({ id: "Fuhhnq", join: "2025-11-05", status: "inactive", role: "" }),
    mem({ id: "Kurev", join: "2024-09-28", leave: "2025-05-21", status: "former", hasPage: true }),
    mem({ id: "YanYa", join: "2024-05-02", leave: "2024-09-27", status: "former" }),
    mem({ id: "YanYa", join: "2025-05-14", leave: "2025-11-30", status: "former" }),
    mem({ id: "Cali", join: "2019-03-06", leave: "2021-07-14", status: "former" }),
    mem({ id: "Mendo", join: "2019-08-13", leave: "", status: "former" }),
  ],
  results: [
    { date: "2026-08-24", event: "A", tournament: "ALGS Year 6 NA Finals", tier: "1", tierType: "", place: "1", prize: 90000, team: "Team Liquid" },
    { date: "2026-05-11", event: "B", tournament: "ALGS Split 1 Playoffs", tier: "1", tierType: "", place: "4", prize: 36000, team: "Team Liquid" },
  ],
  transfers: [
    mv({ id: "Tiltedwinnie", date: "2026-04-21", move: "leave", to: "ROC Esports", k1: "coachInactive", k2: "coach" }),
    mv({ id: "Fuhhnq", date: "2026-04-16", move: "leave", k1: "inactive", k2: "player" }),
    mv({ id: "Kapreme", date: "2026-03-24", move: "join", k1: "player", k2: "coach", r2: "Coach" }),
    mv({ id: "Panic", page: "Panic_(American_player)", date: "2026-02-19", move: "join", k1: "player", k2: "player", hasPage: true }),
    mv({ id: "Tiltedwinnie", date: "2026-02-18", move: "role", k1: "coach", k2: "coachInactive" }),
    mv({ id: "Fuhhnq", date: "2026-02-18", move: "role", k1: "player", k2: "inactive" }),
    mv({ id: "Pistillo", date: "2025-11-05", move: "role", k1: "coach", k2: "other", r1: "Coach", r2: "Manager" }),
    mv({ id: "Zer0", date: "2025-11-05", move: "join", from: "Team Falcons", k1: "inactive", k2: "player", hasPage: true }),
    mv({ id: "X", date: "2025-01-01", move: "role", k1: "player", k2: "player", r1: "Captain", r2: "" }),
  ],
};

describe("战队页 teamview.team", () => {
  test("大卡：队名、缩写方块、赛区标签（红底缩写 + 北美赛区）；进入 Apex 取最早的活动日期，不用比 Apex 还早的成立日期", () => {
    const v = tv.team(TL, "zh");
    assert.equal(v.name, "Team Liquid");
    assert.equal(v.initials, "TL");
    assert.deepEqual(v.badge, { code: "NA", label: "北美赛区" });
    assert.deepEqual(v.facts, [{ k: "进入 Apex", v: "2019 年" }, { k: "累计奖金", v: "$186,400" }]);
    const en = tv.team(TL, "en");
    assert.deepEqual(en.badge, { code: "NA", label: "North America" });
    assert.deepEqual(en.facts[0], { k: "In Apex since", v: "2019" });
  });

  test("进入 Apex：没有任何活动日期才用成立日期；成立日期早于 Apex 也不用", () => {
    assert.equal(tv.enteredYear({ created: "2021-06-01" }, [], [], []), "2021");
    assert.equal(tv.enteredYear({ created: "2013-04-12" }, [], [], []), "");
    assert.equal(tv.enteredYear({ created: "2019-01-01" }, [{ join: "2023-02-01" }], [], [{ date: "2022-12-30" }]), "2022");
  });

  test("解散的队：多一格「解散 / 2024 年」；没记解散日期写「已解散」；没有现役阵容这一块", () => {
    const raw = { page: "X", info: { name: "X", region: "Japan", status: "disbanded", disbanded: "2024-03-01", earnings: 0 },
      members: [mem({ id: "A", join: "2022-01-01", leave: "2024-03-01", status: "former" })] };
    const v = tv.team(raw, "zh");
    assert.deepEqual(v.facts, [{ k: "进入 Apex", v: "2022 年" }, { k: "解散", v: "2024 年" }], "奖金 0 不写");
    assert.deepEqual(v.badge, { code: "JP", label: "日本赛区" });
    assert.equal(v.roster.has, false);
    raw.info.disbanded = "";
    assert.deepEqual(tv.team(raw, "zh").facts[1], { k: "状态", v: "已解散" });
  });

  test("资料还没抓到：队名从页面名来，没有赛区标签；不认识的赛区只写名字", () => {
    const v = tv.team({ page: "Alpha_Gaming", members: [] }, "zh");
    assert.equal(v.name, "Alpha Gaming");
    assert.equal(v.badge, null);
    assert.deepEqual(v.facts, []);
    assert.deepEqual(tv.team({ page: "Y", info: { name: "Y", region: "Atlantis" } }, "zh").badge, { code: "", label: "Atlantis赛区" });
  });

  test("现役阵容：正式队员一张卡（国籍，队长写上）；教练一行（主教练，几年几月加入）；暂停比赛的队员也列一行；离开的不算", () => {
    const r = tv.team(TL, "zh").roster;
    assert.deepEqual(r.cards.map((c) => [c.name, c.meta, c.page]), [
      ["Zer0", "美国", "Zer0"], ["Sikezz", "英国 · 队长", ""], ["Panic", "美国", "Panic_(American_player)"]]);
    assert.deepEqual(r.rows.map((x) => [x.name, x.text]), [["Kapreme", "主教练，2025 年 1 月加入"], ["Fuhhnq", "暂停比赛，2025 年 11 月加入"]]);
    assert.equal(r.countText, "4 名选手和 1 名教练");
    assert.ok(r.cards.every((c) => c.photo === ""), "没有照片地址：都是空的（页面用剪影）");
    assert.deepEqual(r.cards.map((c) => c.long), [false, false, false]);
    const longName = tv.team({ page: "T", members: [mem({ id: "ImperialHal", join: "2024-05-28" })] }, "zh").roster.cards[0];
    assert.equal(longName.long, true, "10 个字符以上换小一号字");
    assert.equal(tv.team(TL, "en").roster.rows[0].text, "Head Coach · Joined January 2025");
  });

  test("比赛成绩：同选手页（S、A 级），队名就是这支队，副标题不重复写", () => {
    const res = tv.team(TL, "zh").results;
    assert.equal(res.major.length, 2);
    assert.equal(res.major[0].sub, "2026-08-24");
    assert.equal(res.major[0].win, true);
  });
});

describe("阵容变动", () => {
  test("加入 / 离队 / 队内换身份的说法；+ 是进了阵容，− 是离开；身份没变的不算", () => {
    const v = tv.team(TL, "zh");
    assert.deepEqual(v.moves.all.map((m) => [m.name, m.sign, m.text, m.date]), [
      ["Tiltedwinnie", "out", "卸任教练，转会 ROC Esports", "2026-04"],
      ["Fuhhnq", "out", "离队", "2026-04"],
      ["Kapreme", "in", "出任教练", "2026-03"],
      ["Panic", "in", "以自由选手身份加入", "2026-02"],
      ["Tiltedwinnie", "out", "暂停执教", "2026-02"],
      ["Fuhhnq", "out", "暂停比赛", "2026-02"],
      ["Pistillo", "out", "卸任教练，转为经理", "2025-11"],
      ["Zer0", "in", "加入，来自 Team Falcons", "2025-11"],
    ], "队长换成普通队员（都是正式队员）不算变动");
    assert.equal(v.moves.all[3].page, "Panic_(American_player)");
    assert.equal(v.moves.all[0].page, "", "没收录的人点不进去");
  });

  test("其余几种：替补、恢复比赛、转正、转任教练、恢复执教、转为主播", () => {
    const t = (o) => tv.moveOf(mv(Object.assign({ id: "A", date: "2025-01-01" }, o)), "zh", T);
    assert.deepEqual(t({ move: "join", k1: "player", k2: "sub", from: "NRG" }), { sign: "in", text: "以替补身份加入，来自 NRG" });
    assert.deepEqual(t({ move: "role", k1: "inactive", k2: "player" }), { sign: "in", text: "恢复比赛" });
    assert.deepEqual(t({ move: "role", k1: "sub", k2: "player" }), { sign: "in", text: "转为正式队员" });
    assert.deepEqual(t({ move: "role", k1: "player", k2: "sub" }), { sign: "out", text: "转为替补" });
    assert.deepEqual(t({ move: "role", k1: "player", k2: "coach" }), { sign: "in", text: "转任教练" });
    assert.deepEqual(t({ move: "role", k1: "coachInactive", k2: "coach" }), { sign: "in", text: "恢复执教" });
    assert.deepEqual(t({ move: "role", k1: "player", k2: "other", r2: "Streamer" }), { sign: "out", text: "转为主播" });
    assert.deepEqual(t({ move: "leave", k1: "player", k2: "player", to: "NRG" }), { sign: "out", text: "离队，转会 NRG" });
  });

  test("英文界面的说法", () => {
    const t = (o) => tv.moveOf(mv(Object.assign({ id: "A", date: "2025-01-01" }, o)), "en", TE).text;
    assert.equal(t({ move: "join", k1: "player", k2: "player", from: "Team Falcons" }), "Joined from Team Falcons");
    assert.equal(t({ move: "join", k1: "player", k2: "player" }), "Joined as a free agent");
    assert.equal(t({ move: "leave", k1: "player", k2: "player", to: "NRG" }), "Left for NRG");
    assert.equal(t({ move: "role", k1: "coach", k2: "other", r2: "Manager" }), "Left as coach, now Manager");
  });

  test("先 4 次（最近 4 次）+「查看全部 N 次」；展开以后写「共 N 次」；不到 4 次直接全列", () => {
    const v = tv.team(TL, "zh");
    const a = tv.visibleMoves(v.moves, false, T);
    assert.equal(a.rows.length, 4);
    assert.equal(a.sub, "最近 4 次");
    assert.equal(a.moreText, "查看全部 8 次");
    const b = tv.visibleMoves(v.moves, true, T);
    assert.equal(b.rows.length, 8);
    assert.equal(b.sub, "共 8 次");
    assert.equal(b.moreText, "");
    assert.equal(tv.visibleMoves({ all: v.moves.all.slice(0, 3) }, false, T).sub, "共 3 次");
  });
});

describe("选手照片", () => {
  test("选手卡带上云函数给的照片地址；没有就是空的（卡上用剪影）", () => {
    const raw = Object.assign({}, TL, { members: TL.members.map((m) => (m.id === "Zer0" ? Object.assign({}, m, { photo: "cloud://e.b/pro/photos/v1/p_Zer0_card.webp" }) : m)) });
    const cards = tv.team(raw, "zh").roster.cards;
    assert.deepEqual(cards.map((c) => c.photo), ["cloud://e.b/pro/photos/v1/p_Zer0_card.webp", "", ""]);
  });
});

describe("历任队员", () => {
  test("现在不在队的选手一人一行（教练不算）；几段在队时间相加；最近离开的在前", () => {
    const f = tv.team(TL, "zh").former;
    assert.equal(f.countText, "共 4 人");
    assert.deepEqual(f.all.map((x) => [x.name, x.range, x.dur, x.page]), [
      ["YanYa", "2024-05 – 2025-11", "11 个月", ""],
      ["Kurev", "2024-09 – 2025-05", "8 个月", "Kurev"],
      ["Cali", "2019-03 – 2021-07", "2 年 4 个月", ""],
      ["Mendo", "2019-08 – ?", "", ""],
    ], "YanYa 两段（148 + 200 天）相加；Mendo 没记离队日期：不写时长、排最后");
  });

  test("先 5 个 +「查看全部 N 人」", () => {
    const many = { page: "T", members: Array.from({ length: 7 }, (_, i) => mem({ id: "P" + i, join: "2020-01-01", leave: "2021-0" + (i + 1) + "-01", status: "former" })) };
    const f = tv.team(many, "zh").former;
    const a = tv.visibleFormer(f, false, T);
    assert.equal(a.rows.length, 5);
    assert.equal(a.moreText, "查看全部 7 人");
    assert.equal(a.rows[0].name, "P6", "最近离开的在前");
    assert.equal(tv.visibleFormer(f, true, T).rows.length, 7);
  });

  test("没有名单（还没抓到）：现役、历任两块都不出", () => {
    const v = tv.team({ page: "T", info: { name: "T" }, members: null }, "zh");
    assert.equal(v.roster.has, false);
    assert.equal(v.former.has, false);
    assert.equal(v.moves.has, false);
    assert.equal(v.results.has, false);
  });
});
