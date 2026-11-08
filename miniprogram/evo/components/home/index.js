/**
 * 首页顶上那块（2026-10-27）：没绑定时教怎么绑定；绑定了显示段位条、今日、上一局。
 *
 * 在分包 evo 里、由主包的首页异步引用（同 overview 组件：主包只剩约 120 KB 余量）。
 * 取不到数据时整块不显示 —— 首页的主角是地图轮换，这块出错不该在首页顶上糊一个报错。
 */
var i18n = require("../../../utils/i18n.js");
var view = require("../../utils/view.js");
var prefs = require("../../../utils/prefs.js");
var evoCloud = require("../../utils/cloud.js");
var state = require("../../utils/state.js");

var STALE_MS = 60 * 1000;   // 切回首页时，超过 1 分钟就重新读
var EMBLEM_RPX = 112;       // 段位徽章多大（rpx），和 index.wxss 的 .evo-hm-emblem 一样

Component({
  options: { styleIsolation: "apply-shared" },   // 用 app.wxss 的令牌和首页的 .hcard / .hpair / .hbar

  properties: {
    lang: { type: String, value: "zh" }
  },

  data: {
    T: i18n.T("zh"),
    state: "loading",
    v: null
  },

  observers: {
    lang: function (lang) {
      this.setData({ T: i18n.T(lang) });
      this.rebuild();
    }
  },

  lifetimes: {
    attached: function () {
      this.load();
    }
  },

  pageLifetimes: {
    show: function () {
      if (this.loadedAt && (state.dirty || Date.now() - this.loadedAt > STALE_MS)) this.load();
    }
  },

  methods: {
    load: function () {
      var self = this;
      return evoCloud.callEvo("home", { account: state.account }).then(function (r) {
        if (!r.ok) {
          if (!self._raw) self.setData({ state: "hidden" });
          return;
        }
        self.loadedAt = Date.now();
        self._raw = r.data;
        if (r.data.account) state.account = r.data.account;
        self.rebuild();
      });
    },

    /** 换语言时用手上的数据重拼，不再打网络 */
    rebuild: function () {
      if (!this._raw) return;
      // 分享标题带不带游戏名：「我的」页「分享卡片」选的（界面偏好，默认不带）
      var v = view.homeView(this._raw, this.data.T, EMBLEM_RPX, Date.now(), { shareName: prefs.get("shareName", false) === true });
      this.setData({ v: v, state: v.state });
    },

    onScan: function () {
      evoCloud.scanToBind(this.data.T);
    },

    onLearn: function () {
      var T = this.data.T;
      wx.showModal({ title: T.evoLearn, content: T.evoLearnBody, showCancel: false });
    },

    /** 段位、今日：去「战绩」tab 看完整的（绑定了 Evo 的人那里默认就是「我的战绩」） */
    onStats: function () {
      wx.switchTab({ url: "/pages/predator/predator" });
    },

    onMatch: function (e) {
      wx.navigateTo({ url: "/evo/match/match?id=" + encodeURIComponent(e.currentTarget.dataset.id) });
    },

    /** 分享按钮：分享由 open-type="share" 交给页面的 onShareAppMessage；这里只拦住点击，别把单局详情也打开 */
    onShareTap: function () {}
  }
});
