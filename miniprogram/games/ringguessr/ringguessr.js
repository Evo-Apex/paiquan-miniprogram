/**
 * 猜圈练习页。
 *
 * 玩法（用户定的时间线，见 games/utils/rings.js）：第 0 秒出第 1 个圈、第 5 秒第 2 个、
 * 第 10 秒第 3 个，20 秒内猜**下一个圈**的圈心；答案圈从头到尾不显示。
 *
 * ★ 选点交互（2026-10-16 第二轮重做，用户反馈"不符合手机操作习惯"）：
 *
 *   第一版做的是「点地图放准星 + 按住左下放大镜拖动来微调」—— 那是**间接操作**：
 *   手指在小方框里动，准星在别的地方动，谁也没见过这种玩法。已删掉放大镜。
 *
 *   现在是手机地图选点的**通行做法**（高德/百度选点、Uber 上车点、游戏标点都用这个）：
 *     · 准星**固定在屏幕正中**，动的永远是地图 —— 落点精度不取决于手指点哪儿；
 *     · **点一下地图** = 聚焦到那个位置（并放大到 2.5 倍，因为 1 倍时地图正好铺满、没法平移）；
 *     · **单指拖动** = 平移地图，准星下面那一点就是你要的位置；
 *     · **双指捏合** = 缩放（1~5 倍），放大后同样一段手指位移对应的地图距离更小 = 更准；
 *     · 「缩小」按钮回到 1 倍看全图（圈的整体形状需要看全）；
 *     · 底部大按钮「就这里」→「确定 / 再调调」（二次确认，但按钮都够大、够低）。
 *
 *   为什么这比第一版准：z=1 时 1 个屏幕像素 ≈ 42 个地图单位，第 3 圈半径约 1400，
 *   也就是 3% —— 随手一拖就够；放大到 2.5 倍就是 1% 出头。手指点屏幕的 ±15px 误差
 *   在这里根本不存在，因为**你不是用指尖去指，而是把地图拖到位**。
 */

var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var ad = require("../../utils/ad.js");
var rings = require("../utils/rings.js");

var TICK_MS = 250;   // 每秒 4 次就够（原来是 100ms/10 次，桌面端容易卡）
var TAP_MAX_MOVE = 12;    // 位移小于这个（px）且时间短 = 点击，不是拖动
var TAP_MAX_MS = 350;

