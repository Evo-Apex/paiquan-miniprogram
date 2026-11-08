/**
 * 选手页（2026-11，比赛页点选手名字进来）。版式照 August 的设计稿：
 * 深色大卡 → 资料 → 合作过的队友 → 常用传奇 → 战队经历 → 重要比赛成绩 → 数据来源入口。
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
    // 比赛成绩、以前的队友当前显示的那几条（展开 / 切换由 view.visibleResults / visibleMates 算）
    res: null,
    mates: null
  },

  onLoad: function (options) {
    this.page = decodeURIComponent((options && options.page) || "");
    this._resMode = "";
    this._resOpen = false;
    this._matesOpen = false;
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
    var T = this.data.T;
    var v = view.player(this._raw, this.data.lang, Date.now());
    if (this._badPhoto && v.photo === this._badPhoto) v.photo = "";   // 加载失败过的照片不再试，换回剪影
    var bad = this._badLogos || {};   // 加载失败过的队标不再试，换回缩写
    if (v.team && bad[v.team.logo]) v.team.logo = "";
    if (v.career.items) v.career.items.forEach(function (it) { if (bad[it.logo]) it.logo = ""; });
    if (!this._resMode) this._resMode = v.results.defaultMode;
    this.setData({
      v: v,
      state: "ready",
      res: view.visibleResults(v.results, this._resMode, this._resOpen, T),
      mates: view.visibleMates(v.mates, this._matesOpen, T)
    });
  },

  /** 比赛成绩：「查看全部 N 场」 */
  onResMore: function () {
    this._resOpen = true;
    this.rebuild();
  },

  /** 比赛成绩：「也看小比赛」（S、A 级看完了才出现）→ 全部比赛，先显示 5 条 */
  onResMinor: function () {
    this._resMode = "all";
    this._resOpen = false;
    this.rebuild();
  },

  /** 比赛成绩：回到只看 S、A 级 */
  onResMajor: function () {
    this._resMode = "major";
    this._resOpen = false;
    this.rebuild();
  },

  /** 照片加载失败（没传、网络不通、手机不认 WebP）→ 换回剪影 */
  onPhotoError: function () {
    this._badPhoto = this.data.v && this.data.v.photo;
    this.setData({ "v.photo": "" });
  },

  /** 队标加载失败（没传、网络不通）→ 这支队换回缩写（大卡和战队经历里同一支队一起换） */
  onLogoError: function (e) {
    var src = e.currentTarget.dataset.src;
    if (!src) return;
    this._badLogos = this._badLogos || {};
    this._badLogos[src] = true;
    this.rebuild();
  },

  onMatesMore: function () {
    this._matesOpen = true;
    this.rebuild();
  },

  /** 点队友 → 他的选手页（我们没收录的人 data-page 是空的，点了没反应） */
  onOpenPlayer: function (e) {
    var page = e.currentTarget.dataset.page;
    if (!page) return;
    wx.navigateTo({ url: "/pro/player/player?page=" + encodeURIComponent(page) });
  },

  /** 点战队（大卡上现在的战队、战队经历那几行）→ 战队页（还没有战队页的 data-page 是空的，点了没反应） */
  onOpenTeam: function (e) {
    var page = e.currentTarget.dataset.page;
    if (!page) return;
    wx.navigateTo({ url: "/pro/team/team?page=" + encodeURIComponent(page) });
  },

  /** 最底下的「数据来源」→ 说明页（来源、上次同步时间、声明都在那里，页面上不放） */
  onSources: function () {
    var at = this.data.v && this.data.v.at ? this.data.v.at : "";
    wx.navigateTo({ url: "/pro/sources/sources?at=" + at });
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
