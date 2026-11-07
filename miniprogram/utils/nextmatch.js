/**
 * 比赛专区 · 下一场比赛：把 next_match_data.js（离线快照）换成界面能直接渲染的视图模型。
 *
 * 和 utils/algs.js 的关系：
 *   · 赛事名的中文写法（ALGS 季后赛 / 职业联赛…）复用 algs.js 的小词表，两处别各写一份；
 *   · 这一块回答的是「**下一场什么时候打、怎么分组、谁上场**」，
 *     ALGS 赛场那块回答的是「**上一届谁赢了、什么阵容**」—— 两种问题，别混。
 *
 * 时间一律按**北京时间（UTC+8）**换算，和云函数 esports.js 的口径一致：
 * 用户在国内，"几点开打"不能让他自己减 8 小时。
 *
 * 数据里可能出现：
 *   · 有分组、没赛程时间 —— 官方还没排期（用户要求：那就只显示分组，不显示假时间）；
 *   · 有队伍、没队员名单 —— 显示「队员待公布」，不编名字。
 */
var i18n = require("./i18n.js");
var algs = require("./algs.js");
var DATA = require("../data/next_match_data.js");

var WD_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
var WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** unix 秒 -> 北京时间的那几个数（和 esports.js 的 beijing() 同一算法） */
function bj(ts) {
  var n = Number(ts);
  if (!isFinite(n) || n <= 0) return null;
  var d = new Date((n + 8 * 3600) * 1000);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    da: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    wd: d.getUTCDay(),
    key: d.getUTCFullYear() + "-" + d.getUTCMonth() + "-" + d.getUTCDate()
  };
}

function p2(x) { return (x < 10 ? "0" : "") + x; }

function dateLabel(t, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  return en
    ? (MON_EN[t.mo - 1] + " " + t.da + " " + WD_EN[t.wd])
    : (t.mo + "月" + t.da + "日 " + WD_ZH[t.wd]);
}

function clock(t) { return p2(t.h) + ":" + p2(t.mi); }

/** 赛程格里用的短日期："10/30" / "Oct 30"（完整日期占一行太长，会把格子撑破） */
function shortDate(t, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  return en ? (MON_EN[t.mo - 1] + " " + t.da) : (p2(t.mo) + "/" + p2(t.da));
}

/* 阶段名。上游的 data-match-name 是给桌面网页用的简写（"Winners R." 还被截断了），
   所以按 bracket 的内部键自己写一份 —— 认不出的阶段原样显示英文，不猜。 */
var ROUND_ZH = {
  Finals: "决赛",
  LosersRound1: "败者组第 1 轮",
  LosersRound2: "败者组第 2 轮",
  WinnersRound1: "胜者组第 1 轮",
  WinnersRound2: "胜者组第 2 轮"
};
var ROUND_EN = {
  Finals: "Finals",
  LosersRound1: "Losers Round 1",
  LosersRound2: "Losers Round 2",
  WinnersRound1: "Winners Round 1",
  WinnersRound2: "Winners Round 2"
};
// 赛程格只有半屏宽（≈340rpx），英文全称会撑到省略号 —— 格子里用短写。
var ROUND_EN_SHORT = {
  Finals: "Finals",
  LosersRound1: "Losers R1",
  LosersRound2: "Losers R2",
  WinnersRound1: "Winners R1",
  WinnersRound2: "Winners R2"
};

function matchName(m, lang, compact) {
  var en = i18n.normalizeLang(lang) === "en";
  var key = String(m.bracket || "");
  var gm = /^([A-Z])v([A-Z])$/.exec(key);           // AvB / CvD …
  if (gm) {
    // 中文格子里省掉空格（"A组 vs B组"），全称在英雄卡里才写 "A 组 vs B 组"
    return en ? ("Group " + gm[1] + " vs " + gm[2])
              : (compact ? (gm[1] + "组 vs " + gm[2] + "组")
                         : (gm[1] + " 组 vs " + gm[2] + " 组"));
  }
  var map = en ? (compact ? ROUND_EN_SHORT : ROUND_EN) : ROUND_ZH;
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return m.name || key;                              // 认不出：给上游原文
}

function groupName(key, lang) {
  return i18n.normalizeLang(lang) === "en" ? ("Group " + key) : (key + " 组");
}

/* 上游的输入设备只有这几种写法，认不出就原样显示 */
function inputText(raw, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var s = String(raw || "");
  if (!s) return "";
  if (/mouse/i.test(s)) return en ? "MnK" : "键鼠";
  if (/controller/i.test(s)) return en ? "Controller" : "手柄";
  if (/hybrid/i.test(s)) return en ? "Hybrid" : "混合";
  return s;
}

