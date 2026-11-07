// Evo 战绩（2026-10-27 起）：云函数 evo_mp 的统计（cloudfunctions/evo_mp/stats.js）
// 和小程序里拼中英文的 evo/utils/view.js。两边都是纯函数，直接测。
//
// 统计的算法和 Evo 电脑窗口一样（Evo 仓库 code/panel_app.py），两边显示的数字必须对得上 ——
// 最容易错的是四舍五入：Python 是"按真实值、正好一半取偶数"，JS 的 Math.round 不是。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const MP = path.join(ROOT, "miniprogram");
const require = createRequire(import.meta.url);

const S = require(path.join(ROOT, "cloudfunctions", "evo_mp", "stats.js"));
const view = require(path.join(MP, "evo", "utils", "view.js"));
const i18n = require(path.join(MP, "utils", "i18n.js"));
const codex = require(path.join(MP, "data", "codex_data.js"));

const ZH = i18n.T("zh");
const EN = i18n.T("en");
const CJK = /[一-鿿　-〿＀-￯]/;

const match = (over = {}) => Object.assign({
  _id: "dev:1", match_id: 1, ended_at: "2026-10-26 21:03:15", player_key: "a", mode: "ranked", map: "残月", legend: "恶灵",
  placement: 5, kills: 2, assists: 1, knockdowns: 3, damage: 800, rp_delta: 30, rp_source: "经验值页",
  rank_tier: "钻石", rank_division: "II", rank_progress: 40, rank_score: 11040, needs_review: false,
}, over);

