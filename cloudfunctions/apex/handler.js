/**
 * 云函数业务逻辑（与 wx-server-sdk 解耦，方便在 Node 里直接跑单元测试）。
 *
 * 为什么归一化放在云函数而不是小程序端：
 *   小程序一旦发布，改一行都要重新提审。而上游（Apex Legends Status）
 *   改字段名是真实发生过的事（arenas 被废弃、predator 结构换过形态）。
 *   放在云函数里，上游一变我改完直接部署，用户不用等审核、也不用更新版本。
 *
 * 同理，API Key 只存在于云函数环境变量里：
 *   别人打开小程序就能用，不需要自己领 Key，也不用担心 Key 泄露到客户端。
 */

var core = require("./core");
var esports = require("./esports");

var BASE = "https://api.apexlegendsstatus.com";
// 我们自己的超时。必须**明显小于云函数平台的超时上限**：
// 平台默认只有 3 秒，被平台掐掉时用户看到的是一大坨 -504003 英文报错；
// 我们自己主动超时，就能返回一句干净的中文。
// 控制台里请把云函数超时时间调到 20 秒，这里留一半余量。
var DEFAULT_TIMEOUT = 8000;

// 缓存：保护上游配额（免费 Key 限流）和云函数外网出流量（套餐 2GB/月）。
// 地图轮换 15 分钟~4.5 小时才变一次，30 秒缓存对用户完全无感。
// 猎杀分数线按小时更新，缓存久一点。
// 服务器状态随时可能恢复或再挂，缓存必须短 —— 一直显示已经不存在的故障
// 会让人白等，比多打几次上游糟糕。
var CACHE_TTL = {
  rotation: 30 * 1000,
  predator: 10 * 60 * 1000,
  servers: 60 * 1000
};

// 模块级缓存。云函数实例复用期间有效，冷启动后自然失效 —— 够用了，
// 不值得为此引入云数据库（那会额外计费，还会拖慢响应）。
var cache = Object.create(null);

var UPSTREAM_PATH = {
  rotation: "/maprotation",
  predator: "/predator",
  servers: "/servers",
  player: "/bridge"
};

// 允许的 action 集中放一处，免得以后加接口时漏改某个 if
var ACTIONS = ["rotation", "predator", "player", "servers", "esports", "trackAdd", "trackList", "trackRemove",
  "prostats", "prostatsSet"];

function buildUrl(action, event, deps, asUid) {
  var base = ((deps && deps.baseUrl) || BASE).replace(/\/+$/, "");
  var u = new URL(base + (UPSTREAM_PATH[action] || UPSTREAM_PATH.player));
  // 只有 /maprotation 认 version 参数，别的接口送上去没有意义
  if (action === "rotation") u.searchParams.set("version", "2");
  if (action === "player") {
    // uid 精确查：游戏内 ID 不唯一（Steam 玩家尤其常见），
    // 分享链接会带上 uid，用它查就一定是同一个人，不会被同名的另一个账号顶掉。
    if (asUid) u.searchParams.set("uid", String(event.uid || event.player));
    else u.searchParams.set("player", String(event.player));
    u.searchParams.set("platform", String(event.platform || "PC"));
    u.searchParams.set("version", "5");
  }
  return u;
}

async function fetchUpstream(action, event, deps, asUid) {
  var apiKey = deps.apiKey;
  var u = buildUrl(action, event, deps, asUid);
  u.searchParams.set("auth", apiKey);

  // 默认用自带的 http/https 实现，**不能依赖全局 fetch**：
  // 微信云开发的 Node 运行时是 16，没有全局 fetch（Node 18 才内置），
  // 真机实测会直接返回 "运行环境不支持 fetch。"。
  var impl = deps.fetchImpl || require("./fetcher").requestText;

  var res, text;
  try {
    // 刻意不设任何请求头：带 Accept: application/json 会触发上游
    // Apache 内容协商返回 406，而该响应没有 CORS 头 —— 这一条在网页版
    // 曾让工具对所有用户失效，别再犯。
    res = await impl(u.toString(), { timeoutMs: deps.timeoutMs || DEFAULT_TIMEOUT });
    text = await res.text();
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, kind: "timeout", message: "上游响应超时。" + core.MSG.ratelimit };
    return { ok: false, kind: "network", message: "连不上数据源服务器。" };
  }

  var r = core.classifyUpstream(res.status, text);
  // 「查无此人」上游也返回 200，正文里带 Error 文本。
  // classifyUpstream 已经会归到 notfound（联机校验验证过），
  // 这里不重复加启发式判断 —— 多一层猜测只会带来误判。
  return r;
}

