// 各页面的行为测试。
//
// 页面的 js 在 Node 里跑不起来（它调用 Page({...})，而 Page 是小程序运行时提供的），
// 所以用桩把 Page / wx / 定时器都补上，把页面当普通模块加载起来测。
// 这是我在这个环境里唯一能验证页面行为的手段 —— 微信开发者工具是 GUI，这边跑不了。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);

// onLoad 会开每秒定时器；不打桩的话 Node 进程会被钉住不退出
global.setInterval = () => 0;
global.clearInterval = () => {};

const rotationResult = () => ({
  ok: true, kind: "ok", message: "",
  data: {
    // 字段形状照抄云函数真实返回：归一化层会同时给出英文 map 和中文 mapCn
    modes: [
      { def: { id: "ranked", label: "排位赛地图", tag: "BR Ranked" }, current: { map: "Olympus", mapCn: "奥林匹斯", start: 1000, end: 17200, eventName: "" }, nexts: [{ map: "Broken Moon", mapCn: "残月", start: 17200, end: 33400, eventName: "" }] },
      { def: { id: "pubs", label: "匹配模式地图", tag: "BR Pubs" }, current: { map: "Broken Moon", mapCn: "残月", start: 1000, end: 6400, eventName: "" }, nexts: [] },
      { def: { id: "mixtape", label: "轮换模式地图", tag: "Mixtape" }, current: { map: "Fragment", mapCn: "碎片", start: 1000, end: 1900, eventName: "TDM" }, nexts: [] },
      { def: { id: "wildcard", label: "外卡模式地图", tag: "Wildcard" }, current: null, nexts: [] },
    ],
    unknownKeys: [],
  },
});

const predatorResult = () => ({
  ok: true, kind: "ok", message: "",
  data: { group: { key: "RP", plats: [{ code: "PC", label: "PC", rp: 20661, masters: 3564, predCount: 750 }] } },
});

const playerResult = (over = {}) => ({
  ok: true, kind: "ok", message: "",
  data: {
    player: Object.assign({
      name: "shroud", platform: "PC", level: 255, levelPrestige: 2,
      uid: "2262951949",
      rankName: "Apex Predator", rankDiv: 0, rankScore: 21500, ladderPos: 137,
      season: "br_ranked_s30_s2",
      realtime: { online: false, inGame: false, legend: "Revenant", stateText: "Offline" },
      banned: { active: false, reason: "" },
      highlights: [{ label: "生涯击杀", value: 13877, valueText: "13,877" }],
    }, over),
  },
});

function setByPath(obj, key, value) {
  const m = key.match(/^([^[\]]+)\[(\d+)\]\.(.+)$/);
  if (m) {
    const arr = obj[m[1]];
    if (!arr || !arr[Number(m[2])]) return;
    arr[Number(m[2])][m[3]] = value;
    return;
  }
  // 首页的 tick 会写 "hero.cd" 这种（对象里的一个字段）
  const d = key.match(/^([^.[\]]+)\.(.+)$/);
  if (d && obj[d[1]] && typeof obj[d[1]] === "object") {
    obj[d[1]][d[2]] = value;
    return;
  }
  obj[key] = value;
}

/** 加载某个页面并造一个可调用的实例 */
function loadPage(name, opts = {}) {
  // 分包里的页面写成带目录的名字（"games/wheel"），主包页面只写页面名（"maps"）
  const pagePath = name.indexOf("/") >= 0
    ? path.join(MP, name, path.basename(name) + ".js")
    : path.join(MP, "pages", name, name + ".js");
  if (!existsSync(pagePath)) throw new Error("缺少页面 " + pagePath);

  const calls = [];
  const responses = opts.responses || {};
  let pageDef = null;

  const respond = (payload) => {
    if (opts.failAll) return { failWith: "errMsg: cloud function not found" };
    const r = responses[payload.action];
    if (r === undefined) return { ok: true, kind: "ok", message: "", data: {} };
    return typeof r === "function" ? r(payload) : r;
  };

  global.Page = (def) => { pageDef = def; };
  global.wx = {
    cloud: {
      callFunction(o) {
        calls.push({ name: o.name, data: o.data });
        const r = respond(o.data);
        Promise.resolve().then(() => {
          if (r && r.failWith) o.fail && o.fail({ errMsg: r.failWith });
          else o.success && o.success({ result: r });
        });
      },
    },
    stopPullDownRefresh() { calls.push({ stopped: true }); },
    // 故意不提供 setStorageSync：本项目不保存任何用户数据，
    // 页面若误用了会直接抛错，比悄悄存下来好。
  };

  // 界面偏好是模块级缓存 + 本地存储，**测试之间会串** ——
  // 上一条测试把"匹配"勾上了，下一条再勾一次就变成取消。
  // 每次加载页面前清干净，测试才彼此独立。
  try { require(path.join(MP, "utils", "prefs.js")).clear(); } catch (e) { /* 没有也无所谓 */ }

  delete require.cache[require.resolve(pagePath)];
  require(pagePath);
  if (!pageDef) throw new Error(name + " 没有调用 Page()");

  const inst = Object.create(pageDef);
  inst.data = JSON.parse(JSON.stringify(pageDef.data));
  inst.setData = function (patch) { Object.keys(patch).forEach((k) => setByPath(inst.data, k, patch[k])); };
  return { inst, calls };
}

const flush = () => new Promise((r) => setTimeout(r, 5));
const actionsOf = (calls) => calls.filter((c) => c.name === "apex").map((c) => c.data.action);

/* ============================================================
   首页（2026-10-27 起第 1 个 tab）
   ============================================================ */
