/**
 * 深色 / 浅色主题，以及「跟随系统」（2026-11-08，「我的」页的「外观」：跟随系统 / 深色 / 浅色）。
 *
 * 两个概念分开：**模式**（用户选的：system / dark / light，存进界面偏好）和 **主题**（实际用哪套：dark / light）。
 * 模式是 system 时，主题跟着手机：读 wx.getAppBaseInfo().theme，手机切换时 app.js 的 wx.onThemeChange 调 onSystemChange。
 * 要读到手机的深浅色，app.json 得开 "darkmode": true（只为了拿到这个值；导航栏、tab 的颜色照旧由这里的 applyChrome 设）。
 * 读不到（旧基础库）就按浅色。
 *
 * 颜色本身**全在 app.wxss 的 CSS 变量里**（`page` 上是深色，`.wrap.theme-light` 上是浅色），
 * 这个模块只负责两件事：
 *   1. 记住"当前用哪套"；
 *   2. 把主题应用到 **CSS 变量管不到的原生外壳**（导航栏 / 底部 tabBar / 窗口底色）。
 *
 * 和语言一样**只存在内存里，不写本地存储** —— 项目有一条被测试守着的隐私承诺
 * （tests/static.test.mjs「不保存任何用户数据」）。代价是重启回到深色，切 tab 不会丢。
 */
var prefs = require("./prefs.js");

var THEMES = ["dark", "light"];
var MODES = ["system", "dark", "light"];
// 默认用浅色（用户 2026-10 的决定）：地图页底部有广告，
// 浅色底比深色底让广告看着没那么突兀 —— 不是藏广告，是别那么扎眼。
var mode = normalizeMode(prefs.get("theme", "light"));
var current = resolve(mode);

// 原生外壳配色。注意 frontColor 只接受 #ffffff / #000000 两个值（微信的硬性要求）。
// ⚠️ 这里的色值必须和 app.wxss 的令牌保持一致（--bg / --ink3 / --accent），
//    否则会出现"页面换了底色、导航栏还是旧底色"的接缝。
//    tabOn 是**画在 tabBar 底色上的文字**，所以按"当文字用"的强调色取：
//    深色底用 --accent-ink（#ff5a52，白字压它不够、但当文字够亮），
//    浅色底用 --accent-ink（#c62828，白底上 5.62:1）。
var CHROME = {
  dark: {
    bg: "#0a0c10", nav: "#0a0c10", front: "#ffffff",
    tabBg: "#0a0c10", tabColor: "#8b95a6", tabOn: "#ff5a52", tabBorder: "white"
  },
  light: {
    bg: "#f5f6f8", nav: "#f5f6f8", front: "#000000",
    tabBg: "#ffffff", tabColor: "#5f6a79", tabOn: "#c62828", tabBorder: "black"
  }
};

/** 认不出的主题一律当深色 */
function normalize(t) {
  return THEMES.indexOf(t) >= 0 ? t : "dark";
}

function normalizeMode(m) {
  return MODES.indexOf(m) >= 0 ? m : "light";
}

/** 手机现在是深色还是浅色；读不到（没开 darkmode / 旧基础库 / 测试环境）→ null */
function systemTheme() {
  if (typeof wx === "undefined") return null;
  try {
    var info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return info && (info.theme === "dark" || info.theme === "light") ? info.theme : null;
  } catch (e) {
    return null;
  }
}

function resolve(m) {
  return m === "system" ? (systemTheme() || "light") : normalize(m);
}

/** 实际用哪套：dark / light */
function getTheme() {
  return current;
}

/** 用户选的模式：system / dark / light */
function getMode() {
  return mode;
}

/** 选模式（「我的」页的「外观」）；返回实际用的主题 */
function setMode(m) {
  mode = normalizeMode(m);
  prefs.set("theme", mode);   // 记住选择（只存界面偏好，不含个人信息）
  current = resolve(mode);
  applyChrome(current);
  return current;
}

/** 直接选深色 / 浅色（别的页面 ⚙ 面板里的两个按钮）：等于不再跟随系统 */
function setTheme(t) {
  return setMode(normalize(t));
}

/** 手机切换了深浅色（app.js 的 wx.onThemeChange 调）：跟随系统时换主题。返回 true = 主题变了 */
function onSystemChange(t) {
  if (mode !== "system" || (t !== "dark" && t !== "light") || t === current) return false;
  current = t;
  applyChrome(current);
  return true;
}

/** 把主题应用到原生外壳。没有 wx 的环境（测试/网页版）直接返回，不抛错。 */
function applyChrome(theme) {
  var c = CHROME[normalize(theme || current)];
  if (typeof wx === "undefined") return;
  try {
    if (wx.setNavigationBarColor) {
      wx.setNavigationBarColor({ frontColor: c.front, backgroundColor: c.nav });
    }
  } catch (e) { /* 页面还没起来时可能失败，属于正常 */ }
  try {
    if (wx.setBackgroundColor) {
      // 回弹时露出来的那层（.wrap 只铺满一屏，回弹能看到 page）
      wx.setBackgroundColor({ backgroundColor: c.bg, backgroundColorTop: c.bg, backgroundColorBottom: c.bg });
    }
  } catch (e) { /* 忽略 */ }
  try {
    if (wx.setTabBarStyle) {
      wx.setTabBarStyle({
        color: c.tabColor,
        selectedColor: c.tabOn,
        backgroundColor: c.tabBg,
        borderStyle: c.tabBorder
      });
    }
  } catch (e) { /* 忽略 */ }
}

module.exports = {
  THEMES: THEMES,
  MODES: MODES,
  normalize: normalize,
  getTheme: getTheme,
  getMode: getMode,
  setMode: setMode,
  setTheme: setTheme,
  onSystemChange: onSystemChange,
  applyChrome: applyChrome
};
