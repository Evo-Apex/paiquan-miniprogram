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
 * 本页的内容**全部是本地离线数据**（match_result_data / next_match_data / algs_data），
 * 所以 onLoad 同步就能渲染出来，不用等网络。唯一的云函数调用是 proRoster（2026-11）：
 * 只读数据库里的参赛名单，用来把战队、选手名连到选手页，不碰任何上游。
 */
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var vm = require("../../utils/viewmodel.js");
var algs = require("../../utils/algs.js");
var nextmatch = require("../../utils/nextmatch.js");
var matchresult = require("../../utils/matchresult.js");
var cloud = require("../../utils/cloud.js");
var prolink = require("../../utils/prolink.js");
// 2026-11 起能点进选手页（分包 pro/，数据来自 Liquipedia）：这一页的内容仍是本地快照、立刻渲染，
// 另外向云函数要一份参赛名单（proRoster，只读数据库）把战队、选手名连到选手页；要不到就不能点，别的照旧。
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
  // 最终成绩的分段：rank 排名 / players 选手 / games 每局 / teams 战队数据 / legends 英雄
  rseg: "rank",
    // 点开的队伍（底部弹层）。null = 没开
    openTeam: null,
    // 「赛制」展开状态（默认收起，不占第一屏）
    fmtOpen: false,
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme()
  },

  /** 切换最终成绩的分段。只认白名单，不拿 dataset 直接当分支 */
  onRSeg: function (e) {
    var k = e.currentTarget.dataset.k;
    if (["rank", "players", "games", "teams", "legends"].indexOf(k) < 0) return;
    if (k === this.data.rseg) return;
    this.setData({ rseg: k });
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
      result: this._roster
        ? prolink.decorate(matchresult.build(this.data.lang), this._roster, this.data.lang)
        : matchresult.build(this.data.lang),
      openTeam: null
    });
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

  /** 点冠军队名、弹层里的「战队主页」→ 战队页（还没有战队页的 data-page 是空的，点了没反应） */
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
