// 圈型速判（miniprogram/games/utils/ringpick.js）的单元测试。
//
// 这个模块只做三件事：从真实序列里出题、算四个候选方向、算视口（放大/平移）。
// 三件事都有"错了也不报错、只是看着不对"的失败方式，所以逐条钉住：
//   1. 题库里混进"圆心几乎没动"的题 → 四个点挤成一团、点不准；
//   2. 候选点摆到地图外 → 有一个字母根本看不见，等于三选一；
//   3. 视口平移没夹住 → 底图边上露出空白，像地图缺了一块。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);
const rp = require(path.join(MP, "games", "utils", "ringpick.js"));
const rings = require(path.join(MP, "games", "utils", "rings.js"));

const K = 686 / 16384;      // 1 个地图单位 = 多少 rpx（未放大时）；和 ringpick.js 的 BOX 一致

const pct = (style, key) => Number(String(style).match(new RegExp(key + ":([-0-9.]+)%"))[1]);

/** 用固定种子的假随机，测试才能复现 */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("圈型速判 · 题库", () => {
  test("题库来自真实序列，够玩很久，且覆盖到每张有图的图", () => {
    const bank = rp.bank();
    // 2026-10-25：按「第 1 圈半径」做版本自检后，旧版社区数据全部剔除，
    // 题库从 923 缩到 166（去重后更少）。门槛跟着现实下调，但仍要够玩。
    assert.ok(bank.length >= 120, "题库太小：只有 " + bank.length + " 道");
    const maps = [...new Set(bank.map((q) => q.map))].sort();
    assert.ok(maps.length >= 4, "至少要有四张图，实际：" + maps.join(","));
    // 每道题的底图都必须在包里（不然界面是一块空白）
    const missing = bank.filter((q) => {
      const p = rings.mapImage(q.map);
      return !p || !existsSync(path.join(MP, p.replace(/^\//, "")));
    }).map((q) => q.key);
    assert.deepEqual(missing, [], "这些题的底图不在包里：" + missing.join(","));
  });

  test("每道题都是「第一圈 + 真实的第二圈」，且第二圈落在第一圈里", () => {
    // 这是整个玩法的前提：候选点摆在内切轨迹上，玩家只猜方向。
    const bad = rp.bank().filter((q) => {
      if (!(q.ring.r > 0 && q.answer.r > 0)) return true;
      // Apex 的圈本来就是**相切**的（内圈正好顶到外圈边缘），取整误差会有几个单位，
        // 所以容差按半径的 1% 算，而不是固定 2 个坐标单位。
        return dist(q.ring, q.answer) + q.answer.r > q.ring.r + q.ring.r * 0.01;
    }).map((q) => q.key + "@" + q.map);
    assert.deepEqual(bad, [], "这些题的第二圈没落在第一圈里：" + bad.slice(0, 5).join(","));
  });

  test("圆心移动太小的题被剔掉了（否则四个点会挤成一团）", () => {
    const tooClose = rp.bank().filter((q) => dist(q.ring, q.answer) < 1000).map((q) => q.key);
    assert.deepEqual(tooClose, [], "这些题的圆心几乎没动：" + tooClose.join(","));
  });

  test("抽一局：5 道不重复的题，而且不会连着两题同一张图", () => {
    for (let k = 0; k < 20; k++) {
      const game = rp.newGame(seeded(k + 1));
      assert.equal(game.length, rp.ROUNDS);
      assert.equal(new Set(game.map((q) => q.key)).size, rp.ROUNDS, "同一局里出现了重复的题");
      for (let i = 1; i < game.length; i++) {
        assert.notEqual(game[i].map, game[i - 1].map, "连着两题同一张图");
      }
    }
  });
});

describe("圈型速判 · 一道题的四个选项", () => {
  const bank = rp.bank();

  test("四个选项、A~D、只有一个是对的", () => {
    bank.forEach((q) => {
      const v = rp.view(q, "zh", seeded(7));
      assert.equal(v.options.length, 4);
      assert.deepEqual(v.options.map((o) => o.label), ["A", "B", "C", "D"]);
      assert.equal(v.options.filter((o) => o.correct).length, 1, q.key);
      assert.equal(v.options[v.answerIndex].correct, true, q.key + " 的 answerIndex 指错了");
    });
  });

  test("对的那个点正好压在真实圈心上（揭晓时圈和点不能错位）", () => {
    const worst = { key: "", d: 0 };
    bank.forEach((q) => {
      const v = rp.view(q, "zh", seeded(11));
      const a = v.answer.style;
      const cx = pct(a, "left") + pct(a, "width") / 2;
      const cy = pct(a, "top") + pct(a, "height") / 2;
      const o = v.options[v.answerIndex];
      const d = Math.hypot(pct(o.style, "left") - cx, pct(o.style, "top") - cy);
      if (d > worst.d) { worst.d = d; worst.key = q.key; }
    });
    // 允许 style 保留三位小数的误差（0.5% 以内 = 3.4rpx）
    assert.ok(worst.d < 0.5, "最歪的一题偏了 " + worst.d.toFixed(2) + "%（" + worst.key + "）");
  });

  test("四个点都在同一个半径上 ——「方向」才是要猜的东西", () => {
    bank.forEach((q) => {
      const v = rp.view(q, "zh", seeded(3));
      const r0 = Math.hypot(v.options[0].x - q.ring.x, v.options[0].y - q.ring.y);
      v.options.forEach((o) => {
        const r = Math.hypot(o.x - q.ring.x, o.y - q.ring.y);
        assert.ok(Math.abs(r - r0) < 1, q.key + " 的候选点不在同一圈上");
      });
    });
  });

  test("四个点在地图内、彼此不挨着（屏幕上至少 96rpx，热区才不会互相压住）", () => {
    let minChord = Infinity;
    bank.forEach((q) => {
      const v = rp.view(q, "zh", seeded(5));
      const pts = v.options.map((o) => ({ l: pct(o.style, "left"), t: pct(o.style, "top") }));
      pts.forEach((p) => {
        assert.ok(p.l > 0 && p.l < 100 && p.t > 0 && p.t < 100, q.key + " 有候选点跑到地图外");
      });
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const chord = Math.hypot(pts[i].l - pts[j].l, pts[i].t - pts[j].t) * 6.86; // 1% = 6.86rpx
          minChord = Math.min(minChord, chord);
        }
      }
    });
    assert.ok(minChord >= 96, "最近的两个点只隔 " + minChord.toFixed(1) + "rpx（热区 96rpx 会叠住）");
  });

  test("底图铺满整个框（放大后不能在某条边露出空白）", () => {
    bank.forEach((q) => {
      const v = rp.view(q, "zh", seeded(13));
      const m = v.world.match(/translate\(([-0-9.]+)%,([-0-9.]+)%\) scale\(([\d.]+)\)/);
      assert.ok(m, "world style 解析不出来：" + v.world);
      const tx = Number(m[1]) / 100;
      const ty = Number(m[2]) / 100;
      const z = Number(m[3]);
      assert.ok(z >= 1, q.key + " 的放大倍数应当 ≥1");
      assert.ok(tx <= 0.0005 && tx + z >= 0.9995, q.key + " 横向没铺满");
      assert.ok(ty <= 0.0005 && ty + z >= 0.9995, q.key + " 纵向没铺满");
    });
  });

  test("同一个种子出同一道题（可复现，测试才有意义）", () => {
    const q = bank[0];
    const a = rp.view(q, "zh", seeded(99));
    const b = rp.view(q, "zh", seeded(99));
    assert.deepEqual(a.options.map((o) => o.style), b.options.map((o) => o.style));
    assert.equal(a.answerIndex, b.answerIndex);
  });

  test("切语言只换图名，不动几何", () => {
    const q = bank[0];
    const zh = rp.view(q, "zh", seeded(4));
    const en = rp.view(q, "en", seeded(4));
    assert.equal(en.image, zh.image);
    assert.deepEqual(en.options.map((o) => o.label), zh.options.map((o) => o.label));
    assert.notEqual(en.mapName, zh.mapName);
    assert.ok(!/[\u4e00-\u9fff]/.test(en.mapName), "英文模式下图名还是中文：" + en.mapName);
  });
});

describe("圈型速判 · 判定与常量", () => {
  test("选中对的那个 = hit，且误差为 0；选别的 = 不 hit，误差 > 0", () => {
    const q = rp.bank()[0];
    const v = rp.view(q, "zh", seeded(21));
    const right = rp.judge(v, v.answerIndex);
    assert.equal(right.hit, true);
    assert.ok(right.off < 0.01, "答对了误差应当是 0，实际 " + right.off);

    const wrongIndex = (v.answerIndex + 1) % 4;
    const wrong = rp.judge(v, wrongIndex);
    assert.equal(wrong.hit, false);
    assert.ok(wrong.off > 0.5, "选错的误差应当明显大于 1 个圈半径的一半，实际 " + wrong.off);
    // 越界索引不崩
    assert.equal(rp.judge(v, 9).hit, false);
    assert.equal(rp.judge(v, -1).hit, false);
  });

  test("常量：5 题、10 秒、每题 20 分", () => {
    assert.equal(rp.ROUNDS, 5);
    assert.equal(rp.T_ANSWER, 10000);
    assert.equal(rp.PER_SCORE, 20);
    assert.equal(rp.ROUNDS * rp.PER_SCORE, 100, "满分应当是 100");
  });

  test("候选点之间的角度间隔至少 70°（不会两个字母叠在一个位置）", () => {
    const q = rp.bank()[3];
    const v = rp.view(q, "zh", seeded(31));
    const angles = v.options.map((o) => Math.atan2(o.y - q.ring.y, o.x - q.ring.x));
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        let d = Math.abs(angles[i] - angles[j]) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        assert.ok(d >= (70 * Math.PI) / 180 - 1e-6, "间隔只有 " + ((d * 180) / Math.PI).toFixed(1) + "°");
      }
    }
    void K;
  });
});