/**
 * @param {{action:string, player?:string, platform?:string}} event
 * @param {{apiKey:string, fetchImpl?:Function, now?:Function, timeoutMs?:number}} deps
 * @returns {Promise<{ok:boolean, kind:string, message:string, data?:any, cached?:boolean}>}
 */
async function handle(event, deps) {
  event = event || {};
  deps = deps || {};
  var action = event.action;
  var now = deps.now || Date.now;

  if (ACTIONS.indexOf(action) < 0) {
    return { ok: false, kind: "action", message: core.MSG.action };
  }
  // 赛事数据来自 overstat.gg 的**公开**接口，不需要上游 API Key，
  // 所以必须在下面的 nokey 检查**之前**分流：
  // 否则只要环境里没配 Apex API Key，这一路就会被判成"未配置"直接挡掉。
  if (action === "esports") {
    var mid = event.matchId || event.id;
    var sch = await esports.schedule(mid, deps, now);
    var st = await esports.standings(mid, deps, now);
    if (!sch && !st) {
      return { ok: false, kind: "upstream", message: "赛事数据暂时取不到。" };
    }
    return { ok: true, kind: "ok", message: "", data: { schedule: sch, standings: st }, cached: false };
  }
  // 主播排位数据（热更新）：读云数据库里的那一条，读不到就让前端用包内快照。
  // 和 esports 一样放在 nokey 检查**之前** —— 这条路完全不碰上游 API。
  if (action === "prostats") {
    if (!deps.prostats) {
      return { ok: false, kind: "unsupported", message: "热更新仅微信小程序可用。" };
    }
    var hot = await deps.prostats.read();
    if (!hot || !hot.players || !hot.players.length) {
      return { ok: false, kind: "empty", message: "云端还没有主播数据。" };
    }
    return { ok: true, kind: "ok", message: "", data: hot, cached: false };
  }

  // 写入口：给识别脚本推送用。**token 只存在云函数环境变量里**，
  // 小程序端不持有它（客户端发的 prostatsSet 一律会被拒），所以不能靠它改数据。
  if (action === "prostatsSet") {
    var expect = String(deps.prostatsToken || "").trim();
    if (!expect || String(event.token || "") !== expect) {
      return { ok: false, kind: "forbidden", message: "没有写入权限。" };
    }
    if (!deps.prostats) {
      return { ok: false, kind: "unsupported", message: "云端存储没初始化，无法写入。" };
    }
    var payload = event.payload;
    if (!payload || !Array.isArray(payload.players) || !payload.players.length) {
      return { ok: false, kind: "badparam", message: "payload 不合法。" };
    }
    var wrote = await deps.prostats.write(payload);
    if (!wrote) return { ok: false, kind: "internal", message: "写入失败，请检查 prostats 集合。" };
    return { ok: true, kind: "ok", message: "", data: { players: payload.players.length } };
  }

  if (!deps.apiKey) {
    return { ok: false, kind: "nokey", message: core.MSG.nokey };
  }  // 追踪（增删查）走数据库，和上面"查上游"是两条独立的路
  if (action === "trackAdd" || action === "trackList" || action === "trackRemove") {
    return await handleTrack(event, deps);
  }
  // 玩家查询：给名字或 uid 都行（uid 用来精确指定同名账号里的某一个）
  if (action === "player" && !core.isUidLike(event.uid) && (!event.player || !String(event.player).trim())) {
    return { ok: false, kind: "badparam", message: "请输入玩家 ID。" };
  }

  // 只缓存与个人无关的数据
  var cacheKey = (action === "rotation" || action === "predator" || action === "servers") ? action : null;
  if (cacheKey) {
    var hit = cache[cacheKey];
    if (hit && (now() - hit.at) < CACHE_TTL[cacheKey]) {
      return { ok: true, kind: "ok", message: "", data: hit.data, cached: true };
    }
  }

  // 有 uid 就直接按 uid 查（分享链接会带上），否则按名字查。
  // 注意 uid 只可能是"精确指定某个人"，不会用来枚举同名的人 ——
  // 上游没有"按名字列出所有同名账号"的接口，那件事做不到。
  var asUid = action === "player" && core.isUidLike(event.uid);

  var r = await fetchUpstream(action, event, deps, asUid);

  // 用户可能直接把 uid 粘进输入框。**先当名字查**，查不到再当 uid 试一次：
  // 这样纯数字的玩家名照样能用（不会因为"像 uid"就被抢走），
  // 而真正的 uid 也能查出来。只多打一次上游，且只在失败的分支上。
  if (action === "player" && !asUid && r.kind === "notfound" && core.isUidLike(event.player)) {
    r = await fetchUpstream(action, event, deps, true);
  }

  // 注意：classifyUpstream 返回的是 {kind, message, data}，没有 ok 字段。
  // 曾经在这里写成 if (!r.ok) —— undefined 取反为真，导致**每一次成功的请求
  // 都被当成失败返回**，而缓存因为"失败不缓存"永远不生效。靠测试抓出来的。
  if (r.kind !== "ok") return { ok: false, kind: r.kind, message: r.message };

  var data;
  if (action === "rotation") {
    data = {
      modes: core.normalizeRotation(r.data),
      unknownKeys: core.unknownModeKeys(r.data)
    };
  } else if (action === "predator") {
    var group = core.normalizePredator(r.data);
    await withDeltas(group, deps, now);
    data = { group: group };
  } else if (action === "servers") {
    // 认不出来就如实给 null，界面据此整块不显示，别硬凑一行「全部正常」
    data = { servers: core.normalizeServers(r.data) };
  } else {
    data = { player: core.normalizePlayer(r.data) };
  }

  // 失败结果不进缓存，否则一次抖动会污染整个 TTL
  if (cacheKey) cache[cacheKey] = { at: now(), data: data };

  return { ok: true, kind: "ok", message: "", data: data, cached: false };
}

