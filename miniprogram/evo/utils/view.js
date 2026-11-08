/**
 * Evo 战绩：云函数 evo_mp 回的数字和代号 → 界面字段（中英文都在这里拼）。
 *
 * 纯函数，tests/evo.test.mjs 直接测。页面和组件只管"取数 + setData"（同 AI-CONTEXT §3 的分层约定）。
 * 读不出来的项一律显示"—"，不当作 0（不编数据）。
 *
 * 名字的来源：传奇、地图是 Evo 从游戏画面上读到的中文（游戏里的叫法）。
 * 英文模式下传奇名和头像从图鉴 codex_data 取，地图名从 core.MAP_CN 反查；查不到就保留原文。
 */
var core = require("../../utils/core.js");
var codex = require("../../data/codex_data.js");

// Evo 记下的传奇名（游戏里的中文）→ 图鉴里的 id。
// 图鉴有 4 个中文名和游戏里不一样（变换/变幻、兰帕特/兰伯特、疯马吉/疯玛吉、导管/导线管），所以按 id 对，不按名字
var LEGEND_IDS = {
  "恶灵": "wraith", "变幻": "alter", "罗芭": "loba", "探路者": "pathfinder", "纽卡斯尔": "newcastle",
  "卡特莉丝": "catalyst", "兰伯特": "rampart", "艾克赛尔": "axle", "希尔": "seer", "疯玛吉": "mad-maggie",
  "密客": "crypto", "暴雷": "fuse", "万蒂奇": "vantage", "沃特森": "wattson", "班加罗尔": "bangalore",
  "琉雀": "sparrow", "动力小子": "octane", "直布罗陀": "gibraltar", "导线管": "conduit", "侵蚀": "caustic",
  "弹道": "ballistic", "亡灵": "revenant", "命脉": "lifeline", "地平线": "horizon", "寻血猎犬": "bloodhound",
  "幻象": "mirage", "瓦尔基里": "valkyrie", "艾许": "ash"
};
var HEROES = {};
codex.heroes.forEach(function (h) { HEROES[h.id] = h; });

// 地图：MAP_CN 是 英文 → 中文，反过来查；「破碎月亮」是残月改名前的叫法（Evo 两个都认）
var MAP_EN = { "破碎月亮": "Broken Moon" };
Object.keys(core.MAP_CN).forEach(function (en) {
  var zh = core.MAP_CN[en];
  if (!MAP_EN[zh] && en.indexOf("The ") !== 0) MAP_EN[zh] = en;
});

var TIER_ZH = {
  rookie: "菜鸟", bronze: "青铜", silver: "白银", gold: "黄金", platinum: "白金",
  diamond: "钻石", master: "大师", predator: "Apex 猎杀者"
};
var TIER_EN = {
  rookie: "Rookie", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
  diamond: "Diamond", master: "Master", predator: "Apex Predator"
};
// 段位徽章图片（evo/assets/ranks/<tier>.png）上写段数的铭牌在哪：x、y 是铭牌中心占图片宽高的百分比，h 是铭牌高度的百分比
// （数值是生成徽章图时量出来的，见 Evo 仓库 miniprogram/tools/make_assets.py）。菜鸟没有徽章图，用字母方块
// 徽章用 256 色 png，不用 webp：iPhone 上的微信显示不了包里的 webp（报 getLocalImgData:fail，模拟器里正常；2026-10-28 真机试过）
var RANK_PLATES = {
  bronze: { x: 49.8, y: 83, h: 24.6 }, silver: { x: 50, y: 82.1, h: 24.1 }, gold: { x: 50, y: 82.5, h: 24.1 },
  platinum: { x: 49.8, y: 82.8, h: 24.2 }, diamond: { x: 49.9, y: 79.5, h: 20.8 }, master: { x: 50.2, y: 84.6, h: 18.1 },
  predator: { x: 50, y: 82.5, h: 14 }
};
var TIER_LETTER = { rookie: "R", bronze: "B", silver: "S", gold: "G", platinum: "P", diamond: "D", master: "M", predator: "A" };
var DIVISION_NUMBER = { IV: 4, III: 3, II: 2, I: 1 };

