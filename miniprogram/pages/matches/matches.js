/**
 * 比赛页：职业选手与职业赛事数据。
 *
 * 为什么从「排位专区」拆出来（用户 2026-10 的要求）：
 *   原来那一页把两类东西混在一起 ——
 *     · **职业/赛事**：选手的英雄与枪械统计、图鉴、ALGS 职业赛场；
 *     · **天梯**：各平台猎杀分数线、查某人、段位分布。
 *   两者受众和使用时机都不一样（看比赛 vs 查分数线），挤在一页要滑很久。
 *   拆开后：比赛页 = 职业/赛事，排位专区 = 天梯。
 *
 * 本页**全部是本地离线数据**（prostats_data / codex_data / algs_data），
 * 不联网、不耗云函数配额 —— 所以 onLoad 同步就能渲染出来，不用等网络。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var ad = require("../../utils/ad.js");
var vm = require("../../utils/viewmodel.js");
var algs = require("../../utils/algs.js");
var nextmatch = require("../../utils/nextmatch.js");
var matchresult = require("../../utils/matchresult.js");
// 职业选手统计与图鉴放在「排位专区」（用户 2026-10 的决定）——
// 这一页只留真正的赛事内容：ALGS 官方赛场的战队名次 / 英雄选取率 / 三人组合。
// 2026-10-18 起，页首多了一块「下一场比赛」：赛程 + 分组 + 队员（离线快照）。

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
    // 错误态占位：本页全是本地数据，正常不会出错；但 WXML 里那块 msg 是
    // 各页统一的结构，留着字段才不会让 {{err.kind}} 变成"没有来源的绑定"。
    err: { kind: "", style: "", title: "", message: "" },
    // ALGS 职业赛场：官方赛事赛后统计（团队名次 / 英雄选取率 / 三人组合）—— 本地离线快照
    algs: null,
    // 比赛专区 · 下一场比赛：赛程 / 分组 / 队员（本地离线快照，见 utils/nextmatch.js）
    next: null,
  // 拉斯维加斯季后赛最终成绩（2026-11-02）：那场打完了，用它替掉「下一场比赛」
  result: null,
  // 最终成绩的分段：rank 排名 / players 选手 / games 每局 / legends 英雄
  rseg: "rank",
  // 选手六边形弹层：null = 没开
  pModal: null,
    // 点开的队伍（底部弹层）。null = 没开
    openTeam: null,
    // 「赛制」展开状态（默认收起，不占第一屏）
    fmtOpen: false,
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    adUnit: ad.adUnitFor("matches")
  },

  onAdError: function (e) {
    console.warn("广告加载失败", e && e.detail);
  },

  /** 切换最终成绩的分段。只认白名单，不拿 dataset 直接当分支 */
  onRSeg: function (e) {
    var k = e.currentTarget.dataset.k;
    if (["rank", "players", "games", "legends"].indexOf(k) < 0) return;
    if (k === this.data.rseg) return;
    this.setData({ rseg: k });
  },

  /** 点选手榜某一行 → 打开六边形弹层 */
  onOpenPlayer: function (e) {
    var i = Number(e.currentTarget.dataset.i);
    var rows = (this.data.result && this.data.result.playerRows) || [];
    var row = rows[i];
    if (!row || !row.stats) return;
    var f = this.data.result.radarField || {};
    var T = this.data.T;
    var labels = [
      ["kills", T.radarKills], ["dmg", T.radarDmg], ["knocks", T.radarKnocks],
      ["assists", T.radarAssists], ["kd", T.radarKd], ["kp", T.radarKp]
    ];
    var nums = labels.map(function (x) {
      var k = x[0];
      return { k: x[1], v: String(row.stats[k]), a: String((f[k] && f[k].avg) || "") };
    });
    this.setData({ pModal: { player: row.player, team: row.team, stats: row.stats, nums: nums } });
    var self = this;
    // 等节点渲染出来再画
    wx.nextTick(function () { self.drawRadar(row.stats); });
  },

  onClosePlayer: function () { this.setData({ pModal: null }); },
  noop: function () {},

  /** 画六边形：外圈 = 全场 80 分位，所以数据特别好的会"破框" */
  drawRadar: function (stats) {
    var self = this;
    wx.createSelectorQuery().select("#radar").fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return;
      var canvas = res[0].node;
      var ctx = canvas.getContext("2d");
      var dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2;
      var W = res[0].width, H = res[0].height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      var dark = self.data.theme !== "light";
      var grid = dark ? "#2b3140" : "#e2e5eb";
      var ink3 = dark ? "#8b95a6" : "#5f6a79";
      var avgC = dark ? "#8b95a6" : "#7b8595";
      var meC = dark ? "#ff5a52" : "#c62828";

      var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
      var f = self.data.result.radarField || {};
      var keys = ["kills", "dmg", "knocks", "assists", "kd", "kp"];
      // 网格：4 圈，最外圈是全场 80 分位 -> 超出者画到框外
      var rings = [0.2, 0.4, 0.6, 0.8];
      var pt = function (ratio, i) {
        var a = -Math.PI / 2 + i * Math.PI / 3;
        return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
      };
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      rings.forEach(function (r) {
        ctx.beginPath();
        for (var i = 0; i < 6; i++) { var p = pt(r, i); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.closePath(); ctx.stroke();
      });
      for (var i = 0; i < 6; i++) {
        var p = pt(1, i);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke();
      }

      var poly = function (vals, stroke, fill, dash) {
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var q = pt(vals[i], i);
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.setLineDash(dash || []);
        ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([]);
      };
      var norm = function (src) {
        return keys.map(function (k) {
          var mx = (f[k] && f[k].max) || 1;
          return Math.min(1.25, (src[k] || 0) / mx);
        });
      };
      var avgVals = keys.map(function (k) { return (((f[k] && f[k].avg) || 0) / ((f[k] && f[k].max) || 1)); });
      poly(avgVals, avgC, null, [4, 4]);
      poly(norm(stats), meC, dark ? "rgba(255,90,82,0.16)" : "rgba(198,40,40,0.12)", []);

      ctx.fillStyle = ink3;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      var T = self.data.T;
      var names = [T.radarKills, T.radarDmg, T.radarKnocks, T.radarAssists, T.radarKd, T.radarKp];
      names.forEach(function (n, i) {
        var q = pt(1.16, i);
        ctx.fillText(n, q[0], q[1] + 4);
      });
    });
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

  onLoad: function () {
    this.setData(navMetrics());
    this.rebuild();
  },

  onShow: function () {
    // 语言与主题是全项目共用的模块级状态，在别的页面切过就要跟上
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    this.rebuild();
  },

  onShareAppMessage: function () {
    var en = this.data.lang === "en";
    return {
      // 2026-10-18 起这一页的第一块是「下一场比赛」，分享标题跟着主内容走
      title: en ? "Apex esports: next ALGS match, groups and rosters"
                : "Apex 比赛专区：下一场赛程 · 分组 · 队员",
      path: vm.sharePath("matches", "", "")
    };
  },

  /** 本地快照，重算即可（切语言、切赛事、切分组都走这里） */
  rebuild: function () {
    i18n.applyChrome(this.data.lang, "navMatches");
    theme.applyChrome(this.data.theme);
    this.setData({
      algs: algs.buildAll(this._algsId, this.data.lang),
      // 时间在视图模型里算：快照是静态的，"还有几天"必须按打开页面的那一刻算
      // 赛程全部打完时 build() 返回 hasNext=false：那就不显示「下一场比赛」，只显示最终成绩
      next: (function (nx) { return nx && nx.hasNext ? nx : null; })(nextmatch.build(this.data.lang, Date.now(), this._nextGroup)),
      result: matchresult.build(this.data.lang),
      openTeam: null
    });
  },

  /** 切 ALGS 赛事 */
  onAlgsChip: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || id === this._algsId) return;
    this._algsId = id;
    this.rebuild();
  },

  /** 切「下一场比赛」的分组（A/B/C/D） */
  onNextGroup: function (e) {
    var key = e.currentTarget.dataset.k;
    if (!key) return;
    if (this.data.next && key === this.data.next.activeGroup) return;
    this._nextGroup = key;
    this.rebuild();
  },

  /** 点队伍 → 底部弹层看队员 */
  onTeam: function (e) {
    var i = Number(e.currentTarget.dataset.i);
    var n = this.data.next;
    if (!n || !n.teams || !n.teams[i]) return;
    var t = n.teams[i];
    this.setData({
      openTeam: {
        name: t.name,
        icon: t.icon || "",
        hasIcon: !!t.hasIcon,
        groupName: n.activeGroupName,
        players: t.players || [],
        hasPlayers: !!t.hasPlayers,
        countText: i18n.t(this.data.lang, "nextPlayerCount").replace("{n}", (t.players || []).length)
      }
    });
  },

  onCloseTeam: function () {
    if (this.data.openTeam) this.setData({ openTeam: null });
  },

  /** 展开/收起「赛制」 */
  onFormat: function () {
    this.setData({ fmtOpen: !this.data.fmtOpen });
  },

  /** 弹层里的 catchtap / catchtouchmove 占位：只为拦住冒泡，不做任何事 */
  noop: function () {}
});
