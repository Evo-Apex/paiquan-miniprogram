// 回归测试：**每一道题的圈都必须真的画得出来**。
//
// 背景（2026-10-17 用户实测报的"奥林匹斯的猜圈没显示第一圈"）：
//   完整序列那批数据（真实对局 + 社区环库）里每个圈是 [x, y, r] **数组**，
//   而 boxOf 读的是 {x, y, r} 对象 —— 数组上这些字段是 undefined，
//   boxOf 走 NaN 兜底算出 "0%"，圈被画成 0×0，屏幕上就是没有圈，而且**不报错**。
//   奥林匹斯题量最大，所以最先在那里被发现。
//
// 原来的用例只拿「上游三圈样本」（对象形式）测 roundView，所以完全没覆盖到这条。

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);
const rings = require(path.join(MP, "games", "utils", "rings.js"));

describe("猜圈 · 每一道题都画得出来", () => {
  const ALL = rings.allQuestions();

  test("题库里每个圈都是 {x,y,r} 数字（不是数组、不是 undefined）", () => {
    assert.ok(ALL.length > 0, "题库空了");
    for (const q of ALL) {
      for (const c of q.hints.concat([q.answer])) {
        assert.equal(typeof c.x, "number", q.key + " 的圈没有 x");
        assert.equal(typeof c.y, "number", q.key + " 的圈没有 y");
        assert.equal(typeof c.r, "number", q.key + " 的圈没有 r");
      }
    }
  });

  test("★ 每个圈算出来的尺寸都是正数百分比（0% = 图上根本看不见）", () => {
    for (const q of ALL) {
      const v = rings.roundView(q, "zh");
      v.hints.concat([v.answer]).forEach((b) => {
        assert.match(b.size, /^\d+(\.\d+)?%$/, q.key + " 尺寸异常：" + b.size);
        assert.ok(parseFloat(b.size) > 1, q.key + " 的圈太小（很可能没转成对象）：" + b.size);
        assert.ok(!/NaN|undefined/.test(b.style), q.key + " 的样式里有 NaN：" + b.style);
      });
    }
  });

  test("每道题的答案圈和提示圈不在同一个位置（否则答案提前露馅）", () => {
    for (const q of ALL) {
      const last = q.hints[q.hints.length - 1];
      const same = q.answer.x === last.x && q.answer.y === last.y && q.answer.r === last.r;
      assert.equal(same, false, q.key + " 的答案圈和最后一个提示圈完全相同");
    }
  });

  test("覆盖到 5 张图（含奥林匹斯 / 残月）", () => {
    const maps = new Set(ALL.map((q) => q.map));
    for (const m of ["storm-point", "worlds-edge", "e-district", "olympus", "broken-moon"]) {
      assert.ok(maps.has(m), "题库里没有 " + m + " 的题");
    }
  });

  test("★ 一局里相邻两题不会是同一张图（用户要求：测完马上换一张图）", () => {
    // 奥林匹斯占题库 69%，纯随机抽 8 道会连着一堆同一张图；
    // 现在是**按地图轮转抽**，所以一局里 5 张图都会出现、相邻必然不同图。
    for (let i = 0; i < 40; i++) {
      const g = rings.newGame().rounds;
      for (let k = 1; k < g.length; k++) {
        assert.notEqual(g[k].map, g[k - 1].map,
          "第 " + (k + 1) + " 题和上一题都是 " + g[k].map);
      }
      assert.ok(new Set(g.map((q) => q.map)).size >= 3,
        "一局只覆盖了 " + new Set(g.map((q) => q.map)).size + " 张图，太单调");
    }
  });

  test("★ 每道题都从第 1 圈开始（用户报过「一开局显示的就是二圈」）", () => {
    // 曾经的错：完整序列用滑动窗口出题（k=0,1,2…），于是有些题拿第 2、3 圈当起点，
    // 界面上就成了"一开始显示的是二圈"，和"第 0 秒出第 1 圈"的规则对不上。
    for (const q of ALL) {
      const hs = q.hints;
      assert.ok(hs[0].r >= hs[hs.length - 1].r, q.key + " 第一个提示圈不是最大的");
      for (let i = 1; i < hs.length; i++) {
        assert.ok(hs[i].r <= hs[i - 1].r, q.key + " 的提示圈半径在变大（起点不是第 1 圈）");
      }
      assert.ok(q.answer.r <= hs[hs.length - 1].r, q.key + " 的答案圈比最后一个提示圈还大");
    }
  });
});