describe("evo · 统计（云函数 stats.js）", () => {
  test("四舍五入和 Python 一样：正好一半取偶数，按真实值算", () => {
    assert.equal(S.pyRound(12.5), 12);
    assert.equal(S.pyRound(13.5), 14);
    assert.equal(S.pyRound(8.35, 1), 8.3);   // 8.35 在计算机里是 8.3499…
    assert.equal(S.pyRound(8.25, 1), 8.2);   // 8.25 是精确值，取偶数
    assert.equal(S.pyRound(-2.5), -2);
    assert.equal(S.pyRound(1234.4), 1234);
  });

  test("场均：读不出来的局不算进去（不当作 0），计分次数的击杀不算场均击杀", () => {
    const n = S.groupNumbers([
      match({ placement: 1, kills: 4, damage: 1000 }),
      match({ placement: null, kills: null, damage: null }),
      match({ placement: 9, kills: 9, kills_counted: true, damage: 500 }),
    ]);
    assert.equal(n.games, 3);
    assert.equal(n.avg_place, 5);
    assert.equal(n.avg_kills, 4);
    assert.equal(n.avg_damage, 750);
    assert.equal(n.win_rate, 50);
    assert.equal(n.top5, 50);
  });

  test("一局都没有名次时，比率是 null（界面显示—），不是 0%", () => {
    const n = S.groupNumbers([match({ placement: null })]);
    assert.equal(n.win_rate, null);
    assert.equal(n.top5, null);
    assert.equal(n.avg_place, null);
  });

  test("RP 合计：没有 RP 的局跳过；一局都没有时是 null", () => {
    assert.equal(S.rpSum([match({ rp_delta: 30 }), match({ rp_delta: -12 }), match({ rp_delta: null })]), 18);
    assert.equal(S.rpSum([match({ rp_delta: null })]), null);
  });

  test("段位：大厅读数更新时以大厅为准；段位名换成代号", () => {
    const rows = [match()];
    const lobby = [{ read_at: "2026-10-26 21:10:00", rank_tier: "大师", rank_division: null, rank_progress: 120, score: 15120 }];
    assert.deepEqual(S.rankCard(rows, lobby),
      { tier: "master", division: null, progress: 120, score: 15120, when: "2026-10-26 21:10:00", from_lobby: true });
    const older = [{ read_at: "2026-10-26 20:00:00", rank_tier: "白金", rank_division: "I", rank_progress: 0, score: 9000 }];
    assert.equal(S.rankCard(rows, older).tier, "diamond");
    assert.equal(S.rankCard(rows, older).division, "II");
    assert.equal(S.rankCard([], []), null);
    assert.equal(S.rankCard([match({ rank_tier: "没见过的段位" })], []), null, "认不出的段位不显示，不猜");
  });

  test("RP 走势：少于 2 局不画；分界线名字换成代号；大厅分数更新时接在最后", () => {
    assert.equal(S.rpChart([match()], [], []), null);
    const rows = [match({ rank_score: 10900 }), match({ rank_score: 11040, ended_at: "2026-10-26 22:00:00" })];
    const bounds = [[10000, "钻石 IV"], [11000, "钻石 III"], [12000, "钻石 II"]];
    const c = S.rpChart(rows, [{ read_at: "2026-10-26 23:00:00", score: 11100 }], bounds);
    assert.equal(c.count, 2);
    assert.equal(c.points.length, 3, "大厅读数接在最后");
    assert.ok(c.lines.some((l) => l.tier === "diamond" && l.division === "III"));
    assert.ok(c.points.every((p) => p >= 0 && p <= 1));
  });

  test("传奇表现：最多 3 个，其余合成「其他」（name 为 null）", () => {
    const rows = ["恶灵", "恶灵", "恶灵", "命脉", "命脉", "幻象", "侵蚀"].map((legend) => match({ legend }));
    const bars = S.legendBars(rows);
    assert.equal(bars.length, 4);
    assert.deepEqual(bars.map((b) => b.name), ["恶灵", "命脉", "幻象", null]);
    assert.equal(bars[3].other, true);
    assert.equal(bars[0].segments.reduce((a, s) => a + s.width, 0), 100);
    assert.equal(S.legendBars([match({ legend: null })]), null);
  });

  test("账号：只有 1 个时不分；2 个以上默认最近玩过的；all = 全部", () => {
    const acc = S.mergeAccounts([{ accounts: [{ name: "A", keys: ["a"] }, { name: "B", keys: ["b"] }], bounds: [[0, "菜鸟 IV"]] }]);
    assert.equal(acc.accounts.length, 2);
    assert.deepEqual(acc.bounds, [[0, "菜鸟 IV"]]);
    const rows = [match({ player_key: "a", ended_at: "2026-10-01 10:00:00" }), match({ player_key: "b", ended_at: "2026-10-02 10:00:00" })];
    assert.equal(S.accountView(acc.accounts, rows, null).current, "1");
    assert.equal(S.accountView(acc.accounts, rows, "0").current, "0");
    assert.equal(S.accountView(acc.accounts, rows, "all").filter, null);
    assert.deepEqual(S.accountView(acc.accounts.slice(0, 1), rows, null).accounts, []);
  });

  test("两台电脑上用过同一个名字的账号合成一个", () => {
    const acc = S.mergeAccounts([
      { accounts: [{ name: "A", keys: ["a", "a2"] }] },
      { accounts: [{ name: "A 新名字", keys: ["a2", "a3"] }] },
    ]);
    assert.equal(acc.accounts.length, 1);
    assert.equal(acc.accounts[0].keys.size, 3);
  });

  test("「今天」从早上 5 点算起，按电脑的时区", () => {
    const at = (iso) => S.localNow(480, Date.parse(iso));
    assert.equal(S.dayStartText(at("2026-10-26T12:00:00Z")), "2026-10-26 05:00:00");   // 北京 20:00
    assert.equal(S.dayStartText(at("2026-10-26T19:00:00Z")), "2026-10-26 05:00:00");   // 北京 03:00 → 还算前一天
    assert.equal(at("2026-10-26T19:00:00Z").date, "2026-10-27");
  });

  test("单局详情：RP 来源换成代号；不是待确认的局不带原因", () => {
    const d = S.detailData(match({ review_note: "x" }));
    assert.equal(d.rp_source, "xp");
    assert.equal(d.review_note, null);
    assert.equal(d.rank_tier, "diamond");
    assert.equal(S.detailData(match({ rp_delta: null })).rp_source, null, "没有 RP 就没有来源");
  });
});

