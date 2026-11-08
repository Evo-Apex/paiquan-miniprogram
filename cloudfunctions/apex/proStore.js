/**
 * 职业选手数据（Liquipedia）的存储层。两个集合，第一次写入时自动建（不用去控制台手动建）：
 *
 *   pro_players：一位选手一条（_id 由页面名编码而来），
 *                { page, profile, profileAt, history, historyAt, results, resultsAt }
 *   pro_meta：   只有一条 _id = "state"：同步进度（队列、上次请求时间）+ 各赛事的参赛名单
 *   pro_teams：  一支战队一条，{ page, members, membersAt, info, infoAt, results, resultsAt, transfers, transfersAt }
 *                （members 是历史名单：选手 + 教练，算"合作过的队友"、战队页的阵容用；2026-11 以前存的只有 members + at）
 *
 * 收录哪些赛事读 site_config 集合的 _id = "pro_events"（{ list: [赛事页面名] }），读不到返回 null。
 *
 * 和 store.js / playerStore.js 同一条铁律：**任何数据库错误都吞掉、降级、留日志**。
 */

var PLAYERS = "pro_players";
var TEAMS = "pro_teams";
var META = "pro_meta";
var STATE_ID = "state";
var SEASON_ID = "season";             // 比赛页的赛季：比赛列表 + 名次（2026-11-08）
var MANUAL = "pro_manual_events";     // 自己录入的比赛（在云开发控制台里加，见 proSeason.normManual）
var CN_TEAMS = "pro_cn_teams";        // 「所有 CN 战队」的名单（在云开发控制台里加，见 proSeason.cnListOf）
var CALL_NOTE_ID = "call_note";        // 临时排查定时器用（2026-11-08），查清后删掉

/** 页面名 → 文档 _id：只留字母数字和 - _，其它字符写成 ~十六进制~（可逆、不会撞） */
function docId(page) {
  return "p_" + String(page).replace(/[^A-Za-z0-9_-]/g, function (c) {
    return "~" + c.charCodeAt(0).toString(16) + "~";
  });
}

function msgOf(e) { return e && e.message ? e.message : String(e); }

/**
 * @param cloud require("wx-server-sdk") 的结果（已 init）
 */
