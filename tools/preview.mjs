/**
 * WXML 预览器：把小程序页面按【真实 WXML + 真实 WXSS + 真实 data】渲染成一张 HTML，
 * 再用 Edge 无头截图，就能在改 UI 的时候自己看到效果。
 *
 * 为什么需要它：微信开发者工具是 GUI，这个环境里跑不了；没有它改 UI 就是盲改。
 *
 * 用法：
 *   node tools/preview.mjs <page> <lang> <theme> <outHtml> [playerId]
 *   例：node tools/preview.mjs predator zh dark out/preview.html
 *
 * 实现要点：
 *   · 页面 JS 用桩加载（Page / wx / setInterval），和 tests/page.test.mjs 同一套思路；
 *   · WXML 支持 wx:if / wx:elif / wx:else / wx:for / wx:key / {{表达式}} / <block>；
 *   · WXSS 的 rpx 按 750rpx = 屏宽 换算成 px；
 *   · /assets/... 的图片路径改写成 file:// 绝对路径，否则截图里全是空白。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);

/* 用法：node tools/preview.mjs <page> <lang> <theme> <outHtml> [选手id|-] [查谁|-] [表达式|-]
   ⚠️ 想跳过前面的可选参数时请传 `-` 而不是空串 ——
      PowerShell / cmd 会把空串参数直接丢掉，后面的参数就整体前移一位
      （第一次就这么中招：想查 demo，结果 demo 落到了"选手id"那一格）。 */
const args = process.argv.slice(2).map((a) => (a === "-" ? "" : a));
const [page, lang = "zh", theme = "dark", outFile = "preview.html",
  playerId = "", lookupName = "", callExpr = ""] = args;
const WIDTH = 390;                       // 渲染宽度（iPhone 12/13）
const RPX = WIDTH / 750;                 // 750rpx = 屏宽

/* ---------------- 1. 用桩把页面跑起来，拿到真实 data ---------------- */
global.setInterval = () => 0;
global.clearInterval = () => {};

/* 可选：用 PREVIEW_FIXTURE=<json 路径> 覆盖 rotation / predator 的桩数据。
   为什么加这个钩子：默认的 rotation 桩是**空的**（modes: []），
   于是地图页预览出来只有免责声明、没有卡片 —— 做宣传素材/截图时没法用。
   传一个 JSON 进来就能渲染出"有内容"的界面，默认行为完全不变。 */
let FIXTURE_OVERRIDE = {};
if (process.env.PREVIEW_FIXTURE) {
  try {
    FIXTURE_OVERRIDE = JSON.parse(fs.readFileSync(process.env.PREVIEW_FIXTURE, "utf8"));
    console.log("preview: 已加载 fixture 覆盖", Object.keys(FIXTURE_OVERRIDE).join(","));
  } catch (e) {
    console.error("preview: PREVIEW_FIXTURE 读取失败", e.message);
  }
}

const FIXTURES = {
  rotation: { ok: true, kind: "ok", message: "", data: { modes: [], unknownKeys: [] } },
  predator: { ok: true, kind: "ok", message: "", data: { group: { key: "RP", plats: [
    { code: "PC", label: "PC", rp: 20661, masters: 3564, predCount: 750, delta: 1240, deltaBasisAt: Date.now() - 86400000, updatedAt: Date.now() - 600000 },
    { code: "PS4", label: "PlayStation", rp: 19000, masters: 3000, predCount: 750 },
  ] } } },
  player: { ok: true, kind: "ok", message: "", data: { player: { name: "demo", platform: "PC",
    level: 255, rankName: "Apex Predator", rankScore: 21500, ladderPos: 137,
    season: "br_ranked_s30_s2", realtime: { online: true, inGame: true, legend: "Wraith" },
    banned: { active: false, reason: "" }, highlights: [] } } },
  teams: { ok: true, kind: "ok", message: "", data: { teams: [] } },
  stats: { ok: true, kind: "ok", message: "", data: {} },
  // 段位分布：形状照抄云函数 rankdist 的返回（8 个大段 + 各自占比/人数）。
  // 数字是 2026-10-16 用真接口跑出来的一份，量级真实，条形长短才像真的。
  rankdist: { ok: true, kind: "ok", message: "", data: {
    updatedAt: Date.now() - 3600000,
    total: 574025,
    tiers: [
      { key: "Rookie", pct: 1.55, players: 8897, subs: [] },
      { key: "Bronze", pct: 8.631, players: 49539, subs: [] },
      { key: "Silver", pct: 13.02, players: 74736, subs: [] },
      { key: "Gold", pct: 18.299, players: 105044, subs: [] },
      { key: "Platinum", pct: 27.11, players: 155611, subs: [] },
      { key: "Diamond", pct: 29.016, players: 166555, subs: [] },
      { key: "Master", pct: 1.829, players: 10501, subs: [] },
      { key: "Apex Predator", pct: 0.547, players: 3142, subs: [] },
    ] } },
};

