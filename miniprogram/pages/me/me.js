/**
 * 「我的」（第 5 个 tab；2026-11-08 照 August 的设计稿改版）。
 *
 * 上半部分（游戏 ID + 绑定状态、三格统计、电脑上的 Evo）是分包 evo 里的 devices 组件
 * （异步引用，见 me.json 的 componentPlaceholder：主包只剩约 120 KB 余量，Evo 的东西都放分包）。
 * 下面的设置列表在这里：分享卡片（带不带游戏名）、外观（跟随系统 / 深色 / 浅色）、语言、隐私说明、
 * 加入玩家群（Evo 的 QQ 群，→ evo/group）、关于 Evo、版本。原来左上角的 ⚙ 面板（语言、主题）挪进了列表。
 * 不做的（August 定的）：头像昵称用游戏 ID 代替、每周战报 / 地图轮换推送、意见反馈、导出战绩、删除全部战绩。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var prefs = require("../../utils/prefs.js");

/** 自定义导航栏的尺寸（和地图页、「战绩」页同一套算法）：内容从胶囊按钮那一行下面开始 */
function navMetrics() {
  var info = {};
  try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) { info = {}; }
  var top = info.statusBarHeight || 20;
  var h = 44;
  try {
    var r = wx.getMenuButtonBoundingClientRect();
    if (r && r.height && r.top) h = (r.top - top) * 2 + r.height;
  } catch (e) { /* 旧基础库没有这个接口，用上面的保守值 */ }
  return { navTop: top, navH: h };
}

/** 正式版、体验版的版本号；开发版是空的 */
function appVersion() {
  try {
    var a = wx.getAccountInfoSync();
    return (a && a.miniProgram && a.miniProgram.version) || "";
  } catch (e) {
    return "";
  }
}

var THEME_KEYS = { system: "meThemeSystem", dark: "themeDark", light: "themeLight" };
var LANG_NAMES = { zh: "简体中文", en: "English" };   // 语言名用它自己的文字写，两种界面下都一样

Page({
  data: {
    navTop: 20,
    navH: 44,
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    shareText: "",
    themeText: "",
    langText: "",
    version: ""
  },

  onLoad: function () {
    this.setData(Object.assign(navMetrics(), { version: appVersion() }));
  },

  onShow: function () {
    // 语言、主题可能在别的页面切过（全项目共用一份）
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navMe");
    theme.applyChrome(this.data.theme);
    this.refreshValues();
  },

  /** 各行右边写的现在的值 */
  refreshValues: function () {
    var T = this.data.T;
    this.setData({
      shareText: prefs.get("shareName", false) === true ? T.meShareName : T.meShareNoName,
      themeText: T[THEME_KEYS[theme.getMode()]],
      langText: LANG_NAMES[this.data.lang] || ""
    });
  },

  /** 分享卡片：转发「上一局」时标题带不带游戏名（界面偏好，默认不带） */
  onShareSetting: function () {
    var self = this;
    var T = this.data.T;
    wx.showActionSheet({
      itemList: [T.meShareName, T.meShareNoName],
      success: function (res) {
        prefs.set("shareName", res.tapIndex === 0);
        self.refreshValues();
      }
    });
  },

  /** 外观：跟随系统 / 深色 / 浅色 */
  onAppearance: function () {
    var self = this;
    var T = this.data.T;
    var modes = theme.MODES;
    wx.showActionSheet({
      itemList: modes.map(function (m) { return T[THEME_KEYS[m]]; }),
      success: function (res) {
        var t = theme.setMode(modes[res.tapIndex]);
        if (t !== self.data.theme) self.setData({ theme: t });
        self.refreshValues();
      }
    });
  },

  onLanguage: function () {
    var self = this;
    var langs = ["zh", "en"];
    wx.showActionSheet({
      itemList: langs.map(function (l) { return LANG_NAMES[l]; }),
      success: function (res) {
        var l = i18n.setLang(langs[res.tapIndex]);
        if (l !== self.data.lang) {
          self.setData({ lang: l, T: i18n.T(l) });
          i18n.applyChrome(l, "navMe");
        }
        self.refreshValues();
      }
    });
  },

  /** 隐私说明：微信后台填的《用户隐私保护指引》；打不开（旧基础库、后台没填）就用这里的一段话 */
  onPrivacy: function () {
    var T = this.data.T;
    var fallback = function () {
      wx.showModal({ title: T.mePrivacy, content: T.mePrivacyBody, showCancel: false, confirmText: T.meOk });
    };
    if (!wx.openPrivacyContract) { fallback(); return; }
    wx.openPrivacyContract({ fail: fallback });
  },

  /** 加入玩家群：是 QQ 群（微信里加不了），专门一页写群号、放二维码、讲怎么加 */
  onGroup: function () {
    wx.navigateTo({ url: "/evo/group/group" });
  },

  onAboutEvo: function () {
    wx.navigateTo({ url: "/evo/about/about" });
  }
});