function createProStore(cloud) {
  var db = cloud.database();
  var _ = db.command;
  var made = {};

  async function ensure(name) {
    if (made[name]) return;
    made[name] = true;
    try { await db.createCollection(name); } catch (e) { /* 已经有了 */ }
  }

  return {
    readState: async function () {
      try {
        var res = await db.collection(META).doc(STATE_ID).get();
        return res && res.data ? res.data : null;
      } catch (e) {
        return null;   // 第一次跑：集合或记录还没有
      }
    },

    writeState: async function (state) {
      try {
        await ensure(META);
        var data = Object.assign({}, state);
        delete data._id;
        await db.collection(META).doc(STATE_ID).set({ data: data });
        return true;
      } catch (e) {
        console.warn("写选手同步进度失败：" + msgOf(e));
        return false;
      }
    },

    /** 临时排查（2026-11-08）：记下最近一次没有 action 的调用，覆盖同一条。查清后删掉这两个方法 */
    noteCall: async function (info) {
      try {
        await ensure(META);
        await db.collection(META).doc(CALL_NOTE_ID).set({ data: info });
        return true;
      } catch (e) {
        console.warn("记录调用失败：" + msgOf(e));
        return false;
      }
    },

    readCallNote: async function () {
      try {
        var res = await db.collection(META).doc(CALL_NOTE_ID).get();
        return res && res.data ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    readEvents: async function () {
      try {
        var res = await db.collection("site_config").doc("pro_events").get();
        return res && res.data && Array.isArray(res.data.list) ? res.data.list : null;
      } catch (e) {
        return null;
      }
    },

    /** 只改给出的那几个字段；记录还没有就新建 */
    savePlayer: async function (page, patch) {
      try {
        await ensure(PLAYERS);
        var ref = db.collection(PLAYERS).doc(docId(page));
        var res = await ref.update({ data: patch });
        if (res && res.stats && res.stats.updated > 0) return true;
        await ref.set({ data: Object.assign({ page: page }, patch) });
        return true;
      } catch (e) {
        try {
          await db.collection(PLAYERS).doc(docId(page)).set({ data: Object.assign({ page: page }, patch) });
          return true;
        } catch (e2) {
          console.warn("写选手数据失败（" + page + "）：" + msgOf(e2));
          return false;
        }
      }
    },

    readPlayer: async function (page) {
      try {
        var res = await db.collection(PLAYERS).doc(docId(page)).get();
        return res && res.data ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    /** 一支战队：只改给出的那几个字段（名单、资料、成绩、转会各自更新）；记录还没有就新建 */
    saveTeam: async function (page, patch) {
      var ref = db.collection(TEAMS).doc(docId(page));
      try {
        await ensure(TEAMS);
        // 对象字段用 set 整个换掉（update 默认会把对象逐个键合并）
        var upd = {};
        Object.keys(patch).forEach(function (k) {
          var v = patch[k];
          upd[k] = v && typeof v === "object" && !Array.isArray(v) ? _.set(v) : v;
        });
        var res = await ref.update({ data: upd });
        if (res && res.stats && res.stats.updated > 0) return true;
        await ref.set({ data: Object.assign({ page: page }, patch) });
        return true;
      } catch (e) {
        try {
          await ref.set({ data: Object.assign({ page: page }, patch) });
          return true;
        } catch (e2) {
          console.warn("写战队数据失败（" + page + "）：" + msgOf(e2));
          return false;
        }
      }
    },

    /** 一支战队存下来的全部内容；没有 → null */
    readTeam: async function (page) {
      try {
        var res = await db.collection(TEAMS).doc(docId(page)).get();
        return res && res.data ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    /** 一批战队的历史名单：{ 战队页面名: [队员, ...] }（只取名单，不带成绩、转会） */
    readTeams: async function (pages) {
      var out = {};
      if (!pages || !pages.length) return out;
      try {
        var res = await db.collection(TEAMS).where({ page: _.in(pages.slice(0, 200)) })
          .field({ page: true, members: true }).limit(1000).get();
        (res.data || []).forEach(function (d) { if (Array.isArray(d.members)) out[d.page] = d.members; });
      } catch (e) {
        console.warn("读战队名单失败：" + msgOf(e));
      }
      return out;
    },

    /** 这批战队里哪些有战队页（存过名单）：{ 战队页面名: true } */
    teamIndex: async function (pages) {
      var out = {};
      if (!pages || !pages.length) return out;
      try {
        var res = await db.collection(TEAMS).where({ page: _.in(pages.slice(0, 200)) })
          .field({ page: true }).limit(1000).get();
        (res.data || []).forEach(function (d) { if (d.page) out[d.page] = true; });
      } catch (e) {
        console.warn("读战队列表失败：" + msgOf(e));
      }
      return out;
    },

    /** 比赛页的赛季：{ tournaments: [比赛], results: [{ page, rows }], at }；没有 → null */
    readSeason: async function () {
      try {
        var res = await db.collection(META).doc(SEASON_ID).get();
        return res && res.data ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    /** 只改给出的字段（比赛列表、名次各自更新）；记录还没有就新建 */
    saveSeason: async function (patch) {
      var ref = db.collection(META).doc(SEASON_ID);
      try {
        await ensure(META);
        var upd = {};
        Object.keys(patch).forEach(function (k) { upd[k] = Array.isArray(patch[k]) ? _.set(patch[k]) : patch[k]; });
        var res = await ref.update({ data: upd });
        if (res && res.stats && res.stats.updated > 0) return true;
        await ref.set({ data: patch });
        return true;
      } catch (e) {
        try {
          await ref.set({ data: patch });
          return true;
        } catch (e2) {
          console.warn("写赛季数据失败：" + msgOf(e2));
          return false;
        }
      }
    },

    /** 一批战队的资料（赛区等）：{ 页面名: info } */
    readTeamInfos: async function (pages) {
      var out = {};
      if (!pages || !pages.length) return out;
      try {
        var res = await db.collection(TEAMS).where({ page: _.in(pages.slice(0, 200)) })
          .field({ page: true, info: true }).limit(1000).get();
        (res.data || []).forEach(function (d) { if (d.info) out[d.page] = d.info; });
      } catch (e) {
        console.warn("读战队资料失败：" + msgOf(e));
      }
      return out;
    },

    /** 自己录入的比赛（集合 pro_manual_events，控制台手动加的记录，_id 是自动生成的，所以整个集合读）；没有集合 → [] */
    readManualEvents: async function () {
      try {
        var res = await db.collection(MANUAL).limit(100).get();
        return res.data || [];
      } catch (e) {
        return [];
      }
    },

    /** 「所有 CN 战队」的名单（集合 pro_cn_teams，整个集合读）；没有集合 → [] */
    readCnTeams: async function () {
      try {
        var res = await db.collection(CN_TEAMS).limit(100).get();
        return res.data || [];
      } catch (e) {
        return [];
      }
    },

    /** 一批选手的简要信息（队员弹层用）：{ 页面名: { id, nat, input } } */
    readBriefs: async function (pages) {
      var out = {};
      if (!pages || !pages.length) return out;
      try {
        var res = await db.collection(PLAYERS)
          .where({ page: _.in(pages.slice(0, 500)) })
          .field({ page: true, profile: true })
          .limit(1000)
          .get();
        (res.data || []).forEach(function (d) {
          var p = d.profile;
          if (!p) return;
          out[d.page] = { id: p.id || "", nat: (p.nats && p.nats[0]) || "", input: p.input || "" };
        });
      } catch (e) {
        console.warn("读选手简要信息失败：" + msgOf(e));
      }
      return out;
    }
  };
}

module.exports = { createProStore: createProStore, docId: docId };
