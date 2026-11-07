/**
 * 数据来源说明页（2026-11，选手页最底下的「数据来源」点进来）。
 * 设计稿：页面上不放来源和声明，统一放到这一页 —— Liquipedia 的署名（CC BY-SA 3.0）、上次同步时间、
 * 照片为什么是剪影、粉丝工具声明。以后别的页面要写来源也可以链到这里。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var view = require("../utils/view.js");

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    synced: ""
  },

  onLoad: function (options) {
    this.at = Number(options && options.at) || 0;
    this.setData({ synced: view.syncedText(this.at, this.data.T) });
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l), synced: view.syncedText(this.at, i18n.T(l)) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navProSources");
    theme.applyChrome(this.data.theme);
  }
});