describe("首页", () => {
  test("onLoad 只打地图轮换这一个接口（Evo 那两块是分包组件自己取）", async () => {
    const { inst, calls } = loadPage("home", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    assert.deepEqual(actionsOf(calls), ["rotation"]);
  });

  test("大卡默认是排位，其余是小卡；外卡没开也给一张小卡", async () => {
    const { inst } = loadPage("home", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.hero.id, "ranked");
    assert.equal(inst.data.hero.map, "奥林匹斯");
    assert.deepEqual(inst.data.smalls.map((m) => m.id), ["pubs", "wildcard", "mixtape"]);
    assert.equal(inst.data.smalls[1].active, false);
    assert.equal(inst.data.err.kind, "");
    assert.match(inst.data.subline, /好 · /, "问候语后面接数据更新时间");
  });

  test("「全部地图」⚙ 里置顶匹配后，首页大卡跟着变", async () => {
    const { inst } = loadPage("home", { responses: { rotation: rotationResult() } });
    require(path.join(MP, "utils", "prefs.js")).set("pin", "pubs");
    inst.onLoad();
    await flush();
    assert.equal(inst.data.hero.id, "pubs");
  });

  test("取数失败：显示错误，不留一张假卡片", async () => {
    const { inst } = loadPage("home", { failAll: true });
    inst.onLoad();
    await flush();
    assert.ok(inst.data.err.kind, "要有错误提示");
    assert.equal(inst.data.hero, null);
    assert.deepEqual(inst.data.smalls, []);
  });

  test("转发：上一局的分享按钮带着标题；右上角菜单写现在大卡上的地图", async () => {
    const { inst } = loadPage("home", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    const btn = inst.onShareAppMessage({ from: "button", target: { dataset: { title: "我刚在奥林匹斯拿了第 2 名" } } });
    assert.deepEqual(btn, { title: "我刚在奥林匹斯拿了第 2 名", path: "/pages/home/home" });
    const menu = inst.onShareAppMessage({ from: "menu" });
    assert.match(menu.title, /奥林匹斯/);
    assert.equal(menu.path, "/pages/home/home");
  });

  test("切成英文后回到首页：整页跟着换（地图名、问候语）", async () => {
    const { inst } = loadPage("home", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    require(path.join(MP, "utils", "i18n.js")).setLang("en");
    try {
      inst.onShow();
      assert.equal(inst.data.lang, "en");
      assert.equal(inst.data.hero.map, "Olympus");
      assert.match(inst.data.subline, /^Good /);
    } finally {
      require(path.join(MP, "utils", "i18n.js")).setLang("zh");
    }
  });
});

/* ============================================================
   地图页
   ============================================================ */
describe("地图页", () => {
  test("onLoad 只打地图这一个接口（不多发无关请求）", async () => {
    const { inst, calls } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    // 这一页不该去碰 predator / player —— 多一次云函数调用就是多一份额度
    assert.deepEqual([...actionsOf(calls)].sort(), ["rotation"]);
  });

  test("四种模式默认都显示；取消勾选会记住；置顶的排最前；外卡轮换是紧凑卡", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    // 默认四个都显示（用户 2026-10 改的主意：匹配也放出来）
    assert.equal(inst.data.pin, "ranked");
    assert.equal(inst.data.pubsHidden, false);
    assert.deepEqual([...inst.data.modes].map((m) => m.id), ["ranked", "pubs", "wildcard", "mixtape"]);
    assert.equal(inst.data.modes[0].pinned, true, "置顶的带强调标记");
    // 四个模式**都是完整一行**（用户 2026-10 的决定：不并排）
    assert.deepEqual([...inst.data.modes].map((m) => m.compact), [false, false, false, false]);

    // 在 ⚙ 设置里取消勾选匹配 → 卡片少了，并且出现"已收起"的提示
    inst.onToggleMode({ currentTarget: { dataset: { id: "pubs" } } });
    assert.equal(inst.data.pubsHidden, true);
    assert.deepEqual([...inst.data.modes].map((m) => m.id), ["ranked", "wildcard", "mixtape"]);
    assert.deepEqual([...inst.data.modes].map((m) => m.compact), [false, false, false]);

    // 再勾回来
    inst.onToggleMode({ currentTarget: { dataset: { id: "pubs" } } });
    assert.equal(inst.data.pubsHidden, false);
    assert.deepEqual([...inst.data.modes].map((m) => m.id), ["ranked", "pubs", "wildcard", "mixtape"]);

    // 改置顶成匹配 → 顺序换过来
    inst.onPick({ currentTarget: { dataset: { p: "pubs" } } });
    assert.deepEqual([...inst.data.modes].map((m) => m.id), ["pubs", "ranked", "wildcard", "mixtape"]);
    assert.equal(inst.data.modes[0].pinned, true);
    // 认不出的值不该改变现状
    inst.onPick({ currentTarget: { dataset: { p: "nope" } } });
    assert.equal(inst.data.pin, "pubs");
  });

  test("界面显示的是中文地图名（不是 Broken Moon 这种英文）", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    // 四个模式默认都显示，匹配也在
    const byId = {};
    inst.data.modes.forEach((m) => { byId[m.id] = m; });
    assert.equal(byId.pubs.map, "残月");
    assert.equal(byId.ranked.map, "奥林匹斯");
    assert.equal(byId.mixtape.map, "碎片");
    assert.equal(byId.ranked.nexts[0].map, "残月", "接着轮换那一列也要中文");
  });

  test("大逃杀地图带上本地配图，轮换的小区域图留空", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    inst.onPick({ currentTarget: { dataset: { p: "ranked" } } });
    const byId = {};
    inst.data.modes.forEach((m) => { byId[m.id] = m; });
    assert.equal(byId.ranked.image, "/assets/maps/olympus.jpg");
    // 轮换的小区域图现在**有**了 —— 用户自己在游戏里截的实景照（碎片 → mixtape-fragment.jpg）
    assert.equal(byId.mixtape.image, "/assets/maps/mixtape-fragment.jpg");
    assert.equal(byId.wildcard.image, "", "未开启就没有地图，也就没有配图");
  });

  test("失败时给出该类型的标题，且不再显示加载中", async () => {
    const { inst } = loadPage("maps", {
      responses: { rotation: { ok: false, kind: "unverified", message: "去绑定 Discord" } },
    });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.loading, false);
    assert.equal(inst.data.err.kind, "unverified");
    assert.ok(inst.data.err.title.length > 0);
    assert.equal(inst.data.modes.length, 0);
  });

  test("云函数没部署时给可读提示", async () => {
    const { inst } = loadPage("maps", { failAll: true });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.err.kind, "network");
    assert.ok(/云函数/.test(inst.data.err.message));
  });

  test("上游改了字段名时把未识别字段透到界面", async () => {
    const r = rotationResult();
    r.data.unknownKeys = ["mystery_mode"];
    const { inst } = loadPage("maps", { responses: { rotation: r } });
    inst.onLoad();
    await flush();
    assert.deepEqual([...inst.data.unknownKeys], ["mystery_mode"]);
    assert.equal(inst.data.unknownKeysText, "mystery_mode");
  });

  test("tick 按 endSec 算出剩余时间与紧急标记", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    const fakeNow = inst.data.modes[0].endSec * 1000 - 10 * 1000;
    const realNow = Date.now;
    Date.now = () => fakeNow;
    try { inst.tick(); } finally { Date.now = realNow; }
    assert.equal(inst.data.modes[0].cd, "00:10");
    assert.equal(inst.data.modes[0].urgent, true);
    assert.ok(inst.data.modes[0].pct > 90);
  });

  test("过点后显示「轮换中…」而不是负数", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    const realNow = Date.now;
    Date.now = () => inst.data.modes[0].endSec * 1000 + 60000;
    try { inst.tick(); } finally { Date.now = realNow; }
    assert.equal(inst.data.modes[0].cd, "轮换中…");
  });

  test("下拉刷新会收起动画", async () => {
    const { inst, calls } = loadPage("maps", { responses: { rotation: rotationResult() } });
    await inst.onPullDownRefresh();
    await flush();
    assert.ok(calls.some((c) => c.stopped));
  });
});

/* ============================================================
   猎杀榜页
   ============================================================ */
