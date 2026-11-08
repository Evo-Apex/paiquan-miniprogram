// 中英文切换（miniprogram/utils/i18n.js）的测试。
//
// 这个功能最容易出的问题不是"某个词没翻"，而是**漏掉一处导致中英混排** ——
// 页面上突然冒出半句英文或半句中文。所以这里重点用两条自动化检查把它钉死：
//   1. 英文词表里**不许出现任何中文字符**
//   2. WXML 里**不许再写死中文文案**（必须走 {{T.x}}）

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const i18n = require(path.resolve(HERE, "..", "miniprogram", "utils", "i18n.js"));
const vm = require(path.resolve(HERE, "..", "miniprogram", "utils", "viewmodel.js"));
const core = require(path.resolve(HERE, "..", "miniprogram", "utils", "core.js"));

const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

function walk(dir, filter) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

const MP = path.resolve(HERE, "..", "miniprogram");
const wxmlFiles = walk(MP, (p) => p.endsWith(".wxml"));

describe("i18n · 词表", () => {
  test("中英两套词表的 key 完全一致（漏一个就会在英文模式下露出中文）", () => {
    const zh = Object.keys(i18n.DICT.zh);
    const en = Object.keys(i18n.DICT.en);
    // 用 hasOwnProperty 而不是真值判断：**显式给空串是合法的**
    // （比如英文的 peopleUnit 本来就该是空的）
    const missEn = zh.filter((k) => !Object.prototype.hasOwnProperty.call(i18n.DICT.en, k));
    const missZh = en.filter((k) => !Object.prototype.hasOwnProperty.call(i18n.DICT.zh, k));
    assert.deepEqual(missEn, [], "英文词表缺：" + missEn.join(", "));
    assert.deepEqual(missZh, [], "中文词表缺：" + missZh.join(", "));
  });

  test("英文词表里不许出现任何中文字符", () => {
    const bad = Object.keys(i18n.DICT.en).filter((k) => CJK.test(i18n.DICT.en[k]));
    assert.deepEqual(bad, [], "这些英文词条里混了中文：" + bad.join(", "));
  });

  test("T(lang) 取不到时退回中文，绝不返回 undefined", () => {
    const t = i18n.T("zh");
    Object.keys(i18n.DICT.zh).forEach((k) => {
      assert.notEqual(t[k], undefined, k + " 没有值");
    });
    assert.equal(t.lang, "zh");
    assert.equal(i18n.T("en").lang, "en");
    // 显式空串要原样保留：英文量词本来就该是空的，不能回退成中文的「人」
    assert.equal(i18n.T("en").peopleUnit, "");
    assert.equal(i18n.T("zh").peopleUnit, "人");
    // 认不出的语言一律当中文
    assert.equal(i18n.T("fr").lang, "zh");
  });
});

describe("i18n · WXML 里不许写死中文", () => {
  test("三个页面的 WXML 只有 {{T.x}} 和动态字段，没有硬编码中文文案", () => {
    const offenders = [];
    wxmlFiles.forEach((f) => {
      // 去掉注释（注释里是给维护者看的中文，允许）
      const src = readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      // 去掉标签本身和所有 {{...}} 绑定，剩下的就应该是纯空白/标点
      const text = src.replace(/<[^>]*>/g, " ").replace(/\{\{[\s\S]*?\}\}/g, " ");
      text.split(/\s+/).forEach((seg) => {
        if (!seg) return;
        // 「中文」「EN」这两个是语言开关本身的按钮文字，属于例外
        if (seg === "中文" || seg === "EN") return;
        if (CJK.test(seg)) offenders.push(path.basename(f) + " → " + seg.slice(0, 40));
      });
    });
    assert.deepEqual(offenders, [], "这些文案还写死在 WXML 里：\n" + offenders.join("\n"));
  });
});

