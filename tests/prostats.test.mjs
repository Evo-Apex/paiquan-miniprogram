// 排位专区：职业选手排位数据的视图模型测试。
//
// 这一块的数据不来自上游接口，而是离线跑 B站直播回放识别出来的
// （prostats_data.js，生成脚本见 直播识别/build_prostats.py）。
// 所以这里重点验三件事：
//   1. 界面拿到的字段永远存在（缺数据时也不许 undefined，否则 WXML 那块空白且不报错）；
//   2. 条形按各自最大值归一化 —— 否则次数差距大时除了第一名全是看不出差别的小短条；
//   3. 中英切换真的换了主标题，而不是只换标题。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const P = (...a) => path.resolve(HERE, "..", ...a);
const prostats = require(P("miniprogram", "utils", "prostats.js"));

describe("排位专区 · 数据完整性", () => {
  test("至少有一位选手，且每人都有英雄/组合/枪械三块（枪械可以暂时为空）", () => {
    const ps = prostats.DATA.players || [];
    assert.ok(ps.length >= 1, "一位选手都没有，页面会整块空白");
    for (const p of ps) {
      assert.ok(p.id && p.name, "选手必须有 id 和名字：" + JSON.stringify(p.id));
      assert.ok(Array.isArray(p.heroes), p.name + " 缺 heroes");
      assert.ok(Array.isArray(p.combos), p.name + " 缺 combos");
      assert.ok(Array.isArray(p.weapons), p.name + " 缺 weapons");
    }
  });

  test("每条统计的百分比都在 0~100，且次数是正整数", () => {
    for (const p of prostats.DATA.players) {
      for (const key of ["heroes", "combos", "weapons"]) {
        for (const it of p[key]) {
          assert.ok(it.n > 0, `${p.name} ${key} 出现非正次数：${it.n}`);
          assert.ok(it.pct >= 0 && it.pct <= 100.5, `${p.name} ${key} 百分比越界：${it.pct}`);
        }
      }
    }
  });

  test("英雄条目必须有中英两个名字（界面上主副标题都要用）", () => {
    for (const p of prostats.DATA.players) {
      for (const h of p.heroes) {
        assert.ok(h.zh && h.en, "英雄缺中/英名：" + JSON.stringify(h));
      }
      for (const w of p.weapons) {
        assert.ok(w.zh && w.en, "枪械缺中/英名：" + JSON.stringify(w));
      }
      for (const c of p.combos) {
        assert.equal(c.heroes.length, 3, "三人组合必须正好三个人：" + c.heroes.join("+"));
        assert.equal(c.en.length, 3, "三人组合的英文名也要三个：" + c.en.join("+"));
      }
    }
  });
});

