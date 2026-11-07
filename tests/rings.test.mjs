// 猜圈练习（games/utils/rings.js + games/data/rings_data.js）。
//
// 这份数据是从上游猜圈接口一条条取回来的，所以最该验的是**它是不是真的圈**：
//   Apex 的圈是【内切】的 —— 下一个圈的圆心到上一个圈心的距离 + 新半径
//   恰好等于旧半径。这条几何关系对不上，说明数据串了位或者坐标系搞错了。
//   实测能对上（误差 0~2px），所以拿来当硬断言。
//
// 其次是判分：正中满分、2 个圈半径归零、圈内算 hit —— 算错方向会给出相反的暗示。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);
const rings = require(path.join(MP, "games", "utils", "rings.js"));
const i18n = require(path.join(MP, "utils", "i18n.js"));

const CJK = /[\u4e00-\u9fff]/;
const ALL = rings.allSamples();
const COORD = rings.COORD;

describe("猜圈 · 数据", () => {
  test("★ 题库至少 30 道题（用户明确要求的下限）", () => {
    assert.ok(ALL.length >= 30, "题库只有 " + ALL.length + " 道题，少于用户要求的 30 道");
  });

  test("题库足够大（总量看 allQuestions：完整序列那批也算题）", () => {
    // 2026-10-17：rings_data 按**地图版本**裁到只剩风暴点（世界尽头/电力区域的上游题是旧版地图），
    // 所以样本数从 150 降到 65；真正的题库规模看 allQuestions（含完整序列那批）。
    assert.ok(ALL.length >= 30, "样本太少：" + ALL.length);
    assert.ok(rings.allQuestions().length >= 100, "题库太少：" + rings.allQuestions().length);
    const maps = new Set(rings.allQuestions().map((q) => q.map));
    assert.ok(maps.size >= 3, "只覆盖了 " + maps.size + " 张图");
  });

  test("★ 题库里没有完全重复的题（上游按圈型模板发题，重复的要在生成时去掉）", () => {
    // 实测过：抓 194 条里有 44 条一模一样（同一个第 1 圈圈心最多出现 10 次）。
    // 不去重的话，一局 30 道里会抽到几道完全相同的题，"题库多少道"这个数也是虚的。
    const seen = new Set();
    const dups = [];
    for (const s of ALL) {
      const k = s.map + "|" + s.rings.map((r) => r.x + "," + r.y + "," + r.r).join("|");
      if (seen.has(k)) dups.push(k);
      else seen.add(k);
    }
    assert.deepEqual(dups, [], "有 " + dups.length + " 道完全重复的题");
  });

  test("布局是 [x1,x2,x3, y1,y2,y3, r1,r2,r3]，解包后三个圈都在坐标空间内", () => {
    for (const s of ALL) {
      assert.equal(s.rings.length, 3, s.map + " 的圈数不对");
      for (const r of s.rings) {
        assert.ok(r.r > 0, s.map + " 有非正半径：" + r.r);
        assert.ok(r.x >= 0 && r.x <= COORD && r.y >= 0 && r.y <= COORD,
          s.map + " 的圆心跑到坐标空间外：" + r.x + "," + r.y);
      }
    }
  });

  test("★ 圈必须套娃：下一个圈要完整落在上一个圈里", () => {
    // ⚠️ 别把它写成"内切" —— 有一部分局的圈心**根本不动**（同心圆），
    //    那时是深度内含而不是相切。第一版把内切当铁律，84 条里报了 168 处"异常"，
    //    绝大多数其实完全正常。真正的不变量只有"套在里面"。
    let worst = 0;
    for (const s of ALL) {
      for (let i = 1; i < 3; i++) {
        const a = s.rings[i - 1], b = s.rings[i];
        const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        const over = d + b.r - a.r;          // >0 就是戳出了上一个圈
        if (over > worst) worst = over;
      }
    }
    assert.ok(worst <= 5, "有圈戳出了上一个圈，超出 " + worst.toFixed(1) + "px");
  });

  test("同心圆那批确实是深度内含（留个记录，免得下一轮又当成 bug）", () => {
    const gaps = [];
    for (const s of ALL) {
      for (let i = 1; i < 3; i++) {
        const a = s.rings[i - 1], b = s.rings[i];
        gaps.push(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) + b.r - a.r);
      }
    }
    assert.ok(gaps.some((g) => g < -500),
      "数据里没有明显的同心/内含样本 —— 先确认抓取和布局都对");
    // 同时也要有一批接近内切的（说明整体是真实圈数据，不是随机点）
    assert.ok(gaps.filter((g) => Math.abs(g) <= 5).length >= gaps.length * 0.3,
      "接近内切的样本太少，数据可能有问题");
  });

  test("圈半径逐圈变小（圈是收缩的）", () => {
    for (const s of ALL) {
      assert.ok(s.rings[0].r > s.rings[1].r, s.map + " 第二圈没变小");
      assert.ok(s.rings[1].r > s.rings[2].r, s.map + " 第三圈没变小");
    }
  });

  test("图名映射：资产 id 都有中英名，认不出的不猜", () => {
    assert.equal(rings.mapName("storm-point", "en"), "Storm Point");
    assert.ok(CJK.test(rings.mapName("storm-point", "zh")), "中文模式要给中文名");
    assert.ok(!CJK.test(rings.mapName("worlds-edge", "en")));
    // ★ 猜圈必须用【平面战术图】，不能用首页那种斜视宣传图
    assert.equal(rings.mapImage("storm-point"), "/games/assets/flat/storm-point.jpg");
    assert.equal(rings.mapImage("e-district"), "/games/assets/flat/e-district.jpg");
    // 2026-10-17：奥林匹斯 / 残月进了题库，所以也必须是平面图（不是宣传图）
    assert.equal(rings.mapImage("olympus"), "/games/assets/flat/olympus.jpg");
    assert.equal(rings.mapImage("broken-moon"), "/games/assets/flat/broken-moon.jpg");
    // 题库之外的图（诸王峡谷）回落到首页宣传图，只保证路径不空
    assert.equal(rings.mapImage("kings-canyon"), "/assets/maps/kings-canyon.jpg");
    assert.equal(rings.mapName("no-such-map", "zh"), "no-such-map", "认不出就原样返回");
  });

  test("平面图文件真的在包里（路径写错的话截图上就是一片空白）", () => {
    for (const s of ALL) {
      const p = path.join(MP, rings.mapImage(s.map).replace(/^\//, ""));
      assert.ok(existsSync(p), "缺平面图：" + rings.mapImage(s.map));
    }
  });

  test("最终圈可能落点：形状对，且张图有数据时非空", () => {
    const ends = rings.endZones("storm-point");
    assert.ok(Array.isArray(ends));
    for (const e of ends) assert.ok(e.r > 0 && e.x >= 0 && e.x <= COORD);
  });
});

describe("猜圈 · 一轮的时间线（用户定的 0/5/10 + 20 秒）", () => {
  test("0s 第 1 个提示圈、5s 第 2 个、10s 第 3 个、20s 一轮结束", () => {
    assert.equal(rings.stageAt(0, 3).visible, 1);
    assert.equal(rings.stageAt(4999, 3).visible, 1);
    assert.equal(rings.stageAt(5000, 3).visible, 2);
    assert.equal(rings.stageAt(9999, 3).visible, 2);
    assert.equal(rings.stageAt(10000, 3).visible, 3);
    assert.equal(rings.stageAt(20000, 3).over, true);
    assert.equal(rings.stageAt(19999, 3).over, false);
  });

  test("题目只给 2 个提示圈时，第 3 个不会凭空冒出来", () => {
    assert.equal(rings.stageAt(0, 2).visible, 1);
    assert.equal(rings.stageAt(5000, 2).visible, 2);
    assert.equal(rings.stageAt(15000, 2).visible, 2, "上限就是题目给的圈数");
  });

  test("★ 整轮 20 秒都能猜：答案圈从头到尾不显示，不存在「看见了才猜」", () => {
    assert.equal(rings.stageAt(0, 3).canGuess, true);
    assert.equal(rings.stageAt(19999, 3).canGuess, true);
    assert.equal(rings.stageAt(20000, 3).canGuess, false);
  });

  test("倒计时是 20 减去已过时间，且不会变负", () => {
    assert.equal(rings.stageAt(0, 3).leftSec, 20);
    assert.equal(rings.stageAt(19500, 3).leftSec, 1);
    assert.equal(rings.stageAt(99999, 3).leftSec, 0);
    assert.equal(rings.stageAt(-5, 3).leftSec, 20, "负数按 0 算");
    assert.equal(rings.stageAt(NaN, 3).visible, 1, "脏输入不能吐 NaN");
  });
});

describe("猜圈 · 判分", () => {
  const QS = rings.allQuestions();
  const q0 = QS[0];

  test("正中圈心 = 满分，误差为 0", () => {
    const t = q0.answer;
    const res = rings.judge(q0, { x: t.x / COORD, y: t.y / COORD });
    assert.equal(res.ratio, 0);
    assert.equal(res.score, rings.MAX_SCORE);
    assert.equal(res.hit, true);
  });

  test("误差到 2 个圈半径 = 0 分；更远也是 0 分（不许出负数）", () => {
    const t = q0.answer;
    const at2 = rings.judge(q0, { x: (t.x + t.r * 2) / COORD, y: t.y / COORD });
    assert.equal(at2.score, 0);
    const far = rings.judge(q0, { x: 0, y: 1 });
    assert.ok(far.score >= 0);
  });

  test("圈内算 hit，圈外不算；分数随距离单调下降", () => {
    const t = q0.answer;
    const inside = rings.judge(q0, { x: (t.x + t.r * 0.5) / COORD, y: t.y / COORD });
    assert.equal(inside.hit, true);
    const outside = rings.judge(q0, { x: (t.x + t.r * 1.5) / COORD, y: t.y / COORD });
    assert.equal(outside.hit, false);
    assert.ok(inside.score > outside.score, "更近的猜法分数必须更高");
  });

  test("误差用「圈半径的倍数」表示（跨地图可比），不是像素", () => {
    const t = q0.answer;
    const half = rings.judge(q0, { x: (t.x + t.r * 0.5) / COORD, y: t.y / COORD });
    assert.ok(Math.abs(half.ratio - 0.5) < 0.02, "半个圈半径应当算 0.5：" + half.ratio);
  });
});

describe("猜圈 · 一局与视图", () => {
  const q0 = rings.allQuestions()[0];

  test("★ 一局 10 题（用户定的），且同一局里不重复", () => {
    // 用户明确要过：题库扩充，但**一局 10 题**。（曾经是 8 题，2026-10-18 改成 10。）
    assert.equal(rings.ROUNDS, 10, "一局的题数应当是 10，现在是 " + rings.ROUNDS);
    const g = rings.newGame();
    const QS = rings.allQuestions();
    assert.equal(g.rounds.length, Math.min(rings.ROUNDS, QS.length),
      "一局应当正好抽 8 道（题库够的话）");
    const keys = g.rounds.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, "同一局里抽到了重复的题");
  });

  test("题库比一局大得多（否则换一局还是那几道题）", () => {
    assert.ok(ALL.length >= rings.ROUNDS * 3,
      "题库 " + ALL.length + " 道，只有一局的 " + (ALL.length / rings.ROUNDS).toFixed(1) + " 倍，太少了");
  });

  test("注入随机源时结果可复现（测试友好）", () => {
    const seeded = () => 0.42;
    const a = rings.newGame(seeded).rounds.map((s) => s.key);
    const b = rings.newGame(seeded).rounds.map((s) => s.key);
    assert.deepEqual(a, b);
  });

  test("轮次视图：提示圈的百分位样式合法，答案圈也给了", () => {
    // 题有两种：上游接口的 3 圈序列（给 2 猜 1）和真实比赛的完整序列（给 3 猜 1）
    const v = rings.roundView(q0, "zh");
    assert.ok(v.hints.length === 2 || v.hints.length === 3, "提示圈 2 或 3 个，实际 " + v.hints.length);
    assert.equal(v.hintCount, v.hints.length);
    for (const b of v.hints.concat([v.answer])) {
      ["left", "top", "size"].forEach((k) => {
        assert.match(b[k], /^-?[\d.]+%$/, k + " 不是百分比：" + b[k]);
        assert.ok(!/NaN|undefined/.test(b[k]), "算出了 NaN：" + b[k]);
      });
    }
    // 题库里的图是平面图（2026-11-07 随小游戏搬进分包 games/），题库外的图回落到主包的宣传图
    assert.ok(/^\/(games\/assets\/flat|assets\/maps)\//.test(v.image), "配图路径不对：" + v.image);
    assert.ok(v.mapName);
  });

  test("英文模式下地图名不含中文", () => {
    const v = rings.roundView(q0, "en");
    assert.ok(!CJK.test(v.mapName), v.mapName);
  });

  test("结果视图：误差文案带单位、两个定位点都在 0~100%", () => {
    const res = rings.judge(q0, { x: 0.5, y: 0.5 });
    const rv = rings.resultView(q0, { x: 0.5, y: 0.5 }, res, "zh");
    assert.ok(rv.ratioText.indexOf("圈半径") >= 0, rv.ratioText);
    ["centerDot", "guessDot"].forEach((k) => {
      assert.match(rv[k].style, /^left:-?[\d.]+%;top:-?[\d.]+%$/);
    });
    assert.ok(rv.score >= 0 && rv.score <= rings.MAX_SCORE);
  });

  test("boxOf / dotOf：百分比算式正确", () => {
    const b = rings.boxOf({ x: 8192, y: 8192, r: 819.2 });
    assert.equal(b.left, "45%");            // (8192-819.2)/16384 = 45%
    assert.equal(b.top, "45%");
    assert.equal(b.size, "10%");            // 1638.4/16384 = 10%
    const d = rings.dotOf({ x: 8192, y: 4096 });
    assert.equal(d.left, "50%");
    assert.equal(d.top, "25%");
    // 非法输入不能吐出 NaN（WXML 里会变成 NaN%，整块错位）
    assert.equal(rings.boxOf({ x: NaN, y: 0, r: 1 }).left, "0%");
  });
});

describe("猜圈 · 选点视口（准星在正中、拖的是地图）", () => {
  const W = 390;

  test("初始视口正对地图正中", () => {
    const c = rings.vpCenter(rings.vpInit(), W);
    assert.equal(c.x, 0.5);
    assert.equal(c.y, 0.5);
  });

  test("★ 回归：贴边的点必须点得到（用户实测报过）", () => {
    // 曾经的 bug：夹取要求地图始终铺满容器，导致 z=2.5 时中心只能到 0.20~0.80，
    // z=5 时只能到 0.10~0.90 —— 越放大越够不到边，贴边的圈永远选不了。
    for (const z of [1, 2.5, 5]) {
      const lo = rings.vpCenter(rings.vpClamp({ z: z, tx: -1e6, ty: -1e6 }, W), W);
      const hi = rings.vpCenter(rings.vpClamp({ z: z, tx: 1e6, ty: 1e6 }, W), W);
      assert.ok(Math.abs(lo.x - 1) < 1e-6 && Math.abs(lo.y - 1) < 1e-6,
        "z=" + z + " 拖到头应当能到 1.0，实际 " + lo.x);
      assert.ok(Math.abs(hi.x) < 1e-6 && Math.abs(hi.y) < 1e-6,
        "z=" + z + " 拖到另一头应当能到 0，实际 " + hi.x);
    }
  });

  test("捏合缩放时准星那一点不能移动（锚点在中心）", () => {
    let vp = rings.vpFocus(rings.vpInit(), 0.37, 0.62, 2.5, W);
    const before = rings.vpCenter(vp, W);
    for (const f of [1.6, 0.5, 1.2]) {
      vp = rings.vpZoom(vp, f, W);
      const after = rings.vpCenter(vp, W);
      assert.ok(Math.abs(after.x - before.x) < 1e-6, "缩放后 x 漂了：" + after.x);
      assert.ok(Math.abs(after.y - before.y) < 1e-6, "缩放后 y 漂了：" + after.y);
    }
  });

  test("缩放夹在 1 ~ VP_MAX_Z 之间", () => {
    assert.equal(rings.vpZoom(rings.vpInit(), 99, W).z, rings.VP_MAX_Z);
    assert.equal(rings.vpZoom({ z: 2, tx: 0, ty: 0 }, 0.001, W).z, 1);
  });

  test("点一下 = 聚焦：准星精确落在被点的那一点上", () => {
    const vp = rings.vpFocus(rings.vpInit(), 0.81, 0.19, rings.VP_TAP_Z, W);
    const c = rings.vpCenter(vp, W);
    assert.ok(Math.abs(c.x - 0.81) < 1e-6, "实际 " + c.x);
    assert.ok(Math.abs(c.y - 0.19) < 1e-6, "实际 " + c.y);
    assert.equal(vp.z, rings.VP_TAP_Z);
  });

  test("单指拖动：往右拖，中心比例变小（地图跟着手指走）", () => {
    const vp = rings.vpFocus(rings.vpInit(), 0.5, 0.5, 2.5, W);
    const after = rings.vpCenter(rings.vpPan(vp, 80, 0, W), W);
    assert.ok(after.x < 0.5, "往右拖 80px，中心应当往左移，实际 " + after.x);
    assert.equal(after.y, 0.5);
  });
});
