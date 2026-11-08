/**
 * 加入玩家群（2026-11-08，「我的」页「加入玩家群」进来）：Evo 的 QQ 群。
 * 微信里加不了 QQ 群（长按识别也只会打开一个网页），所以写清楚：长按保存二维码，用 QQ 扫一扫从相册选；或在 QQ 里搜群号。
 * 二维码图在 evo/assets/qq-group.jpg（August 给的，QQ 群码不像微信群码那样 7 天过期；换群时换图、改群号、发版）。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");

var GROUP_NUMBER = "1128519951";

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    number: GROUP_NUMBER
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navEvoGroup");
    theme.applyChrome(this.data.theme);
  }
});