/* 国家 / 地区的中文写法（用户 2026-10-18：「全部队员显示国家的时候都显示全名」）。
   ⚠️ 台湾一律写「**中国台湾**」，香港/澳门同理（中国香港 / 中国澳门）—— 别改回简称。
   ⚠️ 这里是**手维护的显示表**，不参与任何判断：新增国家直接加一行即可。
      表里没有的（比如新赛区的小国）退回上游的英文全称，绝不把两个字母的代码
      （US / TW）直接丢给用户 —— 那不算"显示国家"。 */
var COUNTRY_ZH = {
  // 中国 / 地区
  cn: "中国", tw: "中国台湾", hk: "中国香港", mo: "中国澳门",
  // 亚太
  jp: "日本", kr: "韩国", mn: "蒙古", kz: "哈萨克斯坦", uz: "乌兹别克斯坦",
  kg: "吉尔吉斯斯坦", tj: "塔吉克斯坦",
  th: "泰国", id: "印度尼西亚", sg: "新加坡", my: "马来西亚", ph: "菲律宾",
  vn: "越南", in: "印度", pk: "巴基斯坦", bd: "孟加拉国", lk: "斯里兰卡",
  np: "尼泊尔", mm: "缅甸", kh: "柬埔寨", la: "老挝", bn: "文莱",
  au: "澳大利亚", nz: "新西兰", fj: "斐济", pg: "巴布亚新几内亚",
  // 美洲
  us: "美国", ca: "加拿大", mx: "墨西哥", br: "巴西", ar: "阿根廷", cl: "智利",
  pe: "秘鲁", co: "哥伦比亚", uy: "乌拉圭", py: "巴拉圭", bo: "玻利维亚",
  ec: "厄瓜多尔", ve: "委内瑞拉", cr: "哥斯达黎加", pa: "巴拿马", do: "多米尼加",
  gt: "危地马拉", pr: "波多黎各",
  // 欧洲
  gb: "英国", ie: "爱尔兰", fr: "法国", de: "德国", es: "西班牙", pt: "葡萄牙",
  it: "意大利", nl: "荷兰", be: "比利时", ch: "瑞士", at: "奥地利", se: "瑞典",
  no: "挪威", dk: "丹麦", fi: "芬兰", is: "冰岛", pl: "波兰", cz: "捷克",
  sk: "斯洛伐克", hu: "匈牙利", ro: "罗马尼亚", bg: "保加利亚", gr: "希腊",
  ua: "乌克兰", by: "白俄罗斯", ru: "俄罗斯", lt: "立陶宛", lv: "拉脱维亚",
  ee: "爱沙尼亚", rs: "塞尔维亚", hr: "克罗地亚", si: "斯洛文尼亚",
  ba: "波黑", mk: "北马其顿", al: "阿尔巴尼亚", md: "摩尔多瓦",
  // 中东 / 非洲
  tr: "土耳其", ae: "阿联酋", sa: "沙特阿拉伯", qa: "卡塔尔", kw: "科威特",
  bh: "巴林", om: "阿曼", jo: "约旦", lb: "黎巴嫩", il: "以色列", ir: "伊朗",
  iq: "伊拉克",
  ma: "摩洛哥", dz: "阿尔及利亚", tn: "突尼斯", ly: "利比亚", eg: "埃及",
  za: "南非", ng: "尼日利亚", ke: "肯尼亚", gh: "加纳", et: "埃塞俄比亚",
  tz: "坦桑尼亚", ug: "乌干达", sn: "塞内加尔", ci: "科特迪瓦", cm: "喀麦隆",
  zw: "津巴布韦", ao: "安哥拉", mz: "莫桑比克", mg: "马达加斯加", mu: "毛里求斯"
};
// 英文界面同样不能只写 "Taiwan" —— 和中文口径保持一致
var COUNTRY_EN = { tw: "Taiwan, China", hk: "Hong Kong, China", mo: "Macao, China" };

function countryText(p, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var cc = String(p.cc || "").toLowerCase();
  if (en) {
    if (Object.prototype.hasOwnProperty.call(COUNTRY_EN, cc)) return COUNTRY_EN[cc];
    if (p.country) return String(p.country);
    return cc ? cc.toUpperCase() : "";
  }
  if (Object.prototype.hasOwnProperty.call(COUNTRY_ZH, cc)) return COUNTRY_ZH[cc];
  if (p.country) return String(p.country);
  return cc ? cc.toUpperCase() : "";
}

function playerView(p, lang) {
  var bits = [];
  var country = countryText(p, lang);
  if (country) bits.push(country);
  var it = inputText(p.input, lang);
  if (it) bits.push(it);
  return { name: p.name || "", meta: bits.join(" · ") };
}

