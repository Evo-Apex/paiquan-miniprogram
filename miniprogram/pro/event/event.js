/**
 * 赛季里的一站（2026-11-08，比赛页「这个赛季」、进度条下的「下一站」点进来，参数 key = s1pl / s1po / s2pl / s2po / champ）。
 *
 * 照 August 定的：比赛页原来的三块内容挪到这里，按这一站有什么数据放什么 ——
 *   最终成绩（本地快照 match_result_data：S2 季后赛决赛，排名 / 选手 / 每局 / 战队 / 英雄 + 参赛名单连到选手页）、
 *   下一场比赛（本地快照 next_match_data：分组、赛程、队员，快照对得上这一站、还没打完时）、
 *   ALGS 职业赛场（本地快照 algs_data：这一站的战队名次、英雄选取率、三人组合）；
 *   上面都没有名次表时，放 Liquipedia 的名次（云函数 proSeason，只读数据库）；还没打的站是已晋级的队。
 * 头部（日期、冠军）和名次来自 proSeason；参赛名单来自 proRoster（同原来的比赛页）。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var algs = require("../../utils/algs.js");
var nextmatch = require("../../utils/nextmatch.js");
var matchresult = require("../../utils/matchresult.js");
var cloud = require("../../utils/cloud.js");
var prolink = require("../../utils/prolink.js");
var prefs = require("../../utils/prefs.js");
var nextData = require("../../data/next_match_data.js");
var sv = require("../utils/seasonview.js");

// 最终成绩的快照是哪一站（match_result_data 是 2026-11-02 的 S2 季后赛决赛；换了快照要跟着改）
var RESULT_STAGE = "s2po";
// ALGS 职业赛场快照里，这个赛季每一站的编号（联赛只看亚太南，同 proSeason 的 SEASON）
var ALGS_IDS = {
  s1pl: "Y6-Split1-Pro-League-APAC_S",
  s1po: "Y6-Split1-ALGS-Playoffs-Global",
  s2pl: "Y6-Split2-Pro-League-APAC_S",
  s2po: "Y6-Split2-ALGS-Playoffs-Global",
  champ: "Y6-ALGS-Championships-Global"
};

/** 下一场比赛的快照是哪一站（"Y6-Split2" + "ALGS-Playoffs" → s2po）；对不上 → "" */
function nextStageKey(ev, year) {
  if (!ev || String(ev.split || "").indexOf("Y" + year) !== 0) return "";
  var sp = /Split(\d)/.exec(ev.split || "");
  if (/Championship/i.test(ev.league || "")) return "champ";
  if (!sp) return "";
  if (/Pro-League/i.test(ev.league || "")) return "s" + sp[1] + "pl";
  if (/Playoffs/i.test(ev.league || "")) return "s" + sp[1] + "po";
  return "";
}

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    state: "loading",   // loading / ready
    key: "",
    stage: null,
    showStandings: false,
    algs: null,
    next: null,
    result: null,
    // 最终成绩的分段：rank 排名 / players 选手 / games 每局 / teams 战队数据 / legends 英雄
    rseg: "rank",
    // 点开的队伍（底部弹层）。null = 没开
    openTeam: null,
    // 「赛制」展开状态（默认收起）
    fmtOpen: false
  },

  onLoad: function (options) {
    var key = decodeURIComponent((options && options.key) || "");
    this.setData({ key: key });
    var self = this;
    this.rebuild();
    // 两个云函数调用都只读数据库；要不到也照样显示本地快照
    cloud.callCloud({ action: "proSeason" }).then(function (r) {
      if (r.ok && r.data) self._season = r.data;
      self._seasonDone = true;
      self.rebuild();
    });
    this.loadRoster();
  },

  /** 参赛名单（Liquipedia）：到了以后重算一遍，名次行、选手名就能点了 */
  loadRoster: function () {
    var self = this;
    return cloud.callCloud({ action: "proRoster" }).then(function (r) {
      if (!r.ok || !r.data || !Array.isArray(r.data.teams)) return;
      self._roster = r.data;
      self.rebuild();
    });
  },

  onShow: function () {
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    theme.applyChrome(this.data.theme);
    this.rebuild();
  },

  onShareAppMessage: function () {
    var s = this.data.stage;
    return {
      title: (s ? s.name + " · " : "") + this.data.T.navProEvent,
      path: "/pro/event/event?key=" + encodeURIComponent(this.data.key || "")
    };
  },

  rebuild: function () {
    var lang = this.data.lang;
    var key = this.data.key;
    var year = (this._season && this._season.year) || 6;
    var stage = this._season ? sv.stage(this._season, key, lang, Date.now(), prefs.get("homeTeam", "")) : null;
    var result = null;
    if (key === RESULT_STAGE) {
      result = this._roster ? prolink.decorate(matchresult.build(lang), this._roster, lang) : matchresult.build(lang);
    }
    var next = null;
    if (nextStageKey(nextData.event, year) === key) {
      var nx = nextmatch.build(lang, Date.now(), this._nextGroup);
      next = nx && nx.hasNext ? nx : null;
    }
    var a = null;
    if (ALGS_IDS[key]) {
      var built = algs.buildAll(ALGS_IDS[key], lang);
      // 只要这一站：没有这一站的快照（buildAll 退回别的赛事）就不放
      if (built && built.ev && built.ev.id === ALGS_IDS[key]) a = Object.assign({}, built, { chips: [] });
    }
    var hasTable = !!(result && result.rows && result.rows.length) || !!(a && a.ev && a.ev.hasStandings);
    i18n.applyChrome(lang, "navProEvent");
    if (stage && stage.name && wx.setNavigationBarTitle) {
      try { wx.setNavigationBarTitle({ title: stage.name }); } catch (e) { /* 页面还没起来 */ }
    }
    this.setData({
      state: this._seasonDone || result || a || next ? "ready" : "loading",
      stage: stage,
      showStandings: !!(stage && stage.rows.length && !hasTable),
      algs: a,
      next: next,
      result: result,
      openTeam: null
    });
  },

  /** 切换最终成绩的分段。只认白名单，不拿 dataset 直接当分支 */
  onRSeg: function (e) {
    var k = e.currentTarget.dataset.k;
    if (["rank", "players", "games", "teams", "legends"].indexOf(k) < 0) return;
    if (k === this.data.rseg) return;
    this.setData({ rseg: k });
  },

  /** 点名次表的一行 → 底部弹层看这队的三名队员（和「下一场比赛」点队伍是同一个弹层） */
  onRankTeam: function (e) {
    var i = Number(e.currentTarget.dataset.ti);
    var r = this.data.result;
    if (!r || !r.rosterTeams || !(i >= 0) || !r.rosterTeams[i]) return;
    var t = r.rosterTeams[i];
    this.setData({
      openTeam: {
        name: t.name,
        icon: "",
        hasIcon: false,
        groupName: t.place ? i18n.t(this.data.lang, "resTeamPlace").replace("{n}", t.place) : "",
        teamPage: t.teamPage || "",
        players: t.players || [],
        hasPlayers: !!(t.players && t.players.length),
        countText: i18n.t(this.data.lang, "nextPlayerCount").replace("{n}", (t.players || []).length)
      }
    });
  },

  /** 点冠军队名、弹层里的「战队主页」、Liquipedia 名次的一行 → 战队页 */
  onOpenTeam: function (e) {
    var page = e.currentTarget.dataset.page;
    if (!page) return;
    wx.navigateTo({ url: "/pro/team/team?page=" + encodeURIComponent(page) });
  },

  /** 点选手名 → 选手页（没连上 Liquipedia 的名字 data-page 是空的，点了没反应） */
  onOpenPlayer: function (e) {
    var page = e.currentTarget.dataset.page;
    if (!page) return;
    wx.navigateTo({ url: "/pro/player/player?page=" + encodeURIComponent(page) });
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
    // 下一场的队伍名单是另一份数据：按队名去 Liquipedia 名单里对，对上了才有战队页入口
    var rt = this._roster ? prolink.findTeam(this._roster, t.name) : null;
    this.setData({
      openTeam: {
        name: t.name,
        icon: t.icon || "",
        hasIcon: !!t.hasIcon,
        groupName: n.activeGroupName,
        teamPage: (rt && rt.teamPage) || "",
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