// 走势图画在 canvas 上，canvas 读不到 CSS 变量，所以这里抄一份 app.wxss 的值（改那边的令牌时这里一起改）
var CHART_COLORS = {
  dark: { line: "#ff5a52", grid: "#8b95a6", card: "#141821" },     // --accent-ink / --ink3 / --card
  light: { line: "#c62828", grid: "#5f6a79", card: "#ffffff" }
};

var DASH = "—";
var MINUS = "−";   // 真正的减号，和游戏里一样

function has(v) { return v !== null && v !== undefined; }

/** "有 {n} 局" + { n: 3 } → "有 3 局" */
function fill(tpl, vars) {
  return String(tpl == null ? "" : tpl).replace(/\{(\w+)\}/g, function (all, k) {
    return has(vars[k]) ? String(vars[k]) : "";
  });
}

function isEn(T) { return T && T.lang === "en"; }

/** 带数量的词条：英文要分单复数（"1 match" / "2 matches"），模板里写 match{es}、kill{p}（名词加 s）、need{s}（动词加 s）；
 *  中文模板没有这几个空，不受影响 */
function count(tpl, n, vars) {
  var all = { n: n, es: n === 1 ? "" : "es", p: n === 1 ? "" : "s", s: n === 1 ? "s" : "" };
  Object.keys(vars || {}).forEach(function (k) { all[k] = vars[k]; });
  return fill(tpl, all);
}

function num(n) { return has(n) ? core.num(n) : DASH; }

function signed(n) {
  if (!has(n)) return DASH;
  return n >= 0 ? "+" + core.num(n) : MINUS + core.num(-n);
}

function rpClass(n) {
  if (!has(n)) return "none";
  return n >= 0 ? "good" : "bad";
}

function oneDecimal(n) { return has(n) ? n.toFixed(1) : DASH; }

function percent(n) { return has(n) ? n + "%" : DASH; }

function mmss(s) {
  if (!has(s)) return DASH;
  var sec = s % 60;
  return Math.floor(s / 60) + ":" + (sec < 10 ? "0" : "") + sec;
}

function badgeClass(p) {
  if (!has(p)) return "p-none";
  if (p === 1) return "p1";
  if (p <= 3) return "p2";
  return p <= 10 ? "p3" : "p4";
}

/** 传奇：{ name, icon }。图鉴里没有的（新传奇）没有头像，名字保留原文 */
function legend(name, T) {
  if (!name) return { name: "", icon: "" };
  var hero = HEROES[LEGEND_IDS[name]];
  return {
    name: hero && isEn(T) ? hero.en : name,
    icon: hero ? hero.icon : ""
  };
}

function mapName(name, T) {
  if (!name) return "";
  return isEn(T) ? (MAP_EN[name] || name) : name;
}

function modeName(mode, T) {
  if (mode === "ranked") return T.evoModeRanked;
  if (mode === "pubs") return T.evoModePubs;
  if (mode === "other") return T.evoModeOther;
  return "";
}

function tierName(tier, division, T) {
  var names = isEn(T) ? TIER_EN : TIER_ZH;
  if (!names[tier]) return "";
  return names[tier] + (division ? " " + division : "");
}

/** 电脑上的时间（"2026-10-24 21:03:15"）→ "今天 21:03" / "昨天 21:03" / "10-24 21:03" */
function timeText(text, ctx) {
  if (!text) return "";
  var day = text.slice(0, 10);
  var hm = text.slice(11, 16);
  if (day === ctx.today) return fill(ctx.T.evoToday, { hm: hm });
  if (day === ctx.yesterday) return fill(ctx.T.evoYesterday, { hm: hm });
  return text.slice(5, 10) + " " + hm;
}

function kda(r) {
  return [r.kills, r.assists, r.knockdowns].map(function (v) { return has(v) ? String(v) : DASH; }).join(" / ");
}

/** 一局（列表里的一行） */
function row(r, ctx) {
  var T = ctx.T;
  var lg = legend(r.legend, T);
  var map = mapName(r.map, T);
  var title = [lg.name, map].filter(Boolean).join(" · ");
  return {
    id: r.id,
    place: has(r.placement) ? "#" + r.placement : DASH,
    badge: badgeClass(r.placement),
    icon: lg.icon,
    title: title || T.evoUnknown,
    unknown: !title,
    sub: [modeName(r.mode, T), timeText(r.ended_at, ctx)].filter(Boolean).join(" · "),
    kda: kda(r),
    damage: num(r.damage),
    rp: signed(r.rp),
    rpCls: rpClass(r.rp),
    review: Boolean(r.needs_review)
  };
}

