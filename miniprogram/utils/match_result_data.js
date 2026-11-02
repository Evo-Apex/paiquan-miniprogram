/**
 * ALGS 拉斯维加斯季后赛 · 最终成绩（离线快照）。
 *
 * ⚠️ 只写有据可查的事实，来源写在 source 里，界面上会显示。
 *   2026-11-02 用 ApexLegendsStatus 官方赛事页（Y6-Split2/ALGS-Playoffs/Global/Finals）
 *   逐项核对：20 队名次、分数、击杀数全部一致；队名改成官方写法
 *   （WhiteGrimReaper / NinjasinPyjamas）。报道来源 players.com.ua 与游民星空
 *   在冠军（Team Liquid 91 分）与 WOL 第 7（61 分）上与官方一致。
 *
 * ⚠️ 没有的东西不许编：
 *   - 官方没有公布逐选手的击杀/伤害明细，所以这里只放**阵容名单**，不放编造的选手数据；
 *   - 第 11 名以后的完整名次两个来源都没给，所以只列前 10。
 *
 * 由 2026-11-02 的赛果替换原来的「下一场比赛」（那场已经打完）。
 */
module.exports = {
  updated: "2026-11-02",
  source: "ApexLegendsStatus 官方赛事页（Y6-Split2 季后赛决赛成绩）· 2026-11-02 核对",

  event: {
    name: "ALGS 2026 · Split 2 季后赛",
    venue: "美国拉斯维加斯 · Orleans Arena",
    days: 4,
    teams: 40,
    prize: "$2,000,000",
    championPrize: "$600,000",
    games: 9,
    finalMap: "风暴点"
  },

  // 决赛采用赛点制：先满 50 分，再拿一局捍卫者即夺冠
  format: "小组赛 → 胜败者组 → 20 队赛点制决赛（先满 50 分，再赢一局）",

  champion: {
    team: "Team Liquid",
    points: 91,
    players: ["Zer0", "Sikezz", "Panic"],
    coach: "Kapreme"
  },

  // 决赛前 10（打完 9 局）
  standings: [
    { rank: 1, team: "Team Liquid", points: 91, kills: 43, prize: "$600,000",},
    { rank: 2, team: "Team Vision", points: 80, kills: 43, prize: "$300,000",},
    { rank: 3, team: "Forged Wolves", points: 76, kills: 39, prize: "$200,000",},
    { rank: 4, team: "Aurora", points: 71, kills: 42, },
    { rank: 5, team: "Alliance", points: 65, kills: 28, },
    { rank: 6, team: "WhiteGrimReaper", points: 64, kills: 34, },
    { rank: 7, team: "Wolves Esports", points: 61, kills: 31, },
    { rank: 8, team: "NinjasinPyjamas", points: 53, kills: 24, },
    { rank: 9, team: "Crazy Thieves", points: 48, kills: 30, },
    { rank: 10, team: "Team WaR", points: 48, kills: 27, },
    { rank: 11, team: "Team RRQ", points: 47, kills: 25, },
    { rank: 12, team: "Sentinels", points: 47, kills: 29, },
    { rank: 13, team: "GaiminGladiators", points: 43, kills: 26, },
    { rank: 14, team: "Geekay Esports", points: 37, kills: 25, },
    { rank: 15, team: "ShopifyRebellion", points: 34, kills: 18, },
    { rank: 16, team: "Team Falcons", points: 34, kills: 14, },
    { rank: 17, team: "AG GLOBAL", points: 34, kills: 14, },
    { rank: 18, team: "PVISION", points: 32, kills: 16, },
    { rank: 19, team: "KINOTROPE CLUB", points: 26, kills: 10, },
    { rank: 20, team: "REJECT", points: 22, kills: 9, },
  ],


  // 每局战况（9 局：地图 + 前三名，冠军带击杀数）
  // 数据来自官方赛果页的 Score matrix，逐局按名次排序取前三。
  games: [
    { no: 1, map: "Storm Point", first: "Forged Wolves", firstKills: 11, second: "Team WaR", third: "NinjasinPyjamas" },
    { no: 2, map: "Olympus", first: "Alliance", firstKills: 5, second: "Wolves Esports", third: "Team Liquid" },
    { no: 3, map: "E-District", first: "Team Vision", firstKills: 11, second: "Alliance", third: "ShopifyRebellion" },
    { no: 4, map: "World's Edge", first: "NinjasinPyjamas", firstKills: 9, second: "Team Falcons", third: "WhiteGrimReaper" },
    { no: 5, map: "World's Edge", first: "WhiteGrimReaper", firstKills: 8, second: "Alliance", third: "Forged Wolves" },
    { no: 6, map: "E-District", first: "Team Vision", firstKills: 18, second: "KINOTROPE CLUB", third: "Geekay Esports" },
    { no: 7, map: "Olympus", first: "Team Liquid", firstKills: 13, second: "Forged Wolves", third: "Team Vision" },
    { no: 8, map: "Storm Point", first: "Aurora", firstKills: 11, second: "Crazy Thieves", third: "Team Liquid" },
    { no: 9, map: "Storm Point", first: "Team Liquid", firstKills: 6, second: "Team RRQ", third: "Wolves Esports" },
  ],

  // 英雄选取率：60 名选手 × 9 局的选择次数汇总（共 531 次），取前 8
  legends: [
    { name: "Wattson", picks: 70, pct: 13.2 },
    { name: "Pathfinder", picks: 57, pct: 10.7 },
    { name: "Wraith", picks: 54, pct: 10.2 },
    { name: "Gibraltar", picks: 48, pct: 9.0 },
    { name: "Rampart", picks: 43, pct: 8.1 },
    { name: "Seer", picks: 41, pct: 7.7 },
    { name: "Alter", picks: 35, pct: 6.6 },
    { name: "Mad Maggie", picks: 31, pct: 5.8 },
  ],

  // 选手榜（决赛 9 局汇总，官方赛果页的 Players Statistics 表，2026-11-02 抓取）
  // 只取伤害前 10：60 人的全表放进来太重，而且手机上一屏看不完。
  players: {
    metric: "damage",
    total: 60,
    killsKing: { player: "VSN carter", team: "Team Vision", kills: 21 },
    rows: [
      { player: "FWG kaydnw", team: "Forged Wolves", kills: 15, damage: 11343 },
      { player: "TL PanicApex", team: "Team Liquid", kills: 17, damage: 10619 },
      { player: "CRT Koyful", team: "Crazy Thieves", kills: 13, damage: 9885 },
      { player: "WOL Floating", team: "Wolves Esports", kills: 9, damage: 9871 },
      { player: "FLCN ImperialHal", team: "Team Falcons", kills: 6, damage: 8902 },
      { player: "AURA Effect", team: "Aurora", kills: 14, damage: 8861 },
      { player: "WAR Uxako", team: "Team WaR", kills: 9, damage: 8620 },
      { player: "TL Zer0", team: "Team Liquid", kills: 17, damage: 8557 },
      { player: "RRQ Prycyy", team: "Team RRQ", kills: 8, damage: 8259 },
      { player: "FWG Dark", team: "Forged Wolves", kills: 14, damage: 7993 },
    ]
  },

};
