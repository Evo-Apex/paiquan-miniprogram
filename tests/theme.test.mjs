// 深色 / 浅色主题（miniprogram/utils/theme.js + app.wxss 的 CSS 变量）的测试。
//
// 主题最容易出的问题不是"某个颜色不好看"，而是**漏了一个变量** ——
// 浅色下那一块仍是深色底，或者干脆变成透明/继承色，肉眼很难定位。
// 所以这里重点用静态检查把"两套变量必须完全对齐"钉死。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const theme = require(path.resolve(HERE, "..", "miniprogram", "utils", "theme.js"));

const WXSS = readFileSync(path.resolve(HERE, "..", "miniprogram", "app.wxss"), "utf8");

/** 取出某段 CSS 块里的变量定义 */
function varsOf(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** 取出变量名（用于"用到就必须有定义"那条检查） */
function namesOf(block) {
  return [...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

// 深色变量定义在第一个 page{} 块里，浅色在 .wrap.theme-light{} 里。
// 找规则要带上大括号 —— 光找 ".wrap.theme-light" 会命中上面注释里的那处（踩过）。
const lightIdx = WXSS.indexOf(".wrap.theme-light {");
const darkBlock = WXSS.slice(0, lightIdx);
const LIGHT = varsOf(WXSS.slice(lightIdx, lightIdx + 1500));
const DARK = varsOf(darkBlock);

// 基础 page{} 块（浅色块**之后**那个）：排版 / 间距 / 圆角令牌定义在这里。
// 这类令牌**不随主题变**，所以不要求两套主题各写一遍（写了反而是重复）。
// 但它们必须真的被定义 —— 否则 var(--fs-min) 取不到值，字号会静默失效。
const baseBlock = WXSS.slice(lightIdx);
const BASE_NAMES = new Set(namesOf(baseBlock));

describe("主题 · 切换逻辑", () => {
  test("默认深色，能切换，认不出的主题回落深色", () => {
    theme.setTheme("dark");
    assert.equal(theme.getTheme(), "dark");
    assert.equal(theme.setTheme("light"), "light");
    assert.equal(theme.getTheme(), "light");
    assert.equal(theme.setTheme("neon"), "dark");
    assert.equal(theme.getTheme(), "dark");
  });

  test("跟随系统（2026-11-08）：主题跟着手机走；手机切换时跟着换；直接选深色 / 浅色就不再跟随", () => {
    const calls = [];
    let sys = "dark";
    global.wx = {
      getAppBaseInfo: () => ({ theme: sys }),
      setNavigationBarColor: (o) => calls.push(o), setBackgroundColor: () => {}, setTabBarStyle: () => {},
    };
    try {
      assert.equal(theme.setMode("system"), "dark", "手机是深色");
      assert.equal(theme.getMode(), "system");
      sys = "light";
      assert.equal(theme.onSystemChange("light"), true, "手机切成浅色：跟着换");
      assert.equal(theme.getTheme(), "light");
      assert.equal(calls[calls.length - 1].frontColor, "#000000", "原生外壳也跟着换");
      assert.equal(theme.onSystemChange("light"), false, "没变就不动");
      assert.equal(theme.setTheme("dark"), "dark");
      assert.equal(theme.getMode(), "dark", "⚙ 面板里直接选深色 = 不再跟随");
      assert.equal(theme.onSystemChange("light"), false, "不跟随时手机切换不影响");
      assert.equal(theme.getTheme(), "dark");
      global.wx.getAppBaseInfo = () => ({});
      assert.equal(theme.setMode("system"), "light", "读不到手机的深浅色：按浅色");
      assert.equal(theme.setMode("rainbow"), "light", "认不出的模式当浅色（默认）");
    } finally {
      delete global.wx;
    }
  });

  test("原生外壳配色：frontColor 只能是 #ffffff / #000000（微信的硬要求）", () => {
    const calls = [];
    global.wx = {
      setNavigationBarColor: (o) => calls.push(["nav", o]),
      setBackgroundColor: (o) => calls.push(["bg", o]),
      setTabBarStyle: (o) => calls.push(["tab", o]),
    };
    try {
      theme.applyChrome("dark");
      let nav = calls.find((c) => c[0] === "nav")[1];
      assert.equal(nav.frontColor, "#ffffff", "深色主题的导航栏文字必须是纯白");
      assert.ok(calls.some((c) => c[0] === "bg"), "还要把回弹那层底色一起刷掉");
      assert.ok(calls.some((c) => c[0] === "tab"), "tabBar 配色也要跟着走");

      calls.length = 0;
      theme.applyChrome("light");
      nav = calls.find((c) => c[0] === "nav")[1];
      assert.equal(nav.frontColor, "#000000", "浅色主题的导航栏文字必须是纯黑");
      assert.notEqual(nav.backgroundColor, "#0d0f13", "浅色下不能再用深色导航栏");
    } finally {
      delete global.wx;
    }
    // 没有 wx 的环境（测试 / 网页版）不能抛错
    assert.doesNotThrow(() => theme.applyChrome("light"));
  });
});

describe("主题 · 两套变量必须完全对齐", () => {
  test("浅色定义了深色的每一个变量（漏一个浅色下就会有一块深色）", () => {
    // ⚠️ 只比"主题色"。排版 / 间距 / 圆角令牌（--fs-* / --fw-* / --sp-* / --r-*）
    // 不随主题变，只定义一次、两套主题共用，不要求浅色再抄一遍。
    const isShared = (k) => /^(fs|fw|sp|r)-/.test(k);
    const missing = Object.keys(DARK).filter((k) => !isShared(k) && !(k in LIGHT));
    assert.deepEqual(missing, [], "浅色主题缺这些变量：" + missing.join(", "));
  });

  test("变量用到了就必须有定义（否则 var() 取不到值是空的）", () => {
    // 去掉注释再找 var(--x)，免得把注释里举的例子算进来
    const code = WXSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const used = [...new Set([...code.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]))].sort();
    assert.ok(used.length >= 15, "应该有一整套变量，实际只找到 " + used.length + " 个");
    const missDark = used.filter((v) => !(v in DARK));
    const missLight = used.filter((v) => !(v in LIGHT));
    // 主题色必须两套都有；共享令牌只要求"定义过"，来源可以是基础 page 块
    const missShared = missDark.filter((v) => !BASE_NAMES.has(v));
    assert.deepEqual(missDark.filter((v) => !/^(fs|fw|sp|r)-/.test(v)), [], "深色缺定义：" + missDark.join(", "));
    assert.deepEqual(missShared, [], "这些变量哪里都没定义：" + missShared.join(", "));
    assert.deepEqual(missLight.filter((v) => !/^(fs|fw|sp|r)-/.test(v)), [], "浅色缺定义：" + missLight.join(", "));
  });

  test("两套值不许一模一样（那说明忘了改）", () => {
    // 有意两套一样的：强调红；首页大卡（2026-10-27）两套主题都是深色底，卡上的白字和琥珀色倒计时当然也一样
    const SAME_ON_PURPOSE = ["accent", "accent-ink", "hero-ink", "hero-warn"];
    const same = Object.keys(DARK).filter((k) => LIGHT[k] === DARK[k] && !SAME_ON_PURPOSE.includes(k));
    assert.deepEqual(same, [], "这些变量深浅两套取值相同，可能漏改：" + same.join(", "));
  });

  test("规则里不许再写死颜色（除了白色 —— 照片和彩底上的白字两个主题都成立）", () => {
    // 砍掉两个变量定义块，剩下的规则体里不该再有 6 位色值
    const rules = WXSS.slice(0, lightIdx) + WXSS.slice(lightIdx + 1500);
    const body = rules.replace(/--[a-z0-9-]+\s*:\s*[^;]+;/g, "");
    const hard = [...new Set([...body.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()))]
      .filter((c) => c !== "#ffffff");
    assert.deepEqual(hard, [], "这些色值还写死在规则里，切主题不会变：" + hard.join(", "));
  });

  test("page 和 .wrap 都要声明文字颜色（漏了 .wrap 会继承到深色值）", () => {
    // 踩过的坑：page 里的 color: var(--ink) 是在 **page 那一层** 算好的（深色的近白色），
    // 子元素继承的是算好的颜色而不是变量。浅色下 .sec-title / .plat-rp 这类
    // 没写 color 的文字就还是近白色 —— 白底上完全看不见。
    // 所以 .wrap 上必须再声明一次，让它们改从 .wrap 继承。
    // 注意：page{...} 有两处 —— 第一处是变量定义块（没有 color），
    // 带 color 的那处在浅色块**之后**，所以要往后找。
    const afterLight = WXSS.slice(lightIdx);
    const pageIdx = afterLight.indexOf("page {");
    assert.ok(pageIdx > 0, "没找到带 color 的 page 规则");
    assert.match(afterLight.slice(pageIdx, pageIdx + 400), /color:\s*var\(--ink\)/, "page 上要有文字颜色");

    const wrapIdx = WXSS.indexOf("\n.wrap {");
    assert.ok(wrapIdx > 0, "没找到 .wrap 规则");
    const wrapBlock = WXSS.slice(wrapIdx, wrapIdx + 800);
    assert.match(wrapBlock, /color:\s*var\(--ink\)/,
      ".wrap 上必须再声明一次 color —— 否则没写颜色的文字会继承 page 上算好的深色值，浅色下看不见");
    assert.match(wrapBlock, /background:\s*var\(--bg\)/, ".wrap 还要自己铺背景");
  });

  test("浅色下彩色文字都换成了深色版（直接搬深色那套白底上看不清）", () => {
    // 深色的绿 #3ddc84 在白底上对比度只有 1.9 左右，必须换深
    assert.notEqual(LIGHT.up, DARK.up);
    assert.notEqual(LIGHT.down, DARK.down);
    assert.notEqual(LIGHT.warn, DARK.warn);
    assert.notEqual(LIGHT["ok-ink"], DARK["ok-ink"]);
    assert.notEqual(LIGHT["info-ink"], DARK["info-ink"]);
  });
});
