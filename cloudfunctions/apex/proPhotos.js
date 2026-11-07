/**
 * 选手照片（2026-11-07）：Liquipedia 页面名 → 云存储里的照片地址（cloud:// 的 fileID）。
 *
 * 照片是 ALGS 的选手定妆照（August 拿到 EA 授权），tools/build_pro_photos.py 对好名字、压成 WebP，
 * 整个文件夹传到云存储的 pro/photos/<version>/ 下；对照表在同目录的 pro_photos.json。
 * 每人两张：<slug>_hero.webp（480px，选手页大卡）、<slug>_card.webp（320px，战队页选手卡）。
 *
 * fileID 前缀（base）要传完照片才知道（cloud://环境.存储桶/pro/photos/v1/），填在 pro_photos.json；
 * 环境变量 PRO_PHOTO_BASE 可以盖过它（测试环境用）。base 空着 → 一律返回 ""，页面照旧剪影。
 * 小程序端只拿到 cloud:// 地址，不碰外部网站。
 */
var data = { base: "", files: {} };
try {
  data = require("./pro_photos.json");
} catch (e) {
  // 没有对照表：不放照片
}

function base() {
  var b = String(process.env.PRO_PHOTO_BASE || data.base || "").trim();
  return b && b.charAt(b.length - 1) !== "/" ? b + "/" : b;
}

/**
 * @param page 选手的 Liquipedia 页面名
 * @param size "hero"（大卡）/ "card"（战队页选手卡）
 * @returns cloud:// 地址；没有照片或还没传 → ""
 */
function photoOf(page, size) {
  var b = base();
  var slug = data.files && Object.prototype.hasOwnProperty.call(data.files, page) ? data.files[page] : "";
  if (!b || !slug) return "";
  return b + slug + "_" + (size === "card" ? "card" : "hero") + ".webp";
}

module.exports = { photoOf: photoOf };
