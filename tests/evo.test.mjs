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
  test("「我的」页：本赛季最高段位只看赛季开始以后的局和大厅读数；大师没有小段；冠军次数数第 1 名", () => {
    const since = S.seasonStartText(480, Date.parse("2026-11-08T00:00:00Z"));
    assert.equal(since, "2026-11-04 02:00:00", "第 31 赛季 11-03 18:00 UTC = 北京时间 11-04 02:00");
    assert.equal(S.seasonStartText(60, Date.parse("2026-11-08T00:00:00Z")), "2026-11-03 19:00:00", "瑞士（UTC+1）是 19:00");
    assert.equal(S.seasonStartText(480, Date.parse("2026-01-01T00:00:00Z")), null, "比收录的赛季都早：算不出");
    const rows = [
      { ended_at: "2026-11-03 23:00:00", rank_tier: "大师", rank_division: null, placement: 1 },   // 上个赛季的
      { ended_at: "2026-11-05 20:00:00", rank_tier: "钻石", rank_division: "III", placement: 3 },
      { ended_at: "2026-11-06 20:00:00", rank_tier: "钻石", rank_division: "II", placement: 1 },
      { ended_at: "2026-11-07 20:00:00", rank_tier: "钻石", rank_division: "IV", placement: 1 },
    ];
    const lobby = [{ read_at: "2026-11-06 21:00:00", rank_tier: "白金", rank_division: "I" }];
    assert.deepEqual(S.seasonPeak(rows, lobby, since), { tier: "diamond", division: "II" }, "上个赛季的大师不算");
    assert.deepEqual(S.seasonPeak([{ ended_at: "2026-11-05 20:00:00", rank_tier: "大师", rank_division: "I" }], [], since),
      { tier: "master", division: null });
    assert.equal(S.seasonPeak([], [{ read_at: "2026-11-05 20:00:00", rank_tier: "认不出", rank_division: "I" }], since), null);
    assert.equal(S.seasonPeak(rows, lobby, null), null);
    assert.equal(S.winCount(rows), 3);
  });

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

  test("我的（2026-11-08 改版）：游戏 ID 当名字、三格统计、电脑卡的同步时间和状态标签、改过名的账号", () => {
    const NOW_MS = Date.parse("2026-11-08T12:00:00Z");
    const d = {
      devices: [{ id: "u1", bound_at: "2026-10-26 20:00", last_upload_at: "2026-11-08 19:55", last_upload_ms: NOW_MS - 5 * 60000, app_version: "0.5.4", matches: 120 }],
      accounts: [{ name: "ImperialHzd", names: 2 }, { name: "Alt", names: 1 }],
      profile: { account: "ImperialHzd", matches: 95, wins: 7, peak: { tier: "diamond", division: "II" } },
    };
    const v = view.meView(d, ZH, NOW_MS);
    assert.equal(v.state, "ready");
    assert.equal(v.name, "ImperialHzd");
    assert.equal(v.initial, "I");
    assert.equal(v.sub, "已绑定 Evo · 2 个游戏账号");
    assert.deepEqual(v.stats.map((s) => [s.k, s.v]), [["记录局数", "95"], ["赛季最高", "钻石 II"], ["冠军次数", "7"]]);
    assert.equal(v.devices[0].title, "电脑上的 Evo");
    assert.equal(v.devices[0].sub, "5 分钟前同步 · Evo 0.5.4");
    assert.deepEqual([v.devices[0].chip, v.devices[0].chipCls], ["正常", "ok"]);
    assert.equal(v.devices[0].name, "电脑 1", "解绑弹窗里的叫法");
    assert.equal(v.accounts[0].names, "用过 2 个名字");
    assert.equal(v.accounts[1].names, "");
    const en = view.meView(d, i18n.T("en"), NOW_MS);
    assert.equal(en.devices[0].sub, "Synced 5m ago · Evo 0.5.4");
    assert.equal(en.sub, "Evo linked · 2 game accounts");
  });

  test("我的：赛季没数据、云函数还没更新时不编数；两台电脑分开叫；没绑定时讲怎么绑", () => {
    const NOW_MS = Date.parse("2026-11-08T12:00:00Z");
    const two = [
      { id: "u1", bound_at: "x", last_upload_at: null, app_version: null, matches: 0 },
      { id: "u2", bound_at: "x", last_upload_at: "2026-11-01 10:00", app_version: "0.5.0", matches: 30 },
    ];
    const noPeak = view.meView({ devices: two, accounts: [], profile: { account: null, matches: 30, wins: 0, peak: null } }, ZH, NOW_MS);
    assert.deepEqual(noPeak.stats.map((s) => s.k), ["记录局数", "冠军次数"], "这个赛季还没有段位：那格不出，不写 0");
    assert.equal(noPeak.name, "还没有对局");
    assert.equal(noPeak.initial, "");
    assert.equal(noPeak.sub, "已绑定 Evo");
    assert.deepEqual(noPeak.devices.map((x) => x.title), ["电脑 1 上的 Evo", "电脑 2 上的 Evo"]);
    assert.deepEqual(noPeak.devices.map((x) => x.chip), ["还没同步", "正常"]);
    assert.equal(noPeak.devices[0].sub, "还没有同步过");
    assert.equal(noPeak.devices[1].sub, "上次同步 2026-11-01 10:00 · Evo 0.5.0", "云函数旧版没有 last_upload_ms：照旧写时间");
    const old = view.meView({ devices: two, accounts: [{ name: "A", names: 1 }] }, ZH, NOW_MS);
    assert.deepEqual(old.stats.map((s) => [s.k, s.v]), [["记录局数", "30"]], "云函数还没更新（没有 profile）：局数用各台电脑的合计，另外两格不出");
    assert.equal(old.name, "A");
    const unbound = view.meView({ devices: [], accounts: [] }, ZH, NOW_MS);
    assert.deepEqual([unbound.state, unbound.name, unbound.stats.length], ["unbound", "未绑定 Evo", 0]);
  });

  test("首页分享标题：「我的」页选了显示游戏名才带名字；没有名字照旧写「我」", () => {
    const NOW_MS = Date.parse("2026-11-08T12:00:00Z");
    const d = { bound: true, total: 1, name: "ImperialHzd", synced_at: NOW_MS, day: {},
      last: { id: "m1", placement: 1, legend: "恶灵", map: null, kills: 3, damage: 900 } };
    assert.equal(view.homeView(d, ZH, 112, NOW_MS).last.shareTitle, "我刚拿了第 1 名");
    assert.equal(view.homeView(d, ZH, 112, NOW_MS, { shareName: true }).last.shareTitle, "ImperialHzd 刚拿了第 1 名");
    assert.equal(view.homeView(Object.assign({}, d, { name: null }), ZH, 112, NOW_MS, { shareName: true }).last.shareTitle, "我刚拿了第 1 名");
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

/* ============================================================
   解绑（2026-11-11）：解绑就删掉这台电脑传到云端的数据，确认一次。
   原来先选"只解绑、云端留着"还是"解绑并删除"：留着的数据手机上看不到、也删不掉，玩家以为全没了；
   删除那一项的确认按钮「解绑并删除」超过微信限的字数，弹框出不来、也不报错（点了没反应）
   ============================================================ */

// 微信基础库的检查（开发者工具 WAService.js 里的原样）：中文算 2、英文算 1，超过 8 就 fail，弹框不出来
const modalButtonOk = (s) => String(s).replace(/[^\x00-\xff]/g, "##").length <= 8;

describe("evo · 解绑", () => {
  test("原生弹框的确认、取消按钮：中英文都不超过微信的字数（超了弹框出不来，也不报错）", () => {
    assert.equal(modalButtonOk("解绑并删除"), false, "原来的按钮就是超了");
    assert.equal(modalButtonOk("解绑"), true);
    const list = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? list(path.join(dir, d.name)) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : []);
    let seen = 0;
    for (const file of list(MP)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/(?:confirmText|cancelText)\s*:\s*(?:T\.(\w+)|"([^"]*)")/g)) {
        seen++;
        const values = m[1] ? [ZH[m[1]], EN[m[1]]] : [m[2]];
        for (const v of values) {
          assert.ok(typeof v === "string" && v.length, path.relative(MP, file) + " 的 " + m[0] + " 没有词条");
          assert.ok(modalButtonOk(v), path.relative(MP, file) + "：按钮文字「" + v + "」太长（中文最多 4 个字，英文 8 个字母）");
        }
      }
    }
    assert.ok(seen >= 2, "至少有解绑和隐私说明两处");
  });

  /** 用桩把「我的」页的 devices 组件加载起来；showModal 照微信的规矩：按钮字数超了就 fail */
  function loadDevices(T, responses = {}) {
    let def = null;
    global.Component = (d) => { def = d; };
    const calls = { modal: [], toast: [], cloud: [] };
    global.wx = {
      cloud: {
        callFunction(o) {
          calls.cloud.push(o.data);
          const r = responses[o.data.action] || { ok: true, devices: [], accounts: [], profile: null };
          return Promise.resolve({ result: r });
        },
      },
      showModal(o) {
        if (!modalButtonOk(o.confirmText || "") || !modalButtonOk(o.cancelText || "")) {
          if (o.fail) o.fail({ errMsg: "showModal:fail confirmText length should not larger than 4 Chinese characters" });
          return;
        }
        calls.modal.push(o);
      },
      showLoading() {},
      hideLoading() {},
      showToast(o) { calls.toast.push(o); },
    };
    const p = path.join(MP, "evo", "components", "devices", "index.js");
    delete require.cache[require.resolve(p)];
    require(p);
    const inst = Object.assign({}, def.methods);
    inst.data = Object.assign(JSON.parse(JSON.stringify(def.data)), { T });
    inst.setData = (patch) => Object.assign(inst.data, patch);
    inst.data.v = { devices: [{ id: "pc-1", name: T === EN ? "PC 1" : "电脑 1", matches: 12 }, { id: "pc-2", name: "电脑 2", matches: 0 }] };
    return { inst, calls };
  }
  const tap = (index) => ({ currentTarget: { dataset: { index } } });
  const tick = () => new Promise((r) => setTimeout(r, 5));

  test("点「解除绑定」：只弹一个确认框，写明云端的局会一起删；确认以后让云函数删", async () => {
    const { inst, calls } = loadDevices(ZH, { unbind: { ok: true, deleted: true } });
    inst.onUnbind(tap(0));
    assert.equal(calls.modal.length, 1, "确认框弹出来了");
    const m = calls.modal[0];
    assert.equal(m.title, "解绑电脑 1？");
    assert.match(m.content, /12 局会一起删掉/);
    assert.match(m.content, /电脑上的战绩不受影响/);
    assert.equal(m.confirmText, "解绑");
    m.success({ confirm: true });
    await tick();
    assert.deepEqual(calls.cloud[0], { action: "unbind", device: "pc-1", delete_data: true });
    assert.equal(calls.toast[0].title, "已解绑");
    assert.equal(calls.cloud[1].action, "me", "解绑以后重新读「我的」");
  });

  test("点了取消：不解绑", async () => {
    const { inst, calls } = loadDevices(ZH);
    inst.onUnbind(tap(0));
    calls.modal[0].success({ confirm: false, cancel: true });
    await tick();
    assert.equal(calls.cloud.length, 0);
  });

  test("云端还没有对局：不写「0 局」", () => {
    const { inst, calls } = loadDevices(ZH);
    inst.onUnbind(tap(1));
    assert.equal(calls.modal[0].content, ZH.evoUnbindBodyNone);
    assert.doesNotMatch(calls.modal[0].content, /0 局/);
  });

  test("英文：分单复数，没有中文", () => {
    const { inst, calls } = loadDevices(EN);
    inst.onUnbind(tap(0));
    const m = calls.modal[0];
    assert.equal(m.title, "Unlink PC 1?");
    assert.match(m.content, /the 12 matches already in the cloud will be deleted/);
    assert.equal(m.confirmText, "Unlink");
    assert.ok(!CJK.test(m.title + m.content + m.confirmText));
    inst.data.v.devices[0].matches = 1;
    inst.onUnbind(tap(0));
    assert.match(calls.modal[1].content, /the 1 match already/);
  });

  test("确认框弹不出来时也要提示，不能点了没反应", () => {
    const { inst, calls } = loadDevices(ZH);
    global.wx.showModal = (o) => o.fail({ errMsg: "showModal:fail" });
    inst.onUnbind(tap(0));
    assert.equal(calls.toast[0].title, "没解绑成功");
  });

  /** 用一个内存里的假数据库加载云函数（不连真的云端） */
  // hooks.failRemove：这个集合的 where().remove() 报错（模拟删到一半出错）
  function loadCloudFunction(name, store, wxContext, hooks = {}) {
    const Module = require("module");
    const pred = (f) => ({ __pred: f });
    const match = (v, c) => (c && c.__pred ? c.__pred(v) : v === c);
    const where = (rows, cond) => rows.filter((r) => Object.keys(cond).every((k) => match(r[k], cond[k])));
    const collection = (cname) => {
      const rows = () => store[cname] || (store[cname] = []);
      const query = (cond, skip = 0, lim = Infinity) => ({
        skip: (n) => query(cond, n, lim),
        limit: (n) => query(cond, skip, n),
        get: async () => ({ data: where(rows(), cond).slice(skip, skip + lim).map((r) => ({ ...r })) }),
        count: async () => ({ total: where(rows(), cond).length }),
        remove: async () => {
          if (hooks.failRemove === cname) throw new Error("timeout");
          store[cname] = rows().filter((r) => !where([r], cond).length);
          return { stats: {} };
        },
      });
      const find = (id) => {
        const r = rows().find((x) => x._id === id);
        if (!r) throw new Error("document does not exist");
        return r;
      };
      return {
        where: (cond) => query(cond),
        doc: (id) => ({
          get: async () => ({ data: { ...find(id) } }),
          set: async ({ data }) => { store[cname] = rows().filter((x) => x._id !== id).concat([{ _id: id, ...data }]); return {}; },
          update: async ({ data }) => { Object.assign(find(id), data); return { stats: { updated: 1 } }; },
          remove: async () => { store[cname] = rows().filter((x) => x._id !== id); return { stats: {} }; },
        }),
      };
    };
    const command = {
      in: (arr) => pred((v) => arr.includes(v)),
      neq: (x) => pred((v) => v !== x),
      lt: (x) => pred((v) => v < x),
      exists: (yes) => pred((v) => (v !== undefined) === yes),
    };
    const db = { collection, command, serverDate: () => new Date(), createCollection: async () => ({}) };
    const fake = {
      DYNAMIC_CURRENT_ENV: "test", init() {}, database: () => db, getWXContext: () => wxContext,
      openapi: { wxacode: { getUnlimited: async () => ({ buffer: Buffer.from("png") }) } },
    };
    const p = path.join(ROOT, "cloudfunctions", name, "index.js");
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (req, ...rest) { return req === "wx-server-sdk" ? "wx-server-sdk" : resolve.call(this, req, ...rest); };
    require.cache["wx-server-sdk"] = { id: "wx-server-sdk", filename: "wx-server-sdk", loaded: true, exports: fake, children: [] };
    delete require.cache[require.resolve(p)];
    try {
      return require(p);
    } finally {
      Module._resolveFilename = resolve;
      delete require.cache["wx-server-sdk"];
      delete require.cache[p];
    }
  }

  const twoPcs = () => ({
    evo_devices: [{ _id: "pc-1", openid: "me" }, { _id: "pc-2", openid: "someone" }],
    evo_matches: [{ _id: "pc-1:1", uid: "pc-1" }, { _id: "pc-1:2", uid: "pc-1" }, { _id: "pc-2:1", uid: "pc-2" }],
    evo_lobby: [{ _id: "pc-1:1", uid: "pc-1" }, { _id: "pc-2:1", uid: "pc-2" }],
    evo_accounts: [{ _id: "pc-1", uid: "pc-1" }, { _id: "pc-2", uid: "pc-2" }],
  });
  const left = (store) => ["evo_matches", "evo_lobby", "evo_accounts"].map((c) => store[c].map((r) => r._id).join(",")).join(" | ");

  test("云函数 evo_mp：手机上解绑一律删掉这台电脑的数据（传 delete_data: false 也删），别人的不动", async () => {
    const store = twoPcs();
    const fn = loadCloudFunction("evo_mp", store, { OPENID: "me" });
    const r = await fn.main({ action: "unbind", device: "pc-1", delete_data: false });
    assert.deepEqual(r, { ok: true, deleted: true });
    assert.equal(store.evo_devices[0].openid, null);
    assert.equal(left(store), "pc-2:1 | pc-2:1 | pc-2");
    const no = await fn.main({ action: "unbind", device: "pc-2" });
    assert.equal(no.error, "not_yours", "别人的电脑解绑不了");
    assert.equal(left(store), "pc-2:1 | pc-2:1 | pc-2");
  });

  test("云函数 evo_pc：电脑上解绑也一律删（0.5.x 的 Evo 选了「只解绑」还会传 false）", async () => {
    const store = twoPcs();
    const fn = loadCloudFunction("evo_pc", store, {});
    const r = await fn.main({ action: "unbind", delete_data: false }, { environ: "TCB_UUID=pc-1;OTHER=x" });
    assert.deepEqual(r, { ok: true, deleted: true });
    assert.equal(store.evo_devices[0].openid, null);
    assert.equal(left(store), "pc-2:1 | pc-2:1 | pc-2");
  });

  /* 定时的 evo_qrpool 补完码顺带清：11-11 以前选「只解绑、云端留着」留下的数据（August 定：清掉） */
  const withData = (uids) => ({
    evo_matches: uids.map((u) => ({ _id: u + ":1", uid: u })),
    evo_lobby: uids.map((u) => ({ _id: u + ":1", uid: u })),
    evo_accounts: uids.map((u) => ({ _id: u, uid: u })),
  });

  test("evo_qrpool：清解绑过、云端还留着数据的电脑；绑着的、没绑过的、清过的不动；码照样补", async () => {
    const store = {
      evo_devices: [
        { _id: "kept", openid: null, unbound_at: 1 },               // 以前选了「只解绑」
        { _id: "rebound", openid: "me", unbound_at: 1 },            // 解绑过、后来又绑上了
        { _id: "never", openid: null, created_at: 1 },              // 打开过绑定对话框、没绑过
        { _id: "done", openid: null, unbound_at: 1, swept_at: 5 },  // 清过了
      ],
      ...withData(["kept", "rebound", "done"]),
    };
    const fn = loadCloudFunction("evo_qrpool", store, {});
    const r = await fn.main();
    assert.equal(r.swept, 1);
    assert.equal(r.made, 2, "码照样补");
    assert.deepEqual(r.errors, []);
    assert.equal(left(store), "rebound:1,done:1 | rebound:1,done:1 | rebound,done");
    assert.ok(store.evo_devices[0].swept_at > 0, "清过的记下来，以后不再看");
    assert.equal(store.evo_devices[1].swept_at, undefined);
    assert.equal(store.evo_devices[2].swept_at, undefined, "没绑过的没有数据，不用清");
    assert.equal((await fn.main()).swept, 0, "第二次没有要清的");
  });

  test("evo_qrpool：一次最多清 5 台，剩下的下一次接着清", async () => {
    const uids = ["a", "b", "c", "d", "e", "f", "g"];
    const store = { evo_devices: uids.map((u) => ({ _id: u, openid: null, unbound_at: 1 })), ...withData(uids) };
    const fn = loadCloudFunction("evo_qrpool", store, {});
    assert.equal((await fn.main()).swept, 5);
    assert.equal(store.evo_matches.length, 2);
    assert.equal((await fn.main()).swept, 2);
    assert.equal(left(store), " |  | ");
  });

  test("evo_qrpool：删到一半出错不记清过，下一次再清；补码不受影响", async () => {
    const store = { evo_devices: [{ _id: "kept", openid: null, unbound_at: 1 }], ...withData(["kept"]) };
    const r = await loadCloudFunction("evo_qrpool", store, {}, { failRemove: "evo_lobby" }).main();
    assert.equal(r.swept, 0);
    assert.equal(r.made, 2);
    assert.match(r.errors.join(), /sweep kept: timeout/);
    assert.equal(store.evo_devices[0].swept_at, undefined);
    assert.equal((await loadCloudFunction("evo_qrpool", store, {}).main()).swept, 1, "下一次清掉了");
    assert.equal(left(store), " |  | ");
  });
});
