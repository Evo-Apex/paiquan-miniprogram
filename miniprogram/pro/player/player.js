/**
 * 选手页（2026-11，比赛页点选手名字进来）：Liquipedia 的资料、常用传奇、历届成绩、队伍经历。
 *
 * 数据由云函数的定时器每天从 Liquipedia 抓好存进数据库（cloudfunctions/apex/proSync.js），
 * 这里只读数据库（action: proPlayer），不现查 Liquipedia —— 它每小时只给 60 次请求。
 * 判断、换算都在 pro/utils/view.js（纯函数，有测试），页面只管取数 + setData。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var cloud = require("../../utils/cloud.js");
var view = require("../utils/view.js");

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    state: "loading",   // loading / error / empty / ready
    v: null,
    // 历届成绩：false = 只看大赛（默认），true = 全部
    showAll: false
  },

  onLoad: function (options) {
    this.page = decodeURIComponent((options && options.page) || "");
    this.load();
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navProPlayer");
    theme.applyChrome(this.data.theme);
    this.rebuild();
  },

  load: function () {
    var self = this;
    return cloud.callCloud({ action: "proPlayer", page: this.page }).then(function (r) {
      if (!r.ok) { self.setData({ state: "error" }); return; }
      if (!r.data) { self.setData({ state: "empty" }); return; }
      self._raw = r.data;
      self.rebuild();
    });
  },

  rebuild: function () {
    if (!this._raw) return;
    var v = view.player(this._raw, this.data.lang, Date.now());
    // 一场大赛都没有时，直接列全部（view 里 majorOnlyDefault = false）
    var showAll = this._toggled ? this.data.showAll : !v.results.majorOnlyDefault;
    this.setData({ v: v, state: "ready", showAll: showAll });
  },

  /** 历届成绩的「大赛 ｜ 全部」。只认白名单 */
  onResSeg: function (e) {
    var k = e.currentTarget.dataset.k;
    if (k !== "major" && k !== "all") return;
    this._toggled = true;
    if ((k === "all") !== this.data.showAll) this.setData({ showAll: k === "all" });
  },

  onRetry: function () {
    this.setData({ state: "loading" });
    this.load();
  },

  onShareAppMessage: function () {
    var v = this.data.v;
    return {
      title: (v && v.id ? v.id + " · " : "") + this.data.T.navProPlayer,
      path: "/pro/player/player?page=" + encodeURIComponent(this.page || "")
    };
  }
});
