/**
 * 小游戏分类页（第 4 个 tab）。
 *
 * 为什么有这一页（用户 2026-10 的要求）：
 *   原来第 4 个 tab 直接就是「猜圈」。加了轮盘之后有两个玩法了，
 *   用户要求**放在同一个分类下、标签叫「小游戏」** —— 所以这里是一个分类页，
 *   两个玩法各占一张卡，点进去才是具体页面。
 *   好处是以后再加小游戏不用动 tabBar（最多 5 个，且图标只能本地文件）。
 *
 * 这一页**全部是本地数据和跳转**，不联网、不耗云函数配额：
 *   · 三个玩法页和猜圈、速判的题库在分包 games/ 里（2026-11-07 搬过去，主包少约 470 KB）。
 *     这一页是 tab，只能留在主包，而主包不能 require 分包里的文件，
 *     所以两个题量抄在 utils/games_meta.js（测试拿真题库核对）；
 *   · 轮盘的候选池在 utils/codex_data.js（人数/枪数从这里现算，不写死）。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var wd = require("../../utils/wheel_data.js");
var meta = require("../../utils/games_meta.js");

/** 玩法入口。p = 页面名（分包 games/<p>/<p>） */
var GAMES = [
  { p: "ringguessr" },
  { p: "ringpick" },
  { p: "wheel" }
];

/** 猜圈入口的预览图：包内真地图（和猜圈页用的是同一批 assets/maps） */
var RING_MAP = "/assets/maps/storm-point.jpg";
/** 圈型速判的预览图：换一张图，两张卡才不像复制粘贴 */
var PICK_MAP = "/assets/maps/olympus.jpg";

/** 轮盘入口的预览：五个英雄头像，各自歪一点（像抓在手里的一把牌） */
var TILT = [-8, -4, 0, 4, 8];

/**
 * 自定义导航栏的尺寸（和地图页 / 排位页 / 比赛页同一套算法）。
 * 原生导航栏不接受自定义元素，而 ⚙ 要常驻左上角，所以高度自己算。
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
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),

    // 三张卡的预览（都是包内真资源，不引外链）
    ringMap: RING_MAP,
    pickMap: PICK_MAP,
    heroPicks: [],          // [{src, style}] —— 五个英雄头像 + 各自的角度

    // 三个入口各自的"有多少东西可玩"：英雄/枪数现算，两个题量抄在 utils/games_meta.js（测试核对）
    ringMeta: "",
    pickMeta: "",
    wheelMeta: ""
  },

  onLoad: function () {
    this.setData(navMetrics());
    // 头像跟着数据走（codex 里的前五位 = 职业选手最常玩的五个），不写死名字拼路径
    this.setData({
      heroPicks: wd.heroes().slice(0, TILT.length).map(function (h, i) {
        return { src: h.icon, style: "transform: rotate(" + TILT[i] + "deg);" };
      })
    });
    this.rebuild();
  },

  onShow: function () {
    // 语言 / 主题是全项目共用的模块级状态，在别的页面切过就要跟上
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    this.rebuild();
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
    this.setData({ lang: l, T: i18n.T(l) });
    this.rebuild();
  },

  rebuild: function () {
    var T = this.data.T;
    var s = wd.stats();
    this.setData({
      ringMeta: T.gameRingMeta.replace("{n}", String(meta.ringQuestions)),
      // 圈型速判的题库是「第一圈 + 真实第二圈」的序列数，和猜圈练习的题量不是同一个数
      pickMeta: T.gamePickMeta.replace("{n}", String(meta.pickQuestions)),
      wheelMeta: T.gameWheelMeta.replace("{h}", String(s.heroes)).replace("{w}", String(s.weapons))
    });
    i18n.applyChrome(this.data.lang, "navGames");
    theme.applyChrome(this.data.theme);
  },

  /** 点卡片 → 进具体玩法页。页面名只认 GAMES 里列出来的那几个（不拿 dataset 直接拼 URL） */
  onOpen: function (e) {
    var p = e.currentTarget.dataset.p;
    var ok = false;
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].p === p) ok = true;
    if (!ok) return;
    try {
      wx.navigateTo({ url: "/games/" + p + "/" + p });
    } catch (err) { /* 页面栈满了之类，微信自己会提示 */ }
  }
});
