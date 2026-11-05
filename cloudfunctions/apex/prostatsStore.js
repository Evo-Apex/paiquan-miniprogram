/**
 * 主播排位数据（英雄 / 三人阵容 / 武器 / 配枪）的云端存储。
 *
 * 为什么要放数据库：这份数据是离线跑 B 站录像识别出来的，
 * 打进包里的话**每改一次数据就要重新发版**（还要过审）。
 * 放进云数据库后，识别脚本推一次，用户下次打开小程序就是新的。
 *
 * 铁律跟 store.js 一样：**任何错误都降级成"没有数据"**。
 * 集合没建、权限不对、库超时 —— 都不该让排位专区白屏，
 * 前端会回落到包里那份快照，只是显示"更新于 X"的旧日期。
 *
 * 一条记录，_id = "current"：整份数据有点大（80KB 左右），
 * 拆成多条反而要多次读、还得保证一致性，不值当。
 */

var COLLECTION = "prostats";
var DOC_ID = "current";

/**
 * 只保留前端认识的字段，防止把脚本里的调试字段一起塞进库里。
 * 数组没做深拷贝 —— 这份数据是只读的，写一次读很多次。
 */
function shape(payload) {
  return {
    season: String(payload.season || ""),
    updated: String(payload.updated || ""),
    players: Array.isArray(payload.players) ? payload.players : [],
    summary: String(payload.summary || "")
  };
}

/**
 * @param cloud require("wx-server-sdk") 的结果（已 init）
 */
function createProstatsStore(cloud) {
  var db = cloud.database();
  var col = db.collection(COLLECTION);

  return {
    /**
     * 读云端这份数据；没有或出错都返回 null（前端据此回落快照）。
     *
     * 两种记录都要认：
     *   1. `_id = "current"` —— 脚本 push 写的那种（固定 id，覆盖更新）；
     *   2. **任意 id 的最新一条** —— 控制台「导入」不认 JSON 里的 _id，
     *      会自己生成一个（实测 2026-11-05 导入后 id 变成 b548473b...）。
     *      只认 current 的话，用户照文档导入完却读不到，排查起来极费劲。
     *      按 updated 倒序取最新，多条并存也不会读错。
     */
    read: async function () {
      try {
        var res = await col.doc(DOC_ID).get();
        var d = res && res.data;
        if (d) {
          var out = shape(d);
          // 空数组等于没有：宁可让前端用包内快照，也别渲染一片空白
          if (out.players.length) return out;
        }
      } catch (e) {
        // 文档不存在会抛 —— 预期情况，接着走下面的兜底
      }
      try {
        var q = await col.orderBy("updated", "desc").limit(1).get();
        var row = q && q.data && q.data[0];
        if (!row) return null;
        var latest = shape(row);
        return latest.players.length ? latest : null;
      } catch (e) {
        return null;
      }
    },

    /** 覆盖写；成功返回 true，任何异常都返回 false（不抛给调用方） */
    write: async function (payload) {
      try {
        var data = shape(payload);
        if (!data.players.length) return false;
        await col.doc(DOC_ID).set({ data: data });
        return true;
      } catch (e) {
        console.warn("prostats 写入失败：" + (e && e.message ? e.message : String(e)));
        return false;
      }
    }
  };
}

module.exports = {
  COLLECTION: COLLECTION,
  DOC_ID: DOC_ID,
  shape: shape,
  createProstatsStore: createProstatsStore
};
