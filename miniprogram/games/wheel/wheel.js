/**
 * 英雄 / 武器轮盘（「小游戏」分类里的娱乐功能）。
 *
 * 四种玩法（用户 2026-10 定的）：
 *   英雄轮盘 · 抽一位英雄          —— 从全部英雄里随机 1 位
 *   英雄轮盘 · 三人英雄组合        —— 随机 3 位不重复的英雄
 *   武器轮盘 · 一长一短            —— 长枪池抽 1 把 + 短枪池抽 1 把
 *   武器轮盘 · 两把随机            —— 全部枪里抽 2 把（可能同枪种）
 *
 * ★ 这里只放"怎么转、怎么亮"，候选池和几何在 utils/wheel_data.js：
 *   那个文件负责读 codex 数据、分长枪/短枪、算扇形角度；这一页负责交互。
 *
 * ★ 转盘用的是**真转盘**的做法，不是"随机延迟 + 闪现"：
 *     · 先抽结果，再算要转到哪个角度 —— 指针停在结果那一片上，眼睛能验证；
 *     · 角度用累加值（每次至少多转 5 圈），所以永远是顺着一个方向转；
 *     · CSS transition 负责动画，JS 只负责起点和终点；
 *     · 动画结束（SPIN_MS）才亮出结果并高亮那几片。
 *   为什么不"转到随机角度再看落在哪"：那样指针扫过的每一片都可能被误认为结果，
 *   而且抽到哪一片取决于动画时长和帧率 —— 结果不可复现，测试也没法验。
 */

var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var wd = require("../../utils/wheel_data.js");

var SPIN_MS = 2600;      // 必须和 wheel.wxss 里 .wdisc 的 transition 时长一致
var TURNS = 5;           // 每次至少多转 5 圈
var TABS = ["hero", "weapon"];

