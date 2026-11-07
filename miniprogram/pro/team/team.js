/**
 * 战队页（2026-11-07，从选手页、比赛页的战队名点进来）。版式照 August 的战队页设计稿：
 * 深色大卡 → 现役阵容 → 重要比赛成绩 → 阵容变动 → 历任队员 → 数据来源入口。
 *
 * 数据由云函数的定时器每天从 Liquipedia 抓好存进数据库（cloudfunctions/apex/proSync.js），
 * 这里只读数据库（action: proTeam），不现查 Liquipedia —— 它每小时只给 60 次请求。
 * 判断、换算都在 pro/utils/teamview.js（纯函数，有测试），页面只管取数 + setData。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var cloud = require("../../utils/cloud.js");
var view = require("../utils/view.js");
var teamview = require("../utils/teamview.js");

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    state: "loading",   // loading / error / empty / ready
    v: null,
    // 比赛成绩、阵容变动、历任队员当前显示的那几条（展开 / 切换由 view、teamview 的 visible* 算）
    res: null,
    moves: null,
    former: null
  },

  onLoad: function (options) {
    this.page = decodeURIComponent((options && options.page) || "");
    this._resMode = "";
    this._resOpen = false;
    this._movesOpen = false;
    this._formerOpen = false;
    this.load();
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    i18n.applyChrome(this.data.lang, "navProTeam");
    theme.applyChrome(this.data.theme);
    this.rebuild();
  },

  load: function () {
    var self = this;
    return cloud.callCloud({ action: "proTeam", page: this.page }).then(function (r) {
      if (!r.ok) { self.setData({ state: "error" }); return; }
      if (!r.data) { self.setData({ state: "empty" }); return; }
      self._raw = r.data;
      self.rebuild();
    });
  },

  rebuild: function () {
    if (!this._raw) return;
    var T = this.data.T;
    var v = teamview.team(this._raw, this.data.lang);
    if (!this._resMode) this._resMode = v.results.defaultMode;
    this.setData({
      v: v,
      state: "ready",
      res: view.visibleResults(v.results, this._resMode, this._resOpen, T),
      moves: teamview.visibleMoves(v.moves, this._movesOpen, T),
      former: teamview.visibleFormer(v.former, this._formerOpen, T)
    });
  },

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

  onResMajor: function () {
    this._resMode = "major";
    this._resOpen = false;
    this.rebuild();
  },

  onMovesMore: function () {
    this._movesOpen = true;
    this.rebuild();
  },

  onFormerMore: function () {
    this._formerOpen = true;
    this.rebuild();
  },

  /** 点选手 → 他的选手页（我们没收录的人 data-page 是空的，点了没反应） */
  onOpenPlayer: function (e) {
    var page = e.currentTarget.dataset.page;
    if (!page) return;
    wx.navigateTo({ url: "/pro/player/player?page=" + encodeURIComponent(page) });
  },

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
      title: (v && v.name ? v.name + " · " : "") + this.data.T.navProTeam,
      path: "/pro/team/team?page=" + encodeURIComponent(this.page || "")
    };
  }
});
