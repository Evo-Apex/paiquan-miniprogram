/**
 * 云函数入口。
 *
 * 依赖只有一个：wx-server-sdk，而且**只用来存「每小时一条」的猎杀底分快照**，
 * 好算「较昨日同期涨了多少」。上游没有历史接口（实测 /predator/history 返回的就是当前值），
 * 所以这个涨幅只能自己记。
 *
 * 包在 try/catch 里是有意的：万一依赖没装上（比如上传时没选「云端安装依赖」），
 * 这个函数仍然能正常查分数线，只是没有涨幅这个附加信息 ——
 * **不能因为一个附加功能，让整个小程序挂掉。**
 *
 * API Key 从云函数的环境变量读，不写在代码里、也不下发到小程序端。
 * 在「云开发控制台 → 云函数 → apex → 配置 → 环境变量」里加一条：
 *     ALS_API_KEY = 你的 Apex Legends Status API Key
 * 比赛页的选手页（2026-11）还要一条（没配就不抓，选手页显示"还没有资料"，别的功能不受影响）：
 *     LIQUIPEDIA_API_KEY = Liquipedia 数据库 API 的 Key
 */
const { handle } = require("./handler");

let snapshots = null;
let playerStore = null;
let rotationLog = null;
let proStore = null;
let getOpenid = null;
let prostats = null;
try {
  const cloud = require("wx-server-sdk");
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  snapshots = require("./store").createStore(cloud);
  playerStore = require("./playerStore").createPlayerStore(cloud);
  // 职业选手数据（Liquipedia）：定时器抓、前端读，见 proSync.js
  proStore = require("./proStore").createProStore(cloud);
  // 轮换记录器：给"接下来两天几点打哪张图"的表供数（玩法那部分不用记，可以外推）
  rotationLog = require("./rotationLog").createLog(cloud);
  // 主播排位数据（英雄/阵容/配枪）的热更新仓库
  prostats = require("./prostatsStore").createProstatsStore(cloud);
  // 追踪按 openid 隔离（每人最多 5 个）。定时触发器触发的轮询没有用户上下文，openid 为空即可。
  getOpenid = function () {
    try {
      const ctx = cloud.getWXContext();
      return ctx && ctx.OPENID ? ctx.OPENID : "";
    } catch (e) { return ""; }
  };
} catch (e) {
  console.warn("存储没初始化成功，追踪/涨幅功能会缺失：" + (e && e.message ? e.message : String(e)));
}

// 定时器顺带抓一点职业选手数据（每次最多 1 个请求，见 proSync.js）。
// 自己包一层 try：Liquipedia 挂了、Key 没配，都不能影响轮询和轮换记录。
async function syncPro() {
  try {
    const { tick } = require("./proSync");
    const r = await tick({ apiKey: (process.env.LIQUIPEDIA_API_KEY || "").trim(), store: proStore });
    return r && r.did ? r.did : "";
  } catch (e) {
    console.warn("选手数据同步失败：" + (e && e.message ? e.message : String(e)));
    return "error";
  }
}

// 定时触发器调用时，线上传的 Type 是小写 "timer"（2026-11-08 实测）。
// 之前只认大写 "Timer"，定时器每次都调用了函数，但定时任务一次都没跑。大小写都认
function isTimerCall(event) {
  return !!event && typeof event.Type === "string" && event.Type.toLowerCase() === "timer";
}

