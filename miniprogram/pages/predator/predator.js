var core = require("../../utils/core.js");
var vm = require("../../utils/viewmodel.js");
var cloud = require("../../utils/cloud.js");
var ad = require("../../utils/ad.js");
var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var rankdist = require("../../utils/rankdist.js");
var prostats = require("../../utils/prostats.js");
// 2026-10-18 用户要求去掉「版本图鉴」（英雄 + 枪械样本）：
// 那一块和上面「职业选手数据」讲的其实是同一件事（谁被用得多），一页里出现两遍。
// 注意：codex_data.js **不能删** —— prostats/algs 的英雄头像与中英名还在用它。
// 职业选手统计放在这一页（用户 2026-10 的决定）：
// 它回答的是"现在职业选手常玩什么、怎么配枪"，属于**参考数据**，和天梯放在一起更顺手；
// 「比赛」页只留真正的赛事内容（ALGS 赛场名次/选取率）。

var PLATFORMS = core.PLATFORMS;
var REFRESH_MS = 10 * 60 * 1000;   // 分数线按小时更新，不用勤刷

// 战队专区：**暂时隐藏**（2026-10-10）。
// 原因：上游（ALS）对职业选手账号的索引不全，按名字根本拿不到正确账号 ——
// 实测游戏里真实存在的账号（LqDuD 主号 17,729 分、Kassa 的「运气好点的白银」）
// 上游查不到；能查到的又分不清是主号还是小号（青铜/黄金/铂金全出来了）。
// 按 uid 查是准的，但 uid 拿不到。所以要显示这一块，只有等选手本人把 uid 给过来。
// 恢复方式：把下面这行改成 true（页面、视图模型、后端 teams.js、名单都还在，不用重写）。
var TEAMS_ENABLED = false;