function rows(list, ctx) {
  return (list || []).map(function (r) { return row(r, ctx); });
}

/** 段位卡：徽章（有图的段位把段数写在铭牌上）、段位名、段内分数、什么时候读到的 */
function rankView(rank, ctx, emblemRpx) {
  if (!rank) return null;
  var T = ctx.T;
  var plate = RANK_PLATES[rank.tier];
  var number = DIVISION_NUMBER[rank.division];
  var when = timeText(rank.when, ctx);
  return {
    tier: rank.tier,
    name: tierName(rank.tier, rank.division, T),
    division: number ? rank.division : "",
    letter: (TIER_LETTER[rank.tier] || "?") + (number || ""),
    hasEmblem: Boolean(plate),
    emblem: "/evo/assets/ranks/" + rank.tier + ".png",
    plateLeft: plate ? plate.x : 0,
    plateTop: plate ? plate.y : 0,
    plateFont: plate ? Math.round(emblemRpx * plate.h / 100 * 0.7) : 0,   // 同 Evo 窗口：铭牌高度的 70%
    progress: has(rank.progress) ? String(rank.progress) : "",              // 同 Evo 窗口，不加逗号
    asOf: when ? fill(T.evoRankAsOf, { when: when + (rank.from_lobby ? " · " + T.evoFromLobby : "") }) : ""
  };
}

function chartView(chart, T) {
  if (!chart) return null;
  return {
    points: chart.points,
    lines: chart.lines.map(function (l) { return { y: l.y, name: tierName(l.tier, l.division, T) }; }),
    hasLines: chart.lines.length > 0,
    ago: count(T.evoChartAgo, chart.count - 1)
  };
}

function statCells(s, T) {
  return [
    { key: "place", label: T.evoAvgPlace, value: oneDecimal(s.avg_place) },
    { key: "kills", label: T.evoAvgKills, value: oneDecimal(s.avg_kills) },
    { key: "damage", label: T.evoAvgDamage, value: num(s.avg_damage) },
    { key: "top5", label: T.evoTop5, value: percent(s.top5) },
    { key: "win", label: T.evoWinRate, value: percent(s.win_rate), accent: true },
    { key: "games", label: T.evoGames, value: String(s.games) }
  ];
}

function legendRows(list, T) {
  if (!list) return null;
  return list.map(function (l) {
    var lg = l.other ? { name: T.evoLegendOther, icon: "" } : legend(l.name, T);
    var parts = [count(T.evoGamesN, l.games)];
    if (has(l.avg_damage)) parts.push(fill(T.evoAvgDmg, { n: core.num(l.avg_damage) }));
    return { key: l.other ? "_other" : l.name, name: lg.name, icon: lg.icon, other: l.other, meta: parts.join(" · "), segments: l.segments };
  });
}

/** 账号切换（2 个以上账号才显示）：最后一项是"全部账号" */
function accountPicker(accounts, current, T) {
  if (!accounts || accounts.length < 2) return null;
  var names = accounts.map(function (a) { return a.name; }).concat(T.evoAllAccounts);
  var at = 0;
  if (current === "all") at = accounts.length;
  else accounts.forEach(function (a, i) { if (a.key === current) at = i; });
  return { names: names, index: at, keys: accounts.map(function (a) { return a.key; }).concat("all") };
}

/**
 * 「我的战绩」整块。state：unbound（没绑定电脑）/ empty（绑定了还没有对局）/ ready
 * @param {object} d 云函数 overview 的结果
 * @param {object} T 词表（i18n.T(lang)）
 * @param {number} emblemRpx 段位徽章多大（rpx），和 overview 的 .evo-emblem 一样
 */