// 覆盖钩子：只替换显式给了的键（rotation / predator / rankdist …）
Object.keys(FIXTURE_OVERRIDE).forEach((k) => { FIXTURES[k] = FIXTURE_OVERRIDE[k]; });

/* fixture 里的 start/end 写 0 表示"用相对时间"：把当前场设成 82 分钟前开始、38 分钟后结束，
   下一场顺延 —— 这样预览里的倒计时是活的（截图才有"还有 XX 分钟"可看）。
   ⚠️ 单位必须是**秒**：上游 /maprotation 给的是 epoch 秒，页面按秒算 cd。
      喂毫秒会让倒计时变成 497471019:11:55、active 判成 false（本轮踩过）。
   注意这只是**预览用的演示状态**，真机上的数字来自云函数实时数据。 */
(function patchRotationTimes() {
  const r = FIXTURES.rotation;
  if (!r || !r.data || !Array.isArray(r.data.modes)) return;
  const now = Math.floor(Date.now() / 1000);
  r.data.modes.forEach((m) => {
    const bump = (o, s, e) => { if (o && (!o.start || o.start === 0)) { o.start = now + s; o.end = now + e; } };
    bump(m.current, -82 * 60, 38 * 60);
    (m.nexts || []).forEach((n, j) => bump(n, 38 * 60 + j * 120 * 60, 158 * 60 + j * 120 * 60));
  });
})();

global.wx = {
  getWindowInfo: () => ({ statusBarHeight: 44, windowWidth: WIDTH, windowHeight: 844 }),
  getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32, left: WIDTH - 90, right: WIDTH - 10 }),
  getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: WIDTH, windowHeight: 844 }),
  setNavigationBarTitle: () => {}, setNavigationBarColor: () => {}, setTabBarItem: () => {},
  setTabBarStyle: () => {}, getStorageSync: () => ({}), setStorageSync: () => {},
  showToast: () => {}, hideLoading: () => {}, showLoading: () => {},
  /**
   * 量元素框的桩。页面用它在 onReady 里记下"地图占了哪块屏幕"，
   * 好把点击位置换算成相对坐标 —— 不给这个桩，猜圈页就完全点不动。
   * 这里固定返回一个铺满渲染宽度的正方形。
   */
  createSelectorQuery: () => {
    const node = {
      boundingClientRect(cb) {
        if (cb) cb({ left: 0, top: 0, width: WIDTH, height: WIDTH });
        return node;
      },
      exec() { return node; },
    };
    return { select: () => node, selectAll: () => node, exec() {} };
  },
  cloud: {
    /**
     * ⚠️ 必须同时支持**回调风格**：utils/cloud.js 用的是
     * `wx.cloud.callFunction({ ..., success, fail })`，只返回 Promise 的话
     * success 永远不会被调用 → 页面上所有网络驱动的区块**一个都渲染不出来**
     * （本工具之前就是这样：分数线、段位分布这类全空的，只有静态文案在）。
     */
    callFunction: (opts) => {
      const payload = (opts && opts.data) || {};
      const result = FIXTURES[payload.action] || FIXTURES.stats;
      if (opts && typeof opts.success === "function") {
        setTimeout(() => opts.success({ result }), 0);
        return undefined;
      }
      return Promise.resolve({ result });
    },
  },
};

