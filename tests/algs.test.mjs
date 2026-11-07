// ALGS 职业赛场（官方赛事赛后统计快照）。
//
// 数据是离线生成的（algs_data.js，生成脚本 直播识别/build_algs.py）。
// 这里重点验三件在界面上"错了也看不出来"的事：
//   1. 数据里出现的**每个英雄都能在图鉴里查到名字和头像** —— 查不到时界面会
//      退化成英文名 + 没有头像，看着像"没做完"，而不是像"报错"；
//   2. **名次的口径**：决赛名次和"全程积分第一"是两件事，不能混着叫冠军；
//   3. 中英切换后主名跟着语言走（副名刻意保留另一种语言，和项目其它地方一致）。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);
const algs = require(path.join(MP, "utils", "algs.js"));
const codex = require(path.join(MP, "data", "codex_data.js"));

const EVENTS = algs.DATA.events || [];
const KNOWN = new Map(codex.heroes.map((h) => [h.en.toLowerCase(), h]));
const CJK = /[\u4e00-\u9fff]/;

describe("ALGS · 数据", () => {
  test("抓到了赛事（少于一打说明抓取脚本退化了）", () => {
    assert.ok(EVENTS.length >= 10, "只有 " + EVENTS.length + " 个赛事，太少了");
  });

  test("赛事 id 不重复，且都带年份/赛段/赛区", () => {
    const ids = EVENTS.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "有重复的赛事 id");
    for (const e of EVENTS) {
      assert.match(e.split, /^Y\d+-Split\d$/, e.id + " 的赛段名不对：" + e.split);
      assert.ok(e.league, e.id + " 没有赛事名");
      assert.ok(e.region, e.id + " 没有赛区");
      // 只留路径不留完整 URL：小程序端有测试禁止代码里出现外部域名
      assert.match(e.path, /^Y\d+-Split\d\/[A-Za-z-]+\//, e.id + " 的来源路径不对：" + e.path);
      assert.ok(!/https?:/.test(JSON.stringify(e)), e.id + " 里出现了完整 URL");
    }
  });

  test("每个赛事都真有英雄数据（没有数据的赛事必须在生成时被丢掉）", () => {
    for (const e of EVENTS) {
      assert.ok(e.legends.length > 0, e.id + " 一个英雄都没有，不该出现在这里");
      assert.ok(e.legendTotal > 0, e.id + " 缺少英雄样本量");
    }
  });

  test("英雄名全部能在图鉴里查到（否则界面上是个没头像的英文名）", () => {
    const missing = new Set();
    for (const e of EVENTS) {
      for (const l of e.legends) if (!KNOWN.has(l.en.toLowerCase())) missing.add(l.en);
      for (const c of e.combos) {
        for (const h of c.heroes) if (!KNOWN.has(h.toLowerCase())) missing.add(h);
      }
    }
    assert.deepEqual([...missing], [],
      "这些英雄图鉴里没有，界面上会退化成英文名 + 无头像：把译名和头像补进 codex_data.js");
  });

  test("数据里不许有占位英雄（Dummie 是数据源对「没选英雄」的占位，不是英雄）", () => {
    for (const e of EVENTS) {
      for (const l of e.legends) assert.doesNotMatch(l.en, /dumm/i, e.id + " 混进了占位英雄");
      for (const c of e.combos) {
        for (const h of c.heroes) assert.doesNotMatch(h, /dumm/i, e.id + " 的组合里有占位英雄");
      }
    }
  });

  test("英雄按出现次数降序，数字之间自洽", () => {
    for (const e of EVENTS) {
      for (let i = 1; i < e.legends.length; i++) {
        assert.ok(e.legends[i - 1].n >= e.legends[i].n,
          e.id + "：" + e.legends[i - 1].en + " 排在 " + e.legends[i].en + " 前面，顺序不对");
      }
      for (const l of e.legends) {
        assert.ok(l.n > 0, e.id + " " + l.en + " 出现次数为 0");
        assert.ok(l.pct > 0 && l.pct <= 100, e.id + " " + l.en + " 的选取率越界：" + l.pct);
      }
    }
  });

  test("三人组合必须真的是 2~3 个英雄，且没有重复英雄", () => {
    for (const e of EVENTS) {
      for (const c of e.combos) {
        assert.ok(c.heroes.length >= 2 && c.heroes.length <= 3,
          e.id + " 的组合人数不对：" + c.heroes.join("+"));
        assert.equal(new Set(c.heroes).size, c.heroes.length,
          e.id + " 的组合里有重复英雄：" + c.heroes.join("+"));
      }
    }
  });

  test("名次是 1..n 连续递增，分数不为负", () => {
    for (const e of EVENTS) {
      assert.ok(e.standings.length > 0, e.id + " 没有名次");
      e.standings.forEach((s, i) => {
        assert.equal(s.rank, i + 1, e.id + " 的名次不连续：" + JSON.stringify(s));
        assert.ok(s.score >= 0, e.id + " " + s.team + " 的分数是负的");
        assert.ok(s.team, e.id + " 有名次没有队名");
      });
    }
  });

  test("地图分布里不许出现认不出的地图名（宁可不显示）", () => {
    for (const e of EVENTS) {
      for (const m of e.maps || []) {
        assert.ok(m.en && !/^unknown$/i.test(m.en), e.id + " 有认不出的地图名：" + JSON.stringify(m));
        assert.ok(m.n > 0, e.id + " " + m.en + " 的局数为 0");
      }
    }
  });
});