function overview(d, T, emblemRpx) {
  var ctx = { T: T, today: d.today, yesterday: d.yesterday };
  var all = d.account === "all";
  var rangeName = d.range === "all" ? T.evoRangeAll : T.evoRange30;
  return {
    state: !d.bound ? "unbound" : (d.total ? "ready" : "empty"),
    picker: accountPicker(d.accounts, d.account, T),
    all: all,
    review: d.review_count ? count(T.evoReviewN, d.review_count) : "",
    rank: all ? null : rankView(d.rank, ctx, emblemRpx),
    rangeRpLabel: rangeName + " RP",
    rangeRp: signed(d.range_rp),
    rangeRpCls: rpClass(d.range_rp),
    todayRp: signed(d.today_rp),
    todayRpCls: rpClass(d.today_rp),
    todayGames: String(d.today_games || 0),
    chart: all ? null : chartView(d.chart, T),
    stats: statCells(d.stats, T),
    recent: rows(d.recent, ctx),
    legends: legendRows(d.legends, T),
    legendsTitle: T.evoLegends + " · " + rangeName
  };
}

/** 全部对局一页 */
function matchesView(d, T) {
  var ctx = { T: T, today: d.today, yesterday: d.yesterday };
  return {
    picker: accountPicker(d.accounts, d.account, T),
    rows: rows(d.rows, ctx),
    reviewCount: d.review_count || 0,
    total: count(T.evoTotalN, d.total),
    more: d.page < d.pages
  };
}

/** 全部对局里列表是空的时候说什么 */
function emptyText(mode, review, T) {
  if (review) return T.evoEmptyReview;
  if (mode) return fill(T.evoEmptyMode, { mode: modeName(mode, T) });
  return T.evoEmptyAll;
}

var RP_SOURCE_KEYS = { xp: "evoSrcXp", hud: "evoSrcHud", lobby: "evoSrcLobby", other: "evoSrcOther" };

/** 单局详情 */
function detail(d, T) {
  var m = d.match;
  var ctx = { T: T, today: d.today, yesterday: d.yesterday };
  var base = row(m, ctx);
  var rank = tierName(m.rank_tier, m.rank_division, T);
  base.rpFrom = m.rp_source ? fill(T.evoRpFrom, { source: T[RP_SOURCE_KEYS[m.rp_source]] }) : "";
  // 待确认的原因是 Evo 写的中文；英文模式下不硬塞中文（i18n 不混排），只说"不确定"
  base.reviewNote = m.review_note && !isEn(T) ? m.review_note : "";
  base.facts = [
    { key: "kda", label: T.evoKda, value: kda(m) },
    { key: "damage", label: T.evoDamage, value: num(m.damage) },
    { key: "part", label: T.evoParticipation, value: num(m.participation) },
    { key: "surv", label: T.evoSurvival, value: mmss(m.survival_time) },
    { key: "rev", label: T.evoRevives, value: num(m.revives) },
    { key: "resp", label: T.evoRespawns, value: num(m.respawns) },
    { key: "squad", label: T.evoSquadKills, value: num(m.squad_kills) }
  ];
  if (rank) base.facts.push({ key: "rank", label: T.evoRankAtEnd, value: rank + (has(m.rank_progress) ? " " + m.rank_progress : "") });
  base.meta = fill(T.evoMetaLine, { name: m.player_name || DASH, time: m.ended_at || DASH });
  base.mates = (m.mates || []).map(function (x, i) {
    var lg = legend(x.legend, T);
    return {
      key: String(i),
      name: x.name || DASH,
      id: x.player_id || "",
      legend: lg.name || DASH,
      icon: lg.icon,
      kda: kda(x),
      damage: num(x.damage),
      survival: mmss(x.survival_time),
      revRes: (has(x.revives) ? x.revives : DASH) + " / " + (has(x.respawns) ? x.respawns : DASH)
    };
  });
  base.noSummary = Boolean(m.no_summary) && base.mates.length > 0;
  return base;
}

/** 「我的」里的电脑和账号 */
/**
 * 「我的」页上半部分（云函数 me 的结果，2026-11-08 照 August 的设计稿）：
 *   顶上：游戏 ID（首字母切角方块当头像）+ 绑定状态；三格统计（记录局数 / 赛季最高 / 冠军次数，没有的格不出）；
 *   每台电脑一张「电脑上的 Evo」卡（状态标签 + 几分钟前同步 + Evo 版本）。
 * 云函数还没更新（没有 profile）时：局数用各台电脑的合计，赛季最高、冠军次数不出。
 * @param {number} nowMs 手机上的现在（算"几分钟前同步"）
 */