function teamView(t, lang) {
  var en = i18n.normalizeLang(lang) === "en";
  var players = (t.players || []).map(function (p) { return playerView(p, lang); });
  return {
    name: t.name,
    icon: t.icon || "",
    hasIcon: !!t.icon,
    players: players,
    hasPlayers: players.length > 0,
    countText: players.length
      ? (players.length + (en ? "" : " 人"))
      : i18n.t(lang, "nextRosterTbd")
  };
}

/* 赛制展示：只认生成脚本标记过的已知赛制（data.format.key），
   认不出就返回 null，界面不显示 —— 不猜赛制、不编晋级规则。
   ⚠️ 文案是对赛事页 info-banner 里官方英文原文的中文转写，别加没写的数字（比如赛点分）。 */
var FORMATS = {
  "rr4-mp": {
    zh: {
      // 摘要压到一行：原来的 "前 20 胜者组 / 21–40 败者组" 会多折出一个"制"字
      summary: "4 组循环 → 胜者组 / 败者组 → 20 队赛点制决赛",
      lines: [
        { k: "小组赛", v: "40 队分 4 组循环；前 20 进胜者组，21–40 进败者组第一轮。" },
        { k: "胜者组", v: "前 10 进决赛，后 10 进败者组第二轮。" },
        { k: "败者组", v: "第一轮前 10 进第二轮；第二轮前 10 进决赛。" },
        { k: "决赛", v: "20 队，赛点制。" }
      ]
    },
    en: {
      summary: "4-group round robin → winners / losers → match point finals",
      lines: [
        { k: "Group stage", v: "40 teams, 4-group round robin. Top 20 → Winners Round; bottom 20 → Losers Round 1." },
        { k: "Winners", v: "Top 10 → Finals; bottom 10 → Losers Round 2." },
        { k: "Losers", v: "R1 top 10 → R2; R2 top 10 → Finals." },
        { k: "Finals", v: "20 teams, match point." }
      ]
    }
  }
};

function formatView(f, lang) {
  if (!f || !f.key || !Object.prototype.hasOwnProperty.call(FORMATS, f.key)) return null;
  var v = FORMATS[f.key][i18n.normalizeLang(lang) === "en" ? "en" : "zh"];
  return { summary: v.summary, lines: v.lines };
}

/** 赛事日期范围："10/30–11/02" / "Oct 30 – Nov 2" */
function rangeText(first, last, lang) {
  var a = bj(first), b = bj(last);
  if (!a || !b) return "";
  if (i18n.normalizeLang(lang) === "en") {
    return MON_EN[a.mo - 1] + " " + a.da + " – " + MON_EN[b.mo - 1] + " " + b.da;
  }
  return p2(a.mo) + "/" + p2(a.da) + "–" + p2(b.mo) + "/" + p2(b.da);
}

/** 某个组的小组赛（从赛程的 bracket 键 AvB / AvC … 反推，不需要额外数据） */
function groupMatches(schedule, letter, lang) {
  var out = [];
  schedule.forEach(function (m) {
    var gm = /^([A-Z])v([A-Z])$/.exec(String(m.bracket || ""));
    if (!gm) return;
    var a = gm[1], b = gm[2];
    if (a !== letter && b !== letter) return;
    var t = bj(m.at);
    if (!t) return;
    out.push({
      at: m.at,
      label: shortDate(t, lang) + " " + clock(t),
      other: a === letter ? b : a
    });
  });
  out.sort(function (x, y) { return x.at - y.at; });
  return out;
}

/** 倒计时只在开赛前显示；开赛后用"到点/结束"两句如实说，不猜比分 */
function countdownText(ms, lang) {
  var mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return i18n.t(lang, "nextInMins").replace("{n}", mins);
  var hours = Math.round(mins / 60);
  if (hours < 48) return i18n.t(lang, "nextInHours").replace("{n}", hours);
  return i18n.t(lang, "nextInDays").replace("{n}", Math.round(hours / 24));
}

/**
 * @param {string} lang
 * @param {number} nowMs  打开页面的那一刻（倒计时按它算，测试可传死时间）
 * @param {string} activeGroup 当前展开的组（A/B/C/D）
 * @param {object} [data]  默认用 next_match_data.js；测试可注入假数据
 */