describe("ALGS · 名次口径（最容易出错的地方）", () => {
  test("rankBy 只有两种取值，且与 champion / pointsLeader 一一对应", () => {
    for (const e of EVENTS) {
      assert.ok(["bracket", "points"].includes(e.rankBy), e.id + " 的 rankBy 不认识：" + e.rankBy);
      if (e.rankBy === "bracket") {
        assert.ok(e.champion, e.id + " 有官方名次却没有冠军");
      } else {
        // 退回累计积分表时**绝不能**叫冠军：ALGS 的名次由决赛赛制决定，
        // 跟全程积分不是一回事。这一条就是防止有人图省事把它填上。
        assert.equal(e.champion, "", e.id + " 只有积分榜却写了冠军");
        assert.ok(e.pointsLeader, e.id + " 没有冠军也没有积分第一");
        assert.equal(e.pointsLeader, e.standings[0].team);
      }
    }
  });

  test("官方名次来自决赛阶段（不是小组赛）", () => {
    for (const e of EVENTS) {
      if (e.rankBy !== "bracket") continue;
      assert.equal(e.stage, "Finals", e.id + " 的名次来自「" + e.stage + "」，不是决赛");
    }
  });
});

describe("ALGS · 视图模型", () => {
  test("赛事 chips 不重名（不同赛区的同名赛事必须补上赛区）", () => {
    // 实测过：亚太北和亚太南的「Y6S2 职业联赛」会生成两个一模一样的 chip，
    // 点哪个都看不出来是哪个赛区。
    for (const lang of ["zh", "en"]) {
      const names = algs.chipList(lang).map((c) => c.name);
      const dup = names.filter((n, i) => names.indexOf(n) !== i);
      assert.deepEqual([...new Set(dup)], [], lang + " 下有重名 chip：" + dup.join(", "));
    }
    assert.ok(algs.chipList("en").every((c) => !CJK.test(c.name)), "英文 chip 里混了中文");
  });

  test("没数据时返回 null（界面据此整块不渲染，而不是显示一个空壳）", () => {
    assert.ok(algs.buildAll("", "zh"));
  });

  test("默认选中第一个赛事；传一个不存在的 id 也退回第一个", () => {
    const a = algs.buildAll("", "zh");
    const b = algs.buildAll("这不是一个赛事", "zh");
    assert.equal(a.active, EVENTS[0].id);
    assert.equal(b.active, EVENTS[0].id);
    assert.equal(a.chips.filter((c) => c.active).length, 1, "只能有一个选中项");
  });

  test("赛事 chips：每个赛事一个，点选后选中的赛事要对得上", () => {
    const v = algs.buildAll(EVENTS[2].id, "zh");
    assert.equal(v.chips.length, EVENTS.length);
    assert.equal(v.ev.id, EVENTS[2].id);
    assert.equal(v.chips[2].active, true);
  });

  test("英雄卡带 id/图标/进度条宽度，宽度必须在 0~100 之间", () => {
    const v = algs.buildAll("", "zh");
    for (const h of v.ev.legends) {
      assert.ok(h.key, "英雄卡没有 key（WXML 的 wx:key 要用）");
      assert.match(h.pctText, /^\d+(\.\d)?%$/);
      assert.ok(h.bar >= 0 && h.bar <= 100, h.main + " 的进度条越界：" + h.bar);
      if (h.hasIcon) {
        assert.ok(existsSync(path.join(MP, h.icon.replace(/^\//, ""))),
          h.main + " 的头像文件不存在：" + h.icon);
      }
    }
  });

  test("三人组合：三个头像 + 一行名字；进度条同样在 0~100", () => {
    const v = algs.buildAll("", "zh");
    assert.ok(v.ev.combos.length > 0);
    for (const c of v.ev.combos) {
      assert.ok(c.key && c.text, "组合缺少 key 或文本");
      assert.ok(Array.isArray(c.avatars));
      assert.ok(c.bar >= 0 && c.bar <= 100, c.text + " 的进度条越界：" + c.bar);
      if (c.hasAvatars) {
        for (const a of c.avatars) {
          assert.ok(existsSync(path.join(MP, a.replace(/^\//, ""))), "组合头像缺失：" + a);
        }
      }
    }
  });

  test("中英切换：主名跟着语言，副名给另一种（和无障碍/图鉴一个口径）", () => {
    const zh = algs.buildAll("", "zh");
    const en = algs.buildAll("", "en");
    assert.match(zh.ev.legends[0].main, CJK, "中文模式下英雄主名应当是中文");
    assert.ok(!CJK.test(en.ev.legends[0].main), "英文模式下英雄主名不能是中文：" + en.ev.legends[0].main);
    // 副名是刻意保留的另一种语言，用来对照，不算漏翻
    assert.ok(zh.ev.legends[0].sub && !CJK.test(zh.ev.legends[0].sub));
  });

  test("英文模式下界面文案不含中文（除副名外）", () => {
    const en = algs.buildAll("", "en");
    const out = [en.updatedText, en.ev.label, en.ev.sub, en.ev.championLabel,
      en.ev.teamsText, en.ev.gamesText, en.ev.mapsText, en.ev.rankNote,
      en.ev.legendTotalText, en.caveat];
    en.chips.forEach((c) => out.push(c.name));
    en.ev.standings.forEach((s) => { out.push(s.team); out.push(s.winsText); out.push(s.scoreText); });
    en.ev.combos.forEach((c) => { out.push(c.text); out.push(c.nText); out.push(c.pctText); });
    const bad = [...new Set(out.filter((s) => s && CJK.test(s)))];
    assert.deepEqual(bad, [], "英文模式下这些文案还是中文：\n  " + bad.join("\n  "));
  });

  test("认不出的英雄照原样显示英文，不猜中文名（也不给假头像）", () => {
    const h = algs.heroOf("Brand New Legend");
    assert.equal(h.zh, "Brand New Legend");
    assert.equal(h.en, "Brand New Legend");
    assert.equal(h.icon, "");
    assert.equal(h.known, false);
    // 认识的仍然要认出中文名和头像
    const w = algs.heroOf("Wraith");
    assert.equal(w.zh, "恶灵");
    assert.ok(w.icon);
    // 大小写不该影响识别
    assert.equal(algs.heroOf("wraith").zh, "恶灵");
    assert.equal(algs.heroOf(null).known, false, "空值不能崩");
  });

  test("快照要有日期和来源（快照不说自己什么时候抓的，就等于假实时）", () => {
    assert.match(algs.DATA.updated, /^\d{4}-\d{2}-\d{2}$/, "快照日期格式不对：" + algs.DATA.updated);
    assert.equal(algs.DATA.source, "apexlegendsstatus.com/algs");
    const v = algs.buildAll("", "zh");
    assert.ok(v.updatedText.includes(algs.DATA.updated));
  });
});