function meView(d, T, nowMs) {
  var list = d.devices || [];
  var accounts = (d.accounts || []).map(function (a, i) {
    return { key: String(i), name: a.name, names: a.names > 1 ? count(T.evoNamesN, a.names) : "" };
  });
  if (!list.length) {
    return { state: "unbound", name: T.meUnbound, initial: "", sub: T.meUnboundSub, stats: [], devices: [], accounts: accounts };
  }
  var p = d.profile || null;
  var name = (p && p.account) || (accounts[0] && accounts[0].name) || "";
  var total = list.reduce(function (s, x) { return s + (x.matches || 0); }, 0);
  var stats = [{ key: "m", k: T.meStatMatches, v: core.num(p ? p.matches : total), small: false }];
  var peak = p && p.peak ? tierName(p.peak.tier, p.peak.division, T) : "";
  if (peak) stats.push({ key: "p", k: T.meStatPeak, v: peak, small: true });   // 段位是字，比数字小一号
  if (p && has(p.wins)) stats.push({ key: "w", k: T.meStatWins, v: core.num(p.wins), small: false });
  return {
    state: "ready",
    name: name || T.meNoMatches,
    initial: name ? name.slice(0, 1).toUpperCase() : "",
    sub: accounts.length ? T.meBound + " · " + count(T.meAccountsN, accounts.length) : T.meBound,
    stats: stats,
    devices: list.map(function (x, i) {
      var sync = has(x.last_upload_ms) ? fill(T.meSyncedAgo, { ago: agoText(x.last_upload_ms, nowMs, T).trim() })
        : (x.last_upload_at ? fill(T.evoLastSync, { t: x.last_upload_at }) : T.evoNeverSync);
      return {
        id: x.id,
        title: list.length > 1 ? fill(T.mePcTitleN, { n: i + 1 }) : T.mePcTitle,
        name: fill(T.evoPcN, { n: i + 1 }),   // 解绑时弹窗里说"电脑 1"
        sub: [sync, x.app_version ? "Evo " + x.app_version : ""].filter(Boolean).join(" · "),
        // 状态标签：同步过 = 正常；绑了还没传过 = 还没同步（标签上有字，不只靠颜色）
        chip: x.last_upload_at || has(x.last_upload_ms) ? T.meStatusOk : T.meStatusNever,
        chipCls: x.last_upload_at || has(x.last_upload_ms) ? "ok" : "warn",
        matches: x.matches
      };
    }),
    accounts: accounts
  };
}

/** 毫秒时间戳 → " 5 分钟前" / "刚刚"（同步时间用，跟手机上的时间比） */
function agoText(ms, nowMs, T) {
  var min = Math.floor((nowMs - ms) / 60000);
  if (min < 1) return T.evoAgoNow;
  if (min < 60) return fill(T.evoAgoMin, { n: min });
  if (min < 24 * 60) return fill(T.evoAgoHour, { n: Math.floor(min / 60) });
  return fill(T.evoAgoDay, { n: Math.floor(min / 1440) });
}

/** 带一个数字的句子拆成三段（数字要加粗）："升钻石 I 还差 {n}" → { pre: "升钻石 I 还差 ", n: "132", post: "" } */
function splitAtNumber(tpl, vars, n) {
  var parts = fill(tpl.replace("{n}", "\u0000"), vars).split("\u0000");
  return { pre: parts[0], n: n, post: parts[1] || "" };
}

/**
 * 首页顶上那块（云函数 home 的结果）。state：unbound（没绑定电脑）/ empty（绑定了还没有对局）/ ready
 * @param {number} emblemRpx 段位徽章多大（rpx），和 home 组件的 .evo-hm-emblem 一样
 * @param {number} nowMs 手机上的现在（算"同步于几分钟前"）
 */