function build(lang, nowMs, activeGroup, data) {
  data = data || DATA;
  if (!data || !data.schedule || !data.groups || !data.groups.length) return null;
  var en = i18n.normalizeLang(lang) === "en";
  var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
  var ev = data.event || {};

  // 生成脚本已经按时间排过，这里再排一次：视图模型不假设上游一定有序，
  // 否则"下一场"会挑错（数据一旦手工改过就会踩到）。
  var timed = data.schedule.filter(function (m) { return m.at; })
    .slice()
    .sort(function (a, b) { return a.at - b.at; });
  var next = null;
  for (var i = 0; i < timed.length; i++) {
    if (timed[i].at * 1000 > now) { next = timed[i]; break; }
  }
  var last = timed.length ? timed[timed.length - 1] : null;
  var ended = !next && last && now >= (last.at + 2 * 3600) * 1000;

  // 赛程格子：一场一格（日期 + 时间 + 场次）。两列排，10 场约 300rpx ——
  // 按"天"分组时右列会折行，四天要 500rpx 以上，会把分组挤出第一屏（实测算过）。
  // 没排期的场次单独列，绝不塞一个假时间。
  var slots = [];
  timed.forEach(function (m) {
    var t = bj(m.at);
    if (!t) return;
    slots.push({
      key: m.key,
      label: shortDate(t, lang) + " " + clock(t),
      name: matchName(m, lang, true)
    });
  });
  var untimed = data.schedule.filter(function (m) { return !m.at; });

  // 主卡片上的那一场：未来的最近一场 → 否则最后一场（已到点/已结束）→
  // 否则第一条赛程（一条时间都没排，只显示"时间待定"）
  var heroMatch = next || last || data.schedule[0] || null;
  var heroTime = heroMatch && heroMatch.at ? bj(heroMatch.at) : null;

  var groups = data.groups.map(function (g) {
    var gm = groupMatches(data.schedule, g.key, lang);
    var head = en ? "Group stage: " : "小组赛：";
    return {
      key: g.key,
      name: groupName(g.key, lang),
      countText: (g.teams || []).length + (en ? " teams" : " 队"),
      // "A 组赛程：10/30 01:00 vs B · 10/31 01:00 vs C · 10/31 09:30 vs D"
      matchesText: gm.length
        ? head + gm.map(function (x) {
            return x.label + " vs " + (en ? ("Group " + x.other) : (x.other + " 组"));
          }).join(" · ")
        : ""
    };
  });
  var picked = null;
  for (var k = 0; k < data.groups.length; k++) {
    if (data.groups[k].key === activeGroup) { picked = data.groups[k]; break; }
  }
  if (!picked) picked = data.groups[0];

  var activeKey = picked.key;
  var activeMatchesText = "";
  groups.forEach(function (g) {
    g.active = (g.key === activeKey);
    if (g.active) activeMatchesText = g.matchesText;
  });

  var teams = (picked.teams || []).map(function (t, idx) {
    var v = teamView(t, lang);
    v.idx = idx;
    return v;
  });

  var totalTeams = data.groups.reduce(function (n, g) { return n + (g.teams || []).length; }, 0);

  var statusText;
  if (next) statusText = countdownText(next.at * 1000 - now, lang);
  else if (last) statusText = ended ? i18n.t(lang, "nextEnded") : i18n.t(lang, "nextStarted");
  else statusText = i18n.t(lang, "nextTimeTbd");

  var range = timed.length ? rangeText(timed[0].at, timed[timed.length - 1].at, lang) : "";

  return {
    updatedText: i18n.t(lang, "nextSnapshot").replace("{d}", data.updated || ""),
    eventLabel: algs.leagueName(ev.league || "", lang),
    eventSub: algs.splitText(ev.split || "", lang) + " · " +
      (en ? (ev.region || "") : (algs.regionName(ev.region || "", lang) || ev.region || "")) +
      (range ? " · " + range : ""),
    metaText: i18n.t(lang, "nextMeta")
      .replace("{g}", data.groups.length)
      .replace("{t}", totalTeams)
      .replace("{m}", data.schedule.length),
    hasNext: !!next,
    // 有没有"时间状态"可说。一场都没排期时整块不显示胶囊 —— 否则
    // 「时间待定」会在胶囊和主标题上各写一遍。
    hasStatus: !!(next || last),
    statusText: statusText,
    nextTimeText: heroTime ? (dateLabel(heroTime, lang) + " " + clock(heroTime)) : i18n.t(lang, "nextTimeTbd"),
    nextMatchText: heroMatch ? matchName(heroMatch, lang) : "",
    hasTimes: timed.length > 0,
    slots: slots,
    tzText: i18n.t(lang, "nextTz"),
    noTimeNote: i18n.t(lang, "nextNoTime"),
    untimed: untimed.map(function (m) {
      return { key: m.key, name: matchName(m, lang) };
    }),
    hasUntimed: untimed.length > 0,
    // 赛制（官方 info-banner 的转写）；认不出就没有这一块
    format: formatView(data.format, lang),
    groups: groups,
    activeGroup: activeKey,
    activeGroupName: groupName(activeKey, lang),
    activeMatchesText: activeMatchesText,
    teams: teams,
    caveat: i18n.t(lang, "nextCaveat").replace("{d}", data.updated || "")
  };
}

module.exports = {
  DATA: DATA,
  build: build,
  matchName: matchName,
  formatView: formatView,
  bj: bj
};