/**
 * 自定义导航栏的尺寸（和地图页同一套算法）。
 * 这一页用了 navigationStyle: custom —— 原生导航栏不接受自定义元素，
 * 而 ⚙ 要常驻左上角，所以高度得自己按状态栏 + 胶囊位置算。
 * 算不出来时退回保守值，绝不返回 undefined（样式里会变成 NaN）。
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
    // 顶部切换：mine = 我的战绩（Evo），ranked = 排位资讯（原排位专区）。
    // 先显示 ranked（和改版前一样）；「我的战绩」读完发现绑定了 Evo，再切过去（onEvoStatus）
    seg: "ranked",
    proQuery: "",        // 选手搜索词
    proExpand: false,       // 竖排选手列表是否展开（默认收起，只显示当前这个人）
    proChipsView: [],      // 展开后渲染的选手（搜索过滤后）
    proCurrentName: "",    // 当前选中的是谁（收起时那一行就显示它）
    proCanSearch: false,   // 选手多到一屏放不下时才给搜索框
    panelOpen: false,
    // 四个榜单的"展开其余"开关。用户 2026-10 的要求：一律只显示前五，
    // 其余点一下才展开。状态放在 data 里而不是视图模型里 ——
    // 换语言/换选手会重建视图模型，放那边会把展开状态冲掉。
    expHeroes: false,
    expCombos: false,
    expWeapons: false,
    expPairs: false,
    loading: true,
    err: { kind: "", style: "", title: "", message: "" },
    predator: [],
    platformLabels: PLATFORMS.map(function (p) { return p.label; }),
    platformIndex: 0,
    playerInput: "",
    player: null,
    // 距猎杀线差额；取不到分数线时为 null，界面整块不渲染
    gap: null,
    playerErr: "",
    playerLoading: false,
    // 战队专区：职业选手名单（后端读本地名单 + 查分数，失败就空数组不显示）
    teams: [],
    // 职业选手统计：英雄选取 / 三人组合 / 枪械 / 双武器搭配（本地离线识别）
    pro: null,
    // 本赛季段位分布（网络；云函数去抓上游那个没被校验的 JSON 接口）
    rank: null,
    // 赛季倒计时（2026-10-16 从战绩页搬到这里，显示在排位专区顶部）。
    // 先在 data 里声明，WXML 才有稳定的来源（也方便静态检查）。
    seasonShow: false,
    seasonEnded: false,
    seasonDays: 0,
    seasonHours: 0,
    // 当前语言 + 词表（WXML 用 {{T.x}} 取词）
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    // 未开通流量主时为空串，广告组件不渲染（配置见 utils/ad.js）
    adUnit: ad.adUnitFor("predator")
  },

  /** 广告拉取失败不影响页面任何功能，记一下就行 */
  onAdError: function (e) {
    console.warn("广告加载失败", e && e.detail);
  },

  /** 顶部切换：用户点过以后就不再自动切 */
  onSeg: function (e) {
    var seg = e.currentTarget.dataset.seg;
    this._segTouched = true;
    if (seg === this.data.seg) return;
    var self = this;
    this.setData({ seg: seg }, function () { if (seg === "mine") self.redrawEvo(); });
  },

  /**
   * 「我的战绩」读完了：绑定了 Evo 的人默认看自己的战绩。
   * 没绑定的人（现在的绝大多数用户）留在「排位资讯」—— 不然每次点进来先看到"去绑定"，猎杀线反而要多点一下。
   */
  onEvoStatus: function (e) {
    if (this._segTouched || !e.detail || !e.detail.bound || this.data.seg === "mine") return;
    var self = this;
    this.setData({ seg: "mine" }, function () { self.redrawEvo(); });
  },

  /** 走势图是 canvas，藏着的时候画不上（宽度是 0），切到「我的战绩」时重画 */
  redrawEvo: function () {
    var c = this.selectComponent("#evo-ov");
    if (c && c.drawChart) c.drawChart();
  },

  /** ⚙ 设置面板：语言和主题（和地图页共用同一份全局状态） */
  onTogglePanel: function () {
    this.setData({ panelOpen: !this.data.panelOpen });
  },

  /** 深色 / 浅色切换 */
  onTheme: function (e) {
    var t = theme.setTheme(e.currentTarget.dataset.t);
    if (t !== this.data.theme) this.setData({ theme: t });
  },

  /** 中英文切换：整页换语言，本地重算，不再打网络 */
  onLang: function (e) {
    var l = i18n.setLang(e.currentTarget.dataset.l);
    if (l === this.data.lang) return;
    this.setData({ lang: l, T: i18n.T(l) });
    this.rebuild();
    this.rebuildPro();   // 职业统计与图鉴的中英文条目也要跟着换
  },

  onLoad: function (options) {
    this.setData(navMetrics());   // 自定义导航栏尺寸（状态栏 + 胶囊位置）
    this.rebuildPro();            // 职业统计是本地数据，先渲染出来（不等网络）
    this.refreshProFromCloud();   // 再问一次云端：有更新的数据就换掉重绘（失败保持现状）
    this.refresh();
    this.fetchRank();             // 段位分布（网络，失败就整块不显示）
    this.fetchConfig();           // 赛季倒计时（网络，失败就整行不显示）
    if (TEAMS_ENABLED) this.fetchTeams();
    // 从分享链接进来时顺便把这个人查出来。玩家查询和分数线互不依赖，
    // 所以两个请求并行发，好友不用等两趟往返。
    var q = vm.parseShare(options);
    if (q) {
      // 带 uid 就按 uid 查（名字只用来回填输入框）—— 见 doLookup 的说明
      this.setData({ playerInput: q.player || q.uid, platformIndex: q.platformIndex });
      this.doLookup(q.player || q.uid, q.uid);
    }
  },

  /**
   * 主播数据热更新：云端有更新的就换掉包内快照并重绘。
   *
   * 三条约束（都是踩过的）：
   *   1. 只问一次（utils/prostats.js 里用 FETCHED 兜住），切页/重进不重复烧配额；
   *   2. 失败**什么都不做** —— 包内那份还在，页面照常；
   *   3. 换完必须 rebuildPro 重绘，不然界面上还是旧数据。
   */
  refreshProFromCloud: function () {
    var self = this;
    prostats.refresh(function (changed) {
      if (changed) self.rebuildPro();
    });
  },

  /**
   * 赛季倒计时（2026-10-16 从战绩页搬过来，显示在排位专区顶部）。
   * 结束时间来自云端配置（site_config 集合里 _id="season" 的 endTs）。
   *
   * 三条规矩（搬过来时一起带过来的）：
   *   1. 拿不到就**整行不显示** —— 少一行，好过显示"未知"或编个日期
   *   2. 只报到天 —— 数据源是天级精度，报时分秒是假精确
   *   3. 已结束显示"本赛季已结束"，绝不显示负数
   */
  fetchConfig: function () {
    var self = this;
    // 注意：callCloud 的设计是**永远 resolve、不 reject**（见 utils/cloud.js），
    // 所以成败要看 res.ok —— 写 .catch 是拦不住的，踩过一次。
    cloud.callCloud({ action: "config" }).then(function (res) {
      if (!res || !res.ok) {
        // 最常见的原因：新的 config 动作还没部署到云端。用户看不见无所谓，
        // 开发者在控制台要能查到原因。
        console.warn("[赛季倒计时] 取不到云端配置，这一行不显示：", (res && res.message) || "未知原因");
        return;
      }
      var d = res.data || {};
      var c = vm.buildSeasonCountdown(d.season, Date.now(), self.data.lang);
      self.setData({ seasonShow: c.show, seasonEnded: c.ended, seasonDays: c.days, seasonHours: c.hours });
    }).catch(function (e) {
      console.warn("[赛季倒计时] 异常：", e && e.message ? e.message : e);
    });
  },

  /** 转发时带上当前查的人；没查过人就分享分数线这一页 */
  onShareAppMessage: function () {    var q = this._queried;
    var en = this.data.lang === "en";
    if (!q) {
      return {
        title: en ? "Apex Predator cutoff by platform (live)" : "Apex 各平台猎杀分数线实时查询",
        path: vm.sharePath("predator", "", "")
      };
    }
    return {
      title: en ? (q.name + "'s Apex Predator standing") : (q.name + " 的 Apex 猎杀排名"),
      path: vm.sharePath("predator", q.name, q.platform, q.uid)
    };
  },

  onShow: function () {
    // 用户可能在别的页面切了语言（语言是全项目共用的）
    var l = i18n.getLang();
    if (l !== this.data.lang) this.setData({ lang: l, T: i18n.T(l) });
    // 主题同理 —— 模块级全局状态，页面 data 里那份要跟上，
    // 否则在别的页面切了浅色，回到这一页又变回深色。
    var th = theme.getTheme();
    if (th !== this.data.theme) this.setData({ theme: th });
    // 每次都走 rebuild：它除了换语言，还会把原生外壳（底部 tab、顶部标题）
    // 刷成当前语言 —— 那两处是 app.json / 页面 json 里的静态中文。
    this.rebuild();
    this.rebuildPro();
    // 从别的标签切回来时，数据太旧就刷一下
    if (this.lastFetchAt && (Date.now() - this.lastFetchAt) > REFRESH_MS) this.refresh();
  },

  onPullDownRefresh: function () {
    var evo = this.data.seg === "mine" ? this.selectComponent("#evo-ov") : null;
    var job = evo && evo.load ? evo.load() : this.refresh();
    job.then(function () { wx.stopPullDownRefresh(); });
  },

  refresh: function () {
    var self = this;
    this.lastFetchAt = Date.now();
    this.setData({ loading: true });

    return cloud.callCloud({ action: "predator" }).then(function (r) {
      if (r.ok && r.data) {
        // 原始分组留在实例上，**不进 data** —— data 会被序列化传到视图层，
        // 而这些字段视图用不到；算差额却需要 rp 的原始数值，
        // 视图模型里只剩"20,661"这种格式化好的文字了。
        self._group = r.data.group;
        self.setData({
          // 每个平台的数据时间和"较昨日同期"涨幅都由视图模型算好
          predator: vm.buildPredator(r.data.group, Date.now(), self.data.lang),
          loading: false,
          gap: self.gapFor(self._player),
          err: { kind: "", style: "", title: "", message: "" }
        });
      } else {
        self._group = null;
        self._err = { kind: r.kind, message: r.message };
        self.setData({
          predator: [],
          loading: false,
          gap: self.gapFor(self._player),
          err: vm.errView(r.kind, r.message, self.data.lang)
        });
      }
    });
  },

  /** 切语言后用本地已有的数据重算（不重新打网络） */
  rebuild: function () {
    i18n.applyChrome(this.data.lang, "navPredator");
    theme.applyChrome(this.data.theme);
    var lang = this.data.lang;
    var patch = {};
    if (this._group) {
      patch.predator = vm.buildPredator(this._group, Date.now(), lang);
      patch.gap = this.gapFor(this._player);
      patch.err = { kind: "", style: "", title: "", message: "" };
    } else if (this._err) {
      patch.err = vm.errView(this._err.kind, this._err.message, lang);
    }
    if (this._player) {
      patch.player = vm.buildPlayer(this._player, lang);
      patch.gap = this.gapFor(this._player);
    }
    this.setData(patch);
  },

  /** 玩家 + 分数线 → 差额视图。任一缺失就返回 null，界面据此整块不显示。 */
  gapFor: function (p) {
    if (!p) return null;
    return vm.buildPredGap(p, this._group, PLATFORMS[this.data.platformIndex].code, this.data.lang);
  },

  /** 战队专区：职业选手当前排位分。失败就空数组，整块不显示，不影响分数线。 */
  fetchTeams: function () {
    var self = this;
    return cloud.callCloud({ action: "teams" }).then(function (r) {
      if (r.ok && r.data && Array.isArray(r.data.teams)) {
        self.setData({ teams: vm.buildTeams(r.data.teams) });
      } else {
        self.setData({ teams: [] });
      }
    });
  },

  /* ---------------- 职业选手统计（本地离线数据） ---------------- */

  /**
   * 重算职业统计的视图模型。
   * 纯本地（prostats_data.js），不联网、不耗云函数配额 ——
   * 所以 onLoad 里可以直接先渲染，不用等分数线那几个请求回来。
   */
  /**
   * 由 pro.chips 派生出「竖排选手列表」。
   *
   * 用户 2026-11-07：「抓了太多主播，默认只显示综合情况，其他主播缩略成一个
   * 竖的列表，展开后点击再显示具体主播的个人数据」。
   * 所以默认收起 —— 页面上只留一行"当前是谁 + 切换"，点开才铺出竖列表。
   */
  buildProChipsView: function () {
    var all = (this.data.pro && this.data.pro.chips) || [];
    var q = String(this.data.proQuery || "").trim().toLowerCase();
    var list = q
      ? all.filter(function (c) { return String(c.name || "").toLowerCase().indexOf(q) >= 0; })
      : all;
    var active = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].active) { active = all[i]; break; }
    }
    this.setData({
      proChipsView: list,
      proCurrentName: (active && active.name) || "",
      // 选手多到一屏放不下才给搜索框；否则搜索是多余的噪音
      proCanSearch: all.length > 12
    });
  },

  /** 搜索框输入 */
  onProQuery: function (e) {
    this.setData({ proQuery: e.detail.value || "" });
    this.buildProChipsView();
  },

  /** 清空搜索 */
  onProQueryClear: function () {
    this.setData({ proQuery: "" });
    this.buildProChipsView();
  },

  /** 展开 / 收起竖排选手列表 */
  onProToggle: function () {
    this.setData({ proExpand: !this.data.proExpand });
    this.buildProChipsView();
  },

  /** pro 一变就重算显示列表 */
  afterProSet: function () {
    var self = this;
    setTimeout(function () { self.buildProChipsView(); }, 0);
  },

  rebuildPro: function () {
    this.afterProSet(); this.setData({
      pro: prostats.buildAll(this._proId || "__all__", this.data.lang)
    });
    this.rebuildRank();
  },

  /** 展开/收起某个榜单的"前五之后"（data-k = heroes / combos / weapons / pairs） */
  onToggleMore: function (e) {
    var k = e.currentTarget.dataset.k;
    if (k === "heroes") this.setData({ expHeroes: !this.data.expHeroes });
    else if (k === "combos") this.setData({ expCombos: !this.data.expCombos });
    else if (k === "weapons") this.setData({ expWeapons: !this.data.expWeapons });
    else if (k === "pairs") this.setData({ expPairs: !this.data.expPairs });
  },

  /** 切选手：**选完立刻把手风琴合上**，不然列表一直占着屏幕 */
  onProChip: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    if (id !== this._proId) {
      this._proId = id;
      this.rebuildPro();
    }
    this.setData({ proExpand: false, proQuery: "" });
    this.buildProChipsView();
  },

  /**
   * 段位分布：**网络数据**（云函数去抓上游那个没被校验的 JSON 接口）。
   * 单独一个重建函数，是因为它要跟着两件事变：切语言、以及"查询到某个人后
   * 把他在分布里的位置标出来"。
   */
  rebuildRank: function () {
    this.setData({
      rank: rankdist.build(this._rankData, this._player, this.data.lang)
    });
  },

  /** 取段位分布。失败就整块不显示 —— 不留一个空壳，也不给假数字。 */
  fetchRank: function () {
    var self = this;
    return cloud.callCloud({ action: "rankdist" }).then(function (r) {
      self._rankData = (r && r.ok && r.data) ? r.data : null;
      self.rebuildRank();
    });
  },

  /* ---------------- 交互 ---------------- */

  onPlayerInput: function (e) { this.setData({ playerInput: e.detail.value }); },
  onPlatformChange: function (e) { this.setPlatform(Number(e.detail.value)); },

  /**
   * 点平台卡片直接切换平台。
   *
   * 卡片本来就是按平台分组显示的，让它可点是"就地操作" ——
   * 用户看着 PC 那一栏想知道自己离它多远，直接在那一栏上点一下就行，
   * 不用再跑到下面那个 picker 里选一遍。
   */
  onPickPlatform: function (e) {
    var code = e.currentTarget.dataset.code;
    for (var i = 0; i < PLATFORMS.length; i++) {
      if (PLATFORMS[i].code === code) { this.setPlatform(i); return; }
    }
  },

  /** 切换平台：搜索框、差额计算都跟着走，并重新算一次差额 */
  setPlatform: function (idx) {
    if (!(idx >= 0) || idx >= PLATFORMS.length) return;
    if (idx === this.data.platformIndex) return;
    this.setData({ platformIndex: idx, gap: this.gapFor(this._player) });
  },

  onLookup: function () { this.doLookup(this.data.playerInput); },

  /**
   * 查一个玩家的猎杀排名 + 距猎杀线差额（分享链接进来时也走这里）。
   *
   * @param rawName 玩家名，或直接粘进来的 uid
   * @param uid     分享链接带来的精确 uid（有就按它查）
   *
   * ⚠️ uid 这条路是**用户反馈过的问题**：游戏内 ID 不唯一，只按名字查会命中同名的另一个人。
   *    战绩页被删掉之后（2026-10-16），这一页是唯一的查人入口，所以这套 uid 处理必须留着 ——
   *    搬过来时差点丢掉：onLoad 只传了名字，_queried 里也没存 uid。
   */
  doLookup: function (rawName, uid) {
    var self = this;
    var name = String(rawName || "").trim();
    if (!name) {
      this._player = null;
      this._queried = null;
      this.setData({ player: null, gap: null, playerErr: i18n.t(this.data.lang, "needInput") });
      this.rebuildRank();     // 清掉「你在这里」标记，分布本身照常显示
      return;
    }
    if (this.data.playerLoading) return;

    var code = PLATFORMS[this.data.platformIndex].code;
    this.setData({ playerLoading: true, playerErr: "", player: null, gap: null });

    cloud.callCloud({
      action: "player",
      player: name,
      uid: uid || "",
      platform: code
    }).then(function (r) {
      if (r.ok && r.data) {
        // 分数线这一页 onLoad 已经取过了，这里不再重复请求，直接用现成的算
        self._player = r.data.player;
        // 存 uid：分享出去时带上它，好友点开才不会被同名账号顶掉。
        // 用接口回来的规范名字和 uid，而不是用户敲进去的那串。
        self._queried = { name: r.data.player.name || name, platform: code, uid: r.data.player.uid || "" };
        self.setData({
          playerLoading: false,
          player: vm.buildPlayer(r.data.player, self.data.lang),
          gap: self.gapFor(self._player)
        });
        // 查到了人就把他在分布里的位置标出来（分布本身早在 onLoad 就取回来了）
        self.rebuildRank();
      } else {
        self._player = null;
        self._queried = null;
        self.setData({ playerLoading: false, player: null, gap: null, playerErr: r.message || "查询失败。" });
      }
    });
  }
});
