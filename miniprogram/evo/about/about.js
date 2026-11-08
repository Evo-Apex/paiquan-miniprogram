/**
 * 关于 Evo（2026-11-08，「我的」页「关于 Evo」进来）：Evo 是什么、传哪些数据、待确认的局怎么改、官网。
 * 原来这些写在「我的」页底下，改版以后挪到这一页。只有本地文案，不调云函数。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme()
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navEvoAbout");
    theme.applyChrome(this.data.theme);
  }
});