/* ============================================================
   猎杀底分涨幅（较昨日同期）
   ============================================================ */

// 查库/写库最多等这么久。**这不是性能优化，是防呆**：
// 数据库一旦卡住，不能把整次请求拖到云函数超时，
// 那样用户连分数线都看不到了 —— 涨幅只是锦上添花。
var SNAPSHOT_TIMEOUT_MS = 1500;

/** 给任意 promise 套一层超时；出错或超时都返回 null，绝不抛出 */
function settle(promise, ms) {
  return new Promise(function (resolve) {
    var done = false;
    var finish = function (v) { if (!done) { done = true; resolve(v); } };
    var timer = setTimeout(function () { finish(null); }, ms);
    Promise.resolve(promise).then(
      function (v) { clearTimeout(timer); finish(v); },
      function () { clearTimeout(timer); finish(null); }
    );
  });
}

/**
 * 往分组上贴涨幅，并顺手记一条当前快照。
 *
 * deps.snapshots 由调用方注入（小程序云函数注入真库，网页版不注入）：
 *   readBasis(nowMs)            -> Promise<{at, plats}|null>
 *   writeCurrent(group, nowMs)  -> Promise<void>
 *
 * 这个文件是小程序和网页版**逐字节相同**的共用文件，所以这里只能按接口调用，
 * 不能 require 任何跟数据库相关的东西。
 */
async function withDeltas(group, deps, now) {
  var store = deps.snapshots;
  if (!store || !group) return;

  var t = now();
  var basis = null;
  if (typeof store.readBasis === "function") {
    basis = await settle(store.readBasis(t), SNAPSHOT_TIMEOUT_MS);
  }
  core.attachPredatorDeltas(group, basis, t);

  // 必须 await：云函数返回后没跑完的异步任务会被掐掉，这一条就永远记不上
  if (typeof store.writeCurrent === "function") {
    await settle(store.writeCurrent(group, t), SNAPSHOT_TIMEOUT_MS);
  }
}

/* ============================================================
   排位追踪（增删查）
   ============================================================ */