describe("排位专区页", () => {
  test("onLoad 请求分数线 + 段位分布 + 赛季倒计时 + 主播数据（战队专区当前隐藏）", async () => {
    const { inst, calls } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    await flush();
    // prostats 是主播数据热更新（2026-11-05 新增）：先渲染包内快照，再问云端一次，
    // 云端有更新的就换掉重绘。顺序上是**先本地后云端**，所以它排在最前面。
    // rankdist 是本赛季段位分布（2026-10-16 新增，见 cloudfunctions/apex/rankdist.js）。
    // config 是赛季倒计时 —— 2026-10-16 用户要求从战绩页搬到**排位专区顶部**，
    // 所以它现在也在这个列表里。
    assert.deepEqual(actionsOf(calls), ["prostats", "predator", "rankdist", "config"]);
  });

  test("云端没有主播数据时不影响渲染（回落包内快照）", async () => {
    // 默认桩里 prostats 返回空 → refresh 判定失败 → 不换数据。
    // 这条防的是"云端没数据把页面搞空白"。
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    await flush();
    assert.ok(inst.data.pro && inst.data.pro.chips.length >= 2, "包内快照必须还在");
    assert.ok(inst.data.pro.stat.hasHeroes, "头条英雄不能因为云端没数据就消失");
  });

  test("平台卡片建出来并带千分位", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.predator.length, 1);
    assert.equal(inst.data.predator[0].rpText, "20,661");
    assert.equal(inst.data.predator[0].predCountText, "750");
  });

  /* ---------- 排位专区（职业选手，本地离线数据） ----------
     这一块不联网，所以 onLoad 一进来就该有数据 —— 不用等分数线那几个请求。
     断言只写"跑起来能验证的"：字段有没有、切选手/切语言跟不跟得上。
     界面上长什么样这边看不到（微信开发者工具是 GUI），所以行为测试就是唯一防线。 */
  test("排位专区：onLoad 立刻就有数据（本地数据不等网络）", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    // 刻意 **不** await flush：本地数据必须是同步就位的
    assert.ok(inst.data.pro, "onLoad 之后 pro 必须有值");
    assert.ok(inst.data.pro.chips.length >= 2, "至少要有「综合」+ 一位选手");
    assert.equal(inst.data.pro.chips[0].id, "__all__");
    assert.ok(inst.data.pro.stat.topHeroes.length >= 1, "选手详情里要有英雄条目");
  });

  test("排位专区：点选手 chip 之后详情换成那个人", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    const pro = require(path.resolve(MP, "utils", "prostats.js"));
    const second = (pro.DATA.players || [])[1];
    if (!second) return;   // 只有一位选手时这条没意义
    inst.onProChip({ currentTarget: { dataset: { id: second.id } } });
    assert.equal(inst.data.pro.active, second.id);
    assert.equal(inst.data.pro.stat.name, second.name);
    // 再点回「综合」
    inst.onProChip({ currentTarget: { dataset: { id: "__all__" } } });
    assert.equal(inst.data.pro.active, "__all__");
  });

  test("排位专区：切语言后条目也跟着换（不能只换标题）", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    const zhMain = inst.data.pro.stat.topHeroes[0].main;
    // ⚠️ 语言是模块级全局状态，切完**必须切回来**，
    //    否则后面所有用例都会在英文下跑（这个坑我踩过一次）。
    try {
      inst.onLang({ currentTarget: { dataset: { l: "en" } } });
      const enMain = inst.data.pro.stat.topHeroes[0].main;
      assert.notEqual(zhMain, enMain, "英文模式下主标题应当换成英文名");
      assert.match(inst.data.pro.stat.topHeroes[0].pctText, /%$/);
    } finally {
      const i18n = require(path.resolve(MP, "utils", "i18n.js"));
      i18n.setLang("zh");
    }
  });

  test("排位专区：没有武器的选手不会画出空表（has* 为 false）", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    const s = inst.data.pro.stat;
    assert.equal(typeof s.hasHeroes, "boolean");
    assert.equal(typeof s.hasCombos, "boolean");
    assert.equal(typeof s.hasWeapons, "boolean");
    if (!s.hasWeapons) assert.equal(s.weaponRows.length, 0, "hasWeapons=false 时不该有行");
  });

  test("空输入直接提示，不浪费一次云函数调用", async () => {
    const { inst, calls } = loadPage("predator", {});
    inst.onLoad();
    await flush();
    const before = calls.length;
    inst.setData({ playerInput: "   " });
    inst.onLookup();
    await flush();
    assert.equal(inst.data.playerErr, "请先输入 EA ID。");
    assert.equal(calls.length, before);
  });

  test("查询时带上选中的平台代码", async () => {
    const { inst, calls } = loadPage("predator", { responses: { player: playerResult() } });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "shroud", platformIndex: 2 });   // 2 = Xbox
    inst.onLookup();
    await flush();
    const call = calls.filter((c) => c.data && c.data.action === "player").pop();
    assert.equal(call.data.player, "shroud");
    assert.equal(call.data.platform, "X1");
    assert.equal(inst.data.player.ladderText, "#137");
  });

  test("查无此人 → 显示提示而不是空白", async () => {
    const { inst } = loadPage("predator", {
      responses: { player: { ok: false, kind: "notfound", message: "查无此人。请核对 ID。" } },
    });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "nobody" });
    inst.onLookup();
    await flush();
    assert.equal(inst.data.player, null);
    assert.ok(/查无此人/.test(inst.data.playerErr));
  });

  test("查询进行中重复点不会重复发请求", async () => {
    const { inst, calls } = loadPage("predator", { responses: { player: playerResult() } });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    inst.onLookup();
    await flush();
    const playerCalls = calls.filter((c) => c.data && c.data.action === "player");
    assert.equal(playerCalls.length, 1);
  });

  test("查玩家时顺带算出「距猎杀线还差多少分」（这一页本来就有分数线）", async () => {
    const { inst } = loadPage("predator", {
      responses: {
        predator: predatorResult(),
        player: playerResult({ rankName: "Diamond", rankDiv: 2, rankScore: 12000, ladderPos: null }),
      },
    });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "shroud", platformIndex: 0 });
    inst.onLookup();
    await flush();
    assert.equal(inst.data.gap.kind, "below");
    assert.equal(inst.data.gap.value, "8,661");
  });

  test("查玩家时不再重复取分数线（onLoad 已经拿过了）", async () => {
    const { inst, calls } = loadPage("predator", {
      responses: { predator: predatorResult(), player: playerResult() },
    });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    assert.deepEqual([...actionsOf(calls)], ["predator", "rankdist", "config", "player"], "第二次不该再打一次 predator");
  });

  test("这一页的原始猎杀分组不进 data", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.group, undefined);
  });

  test("有涨幅时带出「涨了多少」和对比的时间点", async () => {
    const H = 3600 * 1000;
    const now = Date.now();
    const withDelta = {
      ok: true, kind: "ok", message: "",
      data: { group: { key: "RP", plats: [{
        code: "PC", label: "PC", rp: 28685, masters: 4000, predCount: 750,
        updatedAt: now - 12 * 60 * 1000,
        delta: 1240, deltaBasisAt: now - 24 * H
      }] } },
    };
    const { inst } = loadPage("predator", { responses: { predator: withDelta } });
    inst.onLoad();
    await flush();
    const pc = inst.data.predator[0];
    assert.equal(pc.deltaText, "+1,240");
    assert.equal(pc.deltaUp, true);
    assert.match(pc.deltaBasisText, /^较 \d\d-\d\d \d\d:\d\d$/);
    assert.equal(pc.updatedAtText, "12 分钟前更新");
  });

  test("拿不到对比基准时涨幅为空串，界面据此不渲染那一行", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad();
    await flush();
    const pc = inst.data.predator[0];
    assert.equal(pc.deltaText, "", "宁可少一行，也不能显示成 +0");
    assert.equal(pc.deltaBasisText, "");
    assert.equal(pc.updatedAtText, "", "上游没给刷新时间就不显示");
  });

  test("底分下跌时是负数并且标记为 down（赛季重置真会掉）", async () => {
    const H = 3600 * 1000;
    const now = Date.now();
    const falling = {
      ok: true, kind: "ok", message: "",
      data: { group: { key: "RP", plats: [{
        code: "PC", label: "PC", rp: 20000, masters: 100, predCount: 750,
        updatedAt: now - 60 * 1000, delta: -8685, deltaBasisAt: now - 24 * H
      }] } },
    };
    const { inst } = loadPage("predator", { responses: { predator: falling } });
    inst.onLoad();
    await flush();
    assert.equal(inst.data.predator[0].deltaText, "−8,685");
    assert.equal(inst.data.predator[0].deltaUp, false);
  });
});

/* ============================================================
   战绩页 —— 2026-10-16 已整页删除（用户要求：把第 4 个 tab 换成「猜圈」小游戏）。
   原先这一整块（15 条用例）测的是 stats 页查人/差额/不落存储等行为。
   这些行为现在只存在于**排位专区页**，而它自己有独立用例（见上面「排位专区页」那一节，
   覆盖了空输入、平台代码、查无此人、重复点、差额、原始数据不进 data），所以没有丢覆盖。
   ============================================================ */

/* ============================================================
   同名问题（游戏内 ID 不唯一）
   ============================================================ */