describe("i18n · 动态文案", () => {
  test("段位名：中文译成中文，英文回落上游原文", () => {
    assert.equal(i18n.rankName("Master", "zh"), "大师");
    assert.equal(i18n.rankName("Apex Predator", "zh"), "猎杀者");
    assert.equal(i18n.rankName("Diamond", "zh"), "钻石");
    assert.equal(i18n.rankName("Master", "en"), "Master");
    // 认不出的原样返回，绝不空白
    assert.equal(i18n.rankName("Brand New Rank", "zh"), "Brand New Rank");
    assert.equal(i18n.rankName("", "zh"), "");
  });

  test("相对时间两种语言都不含另一种语言的残留", () => {
    const now = 1800000000000;
    assert.equal(i18n.ago(0, now, "zh"), "尚未更新");
    assert.equal(i18n.ago(0, now, "en"), "not updated yet");
    assert.ok(CJK.test(i18n.ago(now - 1000, now, "zh")));
    assert.ok(!CJK.test(i18n.ago(now - 1000, now, "en")));
    assert.ok(!CJK.test(i18n.ago(now - 120000, now, "en")));
    assert.ok(!CJK.test(i18n.ago(now - 7200000, now, "en")));
  });

  test("赛季：两种语言都不含另一种语言的残留", () => {
    assert.equal(i18n.season("br_ranked_s30_s2", "zh"), "第 30 赛季 第 2 阶段");
    assert.equal(i18n.season("br_ranked_s30_s2", "en"), "Season 30 \u00b7 Split 2");
    assert.equal(i18n.season("", "zh"), "");
    assert.equal(i18n.season("nonsense", "zh"), "nonsense");
  });

  test("错误视图：英文分支里不许出现中文（云函数那条 message 是中文，不能直接透出）", () => {
    const en = vm.errView("notfound", "查无此人", "en");
    assert.ok(!CJK.test(en.title), "英文标题混了中文：" + en.title);
    assert.ok(!CJK.test(en.message), "英文正文混了中文：" + en.message);
    // 中文分支仍然用云函数那条更具体的 message
    const zh = vm.errView("notfound", "查无此人", "zh");
    assert.equal(zh.title, "查无此人");
    assert.equal(zh.message, "查无此人");
  });

  // ⚠️ 这里原有两条用例（「生涯数据条目名也跟着语言走」和汇总扫荡里的 buildStats 部分），
  // 测的是 vm.buildStats。战绩页 2026-10-16 整页删除后那个 builder 也删了。
  // 生涯条目是那一页独有的东西，排位专区页不显示它，所以没有等价覆盖可迁。

  test("轮换模式要显示具体玩法（控制 / 团队死斗），不能只写「轮换模式地图」", () => {
    // 轮换那张卡片没有地图照片，只写"轮换模式地图"用户不知道这一轮在玩什么。
    // 上游给 eventName（Control / Gun Run / TDM），有时只在 code 里带（freedm_tdm_estates）。
    const mk = (cur) => [{ def: { id: "mixtape", label: "轮换模式地图", tag: "Mixtape" }, current: cur, nexts: [] }];
    assert.equal(vm.buildModes(mk({ map: "Fragment", eventName: "Control" }), "zh")[0].eventText, "控制");
    assert.equal(vm.buildModes(mk({ map: "Fragment", eventName: "Control" }), "en")[0].eventText, "Control");
    assert.equal(vm.buildModes(mk({ map: "Skulltown", eventName: "TDM" }), "zh")[0].eventText, "团队死斗");
    assert.equal(vm.buildModes(mk({ map: "Skulltown", eventName: "Team Deathmatch" }), "zh")[0].eventText, "团队死斗");
    assert.equal(vm.buildModes(mk({ map: "Fragment", eventName: "Gun Run" }), "zh")[0].eventText, "子弹时间");
    assert.equal(vm.buildModes(mk({ map: "Fragment", eventName: "Gun Run" }), "en")[0].eventText, "Gun Run");
    // eventName 缺失时从 code 里认
    assert.equal(vm.buildModes(mk({ map: "Estates", code: "freedm_tdm_estates" }), "zh")[0].eventText, "团队死斗");
    // 认不出的玩法**原样显示英文**，不猜（项目口径：猜错的名字比露出英文更糟）
    assert.equal(vm.buildModes(mk({ map: "x", eventName: "Lockdown" }), "zh")[0].eventText, "Lockdown");
    // 两样都没有就是空串（WXML 据此整块不渲染，不留一个空标签）
    assert.equal(vm.buildModes(mk({ map: "x" }), "zh")[0].eventText, "");
    // 大逃杀那几个模式通常没有玩法，字段必须是空串而不是 undefined
    const pubs = [{ def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" }, current: { map: "Olympus" }, nexts: [] }];
    assert.equal(vm.buildModes(pubs, "zh")[0].eventText, "");
    // 接着轮换那一行也要带上玩法
    const withNext = [{ def: { id: "mixtape", label: "轮换模式地图", tag: "Mixtape" },
      current: { map: "Fragment", eventName: "Control" },
      nexts: [{ map: "Skulltown", code: "freedm_tdm_skulltown", start: 0, end: 1 }] }];
    assert.equal(vm.buildModes(withNext, "zh")[0].nexts[0].eventText, "团队死斗");
  });

  test("轮换时间表：玩法外推、没观察到的地图留空（不编）", () => {
    const now = new Date("2026-10-12T10:00:00").getTime();
    const anchor = { start: Math.floor(now / 1000), event: "Gun Run" };   // 当前这场是子弹时间
    const observed = [{ mode: "mixtape", map: "Estates", start: Math.floor(now / 1000) + 900 }];
    const groups = vm.buildSchedule(observed, anchor, now, "zh");
    const rows = groups[0].rows;

    // 下一场是团队死斗，然后控制、再回子弹时间 —— 3 场一循环
    assert.equal(rows[0].event, "团队死斗");
    assert.equal(rows[1].event, "控制");
    assert.equal(rows[2].event, "子弹时间");
    assert.equal(rows[3].event, "团队死斗");
    // 观察到的场次填地图，没观察到的留空（WXML 显示「待记录」，绝不编一个名字）
    assert.equal(rows[0].map, "Estates");
    assert.equal(rows[1].map, "");
    // 今天 / 明天 都要分组出来
    assert.deepEqual(groups.map((g) => g.label).slice(0, 2), ["今天", "明天"]);
    // 英文模式下玩法也是英文
    assert.equal(vm.buildSchedule(observed, anchor, now, "en")[0].rows[0].event, "Team Deathmatch");
    // 没有锚点（还没拿到当前场次）不能崩
    assert.ok(Array.isArray(vm.buildSchedule([], null, now, "zh")));
    assert.ok(Array.isArray(vm.buildSchedule(null, null, now, "en")));
  });

  // ⚠️ 2026-10-16：这里原来有一条「英雄选取率：英雄名和段位标签都跟着语言走」，
  // 测的是 vm.buildPickLegends / buildPickTabs。这两个 builder 随战绩页那两块一起删了
  // （用户要求：排位专区里已经有职业选手的英雄选取 / 三人英雄组合），用例跟着删。

  test("地图卡片：模式名和角标都跟着语言走", () => {
    const norm = [{
      def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" },
      current: { map: "Broken Moon", mapCn: "残月" }, nexts: []
    }];
    const zh = vm.buildModes(norm, "zh")[0];
    const en = vm.buildModes(norm, "en")[0];
    assert.equal(zh.label, "匹配模式地图");
    assert.equal(zh.tag, "大逃杀匹配", "中文模式下角标也要中文，否则就是中英混排");
    assert.equal(en.label, "Battle Royale");
    assert.equal(en.tag, "BR Pubs");
    assert.ok(!CJK.test(en.label) && !CJK.test(en.tag));
  });

  test("英文模式下地图名必须是英文（反过来也一样）", () => {
    // 这是用户实际报过的 bug：切到 EN 之后满页地图名还是中文。
    // 根因是 buildModes 里无条件用 mapCn || map，跟语言无关。
    const norm = [{
      def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" },
      current: { map: "Broken Moon", mapCn: "残月" },
      nexts: [{ map: "Olympus", mapCn: "奥林匹斯", start: 0, end: 1 }]
    }];
    const zh = vm.buildModes(norm, "zh")[0];
    const en = vm.buildModes(norm, "en")[0];

    assert.equal(zh.map, "残月");
    assert.equal(zh.nexts[0].map, "奥林匹斯");
    assert.equal(en.map, "Broken Moon", "英文模式下不能出现中文地图名");
    assert.equal(en.nexts[0].map, "Olympus", "接着轮换那一行同样要跟着语言");

    // 两边都要覆盖到：英文模式下 map 字段里不许有 CJK
    assert.ok(!CJK.test(en.map));
    assert.ok(en.nexts.every((n) => !CJK.test(n.map)));
    // 查不到译名时中文模式退回英文，绝不空白
    const zh2 = vm.buildModes([{
      def: { id: "pubs", label: "x", tag: "x" },
      current: { map: "The Core", mapCn: "" }, nexts: []
    }], "zh")[0];
    assert.equal(zh2.map, "The Core");
  });

  test("汇总扫荡：英文模式下视图模型产出的所有显示文本都不许含中文", () => {
    // 前面几条是按位置逐个钉的，但"哪里还有中文"靠人事先想全很难 ——
    // 这条把各个 builder 的输出**全捞出来扫一遍**，漏掉的会被它逮住。
    const out = [];
    const push = (v) => { if (typeof v === "string" && v) out.push(v); };

    vm.buildModes([
      { def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" },
        current: { map: "Broken Moon", mapCn: "残月" },
        nexts: [{ map: "Olympus", mapCn: "奥林匹斯", start: 0, end: 1 }] },
      { def: { id: "mixtape", label: "轮换模式地图", tag: "Mixtape" }, current: null, nexts: [] }
    ], "en").forEach((m) => {
      push(m.label); push(m.tag); push(m.map);
      (m.nexts || []).forEach((n) => push(n.map));
    });

    // ⚠️ 原来这里 push 的是 vm.buildStats 产出的英文文本（在线状态/封禁/生涯条目名）。
    // 战绩页删除后那个 builder 也没了；排位专区页的 buildPlayer 已经在上面的
    // 「玩家视图模型」一节扫过（statusText/rankText/ladderText/seasonText/uidText）。
    // 这里补上它真正输出、而上面没覆盖的几条，别让扫荡出现空洞。
    const pl2 = vm.buildPlayer({
      name: "x", level: 255, levelPrestige: 2, rankName: "Master", rankDiv: 2, rankScore: 1,
      ladderPos: null, season: "br_ranked_s30_s2", realtime: { online: true, inGame: true, legend: "Wraith" }
    }, "en");
    ["statusText", "levelText", "rankText", "ladderText", "seasonText", "uidText"].forEach((k) => push(pl2[k]));

    vm.buildPredGap({ rankScore: 12000 }, { plats: [{ code: "PC", rp: 20000 }] }, "PC", "en");
    const gap = vm.buildPredGap({ rankScore: 12000 }, { plats: [{ code: "PC", rp: 20000 }] }, "PC", "en");
    ["title", "value", "unit", "note"].forEach((k) => push(gap[k]));

    vm.buildPredator({ plats: [{ code: "PC", label: "PC", rp: 20000, predCount: 750, updatedAt: Date.now() }] }, Date.now(), "en")
      .forEach((p) => { push(p.rpText); push(p.predCountText); push(p.updatedAtText); push(p.deltaBasisText); });
    const pl = vm.buildPlayer({ name: "x", rankName: "Master", rankDiv: 2, ladderPos: null, level: 255, season: "br_ranked_s30_s2" }, "en");
    ["levelText", "rankText", "ladderText", "seasonText", "uidText"].forEach((k) => push(pl[k]));
    const err = vm.errView("notfound", "查无此人", "en");
    push(err.title); push(err.message);

    // 英文词表本身
    Object.keys(i18n.DICT.en).forEach((k) => push(i18n.DICT.en[k]));

    const bad = [...new Set(out.filter((s) => CJK.test(s)))];
    assert.deepEqual(bad, [], "英文模式下这些文本还是中文：\n  " + bad.join("\n  "));
  });

  test("汇总扫荡：中文模式下视图模型产出的所有显示文本都不许含英文单词", () => {
    // 反向同理，但**要放过合理保留的英文**：上游没译名的据点、认不出的英雄、
    // 以及 PC / RP / ALGS 这类本来就是英文的专有名词。
    const ALLOW = /^(PC|Xbox|PlayStation|Switch|RP|ALGS|UID|BR|TDM|Pro-League|Y6|[A-Za-z0-9 .'’+\-·&/]*)$/;
    const out = [];
    const push = (v) => { if (typeof v === "string" && v && !ALLOW.test(v)) out.push(v); };
    vm.buildModes([{ def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" },
      current: { map: "Broken Moon", mapCn: "残月" }, nexts: [] }], "zh")
      .forEach((m) => { push(m.label); push(m.tag); });
    // ⚠️ 原来这里扫的是 vm.buildStats 的中文文本。战绩页删除后那个 builder 也没了，
    // 换成排位专区页的 buildPlayer（它才是现在唯一会显示玩家字段的地方）。
    const st = vm.buildPlayer({ level: 255, rankName: "Master", rankDiv: 2, realtime: { online: false },
      highlights: [{ label: "生涯击杀", labelEn: "BR Kills", valueText: "1" }] }, "zh");
    ["statusText", "levelText", "rankText", "ladderText"].forEach((k) => push(st[k]));
    const bad = [...new Set(out.filter((s) => CJK.test(s) && /[A-Za-z]{3,}/.test(s)))];
    assert.deepEqual(bad, [], "中文模式下这些文本里混了英文单词：\n  " + bad.join("\n  "));
  });

  test("原生外壳（底部 tab / 顶部标题）跟着语言切", () => {
    // app.json 和页面 json 里写的是静态中文，不改就会在英文模式下露馅。
    const calls = [];
    global.wx = {
      setTabBarItem: (o) => calls.push(["tab", o.index, o.text]),
      setNavigationBarTitle: (o) => calls.push(["nav", o.title]),
    };
    try {
      i18n.applyChrome("en", "navMaps");
      const tabs = calls.filter((c) => c[0] === "tab");
      // 2026-10-27：第 2 个 tab「排位专区」改叫「战绩」，加了第 5 个「我的」（Evo 绑定）
      assert.equal(tabs.length, 5, "五个 tab 都要改");
      // 2026-10-27（首页改版）：第 1 个 tab 从「地图」换成「首页」
      assert.deepEqual(tabs.map((t) => t[2]), ["Home", "Stats", "Esports", "Games", "Me"]);
      assert.deepEqual(calls.find((c) => c[0] === "nav"), ["nav", "Map rotation"]);
      assert.ok(!calls.some((c) => CJK.test(String(c[2] || c[1]))), "英文外壳里不许有中文");

      calls.length = 0;
      i18n.applyChrome("zh", "navMaps");
      assert.deepEqual(calls.filter((c) => c[0] === "tab").map((t) => t[2]), ["首页", "战绩", "比赛", "小游戏", "我的"]);
    } finally {
      delete global.wx;
    }
    // 没有 wx 的环境（测试/网页版）不能抛错
    assert.doesNotThrow(() => i18n.applyChrome("en", "navMaps"));
  });

  test("中文模式下不许漏出英文地图名（轮换的小区域图最容易漏）", () => {
    // 前六个是大逃杀地图，后面是轮换（Mixtape：Control / Gun Run / TDM）用的小区域图。
    // 上游会持续换着用这些地点，**漏一条界面上就出现一个英文名** ——
    // 用户就是这么看到 "Monument" 的。以后上游上了新地点，往这个清单里加一行就会红。
    const names = [
      "Kings Canyon", "World's Edge", "Olympus", "Storm Point", "Broken Moon", "E-District",
      "Skulltown", "Fragment", "Fragment East", "Fragment West", "Hammond Labs", "Estates",
      "Barometer", "Monument", "Artillery", "Caustic Treatment", "Lava Siphon",
      "Party Crasher", "Habitat 4", "Phase Runner", "Highpoint", "Dome", "The Dome",
      "Thunderdome"
    ];
    const missing = names.filter((n) => !core.translateMapName(n));
    assert.deepEqual(missing, [], "这些地图还没有中文名，中文模式下会露出英文：" + missing.join(", "));
    // 上游同一张图两种写法都要命中，否则会出现"同一张图有时中文有时英文"
    assert.equal(core.translateMapName("The Dome"), core.translateMapName("Dome"));
    assert.equal(core.translateMapName("the core"), core.translateMapName("The Core"));
    assert.equal(core.translateMapName(""), "");
    assert.equal(core.translateMapName(null), "");
  });

  test("不传 lang 时行为与改造前完全一致（默认中文）", () => {
    const norm = [{
      def: { id: "ranked", label: "排位赛地图", tag: "BR Ranked" },
      current: { map: "Olympus", mapCn: "奥林匹斯" }, nexts: []
    }];
    const out = vm.buildModes(norm)[0];
    assert.equal(out.label, "排位赛地图");
    assert.equal(out.tag, "大逃杀排位");
    assert.equal(vm.buildPlayer({ rankName: "Master" }).rankText, "大师");
  });
});

describe("i18n · 语言状态", () => {
  test("默认中文，能切换，认不出的语言回落中文", () => {
    i18n.setLang("zh");
    assert.equal(i18n.getLang(), "zh");
    assert.equal(i18n.setLang("en"), "en");
    assert.equal(i18n.getLang(), "en");
    assert.equal(i18n.setLang("klingon"), "zh");
    assert.equal(i18n.getLang(), "zh");
  });
});

describe("词条不许重名（2026-11-08）", () => {
  test("同一种语言里同一个键只写一次：后写的会悄悄盖掉前面的（比赛页的 seasonEnded 差点盖掉首页的「本赛季已结束」）", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../miniprogram/utils/i18n.js", import.meta.url), "utf8");
    const enAt = src.search(/^  en: \{/m);
    for (const [name, block] of [["zh", src.slice(0, enAt)], ["en", src.slice(enAt)]]) {
      const keys = [...block.matchAll(/^    ([A-Za-z_][A-Za-z0-9_]*):/gm)].map((x) => x[1]);
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      assert.deepEqual(dup, [], name + " 里重名的词条：" + dup.join(", "));
    }
  });
});