describe("排位专区 · 视图模型", () => {
  test("综合视图：把各选手的次数加总（次数只增不减）", () => {
    const all = prostats.buildAll("__all__", "zh");
    const each = (prostats.DATA.players || []).reduce((s, p) => s + p.heroes.reduce((a, h) => a + h.n, 0), 0);
    // 用 heroTotal（数字）验证合并，**不要**用 topHeroes+restHeroes 求和 ——
    // 那两条列表会被"收起前五 / 展开前十"的显示上限截断，求和必然小于总数。
    assert.equal(all.stat.heroTotal, each, "综合之后的英雄次数总和应当等于各选手之和");
    assert.ok(all.stat.topHeroes.length >= 1);
  });

  test("四个榜单：收起看前五，展开也只到前十（用户 2026-10 的要求）", () => {
    const all = prostats.buildAll("__all__", "zh");
    const s = all.stat;
    assert.ok(s.topHeroes.length <= 5, "收起时最多五条");
    assert.ok(s.restHeroes.length <= 5, "展开后最多补到前十");
    assert.ok(s.topCombos.length <= 5 && s.restCombos.length <= 5, "英雄组合同样受限");
    assert.ok(s.topWeapons.length <= 5 && s.restWeapons.length <= 5, "枪械同样受限");
    assert.ok(s.topPairs.length <= 5 && s.restPairs.length <= 5, "枪械搭配同样受限");
    // 全量列表仍然保留（图鉴/别处要用），不能被上限改短
    assert.ok(s.combos.length >= s.topCombos.length + s.restCombos.length);
  });

  test("选手切换：给谁就出谁，给不存在的 id 也不崩（退回第一位）", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first) return;
    const one = prostats.buildAll(first.id, "zh");
    assert.equal(one.active, first.id);
    assert.equal(one.stat.name, first.name);
    const bogus = prostats.buildAll("who-is-this", "zh");
    assert.ok(bogus.stat && bogus.stat.name, "无效 id 也要给出一份可渲染的数据");
  });

  test("条形按该选手自己的最大值归一化：第一名占满 100%", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first || !first.heroes.length) return;
    const one = prostats.buildAll(first.id, "zh");
    const maxBar = Math.max(...one.stat.topHeroes.map((r) => r.bar));
    assert.equal(maxBar, 100, "次数最多的那条应当占满整条");
  });

  test("次数少但非零的条目也要留一点宽度（不能看起来像没数据）", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first || first.heroes.length < 2) return;
    const one = prostats.buildAll(first.id, "zh");
    for (const r of one.stat.topHeroes) {
      if (r.n > 0) assert.ok(r.bar >= 3, `${r.main} 有 ${r.n} 次却只有 ${r.bar}% 宽`);
    }
  });

  test("中英切换：主标题换语言，副标题给另一种（两边都能对上号）", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first || !first.heroes.length) return;
    const zh = prostats.buildAll(first.id, "zh").stat.topHeroes[0];
    const en = prostats.buildAll(first.id, "en").stat.topHeroes[0];
    assert.equal(zh.main, first.heroes[0].zh);
    assert.equal(zh.sub, first.heroes[0].en);
    assert.equal(en.main, first.heroes[0].en);
    assert.equal(en.sub, first.heroes[0].zh);
  });

  test("chips 第一项是「综合」，之后是各选手，id 不重复", () => {
    const chips = prostats.chipList("zh");
    assert.equal(chips[0].id, "__all__");
    const ids = chips.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "选手 id 有重复：" + ids.join(","));
  });

  test("没有数据的区块用 has* 标记为 false（界面据此整块不渲染，而不是摆空表）", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first) return;
    const one = prostats.buildAll(first.id, "zh").stat;
    assert.equal(one.hasHeroes, first.heroes.length > 0);
    assert.equal(one.hasCombos, first.combos.length > 0);
    assert.equal(one.hasWeapons, first.weapons.length > 0);
  });

  test("英文模式下百分比/次数文案也换语言（不能中英混排）", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first || !first.heroes.length) return;
    // 2026-10 改版后每行的次数只是数字，单位挪到区块标题（"4,537 次" / "4,537 picks"），
    // 所以这里查区块标题与百分比文案，不再查行内 nText。
    const en = prostats.buildAll(first.id, "en").stat;
    const zh = prostats.buildAll(first.id, "zh").stat;
    assert.match(en.heroTotalText, /picks$/);
    assert.match(zh.heroTotalText, /次$/);
    assert.match(en.topHeroes[0].pctText, /%$/);
    assert.match(zh.combos[0].nText, /局$/);
    assert.match(en.combos[0].nText, /games$/);
  });

  test("双武器搭配：正好两把枪，且中英各一份", () => {
    for (const p of prostats.DATA.players || []) {
      for (const c of p.weaponPairs || []) {
        assert.equal(c.zh.length, 2, "搭配必须正好两把：" + c.zh.join("+"));
        assert.equal(c.en.length, 2, "英文名也要两把：" + c.en.join("+"));
        assert.ok(c.n > 0 && c.pct >= 0);
      }
    }
  });

  test("双武器搭配的视图模型：主副标题分别是中/英，且带次数", () => {
    const first = (prostats.DATA.players || [])[0];
    if (!first || !(first.weaponPairs || []).length) return;
    const zh = prostats.buildAll(first.id, "zh").stat.pairs[0];
    assert.equal(zh.main, first.weaponPairs[0].zh.join(" + "));
    assert.equal(zh.sub, first.weaponPairs[0].en.join(" + "));
    assert.match(zh.nText, /次$/);
    const en = prostats.buildAll(first.id, "en").stat.pairs[0];
    assert.equal(en.main, first.weaponPairs[0].en.join(" + "));
    assert.match(en.nText, /loadouts$/);
  });
});

describe("职业选手数据 · 云端热更新的方向", () => {
  // 用户 2026-11-08 反馈「英雄组合那里好像没更新」。
  // 根因不是数据没生成，而是 setHot 不看日期：包内已经是新版，
  // 云端还留着上一版，一启动就被旧数据盖掉了。
  const POOL = (name) => ([{
    id: "probe", name, heroes: [], combos: [], weapons: [], weaponPairs: [], selfHeroes: [],
  }]);

  test("云端比包内旧 → 不换（宁可显示包内的新数据）", () => {
    const before = prostats.DATA.updated;
    const ok = prostats.setHot({ updated: "2000-01-01", season: "S29", players: POOL("旧人") });
    assert.equal(ok, false, "更旧的云端数据不该覆盖包内数据");
    assert.equal(prostats.isHot(), false);
    assert.equal(prostats.DATA.updated, before, "被拒绝之后 updated 不能被动过");
    assert.ok(prostats.DATA.players.some((p) => p.name !== "旧人"));
  });

  test("云端同一天或更新 → 照常换", () => {
    const same = prostats.setHot({
      updated: prostats.DATA.updated, season: "S31", players: POOL("同日"),
    });
    assert.equal(same, true, "同一天的热更新应当被接受");
    assert.equal(prostats.isHot(), true);

    const newer = prostats.setHot({ updated: "2999-01-01", season: "S31", players: POOL("未来的") });
    assert.equal(newer, true);

    // ⚠️ 复原：这个模块的 DATA 是模块级状态，不还回去后面的用例全废
    prostats.useSnapshot();
    assert.equal(prostats.isHot(), false);
  });
});