describe("evo · 界面字段（evo/utils/view.js）", () => {
  test("填空、单复数、正负号（真正的减号）、读不出来是—", () => {
    assert.equal(view.fill("有 {n} 局", { n: 3 }), "有 3 局");
    assert.equal(view.count(EN.evoReviewN, 1), "1 match needs review");
    assert.equal(view.count(EN.evoReviewN, 3), "3 matches need review");
    assert.equal(view.count(ZH.evoReviewN, 1), "有 1 局识别结果不确定");
    assert.equal(view.signed(1234), "+1,234");
    assert.equal(view.signed(-5), "−5");
    assert.equal(view.signed(null), "—");
  });

  test("每个 Evo 认得的传奇都对得上图鉴（头像、英文名从图鉴取）", () => {
    const ids = new Set(codex.heroes.map((h) => h.id));
    const missing = Object.entries(view.LEGEND_IDS).filter(([, id]) => !ids.has(id));
    assert.deepEqual(missing, [], "图鉴里没有这些 id");
    for (const hero of codex.heroes) {
      assert.ok(existsSync(path.join(MP, hero.icon)), "头像文件不存在：" + hero.icon);
    }
  });

  test("传奇名：中文用游戏里的叫法，英文用图鉴；图鉴里没有的保留原文、没有头像", () => {
    assert.deepEqual(view.legend("恶灵", ZH), { name: "恶灵", icon: "/assets/heroes/wraith.png" });
    assert.equal(view.legend("兰伯特", ZH).name, "兰伯特", "游戏里叫兰伯特（图鉴写的是兰帕特）");
    assert.equal(view.legend("兰伯特", EN).name, "Rampart");
    assert.deepEqual(view.legend("新传奇", EN), { name: "新传奇", icon: "" });
  });

  test("地图名：英文模式反查 MAP_CN；残月改名前的「破碎月亮」也认得", () => {
    assert.equal(view.mapName("残月", EN), "Broken Moon");
    assert.equal(view.mapName("破碎月亮", EN), "Broken Moon");
    assert.equal(view.mapName("世界尽头", EN), "World's Edge");
    assert.equal(view.mapName("残月", ZH), "残月");
    assert.equal(view.mapName("没见过", EN), "没见过", "查不到保留原文，不编");
  });

  test("段位名两种语言", () => {
    assert.equal(view.tierName("diamond", "II", ZH), "钻石 II");
    assert.equal(view.tierName("predator", null, EN), "Apex Predator");
    assert.equal(view.tierName("nope", null, EN), "");
  });

  test("时间：今天 / 昨天 / 更早的写日期", () => {
    const ctx = { T: ZH, today: "2026-10-26", yesterday: "2026-10-25" };
    assert.equal(view.timeText("2026-10-26 21:03:15", ctx), "今天 21:03");
    assert.equal(view.timeText("2026-10-25 08:00:00", ctx), "昨天 08:00");
    assert.equal(view.timeText("2026-10-01 08:00:00", ctx), "10-01 08:00");
    assert.equal(view.timeText("2026-10-26 21:03:15", Object.assign({}, ctx, { T: EN })), "Today 21:03");
  });

  const overviewData = (over = {}) => Object.assign({
    bound: true, accounts: [], account: null, range: "30", today: "2026-10-26", yesterday: "2026-10-25", total: 1,
    rank: { tier: "diamond", division: "II", progress: 40, when: "2026-10-26 21:03:15", from_lobby: false },
    chart: null, range_rp: 30, today_rp: -5, today_games: 1,
    stats: { games: 1, avg_place: 5, avg_kills: 2, avg_damage: 800, top5: 100, win_rate: 0 },
    recent: [S.rowData(match())], legends: S.legendBars([match()]), review_count: 0,
  }, over);

  test("我的战绩：没绑定 / 绑定了没对局 / 有数据", () => {
    assert.equal(view.overview(overviewData({ bound: false }), ZH, 160).state, "unbound");
    assert.equal(view.overview(overviewData({ total: 0 }), ZH, 160).state, "empty");
    const v = view.overview(overviewData(), ZH, 160);
    assert.equal(v.state, "ready");
    assert.equal(v.rank.name, "钻石 II");
    assert.equal(v.rank.hasEmblem, true);
    assert.equal(v.rangeRp, "+30");
    assert.equal(v.todayRp, "−5");
    assert.equal(v.todayRpCls, "bad");
    assert.equal(v.recent[0].title, "恶灵 · 残月");
    assert.equal(v.recent[0].place, "#5");
    assert.equal(v.stats.find((s) => s.key === "place").value, "5.0");
  });

  test("全部账号时不显示段位和走势（段位按账号分开）", () => {
    const v = view.overview(overviewData({ accounts: [{ key: "0", name: "A" }, { key: "1", name: "B" }], account: "all" }), ZH, 160);
    assert.equal(v.all, true);
    assert.equal(v.rank, null);
    assert.equal(v.picker.index, 2);
    assert.equal(v.picker.names[2], "全部账号");
  });

  test("每个有徽章的段位，徽章图片都在分包里", () => {
    for (const tier of ["bronze", "silver", "gold", "platinum", "diamond", "master", "predator"]) {
      const v = view.overview(overviewData({ rank: { tier, division: "I", progress: 1, when: null, from_lobby: false } }), ZH, 160);
      assert.ok(existsSync(path.join(MP, v.rank.emblem)), "缺徽章：" + v.rank.emblem);
    }
    const rookie = view.overview(overviewData({ rank: { tier: "rookie", division: "IV", progress: 1, when: null, from_lobby: false } }), ZH, 160);
    assert.equal(rookie.rank.hasEmblem, false, "菜鸟没有徽章图，用字母方块");
    assert.equal(rookie.rank.letter, "R4");
  });

  test("小程序里没有 webp 图片（iPhone 上的微信显示不了包里的 webp，模拟器里却正常，2026-10-28 真机试过）", () => {
    const list = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? list(path.join(dir, d.name)) : [path.join(dir, d.name)]);
    const files = list(MP);
    const webp = files.filter((f) => /\.webp$/i.test(f)).map((f) => path.relative(MP, f));
    assert.deepEqual(webp, [], "换成 png（徽章用的是 256 色 png）");
    const code = files.filter((f) => /\.(js|wxml|wxss|json)$/.test(f) && !f.includes("node_modules"))
      .filter((f) => /\.webp\b/i.test(readFileSync(f, "utf8"))).map((f) => path.relative(MP, f));
    assert.deepEqual(code, [], "代码里还写着 .webp");
  });

  test("英文模式：拼出来的显示文字里没有中文（认得的传奇、地图、段位）", () => {
    const v = view.overview(overviewData({ review_count: 2,
      chart: { points: [0.2, 0.5], lines: [{ y: 0.3, tier: "diamond", division: "III" }], count: 2 } }), EN, 160);
    const texts = [];
    (function walk(o) {
      if (typeof o === "string") texts.push(o);
      else if (o && typeof o === "object") Object.keys(o).forEach((k) => { if (!["icon", "emblem", "key", "id"].includes(k)) walk(o[k]); });
    })(v);
    const bad = texts.filter((s) => CJK.test(s));
    assert.deepEqual(bad, [], "英文模式混了中文：" + bad.join(" | "));
  });

  test("单局详情：待确认的原因是中文，英文模式下不显示；RP 来源跟着语言", () => {
    const d = { today: "2026-10-26", yesterday: "2026-10-25",
      match: S.detailData(match({ needs_review: true, review_note: "名次两处对不上", no_summary: true,
        mates: [{ name: "x", legend: "命脉", kills: 1 }] })) };
    const zh = view.detail(d, ZH);
    assert.equal(zh.reviewNote, "名次两处对不上");
    assert.equal(zh.rpFrom, "来自经验值页");
    assert.equal(zh.noSummary, true);
    assert.equal(zh.mates[0].legend, "命脉");
    const en = view.detail(d, EN);
    assert.equal(en.reviewNote, "");
    assert.equal(en.rpFrom, "from XP screen");
    assert.equal(en.mates[0].legend, "Lifeline");
    assert.ok(en.facts.some((f) => f.key === "rank" && f.value === "Diamond II 40"));
  });

  test("错误代号 → 两种语言的一句话；认不出的代号给通用的话", () => {
    assert.equal(view.errText("expired", ZH), ZH.evoErrExpired);
    assert.equal(view.errText("network", EN), EN.evoErrNetwork);
    assert.equal(view.errText("whatever", EN), EN.evoErrServer);
  });

  test("绑定码：小程序码的 scene、Evo 二维码的网址、裸码都认得", () => {
    assert.equal(view.bindCodeFrom("evo/bind/bind?scene=ABCDEFGH23"), "ABCDEFGH23");
    assert.equal(view.bindCodeFrom("https%3A%2F%2Fevotracker.cn%2Fbind%3Fc%3Dabcdefgh23"), "ABCDEFGH23");
    assert.equal(view.bindCodeFrom("ABCDEFGH23"), "ABCDEFGH23");
    assert.equal(view.bindCodeFrom("随便什么"), "");
    assert.equal(view.bindCodeFrom("%E0%A4%A"), "", "坏的转义不抛错");
  });

  test("我的：电脑编号、同步时间、改过名的账号", () => {
    const v = view.devicesView({ devices: [{ id: "u1", bound_at: "2026-10-26 20:00", last_upload_at: null, app_version: "0.4.1", matches: 12 }],
      accounts: [{ name: "A", names: 2 }, { name: "B", names: 1 }] }, ZH);
    assert.equal(v.devices[0].name, "电脑 1");
    assert.equal(v.devices[0].sync, "还没有同步过");
    assert.equal(v.devices[0].count, "云端 12 局 · Evo 0.4.1");
    assert.equal(v.accounts[0].names, "用过 2 个名字");
    assert.equal(v.accounts[1].names, "");
  });
});