// 新手示范这次启动是否已看过。只存内存（本项目不写任何本地存储）。
var TUT_SEEN = false;

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),

    noData: false,

    phase: "guess",        // guess | result
    done: false,
    visible: 1,
    hintTotal: 0,
    pc: false,             // 是否电脑端（微信 PC）
    bdAcc: "", bdTime: "", bdFormula: "", bdHint: "",          // 本题一共给几个提示圈（界面写「已出现/总共」）
    leftSec: 0,
    leftPct: 100,
    score: 0,
    best: 0,

    roundText: "",
    mapName: "",
    image: "",
    bankText: "",
    hints: [],
    ends: [],
    showEnds: false,

    // 地图视口的 transform（准星固定在正中，所以只需要这一条）
    worldStyle: "",
    zoomText: "",
    canZoomOut: false,

    confirming: false,
    result: null,
    errText: "",
    roundScoreText: "",

    tutStep: 0,
    tutText: "",

    // 未开通流量主时为空串，广告组件不渲染（配置见 utils/ad.js）
    adUnit: ad.adUnitFor("ringguessr")
  },

  onLoad: function () {
    var game = rings.newGame();
    if (!game.rounds.length) {
      this.setData({ noData: true });
      return;
    }
    this._game = game.rounds;
    this._bank = rings.allQuestions().length;
    this.loadRound(0);
    this.applyChrome();
    if (!TUT_SEEN) this.startTutorial();
  },

  onReady: function () { this.measure(); },
  onUnload: function () { this.stopTicker(); },
  onHide: function () { this.stopTicker(); },

  measure: function () {
    var self = this;
    if (typeof wx === "undefined" || typeof wx.createSelectorQuery !== "function") return;
    try {
      wx.createSelectorQuery()
        .select("#rgmap")
        .boundingClientRect(function (rect) {
          if (!rect || !rect.width) return;
          self._rect = rect;
          self.applyVp();          // 尺寸一拿到就按它排版（尺寸变了也只影响缩放基准）
        })
        .exec();
    } catch (e) { /* 量不到就等下一次 tap 再补量，页面不会崩 */ }
  },

  /** 电脑端（微信 PC/Mac）判断：用来降级桌面上很吃性能的效果 */
  syncPlatform: function () {
    try {
      var s = wx.getSystemInfoSync();
      var pf = String(s.platform || "");
      this.setData({ pc: /devtools|windows|mac/i.test(pf) });
    } catch (e) { /* 拿不到就按手机处理 */ }
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) {
      this.setData({ lang: l, T: i18n.T(l) });
      if (this.data.tutStep) this.setTutStep(this.data.tutStep);
      else if (this._game) this.loadRound(this._i || 0);
    }
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    this.applyChrome();
    this.syncPlatform();
    this.measure();
    if (this._game && this.data.phase === "guess" && !this.data.tutStep) this.resumeTicker();
  },

  /** 广告拉取失败不影响游戏，记一下就行 */
  onAdError: function (e) {
    console.warn("广告加载失败", e && e.detail);
  },

  applyChrome: function () {
    i18n.applyChrome(this.data.lang, "rgTitle");
    theme.applyChrome(this.data.theme);
  },

  /* ---------------- 视口 ---------------- */

  /** 把实例上的 _vp 投影成 WXML 用的 transform（地图内容按 W 缩放到 W*z） */
  applyVp: function (animate) {
    var w = (this._rect && this._rect.width) || 0;
    var vp = this._vp || rings.vpInit();
    this._vp = vp;
    var style = "";
    if (w) {
      style = "width:" + w + "px;height:" + w + "px;" +
              "transform:translate(" + vp.tx + "px," + vp.ty + "px) scale(" + vp.z + ");";
    }
    var zoom = Math.round(vp.z * 10) / 10;
    this.setData({
      worldStyle: style,
      zoomText: "×" + zoom,
      canZoomOut: vp.z > rings.VP_MIN_Z + 0.01,
      // transform 只在"程序改动"时加过渡，手指拖动时不能有（否则跟手会飘）
      worldAnim: !!animate
    });
  },

  /* ---------------- 触摸：拖动 / 捏合 / 点击 ---------------- */

  onTouchStart: function (e) {
    if (this.data.phase !== "guess") return;
    var ts = (e.touches || []);
    this._t0 = Date.now();
    this._moved = 0;
    if (ts.length >= 2) {
      this._pinch = { d0: dist(ts[0], ts[1]), vp0: this._vp || rings.vpInit() };
      this._pan = null;
    } else if (ts.length === 1) {
      this._pan = { x: ts[0].clientX, y: ts[0].clientY, vp0: this._vp || rings.vpInit() };
      this._pinch = null;
    } else {
      this._pan = null;
      this._pinch = null;
    }
  },

  onTouchMove: function (e) {
    if (this.data.phase !== "guess") return;
    var ts = (e.touches || []);
    var w = this._rect && this._rect.width;
    if (!w) { this.measure(); return; }

    if (ts.length >= 2 && this._pinch) {
      var d = dist(ts[0], ts[1]);
      if (this._pinch.d0 > 0) {
        var factor = d / this._pinch.d0;
        this._vp = rings.vpZoom(this._pinch.vp0, factor, w);
        this.applyVp(false);
      }
      this._moved = 999;
      return;
    }
    if (ts.length === 1 && this._pan) {
      var dx = ts[0].clientX - this._pan.x;
      var dy = ts[0].clientY - this._pan.y;
      this._moved = Math.max(this._moved, Math.abs(dx) + Math.abs(dy));
      this._vp = rings.vpPan(this._pan.vp0, dx, dy, w);
      this.applyVp(false);
      return;
    }
    if (ts.length === 1) {
      // 没有 touchstart 记录（例如从拖到"抬起一指"的过渡）就当作从这里开始
      this._pan = { x: ts[0].clientX, y: ts[0].clientY, vp0: this._vp || rings.vpInit() };
    }
  },

  onTouchEnd: function (e) {
    if (this.data.phase !== "guess") return;
    var wasTap = this._moved <= TAP_MAX_MOVE && (Date.now() - (this._t0 || 0)) <= TAP_MAX_MS;
    this._pan = null;
    this._pinch = null;
    if (wasTap) this.focusOnTap(e);
  },

  /**
   * 点一下地图 = **聚焦到那个位置**（并放大到 2.5 倍）。
   * 为什么不只是"放个标记"：1 倍时地图正好铺满容器，没有可平移的余量，
   * 准星就只能指着正中 —— 选不了别的点。放大之后拖动才有意义。
   */
  focusOnTap: function (e) {
    var p = pointOf(e);
    var w = this._rect && this._rect.width;
    if (!p || !w) { this.measure(); return; }
    var vp = this._vp || rings.vpInit();
    var size = w * vp.z;
    var fx = (p.x - this._rect.left - vp.tx) / size;
    var fy = (p.y - this._rect.top - vp.ty) / size;
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) return;   // 点在容器外
    var z = vp.z < rings.VP_TAP_Z ? rings.VP_TAP_Z : vp.z;
    this._vp = rings.vpFocus(vp, fx, fy, z, w);
    this.applyVp(true);
  },

  /** 「缩小」：回到 1 倍看全图，准星还压在刚才那个点上 */
  onZoomOut: function () {
    var w = this._rect && this._rect.width;
    if (!w) return;
    var c = rings.vpCenter(this._vp || rings.vpInit(), w);
    this._vp = rings.vpFocus(this._vp || rings.vpInit(), c.x, c.y, rings.VP_MIN_Z, w);
    this.applyVp(true);
  },

  /** 现在准星压着的那一点（0~1）——就是玩家选的答案 */
  guessPoint: function () {
    var w = this._rect && this._rect.width;
    if (!w) return null;
    return rings.vpCenter(this._vp || rings.vpInit(), w);
  },

  /* ---------------- 新手示范 ---------------- */

  startTutorial: function () {
    this.loadRound(0);
    this.stopTicker();
    this.setData({ confirming: false, result: null, score: 0 });
    this.setTutStep(1);
  },

  setTutStep: function (step) {
    var lang = this.data.lang;
    this.setData({
      tutStep: step,
      tutText: i18n.t(lang, "rgTut" + step),
      confirming: false,
      result: null
    });
    // 每一步顺手把动作演示出来
    if (step === 1) {
      this._vp = rings.vpInit();
      this.applyVp(true);
      this.setData({ visible: this._hintCount || 1 });
    } else if (step === 2) {
      // 演示"点地图 → 聚焦放大 → 拖动准星"
      var w = this._rect && this._rect.width;
      if (w) {
        this._vp = rings.vpFocus(rings.vpInit(), 0.42, 0.38, rings.VP_TAP_Z, w);
        this.applyVp(true);
      }
    } else if (step === 3) {
      this.setData({ visible: this._hintCount || 1 });
    } else if (step === 4) {
      this.setData({ confirming: true });
    }
  },

  onTutNext: function () {
    var step = this.data.tutStep;
    if (step >= 3) { this.endTutorial(); return; }
    this.setTutStep(step + 1);
  },

  onTutSkip: function () { this.endTutorial(); },

  endTutorial: function () {
    TUT_SEEN = true;
    this.setData({ tutStep: 0, tutText: "", confirming: false, score: 0 });
    this.loadRound(0);
  },

  /* ---------------- 计时 ---------------- */

  /** 新一轮：计时从 0 开始 */
  startTicker: function () {
    this.stopTicker();
    this._elapsed = 0;
    this._runTicker();
  },

  /**
   * 从后台 / 别的页面回来：**接着走**，不能把已经过去的秒数抹掉。
   *
   * ★ 这里修过一个真 bug（用户报"玩着玩着不显示圈了"）：
   *   原来 onShow 里直接调 startTicker()，等于把这一轮的时钟重置为 0 ——
   *   切一次后台回来，已经出现的第 2、3 个圈会**消失**，倒计时也跳回 20 秒。
   *   而微信里 onShow 触发得很频繁（切 tab、拉通知栏、点开广告再返回都会触发），
   *   所以表现就是"玩着玩着圈没了"。
   */
  resumeTicker: function () {
    if (this._t0r) return;            // 本来就在跑，别重复起
    this._runTicker();
  },

  _runTicker: function () {
    var self = this;
    this._t0r = Date.now();
    this._timer = setInterval(function () { self.tick(); }, TICK_MS);
    this.tick();
  },

  stopTicker: function () {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    // 把刚跑过的这一段攒起来，恢复时接着算（直接清零就是上面那个 bug）
    if (this._t0r) {
      this._elapsed = (this._elapsed || 0) + (Date.now() - this._t0r);
      this._t0r = 0;
    }
  },

  tick: function () {
    if (this.data.phase !== "guess" || this.data.tutStep) return;
    var ms = (this._elapsed || 0) + (this._t0r ? Date.now() - this._t0r : 0);
    var st = rings.stageAt(ms, this._hintCount);
    if (st.visible !== this.data.visible || st.leftSec !== this.data.leftSec) {
      this.setData({
        visible: st.visible,
        leftSec: st.leftSec,
        leftPct: Math.max(0, Math.round((st.leftSec / Math.ceil(rings.T_END / 1000)) * 100))
      });
    }
    if (st.over) this.reveal(null);
  },

  /* ---------------- 出题 ---------------- */

  loadRound: function (i) {
    var q = this._game[i];
    if (!q) return;
    this._i = i;
    this._q = q;
    this._vp = rings.vpInit();          // 每道题都从"看全图"开始
    this._pan = null;
    this._pinch = null;
    var lang = this.data.lang;
    var view = rings.roundView(q, lang);
    this._hintCount = view.hintCount;
    this.setData({ hintTotal: view.hintCount });

    var ends = rings.endZones(q.map).map(function (e, k) {
      return { key: "e" + k, style: rings.boxOf(e).style };
    });

    this.setData({
      phase: "guess",
      done: false,
      visible: 1,
      leftSec: Math.ceil(rings.T_END / 1000),
      leftPct: 100,
      roundText: i18n.t(lang, "rgRound")
        .replace("{n}", String(i + 1)).replace("{m}", String(this._game.length)),
      mapName: view.mapName,
      image: view.image,
      bankText: i18n.t(lang, "rgBank").replace("{n}", String(this._bank || 0)) + " · " +
                i18n.t(lang, "rgPerGame").replace("{n}", String(rings.ROUNDS)),
      hints: view.hints.map(function (b, k) { return { key: "h" + k, style: b.style }; }),
      ends: ends,
      confirming: false,
      result: null,
      errText: "",
      roundScoreText: ""
    });
    this.applyVp(true);
    this.startTicker();
  },

  /* ---------------- 交卷：两步确认 ---------------- */

  onConfirm: function () {
    if (this.data.phase !== "guess") return;
    this.setData({ confirming: true });
  },

  onCancelConfirm: function () { this.setData({ confirming: false }); },

  onSubmit: function () {
    if (this.data.phase !== "guess") return;
    var g = this.guessPoint();
    if (!g) return;
    this.reveal(g);
  },

  /** 本题已用毫秒（从第一圈出现算起） */
  elapsedMs: function () {
    return (this._elapsed || 0) + (this._t0r ? Date.now() - this._t0r : 0);
  },

  /** 得分明细的几行文字（精度分、时间系数、口径说明） */
  breakdown: function (lang, p) {
    if (!p) return null;
    return {
      accText: i18n.t(lang, "rgBdAcc")
        .replace("{n}", String(p.base))
        .replace("{p}", String(Math.round(p.acc * 100))),
      timeText: i18n.t(lang, "rgBdTime")
        .replace("{s}", String(p.elapsedSec))
        .replace("{m}", String(Math.round(p.timeMul * 100))),
      formula: i18n.t(lang, "rgBdFormula")
        .replace("{a}", String(Math.round(p.acc * 100)))
        .replace("{t}", String(Math.round(p.timeMul * 100))),
      hint: i18n.t(lang, "rgBdHint")
    };
  },

  reveal: function (guess) {
    if (this.data.phase !== "guess") return;
    this.stopTicker();
    var lang = this.data.lang;
    var ms = this.elapsedMs();
    var bd = this.breakdown(lang, this._lastParts) || {};
    var res = guess
      ? rings.judge(this._q, guess, ms)
      : { score: 0, hit: false, ratio: 0, parts: { acc: 0, base: 0, timeMul: 0, elapsedSec: 0, hit: false } };
    var rv = guess ? rings.resultView(this._q, guess, res, lang) : null;
    this._lastParts = res.parts;
    var bd = this.breakdown(lang, res.parts) || {};
    var score = this.data.score + res.score;

    this.setData({
      phase: "result",
      visible: this._hintCount,
      leftSec: 0,
      leftPct: 0,
      confirming: false,
      score: score,
      best: Math.max(this.data.best, score),
      result: {
        hit: res.hit,
        title: !guess
          ? i18n.t(lang, "rgMissShort")
          : i18n.t(lang, res.hit ? "rgHitIn" : "rgHitOut"),
        answer: { style: rings.boxOf(this._q.answer).style },
        centerDot: rv ? { style: rv.centerDot.style } : null,
        guessDot: rv ? { style: rv.guessDot.style } : null
      },
      errText: guess
        ? i18n.t(lang, "rgErr").replace("{r}", rv.ratioText)
        : i18n.t(lang, "rgMiss"),
      roundScoreText: i18n.t(lang, "rgThisRound").replace("{n}", String(res.score)),
      // 得分明细：精度分 × 时间系数，逐项列出来玩家才知道为什么分低
      bdAcc: bd.accText, bdTime: bd.timeText,
      bdFormula: bd.formula, bdHint: bd.hint
    });
    if (this.data.tutStep) {
      TUT_SEEN = true;
      this.setData({ tutStep: 0, tutText: "" });
    }
  },

  onNext: function () {
    if (this.data.phase !== "result") return;
    var next = (this._i || 0) + 1;
    if (next >= this._game.length) {
      this.setData({
        done: true,
        roundText: i18n.t(this.data.lang, "rgDone"),
        best: Math.max(this.data.best, this.data.score)
      });
      return;
    }
    this.loadRound(next);
  },

  onAgain: function () {
    var game = rings.newGame();
    if (!game.rounds.length) return;
    this._game = game.rounds;
    this.setData({ score: 0, done: false });
    this.loadRound(0);
  },

  onToggleEnds: function () {
    this.setData({ showEnds: !this.data.showEnds });
  }
});

/* ---------- 小工具 ---------- */

function dist(a, b) {
  var dx = a.clientX - b.clientX;
  var dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 取触点坐标。一律用 clientX/clientY —— 它和 boundingClientRect 的 left/top
 * 都是**相对视口**的，才能相减；tap 事件 detail 里的 x/y 是相对文档的，
 * 页面一滚动就会偏（踩过一次）。
 */
function pointOf(e) {
  if (!e) return null;
  var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (t && typeof t.clientX === "number") return { x: t.clientX, y: t.clientY };
  if (e.detail && typeof e.detail.x === "number") return { x: e.detail.x, y: e.detail.y };
  return null;
}
