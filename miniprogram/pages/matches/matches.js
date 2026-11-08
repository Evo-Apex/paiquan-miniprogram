/**
 * 比赛页：职业赛事（2026-11-08 照 August 的「赛季进度条」设计稿改版）。
 *
 * 这一页现在只是外壳：自定义导航栏（⚙ 常驻左上角，同地图页）+ 设置面板（语言、主题）+
 * 分包 pro 的赛季组件（pro/components/season：赛季进度条、主队、近期比赛、这个赛季、所有 CN 战队，见 pro/utils/seasonview.js）。
 * 原来这里的三块（S2 季后赛的最终成绩、下一场比赛、ALGS 职业赛场）按 August 定的挪进了每一站的详情页 pro/event/event，
 * 从「这个赛季」里点进去。职业选手统计与图鉴在「排位专区」（用户 2026-10 的决定）。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var vm = require("../../utils/viewmodel.js");

/**
 * 自定义导航栏的尺寸（和地图页/排位页同一套算法）。
 * 这一页用 navigationStyle: custom —— 原生导航栏不接受自定义元素，
 * 而 ⚙ 要常驻左上角，所以高度得自己按状态栏 + 胶囊位置算。
 */
function navMetrics() {
  var info = {};
  try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) { info = {}; }
  var top = info.statusBarHeight || 20;
  var h = 44;
  var right = 96;
  try {
    var r = wx.getMenuButtonBoundingClientRect();
    if (r && r.height && r.top) {
      h = (r.top - top) * 2 + r.height;
      if (info.windowWidth && r.left) right = info.windowWidth - r.left + 8;
    }
  } catch (e) { /* 旧基础库没有这个接口，用上面的保守值 */ }
  return { navTop: top, navH: h, navRight: right };
}

Page({
  data: {
    panelOpen: false,
    // 错误态占位：WXML 里那块 msg 是各页统一的结构，留着字段才不会让 {{err.kind}} 变成"没有来源的绑定"
    err: { kind: "", style: "", title: "", message: "" },
    navTop: 20,
    navH: 44,
    navRight: 96,
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme()
  },

  onTogglePanel: function () {
    this.setData({ panelOpen: !this.data.panelOpen });
  },

  onTheme: function (e) {
    var t = theme.setTheme(e.currentTarget.dataset.t);
    if (t !== this.data.theme) this.setData({ theme: t });
  },

  onLang: function (e) {
    var l = i18n.setLang(e.currentTarget.dataset.l);
    if (l === this.data.lang) return;
    this.setData({ lang: l, T: i18n.T(l) });   // 赛季组件跟着 lang 属性换
    this.applyChrome();
  },

  onLoad: function () {
    this.setData(navMetrics());
  },

  onShow: function () {
    // 语言与主题是全项目共用的模块级状态，在别的页面切过就要跟上
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    this.applyChrome();
  },

  applyChrome: function () {
    i18n.applyChrome(this.data.lang, "navMatches");
    theme.applyChrome(this.data.theme);
  },

  onShareAppMessage: function () {
    var en = this.data.lang === "en";
    return {
      title: en ? "Apex esports: ALGS season, upcoming events and CN teams"
                : "Apex 比赛：ALGS 赛季进度 · 近期比赛 · 国内战队",
      path: vm.sharePath("matches", "", "")
    };
  }
});
