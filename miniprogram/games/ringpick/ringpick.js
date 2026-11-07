/**
 * 圈型速判（四选一）。玩法与几何依据见 games/utils/ringpick.js 顶部。
 *
 * 这一页刻意做得比「猜圈练习」轻：
 *   · 不用拖、不用捏、不用放大 —— 只点一个字母；
 *   · 10 秒一题、5 题一局，滑开就能玩一把；
 *   · 一屏装得下（计分条 + 地图 + 结果 + 按钮），不滚动。
 *
 * ★ 计时沿用猜圈页那套"累计 + 续跑"的写法：
 *   微信里 onShow 触发得很频繁（切后台、拉通知栏都会），
 *   直接重开计时会把已经过去的秒数抹掉 —— 猜圈页当年就踩过这个坑。
 */

var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var rp = require("../utils/ringpick.js");

var TICK_MS = 100;

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),

    noData: false,

    score: 0,
    best: 0,
    summary: "",

    roundText: "",
    leftSec: 0,
    leftPct: 100,

    mapName: "",
    image: "",
    world: "",           // 底图的放大 + 平移（view() 算好的 transform）
    ring: null,          // 第一个圈（白）
    marks: null,         // 真实的下一个圈（答完才出现）
    options: [],         // [{label, style, cls}]

    phase: "guess",      // guess | result
    result: null,        // {hit, title, message}
    done: false
  },

  onLoad: function () {
    var game = rp.newGame();
    if (!game.length) {
      this.setData({ noData: true });
      return;
    }
    this._game = game;
    this._hits = 0;
    this.loadRound(0);
    this.applyChrome();
  },

  onShow: function () {
    // 语言 / 主题是全项目共用的模块级状态，在别的页面切过就要跟上
    var l = i18n.getLang();
    var th = theme.getTheme();
    var patch = {};
    if (l !== this.data.lang) { patch.lang = l; patch.T = i18n.T(l); }
    if (th !== this.data.theme) patch.theme = th;
    if (Object.keys(patch).length) {
      this.setData(patch);
      this.renderTexts();
    }
    this.applyChrome();
    if (this.data.phase === "guess" && this._game) this.resumeTimer();
  },

  onHide: function () { this.stopTimer(); },
  onUnload: function () { this.stopTimer(); },

  applyChrome: function () {
    i18n.applyChrome(this.data.lang, "rpTitle");
    theme.applyChrome(this.data.theme);
  },

  /* ---------------- 出题 ---------------- */

  loadRound: function (i) {
    var q = this._game[i];
    if (!q) return;
    this._i = i;
    this._q = q;
    this._res = null;
    this._view = rp.view(q, this.data.lang);

    this.setData({
      phase: "guess",
      done: false,
      result: null,
      summary: "",
      marks: null,
      mapName: this._view.mapName,
      image: this._view.image,
      world: this._view.world,
      ring: this._view.ring,
      // ⚠️ data 里只放界面要用的字段；坐标留在 _view 上给判定用
      options: this._view.options.map(function (o) {
        return { label: o.label, style: o.style, cls: "" };
      }),
      roundText: i18n.t(this.data.lang, "rpRound")
        .replace("{n}", String(i + 1)).replace("{m}", String(this._game.length)),
      leftSec: Math.ceil(rp.T_ANSWER / 1000),
      leftPct: 100
    });
    this.startTimer();
  },

  /* ---------------- 计时 ---------------- */

  startTimer: function () {
    this.stopTimer();
    this._elapsed = 0;
    this._runTimer();
  },

  resumeTimer: function () {
    if (this._t0r) return;          // 本来就在跑
    this._runTimer();
  },

  _runTimer: function () {
    var self = this;
    this._t0r = Date.now();
    this._timer = setInterval(function () { self.tick(); }, TICK_MS);
    this.tick();
  },

  stopTimer: function () {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._t0r) {
      this._elapsed = (this._elapsed || 0) + (Date.now() - this._t0r);
      this._t0r = 0;
    }
  },

  tick: function () {
    if (this.data.phase !== "guess") return;
    var ms = (this._elapsed || 0) + (this._t0r ? Date.now() - this._t0r : 0);
    var left = Math.max(0, rp.T_ANSWER - ms);
    var sec = Math.ceil(left / 1000);
    var pct = Math.round((left / rp.T_ANSWER) * 100);
    // 每 100ms 一次 setData 已经够勤了：值没变就不要打扰渲染层
    if (sec !== this.data.leftSec || pct !== this.data.leftPct) {
      this.setData({ leftSec: sec, leftPct: pct });
    }
    if (left <= 0) this.reveal(null);
  },

  /* ---------------- 答题 ---------------- */

  onPick: function (e) {
    if (this.data.phase !== "guess") return;
    var i = Number(e.currentTarget.dataset.i);
    if (isNaN(i)) return;
    this.reveal(i);
  },

  /**
   * 揭晓。index = null 表示超时（没选）。
   * 对错都只改界面状态：四个点变成"对/错/其它"，真实的下一个圈画出来。
   */
  reveal: function (index) {
    if (this.data.phase !== "guess" || !this._view) return;
    this.stopTimer();

    var v = this._view;
    var picked = typeof index === "number" ? index : -1;
    var judged = picked >= 0 ? rp.judge(v, picked) : { hit: false, off: 0 };
    var last = this._i + 1 >= this._game.length;

    this._hits += judged.hit ? 1 : 0;
    this._res = {
      hit: judged.hit,
      off: judged.off,
      timeout: picked < 0,
      answerLabel: v.options[v.answerIndex].label
    };

    var score = this.data.score + (judged.hit ? rp.PER_SCORE : 0);
    this.setData({
      phase: "result",
      score: score,
      best: Math.max(this.data.best, score),
      marks: v.answer.style,
      options: v.options.map(function (o, k) {
        var cls = "";
        if (o.correct) cls = "qp-hit";
        else if (k === picked) cls = "qp-miss";
        return { label: o.label, style: o.style, cls: cls };
      }),
      leftSec: 0,
      leftPct: 0,
      done: last,
      result: this.resultView(),
      summary: last
        ? this.data.T.rpSummary
            .replace("{n}", String(this._hits))
            .replace("{m}", String(this._game.length))
            .replace("{s}", String(score))
        : ""
    });
  },

  /** 结果文案（切语言时也靠它重算） */
  resultView: function () {
    var r = this._res;
    if (!r) return null;
    var T = this.data.T;
    var msg;
    if (r.hit) {
      msg = T.rpGain.replace("{n}", String(rp.PER_SCORE));
    } else {
      msg = T.rpAnswerIs.replace("{x}", r.answerLabel);
      if (r.off) msg += " · " + T.rpOff.replace("{x}", r.off.toFixed(1));
    }
    return {
      hit: r.hit,
      title: r.timeout ? T.rpTimeout : (r.hit ? T.rpRight : T.rpWrong),
      message: msg
    };
  },

  /** 切语言后：题号、图名、结果文案都要换（题目本身不能变，否则等于偷偷换题） */
  renderTexts: function () {
    var patch = {};
    if (this._q) {
      patch.mapName = rp.mapNameOf(this._q.map, this.data.lang);
      patch.roundText = this.data.T.rpRound
        .replace("{n}", String((this._i || 0) + 1))
        .replace("{m}", String((this._game || []).length));
    }
    if (this._res) patch.result = this.resultView();
    if (this.data.done && this._game) {
      patch.summary = this.data.T.rpSummary
        .replace("{n}", String(this._hits || 0))
        .replace("{m}", String(this._game.length))
        .replace("{s}", String(this.data.score));
    }
    this.setData(patch);
  },

  onNext: function () {
    if (this.data.phase !== "result" || this.data.done) return;
    this.loadRound(this._i + 1);
  },

  onAgain: function () {
    var game = rp.newGame();
    if (!game.length) return;
    this._game = game;
    this._hits = 0;
    this.setData({ score: 0, done: false, summary: "" });
    this.loadRound(0);
  }
});
