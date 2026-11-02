/**
 * ALGS 拉斯维加斯季后赛 · 最终成绩（离线快照）。
 *
 * ⚠️ 只写有据可查的事实，来源写在 source 里，界面上会显示。
 *   两个独立来源交叉核对过（2026-11-02）：
 *     - players.com.ua《Team Liquid Wins ALGS 2026 Split 2 Playoffs》
 *     - 游民星空《ALGS拉斯维加斯季后赛落幕，CN APEX鏖战四日无缘冠军》
 *   两处在冠军（Team Liquid）、决赛分数（91）、中国战队名次（WOL 第 7 / 61 分）上一致。
 *
 * ⚠️ 没有的东西不许编：
 *   - 官方没有公布逐选手的击杀/伤害明细，所以这里只放**阵容名单**，不放编造的选手数据；
 *   - 第 11 名以后的完整名次两个来源都没给，所以只列前 10。
 *
 * 由 2026-11-02 的赛果替换原来的「下一场比赛」（那场已经打完）。
 */
module.exports = {
  updated: "2026-11-02",
  source: "ALGS 官方赛果 · players.com.ua / 游民星空（2026-11-02）",

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
    coach: "Kapreme",
    note: "第 7 局到赛点，第 9 局在风暴点拿下捍卫者"
  },

  // 决赛前 10（打完 9 局）
  standings: [
    { rank: 1, team: "Team Liquid", points: 91, prize: "$600,000" },
    { rank: 2, team: "Team Vision", points: 80, prize: "$300,000" },
    { rank: 3, team: "Forged Wolves", points: 76, prize: "$200,000" },
    { rank: 4, team: "Aurora", points: 71 },
    { rank: 5, team: "Alliance", points: 65 },
    { rank: 6, team: "White Grim Reaper", points: 64 },
    { rank: 7, team: "Wolves Esports", points: 61 },
    { rank: 8, team: "Ninjas in Pyjamas", points: 53 },
    { rank: 9, team: "Crazy Thieves", points: 48 },
    { rank: 10, team: "Team WaR", points: 48 }
  ],

  // 中国大陆三队
  cn: [
    {
      team: "Wolves Esports",
      short: "WOL",
      result: "决赛第 7",
      points: 61,
      players: ["QQ", "CrazyCong", "Floating"],
      note: "败者组一路杀进决赛；第 8 局掉人，差 2 分没开赛点"
    },
    {
      team: "VKG",
      short: "VKG",
      result: "败者组第 16",
      points: null,
      players: [],
      note: "败者组第一轮止步"
    },
    {
      team: "PXX",
      short: "PXX",
      result: "败者组第 17",
      points: null,
      players: [],
      note: "受签证影响，选手 XD 带两名小将出战"
    }
  ]
};