function homeView(d, T, emblemRpx, nowMs, opts) {
  var shareName = !!(opts && opts.shareName) && !!d.name;   // 「我的」页「分享卡片」选了显示游戏名
  if (!d.bound) return { state: "unbound" };
  if (!d.total) return { state: "empty" };
  var ctx = { T: T, today: "", yesterday: "" };
  var rank = rankView(d.rank, ctx, emblemRpx);
  var step = d.step;
  var day = d.day || {};
  var last = d.last;
  var lastView = null;
  if (last) {
    var lg = legend(last.legend, T);
    var map = mapName(last.map, T);
    var line = [];
    if (has(last.kills)) line.push(count(T.evoKillsN, last.kills));
    if (has(last.damage)) line.push(fill(T.evoDamageN, { n: core.num(last.damage) }));
    if (map) line.push(map);
    lastView = {
      id: last.id,
      place: has(last.placement) ? "#" + last.placement : DASH,
      rp: has(last.rp) ? signed(last.rp) + " RP" : "",
      rpCls: rpClass(last.rp),
      legend: lg.name,
      icon: lg.icon,
      letter: lg.name ? lg.name.slice(0, 1) : "",
      line: line.join(" · "),
      // 转发卡片的标题；名次没读到就不提供分享（不编一个名次出来）
      shareTitle: has(last.placement)
        ? fill(shareName ? (map ? T.evoShareTitleName : T.evoShareTitleNameNoMap) : (map ? T.evoShareTitle : T.evoShareTitleNoMap),
          { place: last.placement, map: map, name: d.name })
        : ""
    };
  }
  return {
    state: "ready",
    synced: d.synced_at ? fill(T.evoSynced, { ago: agoText(d.synced_at, nowMs, T) }) : "",
    rank: rank,
    step: step ? {
      pct: step.pct,
      gap: splitAtNumber(T.evoGapTo, { rank: tierName(step.next_tier, step.next_division, T) }, core.num(step.gap))
    } : null,
    todayRp: signed(day.rp),
    todayRpCls: rpClass(day.rp),
    games: String(day.games || 0),
    avgPlace: has(day.avg_place) ? "#" + oneDecimal(day.avg_place) : DASH,
    kills: num(day.kills),
    damage: num(day.damage),
    last: lastView
  };
}

/** 「大家在玩什么」（云函数 crowd 的结果）。人数不够、取不到时回 null（整块不显示） */
function crowdView(d, T) {
  if (!d || !d.enough || !d.legends || !d.legends.length) return null;
  var widest = Math.max.apply(null, d.legends.map(function (l) { return l.pct; })) || 1;
  var face = function (name) {
    var lg = legend(name, T);
    return { key: name, name: lg.name, icon: lg.icon, letter: lg.name.slice(0, 1) };
  };
  return {
    source: count(T.crowdFrom, d.players, { days: d.days }),
    legends: d.legends.map(function (l) {
      var f = face(l.name);
      f.pct = l.pct + "%";
      f.width = Number((l.pct / widest * 100).toFixed(2));
      return f;
    }),
    combo: d.combo ? {
      faces: d.combo.legends.map(face),
      names: d.combo.legends.map(function (n) { return legend(n, T).name; }).join(" · "),
      avg: "#" + oneDecimal(d.combo.avg_place),
      games: String(d.combo.games)
    } : null
  };
}

var ERROR_KEYS = {
  bad_code: "evoErrBadCode", used: "evoErrUsed", expired: "evoErrExpired", not_found: "evoErrNotFound",
  not_yours: "evoErrNotYours", network: "evoErrNetwork"
};

/** 云函数回的错误代号 → 给人看的一句话 */
function errText(code, T) {
  return T[ERROR_KEYS[code]] || T.evoErrServer;
}

/** 从扫到的内容里取出绑定码：Evo 自己画的二维码是 evotracker.cn/bind?c=XXXXXXXXXX；
 *  小程序码（码池里的）扫出来是页面路径 evo/bind/bind?scene=XXXXXXXXXX；打开绑定页时 scene 就是绑定码本身 */
function bindCodeFrom(text) {
  var raw = "";
  try { raw = decodeURIComponent(String(text || "")); } catch (e) { raw = String(text || ""); }
  var m = raw.match(/[?&](?:c|scene)=([A-Za-z0-9]{6,16})\b/) || raw.match(/^([A-Za-z0-9]{6,16})$/);
  return m ? m[1].toUpperCase() : "";
}

function chartColors(theme) {
  return CHART_COLORS[theme] || CHART_COLORS.dark;
}

module.exports = {
  LEGEND_IDS: LEGEND_IDS,
  fill: fill,
  count: count,
  signed: signed,
  legend: legend,
  mapName: mapName,
  tierName: tierName,
  timeText: timeText,
  row: row,
  overview: overview,
  matchesView: matchesView,
  emptyText: emptyText,
  detail: detail,
  meView: meView,
  homeView: homeView,
  crowdView: crowdView,
  errText: errText,
  bindCodeFrom: bindCodeFrom,
  chartColors: chartColors
};
