/**
 * 比赛结果视图模型：把 match_result_data.js 换成界面能直接渲染的字段。
 *
 * 纯函数（不碰 wx.*），可在 Node 里单测。
 * 口径和 nextmatch 一致：英文缺译文时回落原文，不机翻、不留空。
 */
var i18n = require("./i18n.js");
var RAW = require("../data/match_result_data.js");

function build(lang, raw) {
  var T = i18n.T(lang);
  var d = raw || RAW;

  var ev = d.event || {};
  var ch = d.champion || {};

  var rows = (d.standings || []).map(function (s) {
    return {
      rank: String(s.rank),
      team: s.team,
      points: String(s.points),
      kills: s.kills == null ? "" : String(s.kills),
      prize: s.prize || "",
      cn: s.team === "Wolves Esports"   // 中国大陆最好成绩，界面高亮
    };
  });

  var pl = d.players || {};
  var pRows = (pl.rows || []).map(function (x) {
    return {
      player: x.player || "",
      team: x.team || "",
      kills: x.kills == null ? "" : String(x.kills),
      damage: x.damage == null ? "" : String(x.damage),
      stats: x.stats || null
    };
  });
  var king = pl.killsKing || {};

  var maxPct = Math.max.apply(null, [1].concat((d.legends || []).map(function (x) { return x.pct || 0; })));
  var gameRows = (d.games || []).map(function (g) {
    return {
      no: String(g.no),
      noText: T.resGameNo.replace("{n}", String(g.no)),
      map: g.map || "",
      first: g.first || "",
      killsText: g.firstKills == null ? "" : T.resGameKills.replace("{n}", String(g.firstKills)),
      second: g.second || "",
      third: g.third || ""
    };
  });
  var legendRows = (d.legends || []).map(function (x) {
    return {
      name: x.name || "",
      picksText: T.resLegendPicks.replace("{n}", String(x.picks)),
      pctText: (x.pct == null ? "" : String(x.pct)) + "%",
      barW: Math.round((x.pct || 0) * 100 / maxPct)
    };
  });

  var teamRows = (d.teamStats || []).map(function (x) {
    return {
      team: x.team || "",
      dmg: String(x.dmg == null ? "" : x.dmg),
      kills: String(x.kills == null ? "" : x.kills),
      knocks: String(x.knocks == null ? "" : x.knocks),
      taken: String(x.taken == null ? "" : x.taken)
    };
  });

  return {
    updated: d.updated || "",
    updatedText: T.resUpdated.replace("{d}", d.updated || ""),
    sourceText: T.resSource.replace("{s}", d.source || ""),

    title: T.resTitle,
    eventName: ev.name || "",
    // 一行信息：场地 · 队数 · 天数 · 总奖金
    metaText: [
      ev.venue || "",
      (ev.teams ? T.resTeams.replace("{n}", String(ev.teams)) : ""),
      (ev.days ? T.resDays.replace("{n}", String(ev.days)) : ""),
      (ev.prize ? T.resPrize.replace("{p}", ev.prize) : "")
    ].filter(Boolean).join(" · "),

    champLabel: T.resChampion,
    champTeam: ch.team || "",
    champPoints: ch.points == null ? "" : T.resPoints.replace("{n}", String(ch.points)),
    champPrize: ch.prize || ev.championPrize || "",
    champPlayers: (ch.players || []).join(" · "),
    // 冠军队员一个个列出来：拿到 Liquipedia 名单后能点进选手页（utils/prolink.js）
    champList: (ch.players || []).slice(),
    champCoach: ch.coach ? T.resCoach.replace("{n}", ch.coach) : "",

    tableTitle: T.resTableTitle,
    rankHead: T.resRank,
    teamHead: T.resTeam,
    pointsHead: T.resPointsHead,
    killsHead: T.resKillsHead,
    gamesText: ev.games ? T.resGames.replace("{n}", String(ev.games)) : "",
    rows: rows,

    radarField: pl.field || null,
    radarTitle: T.resRadarTitle,
    radarAvg: T.resRadarAvg,
    radarSelf: T.resRadarSelf,

    teamStatsTitle: T.resTeamStatsTitle,
    teamHead: T.resTeam,
    dmgHead: T.resDmgHead,
    knocksHead: T.resKnocksHead,
    takenHead: T.resTakenHead,
    teamRows: teamRows,

    gamesTitle: T.resGamesTitle,
    gamesText: T.resGames.replace("{n}", String(gameRows.length)),
    gameRows: gameRows,
    legendsTitle: T.resLegendsTitle,
    legendsNote: T.resLegendsNote,
    legendRows: legendRows,

    playersTitle: T.resPlayersTitle,
    playersNote: (pl.total ? T.resPlayersNote.replace("{n}", String(pl.total)) : ""),
    playerHead: T.resPlayerHead,
    damageHead: T.resDamageHead,
    killsKingText: king.player ? T.resKillsKing.replace("{p}", king.player).replace("{n}", String(king.kills)) : "",
    playerRows: pRows,
    formatText: d.format ? T.resFormat.replace("{f}", d.format) : "",
    source: d.source || ""
  };
}

module.exports = { build: build };
