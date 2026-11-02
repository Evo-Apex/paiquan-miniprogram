/**
 * 比赛结果视图模型：把 match_result_data.js 换成界面能直接渲染的字段。
 *
 * 纯函数（不碰 wx.*），可在 Node 里单测。
 * 口径和 nextmatch 一致：英文缺译文时回落原文，不机翻、不留空。
 */
var i18n = require("./i18n.js");
var RAW = require("./match_result_data.js");

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
      damage: x.damage == null ? "" : String(x.damage)
    };
  });
  var king = pl.killsKing || {};

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
    champCoach: ch.coach ? T.resCoach.replace("{n}", ch.coach) : "",
    champNote: ch.note || "",

    tableTitle: T.resTableTitle,
    rankHead: T.resRank,
    teamHead: T.resTeam,
    pointsHead: T.resPointsHead,
    killsHead: T.resKillsHead,
    gamesText: ev.games ? T.resGames.replace("{n}", String(ev.games)) : "",
    rows: rows,

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