describe("同名 · uid（排位专区页：唯一的查人入口）", () => {
  test("结果面板带出 uid，能确认查到的是哪一个人", async () => {
    const { inst } = loadPage("predator", { responses: { player: playerResult(), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    assert.equal(inst.data.player.uid, "2262951949");
  });

  test("拿不到 uid 时那个字段是空串，界面据此不渲染那一行", async () => {
    const { inst } = loadPage("predator", { responses: { player: playerResult({ uid: "" }), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    assert.equal(inst.data.player.uid, "");
  });

  test("手动查询时 uid 传空串（交给云函数按名字查，必要时它自己会重试 uid）", async () => {
    const { inst, calls } = loadPage("predator", { responses: { player: playerResult(), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    const c = calls.filter((x) => x.data && x.data.action === "player").pop();
    assert.equal(c.data.uid, "");
    assert.equal(c.data.player, "shroud");
  });

  test("从带 uid 的分享链接进来时按 uid 查 —— 不会被同名的另一个账号顶掉", async () => {
    const { inst, calls } = loadPage("predator", { responses: { player: playerResult(), predator: predatorResult() } });
    inst.onLoad({ player: "小明", uid: "2262951949", platform: "PC" });
    await flush();
    const c = calls.filter((x) => x.data && x.data.action === "player").pop();
    assert.equal(c.data.uid, "2262951949", "有 uid 就必须按 uid 查");
    assert.equal(c.data.player, "小明", "名字也带上，输入框要显示");
    assert.ok(inst.data.player, "进来就该看到结果");
  });

  test("分享链接带上 uid（这是「发给朋友，他看到的必定是我」的保证）", async () => {
    const { inst } = loadPage("predator", { responses: { player: playerResult(), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    const s = inst.onShareAppMessage();
    assert.match(s.path, /uid=2262951949/, "实际：" + s.path);
    assert.match(s.path, /player=/);
  });

  test("后端没给 uid 时分享链接里就没有 uid（不编一个）", async () => {
    const { inst } = loadPage("predator", { responses: { player: playerResult({ uid: "" }), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    assert.equal(/uid=/.test(inst.onShareAppMessage().path), false);
  });

  test("分享出来的链接自己解析得回来（uid 往返）", async () => {
    const { inst } = loadPage("predator", { responses: { player: playerResult(), predator: predatorResult() } });
    inst.setData({ playerInput: "shroud" });
    inst.onLookup();
    await flush();
    const path = inst.onShareAppMessage().path;
    const opt = {};
    path.split("?")[1].split("&").forEach(function (kv) {
      const i = kv.indexOf("=");
      opt[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    assert.equal(opt.uid, "2262951949");
    assert.equal(opt.player, "shroud");
  });
});

/* ============================================================
   分享：从链接进来 / 生成链接出去
   ============================================================ */
describe("分享", () => {
  // ⚠️ 这里原有 4 条「战绩页」的分享用例。战绩页 2026-10-16 整页删除后，
  // 它们没有对象了；等价行为（从分享链接进来 / 生成分享链接）下面「猎杀榜页」
  // 那几条原样覆盖，而且现在还会校验 uid 往返。

  test("猎杀榜页：从分享链接进来时自动查这个人", async () => {
    // 固件里必须真的有 PS4 的分数线：没有的话差额算不出来，
    // 那这条测试就测不到"按链接里的平台取线"这件事了
    const twoPlat = {
      ok: true, kind: "ok", message: "",
      data: {
        group: {
          key: "RP",
          plats: [
            { code: "PC", label: "PC", rp: 20661, masters: 3564, predCount: 750 },
            { code: "PS4", label: "PlayStation", rp: 18099, masters: 3100, predCount: 749 },
          ],
        },
      },
    };
    const { inst, calls } = loadPage("predator", {
      responses: { predator: twoPlat, player: playerResult({ rankScore: 12000, ladderPos: null }) },
    });
    inst.onLoad({ player: "shroud", platform: "PS4" });
    await flush();
    assert.equal(inst.data.platformIndex, 1);
    assert.ok(inst.data.player, "进来就该看到结果");
    assert.equal(inst.data.gap.value, "6,099", "用的是 PS4 的线（18099-12000），不是 PC 的");
    const call = calls.filter((c) => c.data && c.data.action === "player").pop();
    assert.equal(call.data.platform, "PS4");
  });

  test("排位专区页：分享参数不可用时只请求分数线等页面级数据，不查人", async () => {
    const { inst, calls } = loadPage("predator", { responses: { predator: predatorResult() } });
    inst.onLoad({ player: "" });
    await flush();
    assert.deepEqual([...actionsOf(calls)], ["predator", "rankdist", "config"]);
    assert.equal(inst.data.player, null);
  });

  test("主题是全项目共用的：在别的页面切了，切回来必须跟上", async () => {
    // 用户实际报过：地图页切成浅色，进猎杀榜又变回深色。
    // 根因 —— 主题是**模块级**全局状态，但页面 data 里那份是模块首次加载时抄下来的，
    // 不在 onShow 里同步就会一直用陈旧值。语言当时做了同步，主题漏了。
    const theme = require(path.join(MP, "utils", "theme.js"));
    theme.setTheme("dark");

    const pages = {};
    for (const name of ["maps", "predator", "games/ringguessr"]) {
      pages[name] = loadPage(name, { responses: { predator: predatorResult() } }).inst;
      pages[name].onLoad();
      await flush();
      assert.equal(pages[name].data.theme, "dark", name + " 初始应为深色");
    }

    // 在地图页切成浅色
    theme.setTheme("light");
    pages.maps.onShow();
    assert.equal(pages.maps.data.theme, "light");
    assert.equal(pages.maps.data.theme, theme.getTheme());

    // 另两页切回来时必须跟上，不能各自留着旧值
    for (const name of ["predator", "games/ringguessr"]) {
      pages[name].onShow();
      assert.equal(pages[name].data.theme, "light", name + " 页切回来没跟上主题");
    }

    // 双向：再切回深色也要同步
    theme.setTheme("dark");
    for (const name of ["maps", "predator", "games/ringguessr"]) {
      pages[name].onShow();
      assert.equal(pages[name].data.theme, "dark", name + " 页没跟上切回深色");
    }
  });

  test("语言也是全项目共用的：在别的页面切了，切回来必须跟上", async () => {
    // 和主题同一个坑。之前只修了语言，所以这条一直是绿的 —— 留着防止回归。
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    i18n.setLang("zh");
    const inst = loadPage("predator", { responses: { predator: predatorResult() } }).inst;
    inst.onLoad();
    await flush();
    assert.equal(inst.data.lang, "zh");
    i18n.setLang("en");
    inst.onShow();
    assert.equal(inst.data.lang, "en", "切回来必须跟上语言");
    assert.equal(inst.data.T.predTitle, i18n.t("en", "predTitle"), "词表也要一起换");
    i18n.setLang("zh");
  });

  test("猎杀榜页：查完后的分享链接带上这个人", async () => {
    const { inst } = loadPage("predator", { responses: { predator: predatorResult(), player: playerResult() } });
    inst.onLoad();
    await flush();
    inst.setData({ playerInput: "shroud", platformIndex: 0 });
    inst.onLookup();
    await flush();
    const s = inst.onShareAppMessage();
    assert.ok(s.title.includes("shroud"), "实际：" + s.title);
    assert.ok(s.path.startsWith("/pages/predator/predator?player=shroud"), "实际：" + s.path);
  });

  test("地图页：分享标题里带上当前那张卡的地图（转给队友一眼看懂）", async () => {
    const { inst } = loadPage("maps", { responses: { rotation: rotationResult() } });
    inst.onLoad();
    await flush();
    // 默认置顶排位 → 标题用排位的地图。
    // 关键是标题**跟着实际内容走**，不写死模式名（否则会出现"排位现在打<匹配的地图>"）。
    assert.ok(inst.onShareAppMessage().title.includes("奥林匹斯"), "实际：" + inst.onShareAppMessage().title);

    // 置顶换成匹配后，标题跟着换成匹配的地图（匹配默认就显示）
    inst.onPick({ currentTarget: { dataset: { p: "pubs" } } });
    assert.ok(inst.onShareAppMessage().title.includes("残月"), "实际：" + inst.onShareAppMessage().title);
    assert.equal(inst.onShareAppMessage().path, "/pages/maps/maps");
  });

  test("地图页：还没拿到数据时分享也不崩", () => {
    const { inst } = loadPage("maps", {});
    const s = inst.onShareAppMessage();
    assert.ok(s.title.length > 0);
    assert.equal(s.path, "/pages/maps/maps");
  });
});

/* ============================================================
   比赛页 · 下一场比赛（2026-10-18 用户要求）
   赛程 / 分组 / 队员全部来自本地快照，不联网；交互是切组 + 点队伍看队员。
   ============================================================ */
describe("比赛页 · 下一场比赛", () => {
  // 2026-11 起比赛页多了一个云函数调用 proRoster（只读数据库里的 Liquipedia 参赛名单，用来连到选手页）。
  // 内容本身还是本地快照：onLoad 当场就渲染出来，不等这个调用。
  test("onLoad 立刻就有内容（本地快照）；唯一的云函数调用是参赛名单 proRoster", () => {
    const { inst, calls } = loadPage("matches", {});
    inst.onLoad();
    // 2026-11-02 拉斯维加斯那场打完之后，快照里没有未来的比赛了。
    // 这时这一页显示「最终成绩」而不是「下一场比赛」——两种状态都要成立。
    if (!inst.data.next) {
      assert.ok(inst.data.result, "没有下一场时必须显示最终成绩");
      assert.ok(inst.data.result.rows.length >= 10, "最终成绩至少要有前 10");
      assert.deepEqual(actionsOf(calls), ["proRoster"], "只该要参赛名单，内容是本地数据");
      return;
    }
    assert.ok(inst.data.next, "onLoad 之后 next 必须有值");
    assert.equal(inst.data.next.groups.length, 4);
    assert.equal(inst.data.next.activeGroup, "A");
    assert.equal(inst.data.next.teams.length, 10);
    assert.deepEqual(actionsOf(calls), ["proRoster"], "只该要参赛名单，内容是本地数据");
  });

  test("切分组：A → B，队伍列表跟着换", () => {
    const { inst } = loadPage("matches", {});
    inst.onLoad();
    if (!inst.data.next) return;  // 赛程已全部结束，没有分组可切
    const firstA = inst.data.next.teams[0].name;
    inst.onNextGroup({ currentTarget: { dataset: { k: "B" } } });
    assert.equal(inst.data.next.activeGroup, "B");
    assert.equal(inst.data.next.teams.length, 10);
    assert.notEqual(inst.data.next.teams[0].name, firstA, "换组后还是 A 组的队伍");
    // 再点同一个组不该重建（点了没反应才对）
    const teamsBefore = inst.data.next.teams;
    inst.onNextGroup({ currentTarget: { dataset: { k: "B" } } });
    assert.equal(inst.data.next.teams, teamsBefore);
  });

  test("点队伍 → 打开队员弹层；关掉后清空", () => {
    const { inst } = loadPage("matches", {});
    inst.onLoad();
    if (!inst.data.next) return;  // 赛程已全部结束，没有队伍可点
    inst.onTeam({ currentTarget: { dataset: { i: 0 } } });
    const t = inst.data.openTeam;
    assert.ok(t, "点完应该有 openTeam");
    assert.equal(t.name, inst.data.next.teams[0].name);
    assert.equal(t.groupName, "A 组");
    assert.ok(t.players.length >= 1, "真实快照里每队都有人");
    assert.equal(t.hasPlayers, true);
    assert.match(t.countText, /名队员/);
    inst.onCloseTeam();
    assert.equal(inst.data.openTeam, null);
  });

  test("切语言后下一场也跟着换（不残留旧语言）", () => {
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    i18n.setLang("zh");
    const { inst } = loadPage("matches", {});
    inst.onLoad();
    i18n.setLang("en");
    inst.onShow();
    if (inst.data.next) {
      assert.equal(inst.data.next.eventLabel, "ALGS Playoffs");
      assert.match(inst.data.next.statusText, /in \d+ (day|hour|min)/);
    } else {
      // 没有下一场时，切语言不该把最终成绩弄丢或弄成空白
      assert.equal(inst.data.result.title, "Final results");
      assert.ok(inst.data.result.champTeam, "冠军战队名不能为空");
    }
    i18n.setLang("zh");
  });

  test("没有 next 时点队伍 / 切组不崩", () => {
    const { inst } = loadPage("matches", {});
    inst.setData({ next: null });
    inst.onTeam({ currentTarget: { dataset: { i: 0 } } });
    inst.onCloseTeam();
    inst.onNextGroup({ currentTarget: { dataset: { k: "B" } } });
    assert.equal(inst.data.openTeam, null);
  });

  test("分享标题跟着主内容走（页首是下一场比赛，不只是 ALGS 赛场）", () => {
    const { inst } = loadPage("matches", {});
    inst.onLoad();
    assert.match(inst.onShareAppMessage().title, /下一场/);
    assert.equal(inst.onShareAppMessage().path, "/pages/matches/matches");
  });

  test("赛制：默认收起，点一下展开再收起", () => {
    const { inst } = loadPage("matches", {});
    inst.onLoad();
    assert.equal(inst.data.fmtOpen, false, "默认必须收起，不占第一屏");
    // 赛程全部结束、这一页改成最终成绩时没有 next，赛制折叠就无从谈起
    if (!inst.data.next) return;
    assert.ok(inst.data.next.format, "真实快照必须带赛制（赛事页 info-banner）");
    inst.onFormat();
    assert.equal(inst.data.fmtOpen, true);
    inst.onFormat();
    assert.equal(inst.data.fmtOpen, false);
  });
});

/* ============================================================
   比赛页 → 选手页（2026-11，数据来自 Liquipedia）
   参赛名单由云函数 proRoster 给（只读数据库）；名单到了，冠军队员、名次行、选手榜才能点。
   ============================================================ */
describe("比赛页 · 连到选手页", () => {
  // 一份最小的名单：冠军 Team Liquid（三人）+ 名次 11 的 Rex Regum Qeon（ALS 叫 Team RRQ，只能靠名次对上）
  const roster = {
    event: "Apex_Legends_Global_Series/2026/Split_2/Playoffs",
    teams: [
      { place: "1", team: "Team Liquid", teamPage: "Team_Liquid", players: [
        { page: "Zer0", id: "Zer0", nat: "Australia", input: "Mouse & Keyboard" },
        { page: "Sikezz", id: "Sikezz", nat: "United Kingdom", input: "Controller" },
        { page: "Panic_(American_player)", id: "Panic", nat: "United States", input: "Controller" },
      ] },
      { place: "11", team: "Rex Regum Qeon", teamPage: "", players: [
        { page: "Prycyy", id: "Prycyy", nat: "Indonesia", input: "Controller" },
      ] },
    ],
  };
  const rosterOk = { ok: true, kind: "ok", message: "", data: roster };

  test("名单到了：冠军队员、名次行、选手榜行连上；对不上的不能点", async () => {
    const { inst } = loadPage("matches", { responses: { proRoster: rosterOk } });
    inst.onLoad();
    await flush();
    const r = inst.data.result;
    if (!r) return;   // 快照换成了别的比赛，这条测试的名单就不对了
    assert.deepEqual(r.champChips.map((c) => c.page), ["Zer0", "Sikezz", "Panic_(American_player)"]);
    const row = (team) => r.rows.find((x) => x.team === team);
    assert.equal(row("Team Liquid").ti, 0);
    assert.equal(row("Team RRQ").ti, 1, "Team RRQ 名字对不上，按名次 11 对到 Rex Regum Qeon");
    assert.equal(row("Team Vision").ti, -1, "名单里没有的队不能点");
    const panic = r.playerRows.find((x) => /PanicApex/.test(x.player));
    if (panic) assert.equal(panic.page, "Panic_(American_player)", "TL PanicApex 去掉队名缩写后对到 Panic");
  });

  test("点名次行 → 弹层里是三名队员（带国籍 · 键鼠/手柄）；点队员 → 选手页", async () => {
    const { inst } = loadPage("matches", { responses: { proRoster: rosterOk } });
    const urls = [];
    global.wx.navigateTo = (o) => urls.push(o.url);
    inst.onLoad();
    await flush();
    if (!inst.data.result) return;
    inst.onRankTeam({ currentTarget: { dataset: { ti: 0 } } });
    const t = inst.data.openTeam;
    assert.equal(t.name, "Team Liquid");
    assert.equal(t.groupName, "第 1 名");
    assert.deepEqual(t.players.map((p) => p.meta), ["澳大利亚 · 键鼠", "英国 · 手柄", "美国 · 手柄"]);
    inst.onOpenPlayer({ currentTarget: { dataset: { page: t.players[2].page } } });
    assert.deepEqual(urls, ["/pro/player/player?page=Panic_(American_player)"]);
    // 没连上的（page 为空）点了没反应
    inst.onOpenPlayer({ currentTarget: { dataset: { page: "" } } });
    inst.onRankTeam({ currentTarget: { dataset: { ti: -1 } } });
    assert.equal(urls.length, 1);
  });

  test("有战队页的队：冠军队名能点、弹层第一行是「战队主页」；没有战队页的队没有这一行", async () => {
    const { inst } = loadPage("matches", { responses: { proRoster: rosterOk } });
    const urls = [];
    global.wx.navigateTo = (o) => urls.push(o.url);
    inst.onLoad();
    await flush();
    if (!inst.data.result) return;
    assert.equal(inst.data.result.champTeamPage, "Team_Liquid");
    inst.onRankTeam({ currentTarget: { dataset: { ti: 0 } } });
    assert.equal(inst.data.openTeam.teamPage, "Team_Liquid");
    inst.onOpenTeam({ currentTarget: { dataset: { page: inst.data.openTeam.teamPage } } });
    assert.deepEqual(urls, ["/pro/team/team?page=Team_Liquid"]);
    inst.onRankTeam({ currentTarget: { dataset: { ti: 1 } } });
    assert.equal(inst.data.openTeam.teamPage, "");
    inst.onOpenTeam({ currentTarget: { dataset: { page: "" } } });
    assert.equal(urls.length, 1, "没有战队页的点了没反应");
  });

  test("名单要不到（云函数挂了）：内容照常，什么都不能点", async () => {
    const { inst } = loadPage("matches", { failAll: true });
    inst.onLoad();
    await flush();
    if (!inst.data.result) return;
    assert.ok(inst.data.result.rows.length >= 10, "最终成绩照常显示");
    assert.equal(inst.data.result.champChips, undefined, "没有名单就不出队员块，照旧一行字");
    assert.ok(!inst.data.result.champTeamPage, "冠军队名也不能点");
    assert.ok(inst.data.result.rows.every((x) => !(x.ti >= 0)));
  });
});

/* ============================================================
   战队页（2026-11-07，分包 pro/team；数据来自 Liquipedia，云函数 proTeam 只读数据库）
   ============================================================ */
describe("战队页", () => {
  const mem = (id, o) => Object.assign({ page: id, id, type: "player", nat: "", join: "2025-01-01", leave: "", status: "active", role: "", hasPage: true }, o);
  const data = {
    page: "Team_Liquid", at: 1,
    info: { page: "Team_Liquid", name: "Team Liquid", region: "North America", status: "active", created: "", disbanded: "", earnings: 100 },
    members: [mem("A"), mem("B", { hasPage: false }), mem("C"),
      ...Array.from({ length: 7 }, (_, i) => mem("F" + i, { join: "2020-01-01", leave: "2021-01-0" + (i + 1), status: "former" }))],
    results: [{ date: "2026-01-01", event: "E", tournament: "E", tier: "1", tierType: "", place: "1", prize: 1, team: "Team Liquid" }],
    transfers: Array.from({ length: 6 }, (_, i) => ({ date: "2025-0" + (i + 1) + "-01", page: "A", id: "A", nat: "", move: "join", from: "", to: "", k1: "player", k2: "player", r1: "", r2: "", hasPage: true })),
  };

  test("读到了：每块都出，阵容变动先 4 次、历任队员先 5 个，点「查看全部」才全列", async () => {
    const { inst, calls } = loadPage("pro/team", { responses: { proTeam: { ok: true, kind: "ok", message: "", data } } });
    inst.onLoad({ page: "Team_Liquid" });
    await flush();
    assert.deepEqual(calls.filter((c) => c.name === "apex").map((c) => c.data), [{ action: "proTeam", page: "Team_Liquid" }]);
    assert.equal(inst.data.state, "ready");
    assert.equal(inst.data.v.roster.cards.length, 3);
    assert.equal(inst.data.moves.rows.length, 4);
    assert.equal(inst.data.former.rows.length, 5);
    inst.onMovesMore();
    inst.onFormerMore();
    assert.equal(inst.data.moves.rows.length, 6);
    assert.equal(inst.data.former.rows.length, 7);
  });

  test("点选手 → 选手页；没收录的人点了没反应", async () => {
    const { inst } = loadPage("pro/team", { responses: { proTeam: { ok: true, kind: "ok", message: "", data } } });
    const urls = [];
    global.wx.navigateTo = (o) => urls.push(o.url);
    inst.onLoad({ page: "Team_Liquid" });
    await flush();
    const cards = inst.data.v.roster.cards;
    cards.forEach((c) => inst.onOpenPlayer({ currentTarget: { dataset: { page: c.page } } }));
    assert.deepEqual(urls, ["/pro/player/player?page=A", "/pro/player/player?page=C"]);
  });

  test("选手卡照片加载失败：这张卡换回剪影，展开别的块重算时也不再试", async () => {
    const withPhoto = Object.assign({}, data, { members: data.members.map((m) => (m.id === "A" ? Object.assign({}, m, { photo: "cloud://e.b/a_card.webp" }) : m)) });
    const { inst } = loadPage("pro/team", { responses: { proTeam: { ok: true, kind: "ok", message: "", data: withPhoto } } });
    inst.onLoad({ page: "Team_Liquid" });
    await flush();
    assert.equal(inst.data.v.roster.cards[0].photo, "cloud://e.b/a_card.webp");
    inst.onCardPhotoError({ currentTarget: { dataset: { i: 0 } } });
    assert.equal(inst.data.v.roster.cards[0].photo, "");
    inst.onMovesMore();
    assert.equal(inst.data.v.roster.cards[0].photo, "", "重算以后还是剪影");
  });

  test("数据库里没有这支队：写「还没有这支战队的资料」；云函数挂了：出错 + 重试", async () => {
    const empty = loadPage("pro/team", { responses: { proTeam: { ok: true, kind: "ok", message: "", data: null } } }).inst;
    empty.onLoad({ page: "Nobody" });
    await flush();
    assert.equal(empty.data.state, "empty");
    const bad = loadPage("pro/team", { failAll: true }).inst;
    bad.onLoad({ page: "Team_Liquid" });
    await flush();
    assert.equal(bad.data.state, "error");
  });
});

describe("选手页 · 照片", () => {
  test("大卡照片加载失败：换回剪影，重算也不再试", async () => {
    const raw = { page: "Zer0", photo: "cloud://e.b/p_Zer0_hero.webp", profile: { id: "Zer0", nats: [], legends: [] }, history: [], results: null, mates: null, teamPages: {}, at: 1 };
    const { inst } = loadPage("pro/player", { responses: { proPlayer: { ok: true, kind: "ok", message: "", data: raw } } });
    inst.onLoad({ page: "Zer0" });
    await flush();
    assert.equal(inst.data.v.photo, "cloud://e.b/p_Zer0_hero.webp");
    inst.onPhotoError();
    assert.equal(inst.data.v.photo, "");
    inst.onResMore();
    assert.equal(inst.data.v.photo, "");
  });
});

/* ============================================================
   「我的」（2026-11-08 照 August 的设计稿改版）：上半部分是 evo 组件，这里测下面的设置列表
   ============================================================ */
describe("我的 · 设置列表", () => {
  const withSheet = (pick) => { global.wx.showActionSheet = (o) => { o.itemList.length; o.success({ tapIndex: pick(o.itemList) }); }; };

  test("右边写现在的值；分享卡片默认不显示游戏名，选了以后记住", () => {
    const { inst } = loadPage("me");
    inst.onLoad();
    inst.onShow();
    assert.equal(inst.data.shareText, "不显示游戏名");
    assert.equal(inst.data.langText, "简体中文");
    withSheet((items) => items.indexOf("显示游戏名"));
    inst.onShareSetting();
    assert.equal(inst.data.shareText, "显示游戏名");
    assert.equal(require(path.join(MP, "utils", "prefs.js")).get("shareName"), true);
  });

  test("外观三选一：跟随系统 / 深色 / 浅色；选深色页面跟着换", () => {
    const { inst } = loadPage("me");
    inst.onLoad();
    inst.onShow();
    let items = null;
    global.wx.showActionSheet = (o) => { items = o.itemList; o.success({ tapIndex: 1 }); };
    inst.onAppearance();
    assert.deepEqual(items, ["跟随系统", "深色", "浅色"]);
    assert.equal(inst.data.theme, "dark");
    assert.equal(inst.data.themeText, "深色");
  });

  test("加入玩家群 → 玩家群页（QQ 群，写群号、放二维码）", () => {
    const { inst } = loadPage("me");
    const urls = [];
    global.wx.navigateTo = (o) => urls.push(o.url);
    inst.onGroup();
    assert.deepEqual(urls, ["/evo/group/group"]);
    const g = loadPage("evo/group").inst;
    g.onShow();
    assert.equal(g.data.number, "1128519951");
    assert.match(g.data.T.groupHow, /QQ/);
  });

  test("语言换成 English：整页文案跟着换", () => {
    const { inst } = loadPage("me");
    inst.onLoad();
    inst.onShow();
    withSheet((items) => items.indexOf("English"));
    inst.onLanguage();
    assert.equal(inst.data.lang, "en");
    assert.equal(inst.data.langText, "English");
    assert.equal(inst.data.T.meTheme, "Appearance");
    require(path.join(MP, "utils", "i18n.js")).setLang("zh");   // 别影响后面的测试
  });
});

/* ============================================================
   小游戏（2026-10 用户要求）
   第 4 个 tab 从「猜圈」扩成「小游戏」分类：分类页 → 猜圈练习 / 轮盘。
   这两个页面都是**本地数据 + 纯前端随机**，不联网，所以一进来就该是可用状态。
   ============================================================ */
const wd = require(path.join(MP, "utils", "wheel_data.js"));

describe("小游戏分类页", () => {
  test("onLoad 立刻就有两个入口的规模（本地数据，不等网络）", () => {
    const { inst, calls } = loadPage("games", {});
    inst.onLoad();
    // 英雄与枪的数量是现算的；两个题量抄在 utils/games_meta.js（下一条拿真题库核对）
    assert.match(inst.data.ringMeta, /\d/, "题库条数没算出来：" + inst.data.ringMeta);
    assert.match(inst.data.wheelMeta, /\d+\D+\d+/, "英雄/枪数量没算出来：" + inst.data.wheelMeta);
    assert.deepEqual(actionsOf(calls), [], "这一页全是本地数据，不该请求云函数");
  });

  test("分类页抄的两个题量和分包里的真题库一致（utils/games_meta.js）", () => {
    // 2026-11-07 题库随小游戏搬进分包 games/，主包里的分类页读不到，只能抄数。题库一更新这条就会红。
    const meta = require(path.join(MP, "utils", "games_meta.js"));
    const rings = require(path.join(MP, "games", "utils", "rings.js"));
    const ringpick = require(path.join(MP, "games", "utils", "ringpick.js"));
    const ringN = rings.allQuestions().length;
    const pickN = ringpick.bank().length;
    assert.equal(meta.ringQuestions, ringN, "猜圈题库现在是 " + ringN + " 道：把 utils/games_meta.js 的 ringQuestions 改成 " + ringN);
    assert.equal(meta.pickQuestions, pickN, "速判题库现在是 " + pickN + " 组：把 utils/games_meta.js 的 pickQuestions 改成 " + pickN);
    const { inst } = loadPage("games", {});
    inst.onLoad();
    assert.ok(inst.data.ringMeta.indexOf(String(ringN)) >= 0, "猜圈入口没显示题量：" + inst.data.ringMeta);
    assert.ok(inst.data.pickMeta.indexOf(String(pickN)) >= 0, "速判入口没显示题量：" + inst.data.pickMeta);
  });

  test("点入口只进白名单里的页面（不拿 dataset 直接拼 URL）", () => {
    const { inst } = loadPage("games", {});
    inst.onLoad();
    const urls = [];
    global.wx.navigateTo = (o) => urls.push(o.url);
    inst.onOpen({ currentTarget: { dataset: { p: "wheel" } } });
    inst.onOpen({ currentTarget: { dataset: { p: "ringguessr" } } });
    inst.onOpen({ currentTarget: { dataset: { p: "ringpick" } } });
    // 认不出的页面名（比如被改过的 dataset）一律不跳
    inst.onOpen({ currentTarget: { dataset: { p: "../maps/maps" } } });
    assert.deepEqual(urls, [
      "/games/wheel/wheel",
      "/games/ringguessr/ringguessr",
      "/games/ringpick/ringpick"
    ]);
  });

  test("切语言后入口的规模文案也跟着换（不能只换标题）", () => {
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    i18n.setLang("zh");
    const { inst } = loadPage("games", {});
    inst.onLoad();
    const zh = inst.data.ringMeta;
    try {
      inst.onLang({ currentTarget: { dataset: { l: "en" } } });
      assert.notEqual(inst.data.ringMeta, zh, "英文模式下还是中文文案");
      assert.ok(!/[\u4e00-\u9fff]/.test(inst.data.wheelMeta), "英文模式下 wheelMeta 混了中文");
    } finally {
      i18n.setLang("zh");
    }
  });
});

describe("轮盘页", () => {
  /** 转盘有 2.6 秒动画；测试里直接结束动画（finishSpin 就是定时器的回调） */
  function spin(inst) {
    inst.onSpin();
    assert.equal(inst.data.spinning, true, "点抽取后应当进入转动中");
    const rot = inst.data.rot;
    inst.finishSpin();
    assert.equal(inst.data.spinning, false);
    return rot;
  }

  test("英雄轮盘：片数 = 候选英雄数，两个轮盘 / 两种玩法都在", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    const n = wd.heroes().length;
    assert.equal(inst.data.spots.length, n);
    assert.equal(inst.data.wedges.length, n);
    assert.equal(inst.data.tabs.length, 2);
    assert.equal(inst.data.modes.length, 2);
    assert.equal(inst.data.modes[0].on, true, "默认第一个玩法（抽一位英雄）");
    assert.equal(inst.data.result, null, "还没抽就不该有结果");
    assert.ok(inst.data.poolText.indexOf(String(n)) >= 0, "池子文案里要写清有多少位英雄");
  });

  test("切到武器轮盘：池子换成枪，玩法换成「一长一短 / 两把随机」", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    const heroCount = inst.data.spots.length;
    inst.onTab({ currentTarget: { dataset: { i: 1 } } });
    assert.equal(inst.data.spots.length, wd.weapons().length);
    assert.notEqual(inst.data.spots.length, heroCount);
    assert.equal(inst.data.modes[0].on, true, "换轮盘后回到该轮盘的第一个玩法");
    assert.equal(inst.data.result, null, "换池子要把上一轮结果清掉");
  });

  test("抽一位英雄：正好一片高亮，且指针正对那一片的中线", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    const rot = spin(inst);
    const n = inst.data.spots.length;
    const lit = inst.data.spots.filter((s) => s.on);
    assert.equal(lit.length, 1, "抽一位就只能亮一片");
    assert.equal(inst.data.result.rows.length, 1);
    assert.ok(inst.data.result.rows[0].name, "结果要有人名");
    // 指针钉在正上方：转到 rot 之后，中奖扇形的中线应当正好落在 0°
    const at = ((rot % 360) + wd.midAngle(lit[0].i, n)) % 360;
    assert.ok(at < 0.05 || at > 359.95, "指针没对准结果那一片，实际偏 " + at + "°");
  });

  test("三人英雄组合：抽 3 位不重复的英雄", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    inst.onMode({ currentTarget: { dataset: { i: 1 } } });   // 英雄轮盘的第二个玩法
    spin(inst);
    const rows = inst.data.result.rows;
    assert.equal(rows.length, 3);
    assert.equal(new Set(rows.map((r) => r.name)).size, 3, "三个人不能重样");
    assert.equal(inst.data.spots.filter((s) => s.on).length, 3, "三片都要亮起来");
  });

  test("一长一短：一把长枪 + 一把短枪（顺序就是长、短）", () => {
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    i18n.setLang("zh");
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    inst.onTab({ currentTarget: { dataset: { i: 1 } } });    // 武器轮盘
    inst.onMode({ currentTarget: { dataset: { i: 0 } } });   // 一长一短
    spin(inst);
    const rows = inst.data.result.rows;
    assert.equal(rows.length, 2);
    assert.match(rows[0].tag, /长/, "第一把应当是长枪：" + rows[0].tag);
    assert.match(rows[1].tag, /短/, "第二把应当是短枪：" + rows[1].tag);
    assert.notEqual(rows[0].name, rows[1].name);
  });

  test("两把随机：两把不重复（可以同枪种）", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    inst.onTab({ currentTarget: { dataset: { i: 1 } } });
    inst.onMode({ currentTarget: { dataset: { i: 1 } } });   // 两把随机
    spin(inst);
    const rows = inst.data.result.rows;
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].name, rows[1].name);
  });

  test("转动中再点抽取不会重复抽；也不许换轮盘", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    inst.onSpin();
    const rot = inst.data.rot;
    inst.onSpin();                                   // 连点：不该重新开始
    inst.onTab({ currentTarget: { dataset: { i: 1 } } });
    inst.onMode({ currentTarget: { dataset: { i: 1 } } });
    assert.equal(inst.data.rot, rot, "连点不该再转一次");
    assert.equal(inst.data.spots.length, wd.heroes().length, "转动中不许换池子");
    inst.finishSpin();                               // 收尾，把定时器清掉
    assert.equal(inst.data.spinning, false);
  });

  test("空抽合不崩：没有结果时 finishSpin 什么也不做", () => {
    const { inst } = loadPage("games/wheel", {});
    inst.onLoad();
    inst.finishSpin();
    assert.equal(inst.data.result, null);
  });
});

/* ============================================================
   圈型速判（2026-10 新增）：一题 10 秒、四选一、5 题一局
   ============================================================ */
const rp = require(path.join(MP, "games", "utils", "ringpick.js"));

describe("圈型速判页", () => {
  /** 加载一页并保证语言是中文（语言是模块级状态，会被别的用例改） */
  function pickPage() {
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    i18n.setLang("zh");
    const { inst } = loadPage("games/ringpick", {});
    inst.onLoad();
    return inst;
  }

  const tap = (i) => ({ currentTarget: { dataset: { i } } });

  test("onLoad 就有一题：四个字母、10 秒、底图放大参数都在", () => {
    const inst = pickPage();
    assert.equal(inst.data.noData, false);
    assert.equal(inst.data.phase, "guess");
    assert.deepEqual(inst.data.options.map((o) => o.label), ["A", "B", "C", "D"]);
    assert.equal(inst.data.leftSec, 10);
    assert.equal(inst.data.leftPct, 100);
    assert.match(inst.data.roundText, /1\s*\/\s*5/);
    assert.ok(inst.data.image.length > 0, "没有底图");
    assert.match(inst.data.world, /scale\(/, "底图没有放大/平移");
    assert.ok(inst.data.ring && inst.data.ring.style.indexOf("%") > 0, "第一个圈没定位");
    assert.equal(inst.data.marks, null, "答案圈在答题前不该出现");
  });

  test("点对了：+20 分、结果说答对了、真实的下一个圈画出来", () => {
    const inst = pickPage();
    inst.onPick(tap(inst._view.answerIndex));
    assert.equal(inst.data.phase, "result");
    assert.equal(inst.data.score, 20);
    assert.equal(inst.data.best, 20);
    assert.equal(inst.data.result.hit, true);
    assert.ok(inst.data.marks, "答完必须把真实的下一个圈画出来");
    // 四个点里恰好一个标成"对"
    assert.equal(inst.data.options.filter((o) => o.cls === "qp-hit").length, 1);
    assert.equal(inst.data.options.filter((o) => o.cls === "qp-miss").length, 0);
    assert.equal(inst.data.done, false);
  });

  test("点错了：不加分、结果写清正确点是哪个字母", () => {
    const inst = pickPage();
    const right = inst._view.answerIndex;
    inst.onPick(tap((right + 1) % 4));
    assert.equal(inst.data.score, 0);
    assert.equal(inst.data.result.hit, false);
    assert.match(inst.data.result.message, /正确点是/);
    assert.equal(inst.data.options.filter((o) => o.cls === "qp-hit").length, 1, "正确答案要标出来");
    assert.equal(inst.data.options.filter((o) => o.cls === "qp-miss").length, 1, "选错的那个要标出来");
    // 结果里会尽量写出"差几个圈半径"
    assert.match(inst.data.result.message, /圈半径/);
  });

  test("超时：不加分，标题是超时", () => {
    const inst = pickPage();
    inst._elapsed = 11000;
    inst._t0r = 0;
    inst.tick();
    assert.equal(inst.data.phase, "result");
    assert.equal(inst.data.score, 0);
    assert.equal(inst.data.result.hit, false);
    assert.equal(inst.data.result.title, inst.data.T.rpTimeout);
    assert.ok(inst.data.marks, "超时也要把答案画出来");
  });

  test("下一题：换题、计时归零；连对 5 题满分 100 并给出汇总", () => {
    const inst = pickPage();
    for (let k = 0; k < 5; k++) {
      inst.onPick(tap(inst._view.answerIndex));
      if (k < 4) {
        inst.onNext();
        assert.equal(inst.data.phase, "guess");
        assert.equal(inst.data.leftSec, 10);
        assert.equal(inst.data.result, null);
        assert.match(inst.data.roundText, new RegExp(String(k + 2) + "\\s*/\\s*5"));
      }
    }
    assert.equal(inst.data.score, 100);
    assert.equal(inst.data.best, 100);
    assert.equal(inst.data.done, true);
    assert.match(inst.data.summary, /5/);
    // 答完之后再点选项不该改分（phase 已经不是 guess）
    inst.onPick(tap(0));
    assert.equal(inst.data.score, 100);
  });

  test("再来一局：分数清零、回到第 1 题", () => {
    const inst = pickPage();
    inst.onPick(tap(inst._view.answerIndex));
    inst.onNext();
    inst.onAgain();
    assert.equal(inst.data.score, 0);
    assert.equal(inst.data.done, false);
    assert.equal(inst.data.summary, "");
    assert.equal(inst.data.phase, "guess");
    assert.match(inst.data.roundText, /1\s*\/\s*5/);
  });

  test("切语言：题目本身不变，只换图名和题号文案", () => {
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    const inst = pickPage();
    const before = inst.data.options.map((o) => o.style);
    const zhMap = inst.data.mapName;
    try {
      i18n.setLang("en");
      inst.onShow();
      assert.deepEqual(inst.data.options.map((o) => o.style), before, "切语言不许换题");
      assert.notEqual(inst.data.mapName, zhMap);
      assert.match(inst.data.roundText, /Question/);
      assert.match(inst.data.T.rpAsk, /next/);
    } finally {
      i18n.setLang("zh");
    }
  });
});
