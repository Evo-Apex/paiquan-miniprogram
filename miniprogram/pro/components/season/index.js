/**
 * 比赛页上半部分（2026-11-08，照 August 的「赛季进度条」设计稿）：赛季卡、主队卡、近期比赛、这个赛季、所有 CN 战队、选主队弹层。
 *
 * 在分包 pro 里、由主包的比赛页异步引用（主包空间紧）。数据只读数据库（云函数 proSeason），
 * 判断、换算都在 pro/utils/seasonview.js（纯函数，有测试）。主队存在界面偏好里（prefs 的 homeTeam：只是一个队名）。
 * 读不到数据（云端还没抓、网络不通）时整块不显示，比赛页下面原来的内容照旧。
 */
var i18n = require("../../../utils/i18n.js");
var cloud = require("../../../utils/cloud.js");
var prefs = require("../../../utils/prefs.js");
var sv = require("../../utils/seasonview.js");

Component({
  options: { styleIsolation: "apply-shared" },   // 用 app.wxss 的令牌和 .msg

  properties: {
    lang: { type: String, value: "zh" }
  },

  data: {
    T: i18n.T("zh"),
    ready: false,
    v: null,
    chip: "all",
    recent: null,
    timeline: [],
    showMinor: true,
    cn: null,
    picking: false,
    pick: null,
    pickQuery: "",
    pickRegion: "",
    pickTeam: ""
  },

  observers: {
    lang: function (lang) {
      this.setData({ T: i18n.T(lang) });
      this.rebuild();
    }
  },

  lifetimes: {
    attached: function () {
      this._recentOpen = false;
      this._cnOpen = false;
      this.load();
    }
  },

  methods: {
    load: function () {
      var self = this;
      return cloud.callCloud({ action: "proSeason" }).then(function (r) {
        if (!r.ok || !r.data) return;   // 取不到就整块不显示
        self._raw = r.data;
        self.rebuild();
      });
    },

    rebuild: function () {
      if (!this._raw) return;
      var T = this.data.T;
      var v = sv.season(this._raw, this.data.lang, Date.now(), prefs.get("homeTeam", ""));
      if (!v.has) return;
      var chip = v.chips.some(function (c) { return c.key === this.data.chip; }, this) ? this.data.chip : "all";
      this.setData({
        ready: true,
        v: v,
        chip: chip,
        recent: sv.visibleRecent(v, chip, this._recentOpen, T),
        timeline: sv.visibleTimeline(v, this.data.showMinor),
        cn: sv.visibleCn(v, this._cnOpen, T)
      });
    },

    onChip: function (e) {
      this._recentOpen = false;
      this.setData({ chip: e.currentTarget.dataset.k });
      this.rebuild();
    },

    onRecentMore: function () {
      this._recentOpen = true;
      this.rebuild();
    },

    onToggleMinor: function () {
      this.setData({ showMinor: !this.data.showMinor });
      this.rebuild();
    },

    onCnMore: function () {
      this._cnOpen = true;
      this.rebuild();
    },

    /** 点一站（进度条下的下一站、时间线里的五站、近期比赛里的五站）→ 这一站的详情页 */
    onStage: function (e) {
      var key = e.currentTarget.dataset.k;
      if (!key) return;
      wx.navigateTo({ url: "/pro/event/event?key=" + encodeURIComponent(key) });
    },

    onTeam: function (e) {
      var page = e.currentTarget.dataset.page;
      if (!page) return;
      wx.navigateTo({ url: "/pro/team/team?page=" + encodeURIComponent(page) });
    },

    onSources: function () {
      var at = this.data.v && this.data.v.at ? this.data.v.at : "";
      wx.navigateTo({ url: "/pro/sources/sources?at=" + at });
    },

    /* ---------- 选主队弹层 ---------- */

    onPickOpen: function () {
      var home = prefs.get("homeTeam", "");
      this.setData({ picking: true, pickQuery: "", pickRegion: "", pickTeam: home });
      this.refreshPick();
    },

    onPickClose: function () {
      this.setData({ picking: false });
    },

    refreshPick: function () {
      this.setData({ pick: sv.picker(this._raw, this.data.lang, this.data.pickQuery, this.data.pickRegion, this.data.pickTeam) });
    },

    onPickSearch: function (e) {
      this.setData({ pickQuery: e.detail.value || "" });
      this.refreshPick();
    },

    onPickRegion: function (e) {
      this.setData({ pickRegion: e.currentTarget.dataset.k || "" });
      this.refreshPick();
    },

    onPickTeam: function (e) {
      this.setData({ pickTeam: e.currentTarget.dataset.team || "" });
      this.refreshPick();
    },

    onPickDone: function () {
      prefs.set("homeTeam", this.data.pickTeam || "");
      this.setData({ picking: false });
      this.rebuild();
    },

    onPickClear: function () {
      prefs.set("homeTeam", "");
      this.setData({ picking: false, pickTeam: "" });
      this.rebuild();
    },

    noop: function () {}
  }
});