/* ============================================================
   首页（2026-10-27）：云函数 home / crowd 的统计，和 view.js 的 homeView / crowdView
   ============================================================ */
describe("evo · 首页（段位条、今日、大家在玩什么）", () => {
  const bounds = [[10000, "钻石 IV"], [11000, "钻石 III"], [12000, "钻石 II"], [13000, "钻石 I"], [14000, "大师"]];

  test("段位条：离下一段还差多少、这一段走了百分之几；最高一段或读不出来时不画", () => {
    assert.deepEqual(S.rankStep(12868, bounds), { next_tier: "diamond", next_division: "I", gap: 132, pct: 86.8 });
    assert.equal(S.rankStep(14500, bounds), null, "大师往上没有下一段");
    assert.equal(S.rankStep(9000, bounds), null, "比最低一段还低：不知道这一段从哪算起");
    assert.equal(S.rankStep(null, bounds), null);
    assert.equal(S.rankStep(12000, []), null);
    assert.equal(S.rankStep(12000, bounds).pct, 0, "刚好在分界线上 = 这一段刚开始");
  });

  test("段位卡带上总分（段位条要用）", () => {
    assert.equal(S.rankCard([match({ rank_score: 12868 })], []).score, 12868);
    assert.equal(S.rankCard([match({ rank_score: 12868 })], [{ read_at: "2026-10-26 23:00:00", rank_tier: "钻石", rank_division: "II", rank_progress: 900, score: 12900 }]).score, 12900);
  });

  test("今日：击杀、伤害的总数要每局都读到才算（不把没读到的当作 0）", () => {
    const d = S.dayNumbers([match({ placement: 2, kills: 4, damage: 1820, rp_delta: 45 }), match({ placement: 8, kills: 5, damage: 2300, rp_delta: 42 })]);
    assert.deepEqual(d, { games: 2, avg_place: 5, kills: 9, damage: 4120, rp: 87 });
    const missing = S.dayNumbers([match({ kills: 4 }), match({ kills: null, damage: null })]);
    assert.equal(missing.kills, null);
    assert.equal(missing.damage, null);
    assert.equal(S.dayNumbers([match({ kills: 4 }), match({ kills: 9, kills_counted: true })]).kills, null, "计分次数不是击杀");
    assert.deepEqual(S.dayNumbers([]), { games: 0, avg_place: null, kills: null, damage: null, rp: null });
  });

  test("几天前的那一刻写成电脑上的时间文字（和 ended_at 比大小）", () => {
    const now = Date.UTC(2026, 9, 27, 12, 0, 0);   // 北京时间 20:00
    assert.equal(S.daysAgoText(7, 480, now), "2026-10-20 20:00:00");
  });

  const crowdRow = (uid, legend, mates, placement) => ({ uid, legend, mates: mates.map((l) => ({ legend: l })), placement });

  test("大家在玩什么：玩家不够时只回人数；够了回热门传奇和最好的组合", () => {
    const few = [crowdRow("a", "动力小子", [], 3), crowdRow("b", "恶灵", [], 5)];
    assert.deepEqual(S.crowdStats(few, { minPlayers: 5 }), { players: 2, enough: false });

    const rows = [];
    ["a", "b", "c", "d", "e"].forEach((uid) => {
      rows.push(crowdRow(uid, "动力小子", ["地平线", "疯玛吉"], 4));
      rows.push(crowdRow(uid, "恶灵", ["命脉", "直布罗陀"], 9));
    });
    rows.push(crowdRow("a", "地平线", ["动力小子", "疯玛吉"], 1));   // 同一组合换了人当"自己"，还是同一个组合
    rows.push(crowdRow("a", null, [], 2));                            // 传奇没读到：不算进选用率
    const c = S.crowdStats(rows, { minPlayers: 5 });
    assert.equal(c.players, 5);
    assert.equal(c.enough, true);
    assert.equal(c.games, 12);
    assert.deepEqual(c.legends.map((l) => l.name), ["动力小子", "恶灵", "地平线"]);
    assert.deepEqual(c.legends.map((l) => l.pct), [45, 45, 9]);   // 5/11、5/11、1/11
    assert.deepEqual(c.combo.legends.slice().sort(), ["地平线", "动力小子", "疯玛吉"].sort());
    assert.equal(c.combo.games, 6);
    assert.equal(c.combo.avg_place, 3.5);
  });

  test("组合：传奇没读全、名次没读到、局数不够的不算；没有够格的组合时是 null", () => {
    const rows = ["a", "b", "c", "d", "e"].map((uid) => crowdRow(uid, "恶灵", ["命脉"], 1));   // 只有一个队友
    rows.push(crowdRow("a", "恶灵", ["命脉", "直布罗陀"], null));
    rows.push(crowdRow("b", "恶灵", ["命脉", "直布罗陀"], 2));
    rows.push(crowdRow("c", "恶灵", ["命脉", "直布罗陀"], 3));
    assert.equal(S.crowdStats(rows, { minPlayers: 5 }).combo, null, "只有 2 局读全了，不到 3 局");
  });

  const homeData = (over = {}) => Object.assign({
    ok: true, bound: true, account: null, total: 40, synced_at: 1_000_000_000_000 - 5 * 60000,
    rank: { tier: "diamond", division: "II", progress: 868, score: 12868, when: "2026-10-26 23:00:00", from_lobby: true },
    step: { next_tier: "diamond", next_division: "I", gap: 132, pct: 86.8 },
    day: { games: 6, avg_place: 5.2, kills: 9, damage: 4120, rp: 87 },
    last: { id: "dev:9", placement: 2, rp: 45, legend: "动力小子", kills: 4, damage: 1820, map: "奥林匹斯" },
  }, over);
  const NOW = 1_000_000_000_000;

  test("首页顶上：没绑定 / 绑定了没对局 / 有数据", () => {
    assert.equal(view.homeView({ ok: true, bound: false }, ZH, 112, NOW).state, "unbound");
    assert.equal(view.homeView(homeData({ total: 0 }), ZH, 112, NOW).state, "empty");
    const v = view.homeView(homeData(), ZH, 112, NOW);
    assert.equal(v.state, "ready");
    assert.equal(v.synced, "Evo 同步于 5 分钟前");
    assert.equal(v.rank.name, "钻石 II");
    assert.equal(v.rank.progress, "868");
    assert.deepEqual(v.step.gap, { pre: "升钻石 I 还差 ", n: "132", post: "" });
    assert.equal(v.todayRp, "+87");
    assert.equal(v.games, "6");
    assert.equal(v.avgPlace, "#5.2");
    assert.equal(v.damage, "4,120");
    assert.equal(v.last.place, "#2");
    assert.equal(v.last.rp, "+45 RP");
    assert.equal(v.last.legend, "动力小子");
    assert.equal(v.last.line, "4 杀 · 1,820 伤害 · 奥林匹斯");
    assert.equal(v.last.shareTitle, "我刚在奥林匹斯拿了第 2 名");
  });

  test("首页顶上：读不出来的是—；名次没读到时不给分享（不编名次）", () => {
    const v = view.homeView(homeData({ day: { games: 1, avg_place: null, kills: null, damage: null, rp: null }, step: null,
      last: { id: "dev:9", placement: null, rp: null, legend: null, kills: null, damage: null, map: null } }), ZH, 112, NOW);
    assert.equal(v.avgPlace, "—");
    assert.equal(v.kills, "—");
    assert.equal(v.todayRp, "—");
    assert.equal(v.step, null);
    assert.equal(v.last.place, "—");
    assert.equal(v.last.rp, "");
    assert.equal(v.last.line, "");
    assert.equal(v.last.shareTitle, "");
  });

  test("首页顶上英文：语序跟着语言（数字在前），没有中文", () => {
    const v = view.homeView(homeData(), EN, 112, NOW);
    assert.equal(v.synced, "Evo synced 5m ago");
    assert.deepEqual(v.step.gap, { pre: "", n: "132", post: " to Diamond I" });
    assert.equal(v.last.line, "4 kills · 1,820 dmg · Olympus");
    assert.equal(v.last.shareTitle, "I just placed #2 on Olympus");
    const text = JSON.stringify([v.synced, v.rank.name, v.step, v.last.legend, v.last.line, v.last.shareTitle]);
    assert.ok(!CJK.test(text), text);
  });

  test("大家在玩什么：人数不够、没有数据时整块不显示；条的长短按最热门的算", () => {
    assert.equal(view.crowdView({ ok: true, players: 2, enough: false, days: 7 }, ZH), null);
    assert.equal(view.crowdView(null, ZH), null);
    const v = view.crowdView({ ok: true, days: 7, players: 12, enough: true, games: 80,
      legends: [{ name: "动力小子", pct: 18 }, { name: "地平线", pct: 14 }, { name: "没见过的传奇", pct: 9 }],
      combo: { legends: ["动力小子", "地平线", "疯玛吉"], avg_place: 6.1, games: 23 } }, ZH);
    assert.equal(v.source, "来自 12 位 Evo 玩家 · 近 7 天");
    assert.deepEqual(v.legends.map((l) => l.pct), ["18%", "14%", "9%"]);
    assert.deepEqual(v.legends.map((l) => l.width), [100, 77.78, 50]);
    assert.equal(v.legends[2].icon, "", "图鉴里没有的传奇没有头像，显示名字的第一个字");
    assert.equal(v.legends[2].letter, "没");
    assert.equal(v.combo.names, "动力小子 · 地平线 · 疯玛吉");
    assert.equal(v.combo.avg, "#6.1");
    assert.equal(v.combo.games, "23");
    const en = view.crowdView({ ok: true, days: 7, players: 12, enough: true, legends: [{ name: "动力小子", pct: 18 }], combo: null }, EN);
    assert.equal(en.source, "12 Evo players · last 7 days");
    assert.equal(view.crowdView({ ok: true, days: 7, players: 1, enough: true, legends: [{ name: "动力小子", pct: 18 }], combo: null }, EN).source,
      "1 Evo player · last 7 days", "单数不加 s");
    assert.equal(en.legends[0].name, "Octane");
    assert.equal(en.combo, null);
  });
});