exports.main = async (event) => {
  const apiKey = (process.env.ALS_API_KEY || "").trim();

  // 定时触发器：只做轮询，不走 handle（那是给前端按需调用走的路）
  if (isTimerCall(event)) {
    try {
      const { poll } = require("./trackerPoll");
      const result = await poll({ apiKey: apiKey, playerStore: playerStore });

      // 顺手记一条轮换。
      // 上游只给"当前 + 下一个"，所以时间表只能靠这样一场一场攒；
      // 定时器每 5 分钟跑一次、轮换 15 分钟一场 → 每场 3 次冗余，不会漏。
      let logged = 0;
      if (rotationLog) {
        try {
          const nowSec = Math.floor(Date.now() / 1000);
          const rot = await handle({ action: "rotation" }, { apiKey: apiKey });
          const modes = (rot && rot.data && rot.data.modes) || [];
          const entries = [];
          modes.forEach(function (m) {
            if (!m || !m.def) return;
            if (m.current) {
              entries.push({
                mode: m.def.id, map: m.current.map, event: m.current.eventName || "",
                start: m.current.start, end: m.current.end
              });
            }
            (m.nexts || []).forEach(function (n) {
              entries.push({
                mode: m.def.id, map: n.map, event: n.eventName || "",
                start: n.start, end: n.end
              });
            });
          });
          logged = await rotationLog.record(entries, nowSec);
          await rotationLog.prune(nowSec);
        } catch (e) {
          // 记录失败不能影响轮询本身
          console.warn("轮换记录失败：" + (e && e.message ? e.message : String(e)));
        }
      }

      const proDid = await syncPro();
      return { ok: true, kind: "ok", message: "poll done", data: Object.assign({}, result, { rotationLogged: logged, proSync: proDid }) };
    } catch (e) {
      await syncPro();
      return { ok: false, kind: "internal", message: "轮询失败：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 职业选手、战队（比赛页的选手页、战队页）：只读数据库，不现查 Liquipedia（它每小时只给 60 次）
  // 比赛页的赛季（五站 + 中国的小比赛 + 自己录入的比赛 + 所有 CN 战队，2026-11-08）：同样只读数据库
  if (event && event.action === "proSeason") {
    try {
      return await require("./proSeason").proSeason(event, { store: proStore });
    } catch (e) {
      console.warn("赛季数据读取失败：" + (e && e.message ? e.message : String(e)));
      return { ok: true, kind: "ok", message: "", data: null };
    }
  }

  if (event && (event.action === "proPlayer" || event.action === "proRoster" || event.action === "proTeam")) {
    try {
      const pro = require("./proSync");
      return await pro[event.action](event, { store: proStore });
    } catch (e) {
      return { ok: false, kind: "internal", message: "选手数据读取失败：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 轮换时间表：返回后台攒下来的场次（记录动作在定时触发器里做）。
  // 拿不到就给空数组 —— 前端会把地图列显示成「待记录」，绝不编。
  if (event && event.action === "schedule") {
    try {
      if (!rotationLog) return { ok: true, kind: "ok", message: "", data: { entries: [] } };
      const nowSec = Math.floor(Date.now() / 1000);
      const entries = await rotationLog.readRange(nowSec - 3600, nowSec + 2 * 24 * 3600);
      return { ok: true, kind: "ok", message: "", data: { entries: entries } };
    } catch (e) {
      return { ok: false, kind: "internal", message: "轮换时间表读取失败：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 站点配置：赛季结束时间 + 活动列表 + 赛程列表。
  //
  // 优先读 site_config 集合 —— 这样你可以在云开发控制台的「数据库」里直接改，
  // 不用改代码、不用重新提审（赛季一换就得发版是很糟糕的设计）。
  // 集合不存在（第一次用就是这样）或读失败时**静默退回内置兜底值**，
  // 绝不把错误抛给用户 —— 页面上少一行倒计时，比弹一个报错好得多。
  //
  // SEASON_FALLBACK = 2027-02-10 01:00 (UTC+8)，按游戏内"第31赛季剩余 96 天"推的（2026-11-06 记）。
  // 小时级，所以误差在 ±1 小时内；换赛季去控制台改 site_config 即可。
  if (event && event.action === "config") {
    const SEASON_FALLBACK = 1802192400;
    const cfg = { season: SEASON_FALLBACK, events: [], matches: [] };
    try {
      const res = await cloud.database().collection("site_config").limit(20).get();
      // 控制台「添加记录」不会用你在对话框里填的文档 ID，一律自己生成一个
      // （2026-11-06 实测两次：prostats 和 site_config 都被换成了 b548…/6677…）。
      // 所以只认 _id === "season" 的话，用户照文档建完记录却读不到，极难排查。
      // 这里改成：优先认 _id === "season"；没有就收下**任何带 endTs 的记录**（取最大的那个）。
      // 带 list 的是 events/matches，跳过。
      let byId = 0, anyEnd = 0;
      (res.data || []).forEach(function (doc) {
        if (doc._id === "events" && Array.isArray(doc.list)) { cfg.events = doc.list; return; }
        if (doc._id === "matches" && Array.isArray(doc.list)) { cfg.matches = doc.list; return; }
        if (!doc.endTs || Array.isArray(doc.list)) return;
        const t = Number(doc.endTs);
        if (!isFinite(t) || t <= 0) return;
        if (doc._id === "season") byId = t;
        else if (t > anyEnd) anyEnd = t;
      });
      cfg.season = byId || anyEnd || SEASON_FALLBACK;
    } catch (e) {
      // 集合还没建：保持兜底值，什么都不说
    }
    return { ok: true, kind: "ok", message: "", data: cfg };
  }

  // 职业热门组合：走 ALGS 赛事页抓取（API 里没有赛事数据），也放独立模块
  if (event && event.action === "comps") {
    try {
      const { handle: compsHandle } = require("./comps");
      return await compsHandle(event, {});
    } catch (e) {
      return { ok: false, kind: "internal", message: "职业组合数据错误：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 英雄选取率：走网页抓取（API 里没有这个数据），也放独立模块
  if (event && event.action === "pickrates") {
    try {
      const { handle: pickHandle } = require("./pickrates");
      return await pickHandle(event, {});
    } catch (e) {
      return { ok: false, kind: "internal", message: "选取率数据错误：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 段位分布：上游有一个**没被人机校验挡的 JSON 接口**，所以这一块是实时的，
  // 不用像 ALGS 那样做离线快照（见 rankdist.js 顶部说明）。
  if (event && event.action === "rankdist") {
    try {
      const { handle: rankHandle } = require("./rankdist");
      return await rankHandle(event, {});
    } catch (e) {
      return { ok: false, kind: "internal", message: "段位分布数据错误：" + (e && e.message ? e.message : String(e)) };
    }
  }

  // 战队专区：读本地名单 + 查分数，走独立模块（不塞进共享的 handler.js）
  if (event && event.action === "teams") {
    try {
      const { handle: teamsHandle } = require("./teams");
      return await teamsHandle(event, { apiKey: apiKey });
    } catch (e) {
      return { ok: false, kind: "internal", message: "战队数据错误：" + (e && e.message ? e.message : String(e)) };
    }
  }

  try {
    return await handle(event, {
      apiKey: apiKey,
      snapshots: snapshots,
      playerStore: playerStore,
      prostats: prostats,
      // 只从环境变量读：写入口的 token 绝不能出现在小程序包里
      prostatsToken: (process.env.PROSTATS_TOKEN || "").trim(),
      openid: getOpenid ? getOpenid() : "",
    });
  } catch (e) {
    // 兜底：绝不让云函数把异常直接抛给小程序，否则前端只能看到一句无意义的报错
    return {
      ok: false,
      kind: "internal",
      message: "云函数内部错误：" + (e && e.message ? e.message : String(e)),
    };
  }
};
