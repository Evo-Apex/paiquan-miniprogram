/**
 * 战队队标（2026-11-08）：Liquipedia 战队页面名 → 云存储里的队标地址（cloud:// 的 fileID）。
 *
 * 这一届比赛的队用 ALS 赛事页上的队标（比赛页分组卡片用的同一批），其他队用 Liquipedia 战队资料里的队标；
 * tools/build_pro_logos.py 下载、压成 192px 的 PNG，整个文件夹传到云存储的 pro/logos/<version>/ 下；
 * 对照表在同目录的 pro_logos.json。用 Apex 通用标志顶替的队不在表里（页面照旧写缩写）。
 *
 * fileID 前缀（base）要传完才知道（cloud://环境.存储桶/pro/logos/v1/），填在 pro_logos.json；
 * 环境变量 PRO_LOGO_BASE 可以盖过它（测试环境用）。base 空着 → 一律返回 ""，页面照旧写缩写。
 * 小程序端只拿到 cloud:// 地址，不碰外部网站。
 */
var data = { base: "", files: {} };
try {
  data = require("./pro_logos.json");
} catch (e) {
  // 没有对照表：不放队标
}

function base() {
  var b = String(process.env.PRO_LOGO_BASE || data.base || "").trim();
  return b && b.charAt(b.length - 1) !== "/" ? b + "/" : b;
}

/**
 * @param page 战队的 Liquipedia 页面名（"Team_Liquid"）
 * @returns cloud:// 地址；没有队标或还没传 → ""
 */
function logoOf(page) {
  var b = base();
  var files = data.files || {};
  var name = typeof page === "string" && Object.prototype.hasOwnProperty.call(files, page) ? files[page] : "";
  if (!b || !name) return "";
  return b + name + ".png";
}

/** 一串战队页面名 → { 页面名: 地址 }，只放有队标的（页面按页面名查） */
function logosOf(pages) {
  var out = {};
  (pages || []).forEach(function (p) {
    var u = logoOf(p);
    if (u) out[p] = u;
  });
  return out;
}

module.exports = { logoOf: logoOf, logosOf: logosOf };
