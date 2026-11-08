/**
 * 定时轮询：把追踪名单里的每个 uid 抓一遍，写快照 + 回写最新分数。
 *
 * 只在云函数里用（网页版没有数据库）。由 index.js 在定时触发器触发时调用
 * （event.Type 线上是小写 "timer"，见 index.js 的 isTimerCall），不复用 handler.handle —— 那是给前端按需调用走的路。
 *
 * 安全阀：追踪总人数超过阈值就按 uid 哈希分片，只刷一部分。
 * 实际效果 = 自动降频（每 2 小时 / 每 4 小时一次），用户无感知，
 * 但能把云函数调用量按住，防止博主转发带来的一波注册把账单冲爆。
 */

var core = require("./core");
var handler = require("./handler");

// 超过 200 人刷一半（≈每 2 小时），超过 400 人刷四分之一（≈每 4 小时）
var SHARD_1 = 200;
var SHARD_2 = 400;

/** 稳定哈希（不随进程重启变化），按它决定这一轮要不要刷这个 uid */
function hashUid(uid) {
  var s = String(uid);
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function poll(deps) {
  deps = deps || {};
  var store = deps.playerStore;
  var now = deps.now || Date.now;
  if (!store || typeof store.all !== "function") {
    return { polled: 0, total: 0, divisor: 1, reason: "no store" };
  }

  var all = await store.all();
  if (!Array.isArray(all) || !all.length) return { polled: 0, total: 0, divisor: 1 };

  var total = all.length;
  var divisor = 1;
  if (total > SHARD_2) divisor = 4;
  else if (total > SHARD_1) divisor = 2;

  var polled = 0, skipped = 0;
  for (var i = 0; i < all.length; i++) {
    var item = all[i];
    if (divisor > 1 && hashUid(item.uid) % divisor !== 0) { skipped++; continue; }
    await pollOne(item, deps, now);
    polled++;
  }

  return { polled: polled, total: total, divisor: divisor, skipped: skipped };
}

async function pollOne(item, deps, now) {
  var store = deps.playerStore;
  try {
    var r = await handler.fetchUpstream("player", { uid: item.uid, platform: item.platform }, deps, true);
    if (!r || r.kind !== "ok") return;   // 抓不到就跳过，不中断整批
    var p = core.normalizePlayer(r.data);
    if (typeof store.writeSnapshot === "function") await store.writeSnapshot(item.uid, p, now());
    if (typeof store.touchTracked === "function") await store.touchTracked(item.uid, p);
  } catch (e) {
    console.warn("轮询玩家失败 uid=" + item.uid + "：" + (e && e.message ? e.message : String(e)));
  }
}

module.exports = { poll: poll, SHARD_1: SHARD_1, SHARD_2: SHARD_2 };