// 每个轮盘有哪两种玩法（顺序 = chip 顺序）
var MODES = { hero: ["one", "triple"], weapon: ["pair", "any"] };
// 玩法 → 文案 key
var MODE_LABEL = { one: "whHeroOne", triple: "whHeroThree", pair: "whWeaponPair", any: "whWeaponAny" };
var MODE_NOTE = { one: "whModeHeroOne", triple: "whModeHeroThree", pair: "whModePair", any: "whModeAny" };
var RESULT_NOTE = { one: "whHeroNote", triple: "whSquadNote", pair: "whPairNote", any: "whAnyNote" };

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),

    tabs: [],              // [{label, on}]
    modes: [],             // [{label, on}]
    wedges: [],            // [{i, style(clip-path), on}] —— 扇形
    spots: [],             // [{i, style(位置+旋转), label, on}] —— 扇形上的字
    rot: 0,                // 转盘当前角度（deg）
    spinning: false,
    result: null,          // {title, note, n, rows:[{name, tag, icon, hasIcon}]}
    poolText: "",
    noteText: ""
  },

  onLoad: function () {
    this._tab = "hero";
    this._mode = "one";
    this._rot = 0;
    this._picks = [];
    this._drawn = null;
    this.rebuild();
    this.applyChrome();
  },

  onShow: function () {
    var l = i18n.getLang();
    var th = theme.getTheme();
    var patch = {};
    if (l !== this.data.lang) { patch.lang = l; patch.T = i18n.T(l); }
    if (th !== this.data.theme) patch.theme = th;
    // 语言 / 主题是全项目共用的模块级状态，在别的页面切过就要跟上
    if (Object.keys(patch).length) {
      this.setData(patch);
      this.rebuild();
    }
    this.applyChrome();
  },

  onUnload: function () {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },

  applyChrome: function () {
    i18n.applyChrome(this.data.lang, "whTitle");
    theme.applyChrome(this.data.theme);
  },

  /* ---------------- 重排（切轮盘 / 切玩法 / 切语言都走这里） ---------------- */

  rebuild: function () {
    var lang = this.data.lang;
    var T = this.data.T;
    var isHero = this._tab === "hero";
    var pool = isHero ? wd.heroes() : wd.weapons();
    var picks = this._picks || [];
    // 英雄名字短（恶灵 / 寻血猎犬），武器用短标签（"复仇女神" 而不是全名）——
    // 一片的弧长只有五十来 rpx，全名会压到隔壁。
    var geo = wd.layout(pool.length, isHero ? 0.76 : 0.8);

    var wedges = geo.map(function (g, i) {
      var clip = g.clip;
      return {
        i: i,
        // 标准属性写在前、-webkit- 写在后：老 iOS WebView（13.1 以前）只认前缀版本，
        // 而万一某个运行环境不认识带前缀的那条，先出现的标准那条仍然生效。
        style: "clip-path:" + clip + ";-webkit-clip-path:" + clip + ";",
        on: picks.indexOf(i) >= 0
      };
    });

    var spots = geo.map(function (g, i) {
      return {
        i: i,
        style: "left:" + g.lx + "%;top:" + g.ly + "%;transform:translate(-50%,-50%) rotate(" + g.rot + "deg);",
        label: isHero ? wd.nameOf(pool[i], lang) : wd.shortOf(pool[i], lang),
        on: picks.indexOf(i) >= 0
      };
    });

    var tabs = [
      { label: T.whTabHero, on: isHero },
      { label: T.whTabWeapon, on: !isHero }
    ];
    var mode = this._mode;
    var modes = MODES[this._tab].map(function (k) {
      // ⚠️ 不要在这个回调里用 this：普通 function 的 this 不是 Page 实例，
      //    `k === this._mode` 会永远 false（勾选态全丢，界面上看是"两个玩法都没选中"）。
      return { label: T[MODE_LABEL[k]], on: k === mode };
    });

    var s = wd.stats();
    var poolText = isHero
      ? T.whPoolHero.replace("{n}", String(s.heroes))
      : T.whPoolWeapon.replace("{n}", String(s.weapons))
          .replace("{a}", String(s.long)).replace("{b}", String(s.short));

    this.setData({
      tabs: tabs,
      modes: modes,
      wedges: wedges,
      spots: spots,
      poolText: poolText,
      noteText: T[MODE_NOTE[this._mode]].replace("{n}", String(isHero ? s.heroes : s.weapons)),
      result: this.data.spinning ? null : this.viewResult()
    });
  },

  /** 抽到的那几个 → WXML 用的结果卡片（语言变了也能重算，所以不缓存成文案） */
  viewResult: function () {
    var drawn = this._drawn;
    if (!drawn || !drawn.length) return null;
    var lang = this.data.lang;
    var T = this.data.T;
    var weapon = this._tab === "weapon";
    var rows = drawn.map(function (it) {
      if (weapon) {
        return {
          name: wd.nameOf(it, lang),
          // 标签把"长/短"和枪种一起写出来 —— 只写枪种的话，「一长一短」这个玩法的
          // 结果就还得自己换算一遍
          tag: (it.side === "short" ? T.whSideShort : T.whSideLong) + " · " + wd.className(it, lang),
          icon: "",
          hasIcon: false
        };
      }
      return { name: wd.nameOf(it, lang), tag: "", icon: it.icon, hasIcon: !!it.icon };
    });
    return {
      title: weapon ? T.whWeaponResult : (rows.length > 1 ? T.whSquadResult : T.whHeroResult),
      note: T[RESULT_NOTE[this._mode]],
      n: rows.length,
      rows: rows
    };
  },

  /* ---------------- 切轮盘 / 切玩法 ---------------- */

  onTab: function (e) {
    if (this.data.spinning) return;          // 转的时候不许换池子，否则指针和结果对不上
    var k = TABS[Number(e.currentTarget.dataset.i)];
    if (!k || k === this._tab) return;
    this._tab = k;
    this._mode = MODES[k][0];
    this.clearDraw();
    this.rebuild();
  },

  onMode: function (e) {
    if (this.data.spinning) return;
    var k = MODES[this._tab][Number(e.currentTarget.dataset.i)];
    if (!k || k === this._mode) return;
    this._mode = k;
    this.clearDraw();
    this.rebuild();
  },

  clearDraw: function () {
    this._drawn = null;
    this._picks = [];
  },

  /* ---------------- 抽 ---------------- */

  onSpin: function () {
    if (this.data.spinning) return;
    var isHero = this._tab === "hero";
    var pool = isHero ? wd.heroes() : wd.weapons();
    var drawn = wd.draw(this._tab, this._mode);
    var idx = drawn.map(function (d) {
      for (var i = 0; i < pool.length; i++) if (pool[i].id === d.id) return i;
      return 0;
    });

    // 指针钉在正上方：把第一个中奖扇形的**中线**转到 0°。
    // need 是"还差多少度"，加上整圈数就是这次要转到的绝对角度。
    var cur = this._rot || 0;
    var from = ((cur % 360) + 360) % 360;
    var need = (((360 - wd.midAngle(idx[0], pool.length)) - from) % 360 + 360) % 360;
    this._rot = cur + TURNS * 360 + need;

    this._drawn = drawn;
    this._winIndex = idx;
    this._picks = [];                        // 转的过程中不高亮，停下来才亮
    // ⚠️ 顺序不能反：先把 spinning 置上，rebuild 才会把结果收起来
    this.setData({ spinning: true, rot: this._rot });
    this.rebuild();

    var self = this;
    this._timer = setTimeout(function () { self.finishSpin(); }, SPIN_MS);
  },

  /** 动画结束：高亮中奖的扇形 + 亮出结果卡片（按钮文案也在这里变成「再抽一次」） */
  finishSpin: function () {
    if (!this.data.spinning) return;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._picks = this._winIndex || [];
    this.setData({ spinning: false });
    this.rebuild();
    this.buzz();
  },

  /** 轻微一震：转了两秒多，落地要有反馈（震动失败不影响任何逻辑） */
  buzz: function () {
    try {
      if (typeof wx !== "undefined" && typeof wx.vibrateShort === "function") {
        wx.vibrateShort({ type: "light" });
      }
    } catch (e) { /* 老基础库 / 关闭了震动 */ }
  }
});
