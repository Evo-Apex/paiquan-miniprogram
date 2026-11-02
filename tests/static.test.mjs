// 小程序静态一致性检查。
//
// 这些是"跑起来才会发现、但静默失败"的坑：
//   · WXML 里绑了一个页面根本没设的字段 —— 界面上那块永远是空白，不报错
//   · WXSS 里类名改过、WXML 没跟着改 —— 样式莫名失效，不报错
//   · require 路径写错 —— 只在真机/模拟器加载时才炸
// 微信开发者工具我这边跑不了，所以这些必须靠静态检查兜住。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const MP = path.join(ROOT, "miniprogram");
const require = createRequire(import.meta.url);

function walk(dir, filter) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

const read = (p) => readFileSync(p, "utf8");

/**
 * 检查源码文本前先去掉注释。
 * 不然"解释为什么不要这么写"的注释会把测试自己绊倒 ——
 * 我就在注释里写了 traceUser: true 做说明，结果测试误报。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")      // 块注释
    .replace(/^[ \t]*\/\/.*$/gm, "");      // 整行注释
}

/* ============================================================
   app.json 与实际文件是否对得上
   ============================================================ */
describe("隐私合规", () => {
  // traceUser: true 会把用户访问记录到云开发控制台的「用户管理」里，
  // 也就是把 openid 这类个人信息存下来了 —— 而本项目根本不需要用户身份。
  // 一旦"处理用户个人信息"，微信就要求配隐私保护指引、弹隐私授权框，纯属自找麻烦。
  test("云开发初始化不得开启 traceUser（本项目不需要用户身份）", () => {
    const src = stripComments(read(path.join(MP, "app.js")));
    assert.equal(/traceUser\s*:\s*true/.test(src), false,
      "不要开 traceUser：会把用户访问记录到用户管理，属于处理个人信息");
  });

  test("整份小程序代码里没有任何采集个人信息的接口", () => {
    const files = walk(MP, (p) => p.endsWith(".js"));
    const banned = [
      "getUserProfile", "getUserInfo", "getPhoneNumber", "getLocation",
      "chooseLocation", "chooseImage", "chooseMedia", "getClipboardData",
      "setClipboardData", "getWeRunData", "startRecord", "chooseAddress", "getUserCryptoManager",
    ];
    const hits = [];
    for (const f of files) {
      const src = read(f);
      for (const b of banned) if (src.includes(b)) hits.push(f.replace(ROOT, "") + " → " + b);
    }
    assert.deepEqual(hits, [], "出现了会触发隐私指引要求的接口：" + JSON.stringify(hits));
  });

  test("本地存储只准存界面偏好，且只准在 utils/prefs.js 里用", () => {
    // 口径变更（2026-10）：原来是"一处本地存储都不许用"。
    // 但语言/主题/展示哪些模式这类**界面偏好**存不下来体验太差（重启就回默认），
    // 所以收窄成：**只准存界面偏好，不含任何用户数据** ——
    // 没有 openid、没有查询记录、没有任何能定位到具体某个人的东西。
    const files = walk(MP, (p) => p.endsWith(".js"));
    const hits = files.filter((f) => /wx\.setStorage|wx\.getStorage|wx\.removeStorage/.test(read(f)));
    assert.deepEqual(hits.map((f) => path.basename(f)), ["prefs.js"],
      "只有 utils/prefs.js 能碰本地存储，别处要用一律走它");

    // 存进去的键必须在白名单里 —— 想存新东西就得先来这里加白名单并想清楚它是不是用户数据
    const allowed = new Set(["lang", "theme", "modes", "pin", "hide_pubs_hint"]);
    const used = new Set();
    files.forEach((f) => {
      for (const m of read(f).matchAll(/prefs\.set\(\s*"([a-z]+)"/g)) used.add(m[1]);
    });
    const bad = [...used].filter((k) => !allowed.has(k));
    assert.deepEqual(bad, [], "存了白名单之外的偏好：" + bad.join(", "));
    assert.ok(used.size >= 3, "应该至少有语言/主题/模式三类偏好，实际 " + used.size + " 个");
  });
});

describe("项目结构", () => {
  const appJson = JSON.parse(read(path.join(MP, "app.json")));

  test("app.json 里声明的每个页面都存在 .js/.wxml", () => {
    // 分包（2026-10-27 起有 evo：Evo 战绩的子页面）里的页面路径要加上分包的 root
    const sub = (appJson.subpackages || []).flatMap((p) => p.pages.map((x) => p.root + "/" + x));
    for (const page of appJson.pages.concat(sub)) {
      for (const ext of [".js", ".wxml"]) {
        const f = path.join(MP, page + ext);
        assert.ok(existsSync(f), "缺少页面文件 " + page + ext);
      }
    }
  });

  test("主包页面异步引用的分包组件：路径真实存在，且都配了占位组件", () => {
    // 「战绩」「我的」两个 tab 页用分包 evo 里的组件（主包只剩约 120 KB 余量）。
    // 跨分包引用必须配 componentPlaceholder，否则分包还没下载完时页面直接报错
    for (const page of appJson.pages) {
      const f = path.join(MP, page + ".json");
      if (!existsSync(f)) continue;
      const cfg = JSON.parse(read(f));
      for (const [name, target] of Object.entries(cfg.usingComponents || {})) {
        if (!/^\/evo\//.test(target)) continue;
        assert.ok(existsSync(path.join(MP, target + ".js")), page + " 引用的组件不存在：" + target);
        assert.ok(cfg.componentPlaceholder && cfg.componentPlaceholder[name],
          page + " 跨分包引用 " + name + " 却没配 componentPlaceholder");
      }
    }
  });

  test("project.config.json 里的 AppID 必须是真实 AppID，不能留着占位符", () => {
    // 留着占位符的话，开发者工具能打开项目但编译不了、云开发也用不了，
    // 而且报错信息不会明说"你 AppID 没填"。
    const pc = JSON.parse(read(path.join(ROOT, "project.config.json")));
    assert.equal(
      /^wx[0-9a-f]{16}$/.test(pc.appid || ""), true,
      "当前 appid = " + JSON.stringify(pc.appid) +
      "，需要填成真实 AppID（小程序后台 → 开发 → 开发管理 → 开发设置）"
    );
  });

  test("wx.cloud.init 必须显式传 env（官方文档标注 env 为必填）", () => {
    // 不传 env 时小程序端不知道连哪个云环境，真机/模拟器直接报
    // -601034「没有权限，请先开通云开发或者云托管」——
    // 而云函数在控制台里明明是好的，特别容易误判成"云开发没开通"。
    const src = stripComments(read(path.join(MP, "app.js")));
    assert.match(src, /wx\.cloud\.init\(\s*\{[\s\S]*?env\s*:/, "wx.cloud.init 必须传 env");

    const m = src.match(/CLOUD_ENV\s*=\s*["']([^"']+)["']/) || src.match(/env\s*:\s*["']([^"']+)["']/);
    assert.ok(m, "找不到环境 ID");
    assert.equal(/REPLACE|TODO|YOUR_|xxx/i.test(m[1]), false, "环境 ID 还是占位符：" + m[1]);
    assert.match(m[1], /^cloud\d+-[0-9a-z]{8,}$/i, "环境 ID 格式不对：" + m[1]);
  });

  test("project.config.json 的目录设置与实际布局一致", () => {
    const pc = JSON.parse(read(path.join(ROOT, "project.config.json")));
    assert.equal(pc.miniprogramRoot, "miniprogram/");
    assert.equal(pc.cloudfunctionRoot, "cloudfunctions/");
    assert.ok(existsSync(path.join(ROOT, pc.miniprogramRoot.replace(/\/$/, ""))), "miniprogramRoot 不存在");
    assert.ok(existsSync(path.join(ROOT, pc.cloudfunctionRoot.replace(/\/$/, ""))), "cloudfunctionRoot 不存在");
  });

  test("云函数目录下有 index.js 与 package.json（否则部署会失败）", () => {
    const dir = path.join(ROOT, "cloudfunctions", "apex");
    assert.ok(existsSync(path.join(dir, "index.js")));
    assert.ok(existsSync(path.join(dir, "package.json")));
    assert.ok(existsSync(path.join(dir, "handler.js")));
  });

  test("小程序端 JS 的 require 路径都能解析到真实文件", () => {
    const files = walk(MP, (p) => p.endsWith(".js"));
    assert.ok(files.length > 0);
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
        const target = path.resolve(path.dirname(f), m[1]);
        const exists = existsSync(target) || existsSync(target + ".js");
        assert.ok(exists, f.replace(ROOT, "") + " 里的 require('" + m[1] + "') 找不到文件");
      }
    }
  });
});

/* ============================================================
   tabBar（三个标签）
   ============================================================ */
describe("猜圈页：手势不许带得页面一起滚", () => {
  test("页面 json 里 disableScroll 必须是 true", () => {
    // 用户实测报过：在地图上拖，整个小程序跟着上下滑。
    // 这一页是单屏游戏，滚动永远是误操作，所以整页禁滚 + 地图上 catchtouchmove。
    const cfg = JSON.parse(read(path.join(MP, "pages", "ringguessr", "ringguessr.json")));
    assert.equal(cfg.disableScroll, true, "猜圈页必须 disableScroll，否则拖地图会把页面带着滚");
  });

  test("地图容器用 catch 接管 touchmove（bind 会漏给页面滚动）", () => {
    const wxml = read(path.join(MP, "pages", "ringguessr", "ringguessr.wxml"));
    assert.ok(/catchtouchmove="onTouchMove"/.test(wxml), "地图容器应当用 catchtouchmove");
    assert.ok(!/bindtouchmove="onTouchMove"/.test(wxml), "不要再用 bindtouchmove：它拦不住页面滚动");
  });
});

describe("底部标签", () => {
  const appJson = JSON.parse(read(path.join(MP, "app.json")));
  const bar = appJson.tabBar;

  test("配了 tabBar，且五个标签顺序是 首页 / 战绩 / 比赛 / 小游戏 / 我的", () => {
    assert.ok(bar, "app.json 里没有 tabBar");
    assert.equal(bar.list.length, 5);
    // 第 4 个：2026-10-16 从「战绩」换成「猜圈」，2026-10 又扩成「小游戏」分类
    //（里面是猜圈练习 + 英雄/武器轮盘，用户要求放在同一个分类下）。
    // 2026-10-27：第 2 个「排位专区」改叫「战绩」（顶部切换：我的战绩 ｜ 排位资讯），加了第 5 个「我的」（Evo 绑定）。
    // 2026-10-27（首页改版）：第 1 个从「地图」换成「首页」，地图页变成首页里点「全部地图」进去的子页面。
    // 微信的 tabBar 最多 5 个，已经满了。
    assert.deepEqual([...bar.list].map((t) => t.text), ["首页", "战绩", "比赛", "小游戏", "我的"]);
    assert.equal(bar.list[1].pagePath, "pages/predator/predator", "「战绩」还是原来排位专区那一页（排位资讯是它的一栏）");
  });

  test("「小游戏」是分类页：猜圈练习 / 圈型速判 / 轮盘都从它进去（而不是各占一个 tab）", () => {
    const games = bar.list[3];
    assert.equal(games.pagePath, "pages/games/games");
    assert.ok(appJson.pages.includes("pages/ringguessr/ringguessr"), "猜圈练习应当还在（作为子页）");
    assert.ok(appJson.pages.includes("pages/ringpick/ringpick"), "圈型速判没注册进 pages");
    assert.ok(appJson.pages.includes("pages/wheel/wheel"), "轮盘页没注册进 pages");
    // 子页不在 tabBar 里 —— 否则底部会多出几个标签（上限 5 个，也没必要）
    const tabPages = bar.list.map((t) => t.pagePath);
    assert.equal(tabPages.includes("pages/ringguessr/ringguessr"), false);
    assert.equal(tabPages.includes("pages/ringpick/ringpick"), false);
    assert.equal(tabPages.includes("pages/wheel/wheel"), false);
  });

  test("第一个标签就是默认首页（打开小程序先看到首页，地图轮换在首页上）", () => {
    assert.equal(appJson.pages[0], bar.list[0].pagePath);
    assert.equal(bar.list[0].pagePath, "pages/home/home");
  });

  test("地图页还在（首页点「全部地图」进去），但不再是 tab", () => {
    assert.ok(appJson.pages.includes("pages/maps/maps"), "地图页没注册进 pages");
    assert.equal(bar.list.some((t) => t.pagePath === "pages/maps/maps"), false);
  });

  test("每个标签的页面都在 pages 列表里", () => {
    for (const t of bar.list) {
      assert.ok(appJson.pages.includes(t.pagePath), t.text + " 的页面没在 pages 里：" + t.pagePath);
    }
  });

  test("图标文件真实存在，且必须是 81×81 的 PNG", () => {
    for (const t of bar.list) {
      for (const key of ["iconPath", "selectedIconPath"]) {
        const p = path.join(MP, t[key]);
        assert.ok(existsSync(p), t.text + " 的 " + key + " 找不到：" + t[key]);
        const buf = readFileSync(p);
        assert.equal(buf.slice(1, 4).toString("ascii"), "PNG", t[key] + " 不是 PNG");
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        assert.equal(w, 81, t[key] + " 宽度应为 81，实际 " + w);
        assert.equal(h, 81, t[key] + " 高度应为 81，实际 " + h);
      }
    }
  });

  test("选中与未选中是两张不同的图（否则点了没反馈）", () => {
    for (const t of bar.list) {
      assert.notEqual(t.iconPath, t.selectedIconPath, t.text + " 的两个图标路径一样");
    }
  });
});

/* ============================================================
   广告位
   ============================================================ */
describe("广告位", () => {
  test("三个页面的广告组件都有 wx:if 门闩（没配 ID 时一个像素都不该出现）", () => {
    for (const name of AD_PAGES) {
      const wxml = read(pageWxmlPath(name));
      const m = wxml.match(/<ad\b[^>]*>/);
      assert.ok(m, name + " 页面里没有 <ad> 组件");
      assert.match(m[0], /wx:if="\{\{adUnit\}\}"/,
        name + " 的 <ad> 必须用 wx:if 门控：unit-id 为空会让组件报错或留白");
      assert.match(m[0], /unit-id="\{\{adUnit\}\}"/, name + " 的 unit-id 必须绑定 adUnit");
    }
  });

  test("广告位放在页脚之前（在底部、不遮挡任何操作）", () => {
    for (const name of AD_PAGES) {
      const wxml = read(pageWxmlPath(name));
      const adAt = wxml.indexOf("<ad");
      const footAt = wxml.indexOf('class="foot"');
      assert.ok(adAt > 0 && footAt > 0, name + " 找不到广告位或页脚");
      assert.ok(adAt < footAt, name + " 的广告位应在页脚之前（页面最下方）");
    }
  });

  test("首页的广告在「现在玩什么」和「大家在玩什么」中间（用户 2026-10-27 定的）", () => {
    const wxml = read(pageWxmlPath("home"));
    const adAt = wxml.indexOf("<ad");
    assert.ok(wxml.indexOf('class="hsmalls"') < adAt, "广告应在现在玩什么的小卡之后");
    assert.ok(adAt < wxml.indexOf("<evo-crowd"), "广告应在大家在玩什么之前");
  });

  test("配了广告位就必须合法（填错会报错或留白；没配则允许）", () => {
    const ad = require(path.join(MP, "utils", "ad.js"));
    for (const name of AD_PAGES) {
      const raw = String(ad.AD_UNITS[name] == null ? "" : ad.AD_UNITS[name]).trim();
      if (!raw) continue;   // 没配 = 页面上什么都不出现，这是允许的状态
      assert.match(raw, /^adunit-[0-9a-z]+$/i, name + " 的广告位 ID 格式不对：" + raw);
      assert.equal(ad.adUnitFor(name), raw, name + " 的合法 ID 应该原样返回");
    }
  });

  test("广告位 ID 不能硬编码在页面里（只能来自 utils/ad.js）", () => {
    for (const name of PAGE_NAMES) {
      const js = read(pageJsPath(name));
      assert.equal(/adunit-/.test(js), false, name + " 页面里不该出现硬编码的广告位 ID");
    }
  });
});

/* ============================================================
   WXML 绑定的字段，页面/视图模型必须真的提供
   ============================================================ */
/* 带广告位和页脚的主页面：广告那几条规矩只对它们成立。
   （猜圈练习 / 轮盘 / 小游戏分类页是工具页，没有广告位也没有页脚 ——
    广告位多了反而把"取一个数就走"的路径变长，所以是**有意不加**。） */
// 2026-10-27：加了首页（home），广告位同样在页脚上方
// 2026-11-05 用户要求去掉比赛页广告，所以这里不再包含 matches。
const AD_PAGES = ["home", "maps", "predator"];
/* 需要做"通用正确性"检查的页面：WXML 绑定一致性、标签成对闭合、样式类有定义。
   新加的页面要加进来 —— 这几条正是抓"字段写错/标签没闭合/类名拼错"的网。
   （原来的 pages/mapview「交互地图」已删，所以这里也没有它了。） */
// 2026-10-27：加了「我的」（me）和分包 evo 里 Evo 战绩的三个子页面（写成 "evo/matches" 这样带分包目录的名字）
const PAGE_NAMES = AD_PAGES.concat(["games", "wheel", "ringguessr", "ringpick", "me", "evo/matches", "evo/match", "evo/bind"]);
const pageDir = (n) => (n.indexOf("/") >= 0 ? path.join(MP, n) : path.join(MP, "pages", n));
const pageBase = (n) => path.basename(n);
const pageJsPath = (n) => path.join(pageDir(n), pageBase(n) + ".js");
const pageWxmlPath = (n) => path.join(pageDir(n), pageBase(n) + ".wxml");
const pageWxssPath = (n) => path.join(pageDir(n), pageBase(n) + ".wxss");
/* 自定义组件（目前都是 Evo 战绩的，在分包 evo 里）：和页面一样做绑定一致性 / 标签闭合 / 样式类检查 */
// 2026-10-27：加了首页的两个（home：段位、今日、上一局；crowd：大家在玩什么）
const COMPONENT_NAMES = ["evo/components/overview", "evo/components/devices", "evo/components/home", "evo/components/crowd"];
const compPath = (n, ext) => path.join(MP, n, "index" + ext);

/** 读 wxss，把 @import 进来的文件也接上（Evo 的页面和组件共用 evo/evo.wxss） */
function readWxss(file) {
  if (!existsSync(file)) return "";
  const src = read(file);
  return src.replace(/@import\s+["']([^"']+)["'];?/g, (all, rel) => readWxss(path.resolve(path.dirname(file), rel)));
}

/** 用桩把某个组件加载起来，拿到 Component({properties, data}) 声明的字段 */
function compDataKeys(name) {
  let def = null;
  global.Component = (d) => { def = d; };
  global.wx = { cloud: { callFunction() {} }, stopPullDownRefresh() {} };
  const p = compPath(name, ".js");
  delete require.cache[require.resolve(p)];
  require(p);
  assert.ok(def, name + " 没有调用 Component()");
  return Object.keys(def.data || {}).concat(Object.keys(def.properties || {}));
}

/** 用桩把某个页面加载起来，拿到 Page({data}) 声明的字段 */
function pageDataKeys(name) {
  let def = null;
  global.Page = (d) => { def = d; };
  global.wx = { cloud: { callFunction() {} }, stopPullDownRefresh() {} };
  global.setInterval = () => 0;
  global.clearInterval = () => {};
  const p = pageJsPath(name);
  delete require.cache[require.resolve(p)];
  require(p);
  assert.ok(def, name + " 页面没有调用 Page()");
  return Object.keys(def.data);
}

/** 视图模型在各种情况下会产出的字段名 */
function vmFieldNames() {
  const vm = require(path.join(MP, "utils", "viewmodel.js"));
  const core = require(path.join(MP, "utils", "core.js"));
  const raw = {
    ranked: { current: { start: 1, end: 2, map: "Olympus" }, next: { start: 2, end: 3, map: "Broken Moon" } },
    battle_royale: { current: { start: 1, end: 2, map: "Broken Moon" }, next: { start: 2, end: 3, map: "Olympus" } },
    ltm: { current: { start: 1, end: 2, map: "Fragment", eventName: "TDM" }, next: { start: 2, end: 3, map: "Estates", eventName: "Control" } },
    wildcard: { current: { start: 1, end: 2, map: "E-District" }, next: { start: 2, end: 3, map: "Kings Canyon" } },
  };
  const keys = new Set();
  const collect = (o) => { if (o && typeof o === "object") Object.keys(o).forEach((k) => keys.add(k)); };

  vm.buildModes(core.normalizeRotation(raw)).forEach((m) => { collect(m); (m.nexts || []).forEach(collect); });
  collect(vm.buildPredator(core.normalizePredator({ RP: { PC: { val: 1, foundRank: 1, totalMastersAndPreds: 2 } } }))[0]);

  const full = {
    global: { name: "x", level: 1, levelPrestige: 2, platform: "PC", rankedSeason: "br_ranked_s30_s2",
              rank: { rankName: "Diamond", rankDiv: 2, rankScore: 3, ladderPosPlatform: 4 } },
    realtime: { online: false, inGame: false, selectedLegend: "Wraith", currentStateAsText: "Offline" },
    total: { kills: { name: "BR Kills", value: 1 } },
  };
  const np = core.normalizePlayer(full);
  collect(vm.buildPlayer(np));
  // ⚠️ 原来这里还登记了 vm.buildStats(np) 的字段（等级/在线状态/封禁/生涯条目）。
  // 战绩页 2026-10-16 整页删除后，那个 builder 也一起删了。
  collect(vm.errView("badkey", "x"));
  // 距猎杀线差额块。三种 kind 产出的字段名相同，取一种就够覆盖。
  collect(vm.buildPredGap(np, core.normalizePredator({ RP: { PC: { val: 1, foundRank: 1 } } }), "PC"));
  // 服务器状态。分组条目里的字段也要算进来（WXML 里是 item.statusText 这种写法）。
  const srv = vm.buildServers(core.normalizeServers({
    Origin_login: { Asia: { Status: "DOWN", ResponseTime: 8 } },
    otherPlatforms: { "Xbox-Live": { Status: "UP" } },
  }));
  collect(srv);
  (srv.groups || []).forEach(collect);
  // 战队专区。字段来自云函数 teams.js（经 buildTeams 兜底），同样要登记。
  vm.buildTeams([{ id: "x", name: "x", players: [
    { uid: "1", ign: "x", name: "x", input: "x", nation: "x", rankName: "x", rankScore: 1, rankScoreText: "1", level: 1 },
  ] }]).forEach((t) => { collect(t); (t.players || []).forEach(collect); });
  // ⚠️ 原来这里还登记了「英雄选取率」和「职业热门组合」的字段。
  // 2026-10-16 用户要求把那两块从战绩页删掉（排位专区里已经有职业选手的
  // 英雄选取 / 三人英雄组合），对应的 builder 和云函数调用也一起删了。

  // 排位专区（职业选手排位数据）。这份数据是**本地离线识别**出来的
  // （prostats_data.js），不经过云函数，但同样是 WXML 绑定的来源，必须登记。
  const prostats = require(path.resolve(HERE, "..", "miniprogram", "utils", "prostats.js"));
  const proView = prostats.buildAll("__all__", "zh");
  collect(proView);                       // updatedText / chips / active / stat
  proView.chips.forEach(collect);
  collect(proView.stat);
  collect(proView.stat.headline);
  collect(proView.stat.headline.hero);
  collect(proView.stat.headline.pair);
  collect(proView.stat.headline.sample);
  proView.stat.topHeroes.forEach(collect);
  proView.stat.restHeroes.forEach(collect);
  proView.stat.combos.forEach(collect);
  proView.stat.weapons.forEach(collect);
  proView.stat.pairs.forEach(collect);

  // ⚠️ 2026-10-18 用户要求去掉「版本图鉴」（英雄 + 枪械样本），
  //    utils/codex.js 与它的字段登记一起删了。codex_data.js 还在
  //    （prostats / algs 用它的头像与译名），别顺手删错。

  // ALGS 职业赛场（官方赛事快照）。同样是本地离线数据，嵌套层数最多，逐层登记。
  const algs = require(path.resolve(HERE, "..", "miniprogram", "utils", "algs.js"));
  const algsView = algs.buildAll("", "zh");
  collect(algsView);
  algsView.chips.forEach(collect);
  collect(algsView.ev);
  algsView.ev.legends.forEach(collect);
  algsView.ev.combos.forEach(collect);
  algsView.ev.standings.forEach(collect);

  // 比赛专区 · 下一场比赛（赛程 / 分组 / 队员，离线快照）。四层嵌套，逐层登记。
  const nextmatch = require(path.resolve(HERE, "..", "miniprogram", "utils", "nextmatch.js"));
  const nextView = nextmatch.build("zh", Date.now(), "A");
  collect(nextView);
  nextView.slots.forEach(collect);
  nextView.groups.forEach(collect);
  nextView.teams.forEach((t) => { collect(t); t.players.forEach(collect); });
  nextView.untimed.forEach(collect);
  collect(nextView.format);
  (nextView.format ? nextView.format.lines : []).forEach(collect);
  // 队员弹层：字段由页面 onTeam 组装，不在视图模型里 —— 同样要登记
  collect({ name: "x", icon: "", hasIcon: true, groupName: "x", countText: "x", hasPlayers: true, players: [] });
  collect({ name: "x", meta: "x" });

  // 本赛季段位分布（网络数据，来自云函数 rankdist）。嵌套结构同上。
  const rankdist = require(path.resolve(HERE, "..", "miniprogram", "utils", "rankdist.js"));
  const rankView = rankdist.build({
    updatedAt: 1, total: 100,
    tiers: [{ key: "Diamond", pct: 28.8, players: 100, subs: [] }]
  }, { rankName: "Diamond" }, "zh");
  collect(rankView);
  collect(rankView.mine);
  rankView.rows.forEach(collect);

  // 猜圈练习（本地圈数据，见 utils/rings.js）。视图模型给的那些框也是 WXML 绑定的来源。
  // ⚠️ 2026-10-16 改成"题"模型：roundView/judge 收的是 {map,hints,answer} 而不是旧的样本。
  const rings = require(path.resolve(HERE, "..", "miniprogram", "utils", "rings.js"));
  const allQ = rings.allQuestions();
  const ringQ = allQ[0] || {
    map: "storm-point",
    hints: [{ x: 1, y: 1, r: 1 }, { x: 1, y: 1, r: 1 }],
    answer: { x: 1, y: 1, r: 1 }
  };
  const ringRound = rings.roundView(ringQ, "zh");
  collect(ringRound);
  ringRound.hints.forEach(collect);
  collect(ringRound.answer);
  const ringRes = rings.resultView(ringQ, { x: 0.5, y: 0.5 },
    rings.judge(ringQ, { x: 0.5, y: 0.5 }), "zh");
  collect(ringRes);
  collect(ringRes.centerDot);
  collect(ringRes.guessDot);
  rings.endZones(ringQ.map).forEach(function (e) { collect(rings.boxOf(e)); });


  // 轮换时间表（玩法外推 + 后台记录的场次）。嵌套结构，分组和行都要登记。
  const sched = vm.buildSchedule(
    [{ mode: "mixtape", map: "x", start: 1 }],
    { start: 0, event: "Gun Run" },
    Date.now(),
    "zh"
  );
  sched.forEach((g) => { collect(g); (g.rows || []).forEach(collect); });

  // Evo 战绩（2026-10-27，分包 evo）：evo/utils/view.js 拼出来的字段，样例数据把每个分支都走一遍
  const evoView = require(path.resolve(HERE, "..", "miniprogram", "evo", "utils", "view.js"));
  const i18nT = require(path.resolve(HERE, "..", "miniprogram", "utils", "i18n.js")).T("zh");
  const evoRow = { id: "u:1", ended_at: "2026-10-26 21:03:00", placement: 1, mode: "ranked", map: "残月", legend: "恶灵",
    kills: 3, assists: 1, knockdowns: 4, damage: 1234, rp: 56, needs_review: true };
  const evoOv = evoView.overview({
    bound: true, accounts: [{ key: "0", name: "a" }, { key: "1", name: "b" }], account: "0", range: "30",
    today: "2026-10-26", yesterday: "2026-10-25", total: 1,
    rank: { tier: "diamond", division: "II", progress: 12, when: "2026-10-26 21:03:00", from_lobby: true },
    chart: { points: [0.5, 0.4], lines: [{ y: 0.3, tier: "diamond", division: "I" }], count: 2 },
    range_rp: 56, today_rp: 56, today_games: 1,
    stats: { games: 1, avg_place: 1, avg_kills: 3, avg_damage: 1234, top5: 100, win_rate: 100 },
    recent: [evoRow],
    legends: [{ name: "恶灵", games: 1, avg_damage: 1234, segments: [{ css: "p1", width: 100 }], other: false }],
    review_count: 1,
  }, i18nT, 160);
  collect(evoOv);
  collect(evoOv.picker);
  collect(evoOv.rank);
  collect(evoOv.chart);
  evoOv.stats.forEach(collect);
  evoOv.recent.forEach(collect);
  evoOv.legends.forEach((l) => { collect(l); l.segments.forEach(collect); });
  collect(evoView.matchesView({ accounts: [], rows: [evoRow], review_count: 0, total: 1, page: 1, pages: 1 }, i18nT));
  const evoDetail = evoView.detail({ today: "2026-10-26", yesterday: "2026-10-25", match: Object.assign({}, evoRow, {
    rp_source: "xp", rank_tier: "diamond", rank_division: "II", rank_progress: 12, review_note: "x", no_summary: true,
    mates: [{ name: "x", player_id: "1", legend: "命脉", kills: 1, assists: 0, knockdowns: 1, damage: 100,
      survival_time: 600, revives: 1, respawns: 0 }],
  }) }, i18nT);
  collect(evoDetail);
  evoDetail.facts.forEach(collect);
  evoDetail.mates.forEach(collect);
  const evoDev = evoView.devicesView({ devices: [{ id: "u", bound_at: "x", last_upload_at: "x", app_version: "1", matches: 2 }],
    accounts: [{ name: "a", names: 2 }] }, i18nT);
  collect(evoDev);
  evoDev.devices.forEach(collect);
  evoDev.accounts.forEach(collect);

  // 首页（2026-10-27）：大卡 / 小卡 / 每秒的字段（utils/home.js），Evo 那两块（view.js 的 homeView / crowdView）
  const homeUtil = require(path.resolve(HERE, "..", "miniprogram", "utils", "home.js"));
  vm.buildModes(core.normalizeRotation(raw)).forEach((m) => {
    const c = homeUtil.smallCard(m, "zh");
    collect(c);
    collect(homeUtil.tickFields(c, 1500, "zh"));
  });
  const evoHome = evoView.homeView({ bound: true, total: 1, synced_at: 1,
    rank: { tier: "diamond", division: "II", progress: 1, score: 1, when: "x", from_lobby: true },
    step: { next_tier: "diamond", next_division: "I", gap: 1, pct: 1 },
    day: { games: 1, avg_place: 1, kills: 1, damage: 1, rp: 1 },
    last: { id: "x", placement: 1, rp: 1, legend: "恶灵", kills: 1, damage: 1, map: "残月" } }, i18nT, 112, 2);
  collect(evoHome);
  collect(evoHome.rank);
  collect(evoHome.step);
  collect(evoHome.step.gap);
  collect(evoHome.last);
  const evoCrowd = evoView.crowdView({ days: 7, players: 9, enough: true, legends: [{ name: "恶灵", pct: 1 }],
    combo: { legends: ["恶灵", "命脉", "直布罗陀"], avg_place: 1, games: 3 } }, i18nT);
  collect(evoCrowd);
  evoCrowd.legends.forEach(collect);
  collect(evoCrowd.combo);
  evoCrowd.combo.faces.forEach(collect);

  // 中英文词表。页面把 i18n.T(lang) 整个放进 data，WXML 里写 {{T.xxx}}，
  // 所以词表的每个 key 都要登记（否则会被当成"没有来源的标识符"）。
  const i18n = require(path.resolve(HERE, "..", "miniprogram", "utils", "i18n.js"));
  collect(i18n.T("zh"));
  collect(i18n.T("en"));

  // 未开启的分支也要覆盖
  const raw2 = Object.assign({}, raw); delete raw2.wildcard;
  vm.buildModes(core.normalizeRotation(raw2)).forEach((m) => { collect(m); (m.nexts || []).forEach(collect); });
  // 比赛页「最终成绩」（2026-11-02）：结果视图模型的字段
  const matchresult = require(path.join(MP, "utils", "matchresult.js"));
  const rv = matchresult.build("zh");
  collect(rv);
  rv.rows.forEach(collect);
  rv.playerRows.forEach(collect);
  rv.gameRows.forEach(collect);
  rv.teamRows.forEach(collect);
  // 选手雷达页的数字行（k 名称 / v 个人值 / a 全场平均）
  ["k", "v", "a"].forEach((k) => keys.add(k));
  rv.legendRows.forEach(collect);

  return keys;
}

const VM_FIELDS = vmFieldNames();

describe("WXML 绑定与数据字段一致", () => {
  for (const name of PAGE_NAMES) {
    test(name + "：WXML 里绑定的每个标识符都有来源（否则那块永远空白且不报错）", () => {
      const wxml = read(pageWxmlPath(name));
      const allowed = new Set([
        ...pageDataKeys(name),
        ...VM_FIELDS,
        "item", "n", "index", "idx",
    // 轮换时间表的嵌套循环用的别名（g = 分组，r = 行），
    // 以及模式选择面板里的 item.on（勾没勾上）
    "g", "r", "on",
        "true", "false", "null", "undefined",
      ]);

      // 去掉字符串字面量，免得把 'cd-urgent' 这种当成标识符
      const cleaned = wxml.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
      const exprs = [...cleaned.matchAll(/\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]);
      assert.ok(exprs.length > 0, name + " 没解析到任何绑定，解析逻辑可能坏了");

      const unknown = new Set();
      for (const e of exprs) {
        for (const chain of e.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
          chain[0].split(".").forEach((tok) => { if (!allowed.has(tok)) unknown.add(tok); });
        }
      }
      assert.deepEqual([...unknown], [], name + " 的 WXML 绑了没人提供的字段：" + JSON.stringify([...unknown]));
    });
  }

  for (const name of COMPONENT_NAMES) {
    test(name + "：组件 WXML 里绑定的每个标识符都有来源", () => {
      const wxml = read(compPath(name, ".wxml"));
      const allowed = new Set([...compDataKeys(name), ...VM_FIELDS, "item", "index", "s", "true", "false", "null", "undefined"]);
      const cleaned = wxml.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
      const unknown = new Set();
      for (const m of cleaned.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        for (const chain of m[1].matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
          chain[0].split(".").forEach((tok) => { if (!allowed.has(tok)) unknown.add(tok); });
        }
      }
      assert.deepEqual([...unknown], [], name + " 的 WXML 绑了没人提供的字段：" + JSON.stringify([...unknown]));
    });
  }

  test("页面 data 里声明的字段在 WXML 里确实用到了（防止改名后留下死字段）", () => {
    // 这几个是给 JS 用的中间状态 / 传参，不一定要出现在 WXML
    const jsOnly = new Set(["playerInput", "platformIndex", "platformLabels", "loading"]);
    const unused = [];
    for (const name of PAGE_NAMES) {
      const wxml = read(pageWxmlPath(name));
      const used = new Set();
      for (const m of wxml.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        for (const tok of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) used.add(tok[0]);
      }
      pageDataKeys(name).forEach((k) => {
        if (!used.has(k) && !jsOnly.has(k)) unused.push(name + "." + k);
      });
    }
    assert.deepEqual(unused, [], "这些 data 字段 WXML 没用到，可能是残留：" + JSON.stringify(unused));
  });

  test("WXML 标签必须成对闭合（写错只会在开发者工具里才暴露，这里先拦一道）", () => {
    // 这一条是有来历的：页面的 js 能在 Node 里用假 Page/wx 跑测试，
    // 但 WXML 只在微信开发者工具里才被解析 —— 而本机跑不了那个工具。
    // 结构写错（少一个 </view>）会让整页白屏，这种错不能只靠肉眼看。
    const VOID = new Set([
      "input", "image", "icon", "progress", "checkbox", "radio", "slider", "switch",
      "textarea", "canvas", "video", "audio", "camera", "live-player", "live-pusher",
      "open-data", "web-view", "import", "include", "wxs",
    ]);

    const files = PAGE_NAMES.map(pageWxmlPath).concat(COMPONENT_NAMES.map((n) => compPath(n, ".wxml")));
    for (const file of files) {
      const name = path.relative(MP, file);
      const src = read(file).replace(/<!--[\s\S]*?-->/g, "");
      const stack = [];
      for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
        const closing = m[1] === "/";
        const tag = m[2].toLowerCase();
        const selfClosed = m[4] === "/";

        if (closing) {
          if (VOID.has(tag)) continue;      // 显式闭合的 void 标签，忽略
          const top = stack.pop();
          assert.equal(top, tag, name + " 的 WXML 标签不匹配：遇到 </" + tag + ">，但当前开着的是 <" + top + ">");
        } else if (!selfClosed && !VOID.has(tag)) {
          stack.push(tag);
        }
      }
      assert.deepEqual(stack, [], name + " 的 WXML 有没闭合的标签：" + JSON.stringify(stack));
    }
  });


  test("三个页面都不再有客服反馈入口（已按用户要求移除，别再加回来）", () => {
    for (const name of PAGE_NAMES) {
      const wxml = read(pageWxmlPath(name));
      assert.equal(/open-type="contact"/.test(wxml), false, name + " 不该再有客服反馈入口");
      assert.equal(/class="fb-btn"/.test(wxml), false, name + " 不该再有反馈按钮");
    }
  });

  test("WXML 用到的样式类都在 WXSS 里有定义", () => {
    const wxssFiles = [path.join(MP, "app.wxss")].concat(
      PAGE_NAMES.map(pageWxssPath), COMPONENT_NAMES.map((n) => compPath(n, ".wxss"))
    ).filter(existsSync);
    assert.ok(wxssFiles.length > 0, "一个 wxss 都没有，样式全丢了");
    const wxss = wxssFiles.map(readWxss).join("\n");
    const isDefined = (c) => new RegExp("\\." + c.replace(/[-]/g, "\\-") + "(?![\\w-])").test(wxss);

    const missing = [];
    let sawAny = false;
    const wxmlFiles = PAGE_NAMES.map(pageWxmlPath).concat(COMPONENT_NAMES.map((n) => compPath(n, ".wxml")));
    for (const file of wxmlFiles) {
      const name = path.relative(MP, file);
      const wxml = read(file);
      // 把 class / placeholder-class 的值取出来。必须限定成独立属性，
      // 否则 /class="..."/ 会把 placeholder-class 也一起匹配进来。
      for (const m of wxml.matchAll(/(?:^|\s)(class|placeholder-class)="([^"]*)"/g)) {
        // 把 {{...}} 整体替换成哨兵字符：紧挨着它的片段是"半个类名"
        // （如 class="msg msg-{{err.style}}" 里的 "msg-"），必须丢掉，否则一堆假缺失。
        const rawAttr = m[2].replace(/\{\{[\s\S]*?\}\}/g, "\u0000");
        for (const tok of rawAttr.split(/\s+/)) {
          if (!tok || tok.indexOf("\u0000") >= 0) continue;
          sawAny = true;
          if (!isDefined(tok)) missing.push(name + " → " + tok);
        }
      }
    }
    assert.ok(sawAny, "没解析到任何 class，解析逻辑可能坏了");
    assert.deepEqual(missing, [], "WXSS 里找不到这些类：" + JSON.stringify(missing));
  });
});
