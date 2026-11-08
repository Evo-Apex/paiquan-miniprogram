/**
 * 游戏账号（2026-11-08，「我的」页「电脑上的 Evo」卡里点「管理游戏账号」进来）。
 * 列出 Evo 传上来的游戏账号（按游戏里的玩家名区分，改过名的会写"用过 N 个名字"）；
 * 合并、改名都在电脑上的 Evo 里做（这里只看），说明照旧写在下面。数据和「我的」页同一个接口（me）。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var view = require("../utils/view.js");
var evoCloud = require("../utils/cloud.js");

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    state: "loading",   // loading / error / ready
    error: "",
    accounts: []
  },

  onLoad: function () {
    this.load();
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navEvoAccounts");
    theme.applyChrome(this.data.theme);
  },

  load: function () {
    var self = this;
    return evoCloud.callEvo("me").then(function (r) {
      if (!r.ok) { self.setData({ state: "error", error: view.errText(r.code, self.data.T) }); return; }
      self.setData({ state: "ready", accounts: view.meView(r.data, self.data.T, Date.now()).accounts });
    });
  }
});