// 每人最多追踪多少个（免费额度）
var TRACK_QUOTA = 5;

/** 当前分 vs 约 24 小时前 → 涨幅文案。没有基准就空串，绝不显示 +0 */
function playerDeltaText(currentRp, basis) {
  if (typeof currentRp !== "number" || !isFinite(currentRp)) return "";
  if (!basis || typeof basis.rp !== "number" || !isFinite(basis.rp)) return "";
  var d = currentRp - basis.rp;
  if (d === 0) return "±0";
  return (d > 0 ? "+" : "−") + core.num(Math.abs(d));
}

/**
 * 追踪三个 action。依赖 deps.playerStore（数据库）和 deps.openid（谁在操作）。
 * 网页版没有数据库、也没有 openid，两者都不注入 → 一律降级成「仅小程序可用」。
 */
async function handleTrack(event, deps) {
  var store = deps.playerStore;
  if (!store) return { ok: false, kind: "unsupported", message: "追踪功能仅微信小程序可用。" };
  if (!deps.openid) return { ok: false, kind: "badparam", message: "无法识别用户身份，请重新进入小程序。" };

  var uid = String(event.uid || "").trim();
  var platform = String(event.platform || "PC");

  if (event.action === "trackAdd") {
    if (!core.isUidLike(uid)) return { ok: false, kind: "badparam", message: "请输入正确的 UID（纯数字）。" };

    var count = await settle(store.countBy(deps.openid), SNAPSHOT_TIMEOUT_MS);
    if (count === null) return { ok: false, kind: "http", message: "系统繁忙，请稍后重试。" };
    if (count >= TRACK_QUOTA) {
      return { ok: false, kind: "quota", message: "最多追踪 " + TRACK_QUOTA + " 个，先删掉一个再加。" };
    }

    // 验人：uid 查得到才收，否则名单里会躺一个不存在的账号
    var r = await fetchUpstream("player", { uid: uid, platform: platform }, deps, true);
    if (r.kind !== "ok") {
      if (r.kind === "notfound") return { ok: false, kind: "notfound", message: "查不到这个 UID，请核对后重试。" };
      return { ok: false, kind: r.kind, message: r.message };
    }
    var p = core.normalizePlayer(r.data);
    var added = await settle(store.add({ uid: uid, platform: p.platform || platform, name: p.name, addedBy: deps.openid }), SNAPSHOT_TIMEOUT_MS);
    if (!added) return { ok: false, kind: "http", message: "添加失败，可能已在追踪名单里，请稍后重试。" };

    return { ok: true, kind: "ok", message: "", data: { added: { uid: uid, name: p.name } } };
  }

  if (event.action === "trackList") {
    var list = await settle(store.listBy(deps.openid), SNAPSHOT_TIMEOUT_MS);
    if (!Array.isArray(list)) list = [];
    var t = (deps.now || Date.now)();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var basis = await settle(store.readBasis(item.uid, t), SNAPSHOT_TIMEOUT_MS);
      out.push({
        uid: item.uid,
        name: item.name || "",
        platform: item.platform || "PC",
        lastRp: item.lastRp,
        lastRankName: item.lastRankName || "",
        deltaText: playerDeltaText(item.lastRp, basis),
      });
    }
    return { ok: true, kind: "ok", message: "", data: { list: out, quota: TRACK_QUOTA } };
  }

  if (event.action === "trackRemove") {
    if (!core.isUidLike(uid)) return { ok: false, kind: "badparam", message: "UID 无效。" };
    var removed = await settle(store.removeBy(deps.openid, uid), SNAPSHOT_TIMEOUT_MS);
    return { ok: true, kind: "ok", message: "", data: { removed: !!removed } };
  }

  return { ok: false, kind: "action", message: core.MSG.action };
}

/** 仅测试用：清空模块级缓存 */
function _clearCache() { cache = Object.create(null); }

module.exports = {
  handle: handle,
  fetchUpstream: fetchUpstream,
  _clearCache: _clearCache,
  CACHE_TTL: CACHE_TTL,
  SNAPSHOT_TIMEOUT_MS: SNAPSHOT_TIMEOUT_MS,
  TRACK_QUOTA: TRACK_QUOTA
};