let pageDef = null;
global.Page = (def) => { pageDef = def; };
// 分包里的页面写成 "pro/player" 这样带分包目录的名字（和 tests/static.test.mjs 同一个写法）
const PAGE_DIR = page.indexOf("/") >= 0 ? path.join(MP, page) : path.join(MP, "pages", page);
const PAGE_BASE = path.basename(page);
const pagePath = path.join(PAGE_DIR, PAGE_BASE + ".js");
if (!fs.existsSync(pagePath)) throw new Error("找不到页面 " + pagePath);
require(pagePath);

const inst = Object.assign({}, pageDef, {
  data: JSON.parse(JSON.stringify(pageDef.data || {})),
  /**
   * ★ 必须支持 WXML 路径语法：页面里大量 `setData({ "modes[0].cd": "3:40:32" })`。
   * 原来的 Object.assign 会把它存成字面键 "modes[0].cd"；接着 ev() 拿
   * Object.keys(scope) 当函数参数名 → `modes[0].cd` 不是合法标识符 → new Function 抛错
   * → 所有表达式求值为空 → 整个 wx:for 渲染成空（地图页就是这么"消失"的）。
   */
  setData(patch) {
    Object.keys(patch || {}).forEach((k) => {
      if (/[.[]/.test(k)) setPath(this.data, k, patch[k]);
      else this.data[k] = patch[k];
    });
  },
});

/** 把 "modes[0].cd" 这样的 WXML 路径写进对象 */
function setPath(obj, path, val) {
  const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = val;
}
// 语言/主题：页面从 i18n/theme 读，这里直接覆盖成想要的那套
const i18n = require(path.join(MP, "utils", "i18n.js"));
i18n.setLang(lang);
inst.data.lang = lang;
inst.data.T = i18n.T(lang);
inst.data.theme = theme;
inst.data.panelOpen = false;

// 页面的打开参数（如选手页的 ?page=Zer0）：PREVIEW_OPTIONS='{"page":"Zer0"}'
let LOAD_OPTIONS = {};
if (process.env.PREVIEW_OPTIONS) {
  try { LOAD_OPTIONS = JSON.parse(process.env.PREVIEW_OPTIONS); } catch (e) { console.error("preview: PREVIEW_OPTIONS 不是 JSON", e.message); }
}
inst.onLoad(LOAD_OPTIONS);
// onReady 也要跑：页面在那里量元素框（猜圈页记地图位置就靠它）
if (typeof inst.onReady === "function") inst.onReady();
if (playerId && inst.onProChip) inst.onProChip({ currentTarget: { dataset: { id: playerId } } });
// 可选：模拟"查一个人"，用来预览依赖玩家身份才出现的东西
// （比如段位分布里的「你在这里」那一档 —— 不查人就永远看不到它）
if (lookupName && inst.onPlayerInput && inst.onLookup) {
  inst.onPlayerInput({ detail: { value: lookupName } });
  inst.onLookup();
}
// 可选：跑一段表达式，用来预览"要点一下才出现"的状态。
//   例（猜圈页点一次地图，看判定结果）：
//     node tools/preview.mjs ringguessr zh dark out.html - - "inst.onTapMap({detail:{x:200,y:200}})"
if (callExpr) {
  try {
    new Function("inst", "i18n", "wx", callExpr)(inst, i18n, global.wx);
  } catch (e) {
    console.warn("preview call 失败：" + (e && e.message));
  }
}
await new Promise((r) => setTimeout(r, 300));   // 等云函数桩的 promise 落地

/* ---------------- 2. 极简 WXML 解析 ---------------- */
const VOID = new Set(["image", "input", "ad"]);
function parse(src) {
  const root = { tag: "#root", attrs: {}, kids: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([A-Za-z0-9_-]+)\s*>|<([A-Za-z0-9_-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const [full, close, open, attrs, self, text] = m;
    if (full.startsWith("<!--")) continue;
    if (close) {
      // ⚠️ WXML 里 <image ...></image> 是常见的写法，但 image/input 是自闭合元素、
      //    压根没入栈 —— 不回这里挡掉，</image> 会把父节点 pop 掉，
      //    后面的兄弟节点全跑到外面（第一版就是这么把名字和进度条弄丢的）。
      if (VOID.has(close)) continue;
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (open) {
      const node = { tag: open, attrs: {}, kids: [] };
      /**
       * ★ 属性必须支持**无值属性**：WXML 里 `<block wx:else>`、`<image lazy-load>`
       * 都是只有名字、没有 ="..." 的。老正则 `([name])\s*=\s*"([^"]*)"` 会把 wx:else
       * 直接丢掉 → renderKids 判不到 wx:else → if/else 两支全渲染
       * （地图页的卡片因此重复了一整块，是这轮才发现的老 bug）。
       */
      const ar = /([A-Za-z0-9_:-]+)(?:\s*=\s*"([^"]*)")?/g;
      let a;
      while ((a = ar.exec(attrs))) node.attrs[a[1]] = a[2] === undefined ? "" : a[2];
      stack[stack.length - 1].kids.push(node);
      if (!self && !VOID.has(open)) stack.push(node);
      continue;
    }
    if (text && text.trim()) stack[stack.length - 1].kids.push({ tag: "#text", text });
  }
  return root;
}

/* ---------------- 3. 渲染 ---------------- */
function ev(expr, scope) {
  try {
    const keys = Object.keys(scope);
    return new Function(...keys, "return (" + expr + ");")(...keys.map((k) => scope[k]));
  } catch (e) { return ""; }
}
function interp(str, scope) {
  if (str == null) return "";
  return String(str).replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
    const v = ev(e.trim(), scope);
    return v === undefined || v === null || v === false ? "" : String(v);
  });
}
const TAGMAP = { view: "div", text: "span", image: "img", "scroll-view": "div", block: null,
  picker: "div", input: "input", ad: null, navigator: "a", button: "button", "cover-view": "div" };

function render(node, scope) {
  if (node.tag === "#text") return esc(interp(node.text, scope));
  if (node.tag === "#root") return renderKids(node.kids, scope);

  const a = node.attrs;

  // ⚠️ WXML 里 wx:for 优先于 wx:if：同一元素上两个都有时，
  //    是"先循环、每个 item 再判条件"（例如 <image wx:if="{{item.hasX}}" wx:for="{{...}}">）。
  //    顺序写反了会在 item 还没绑定时求值 -> 整块消失。
  if (a["wx:for"] != null) {
    const raw = a["wx:for"];
    const expr = raw.startsWith("{{") ? raw.slice(2, -2) : raw;
    const list = ev(expr, scope) || [];
    const itemName = a["wx:for-item"] || "item";
    const idxName = a["wx:for-index"] || "index";
    return (Array.isArray(list) ? list : []).map((it, i) => {
      const sc = Object.assign({}, scope, { [itemName]: it, [idxName]: i });
      const clone = Object.assign({}, node, { attrs: Object.assign({}, a) });
      delete clone.attrs["wx:for"]; delete clone.attrs["wx:for-item"];
      delete clone.attrs["wx:for-index"]; delete clone.attrs["wx:key"];
      return render(clone, sc);
    }).join("");
  }

  if (a["wx:if"] != null && !ev(String(a["wx:if"]).replace(/^\{\{|\}\}$/g, ""), scope)) return "";

  const tag = TAGMAP[node.tag] === null ? null : (TAGMAP[node.tag] || node.tag);
  // ⚠️ 子节点必须走 renderKids（它负责 wx:if/elif/else 链）——
  //    直接用 render 会导致带 wx:if 的节点无条件渲染（第一版就这样，看到的全是假的）。
  const inner = renderKids(node.kids, scope);
  if (tag === null) return inner;   // <block>

  const attrs = [];
  const cls = interp(a.class || "", scope).trim();
  if (cls) attrs.push(`class="${esc(cls)}"`);
  const style = interp(a.style || "", scope);
  if (style) attrs.push(`style="${esc(style)}"`);
  if (node.tag === "image") {
    let src = interp(a.src || "", scope);
    if (src.startsWith("/")) src = "file:///" + MP.replace(/\\/g, "/") + src;
    attrs.push(`src="${esc(src)}"`);
    if (a.mode === "aspectFill") attrs.push('style="object-fit:cover"');
  }
  if (node.tag === "input") attrs.push(`placeholder="${esc(interp(a.placeholder || "", scope))}"`);
  return `<${tag} ${attrs.join(" ")}>${inner}</${tag}>`;
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/** 顶层渲染：处理 wx:if / wx:elif / wx:else 链 */
function renderKids(kids, scope) {
  let out = "";
  let lastCond = false;
  for (const k of kids) {
    if (k.tag === "#text") { out += render(k, scope); continue; }
    const a = k.attrs;
    if (a["wx:if"] != null) {
      lastCond = !!ev(a["wx:if"].replace(/^\{\{|\}\}$/g, ""), scope);
      if (lastCond) out += renderSiblings(k, scope);
      continue;
    }
    if (a["wx:elif"] != null) {
      if (lastCond) continue;
      lastCond = !!ev(a["wx:elif"].replace(/^\{\{|\}\}$/g, ""), scope);
      if (lastCond) out += renderSiblings(k, scope);
      continue;
    }
    if (a["wx:else"] != null) {
      if (!lastCond) out += renderSiblings(k, scope);
      lastCond = false;
      continue;
    }
    lastCond = false;
    out += render(k, scope);
  }
  return out;
}
function renderSiblings(node, scope) {
  const a = Object.assign({}, node.attrs);
  delete a["wx:if"]; delete a["wx:elif"]; delete a["wx:else"];
  return render(Object.assign({}, node, { attrs: a }), scope);
}

const wxml = fs.readFileSync(path.join(PAGE_DIR, PAGE_BASE + ".wxml"), "utf8");
const tree = parse(wxml);
let body = "";
try {
  body = renderKids(tree.kids, inst.data);
} catch (e) {
  console.error("RENDER ERROR:", e && e.stack ? e.stack.split("\n").slice(0,4).join(" | ") : e);
  throw e;
}

/* ---------------- 4. WXSS：rpx -> px ---------------- */
let css = fs.readFileSync(path.join(MP, "app.wxss"), "utf8");
const pageCss = path.join(PAGE_DIR, PAGE_BASE + ".wxss");
if (fs.existsSync(pageCss)) css += "\n" + fs.readFileSync(pageCss, "utf8");
// ⚠️ 必须带 m 标志：`page {` 都在行首，没有 m 的话 ^ 只匹配整个字符串开头，
//    结果一条都没替换到 —— 变量全失效、黑底黑字、截图全黑（我踩了两次）。
css = css.replace(/^page(\s*\{)/gm, "body$1");
css = css.replace(/([},])\s*page(\s*\{)/g, "$1body$2");
css = css.replace(/([\d.]+)rpx/g, (_, v) => (parseFloat(v) * RPX).toFixed(2) + "px");

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#000;}
  body{width:${WIDTH}px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;}
  img{display:block;}
  ${css}
</style></head><body>${body}</body></html>`;

fs.writeFileSync(outFile, html, "utf8");
console.log("wrote", outFile, html.length, "bytes; page =", page, lang, theme, playerId || "(all)");

