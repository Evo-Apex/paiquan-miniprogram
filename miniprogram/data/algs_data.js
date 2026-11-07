// 本文件由 直播识别/build_algs.py 自动生成，请勿手改。
//
// 数据来源：apexlegendsstatus.com/algs 的**赛事总览页**（离线抓取后解析）。
// 为什么是快照而不是实时接口，见 build_algs.py 顶部说明 —— 简单说：
// 该站只有赛事总览页对非浏览器放行，其余路径（含它自己的 JSON 接口）
// 都是 Cloudflare 人机校验，云函数同样取不到。
//
// 行数据用**数组**而不是对象，纯粹是为了压体积（赛事多、行多）；
// 每行的含义写在各字段的 "_cols" 里。
// 英雄一律存英文名：中文名与头像由 utils/codex.js 在渲染时查（单一数据源）。
module.exports =  {
  "updated": "2026-10-20",
  "source": "apexlegendsstatus.com/algs",
  "note": "ALGS 官方赛事的赛后统计快照（英雄选取率 / 三人组合 / 战队榜）。",
  "_cols": {
    "legends": [
      "en",
      "n",
      "pct",
      "win",
      "top5"
    ],
    "combos": [
      "heroes",
      "n",
      "pct"
    ],
    "standings": [
      "rank",
      "team",
      "score",
      "wins",
      "stage"
    ],
    "maps": [
      "en",
      "n"
    ]
  },
  "events": [
    {
      "id": "Y6-Split2-Pro-League-APAC_S",
      "year": "Y6",
      "split": "Y6-Split2",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y6-Split2/Pro-League/APAC_S",
      "teams": 30,
      "games": 63,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "E-District",
          "n": 21
        },
        {
          "en": "World's Edge",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        }
      ],
      "champion": "",
      "pointsLeader": "Team RRQ",
      "standings": [
        {
          "rank": 1,
          "team": "Team RRQ",
          "score": 423,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Wolves Esports",
          "score": 415,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "TitanEsportsClub",
          "score": 367,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "GenG Esports",
          "score": 364,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "VK GAMING",
          "score": 340,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Relove DCG",
          "score": 338,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "PXX",
          "score": 320,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "S8UL",
          "score": 312,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "Dogred",
          "score": 309,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "7VEN",
          "score": 306,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Alter",
          "n": 484,
          "pct": 38.5,
          "win": 5.6,
          "top5": 24.0
        },
        {
          "en": "Catalyst",
          "n": 433,
          "pct": 34.4,
          "win": 3.2,
          "top5": 23.3
        },
        {
          "en": "Mad Maggie",
          "n": 383,
          "pct": 30.4,
          "win": 3.9,
          "top5": 23.8
        },
        {
          "en": "Seer",
          "n": 359,
          "pct": 28.5,
          "win": 5.3,
          "top5": 25.3
        },
        {
          "en": "Pathfinder",
          "n": 318,
          "pct": 25.3,
          "win": 5.7,
          "top5": 26.4
        },
        {
          "en": "Wattson",
          "n": 309,
          "pct": 24.6,
          "win": 4.5,
          "top5": 25.2
        },
        {
          "en": "Wraith",
          "n": 291,
          "pct": 23.1,
          "win": 3.8,
          "top5": 26.5
        },
        {
          "en": "Sparrow",
          "n": 225,
          "pct": 17.9,
          "win": 7.6,
          "top5": 27.6
        },
        {
          "en": "Fuse",
          "n": 213,
          "pct": 16.9,
          "win": 6.6,
          "top5": 24.4
        },
        {
          "en": "Crypto",
          "n": 200,
          "pct": 15.9,
          "win": 5.0,
          "top5": 25.0
        },
        {
          "en": "Rampart",
          "n": 134,
          "pct": 10.7,
          "win": 6.7,
          "top5": 30.6
        },
        {
          "en": "Axle",
          "n": 110,
          "pct": 8.7,
          "win": 8.2,
          "top5": 25.5
        }
      ],
      "combos": [
        {
          "heroes": [
            "Alter",
            "Seer",
            "Wattson"
          ],
          "n": 92,
          "pct": 7.3
        },
        {
          "heroes": [
            "Alter",
            "Catalyst",
            "Crypto"
          ],
          "n": 90,
          "pct": 7.2
        },
        {
          "heroes": [
            "Seer",
            "Wattson",
            "Wraith"
          ],
          "n": 56,
          "pct": 4.5
        },
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Wattson"
          ],
          "n": 47,
          "pct": 3.7
        },
        {
          "heroes": [
            "Fuse",
            "Pathfinder",
            "Sparrow"
          ],
          "n": 43,
          "pct": 3.4
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Seer"
          ],
          "n": 42,
          "pct": 3.3
        },
        {
          "heroes": [
            "Catalyst",
            "Mad Maggie",
            "Pathfinder"
          ],
          "n": 35,
          "pct": 2.8
        },
        {
          "heroes": [
            "Catalyst",
            "Seer",
            "Wraith"
          ],
          "n": 32,
          "pct": 2.5
        },
        {
          "heroes": [
            "Mad Maggie",
            "Pathfinder",
            "Seer"
          ],
          "n": 31,
          "pct": 2.5
        },
        {
          "heroes": [
            "Catalyst",
            "Sparrow",
            "Wraith"
          ],
          "n": 28,
          "pct": 2.2
        }
      ],
      "legendTotal": 3776
    },
    {
      "id": "Y6-Split2-Pro-League-APAC_N",
      "year": "Y6",
      "split": "Y6-Split2",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y6-Split2/Pro-League/APAC_N",
      "teams": 30,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "ENTER FORCE.36",
      "standings": [
        {
          "rank": 1,
          "team": "ENTER FORCE.36",
          "score": 507,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "ZETA DIVISION",
          "score": 388,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "REJECT",
          "score": 361,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "KINOTROPE gaming",
          "score": 317,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "RIDDLEORDER ZERO",
          "score": 309,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "UNLIMIT",
          "score": 301,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "NOEZ FOXX",
          "score": 293,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "LawsonTicketXone",
          "score": 291,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "KINOTROPE CLUB",
          "score": 289,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "WhiteGrimReaper",
          "score": 286,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Alter",
          "n": 412,
          "pct": 33.2,
          "win": 5.8,
          "top5": 22.6
        },
        {
          "en": "Wattson",
          "n": 371,
          "pct": 29.9,
          "win": 5.4,
          "top5": 27.8
        },
        {
          "en": "Seer",
          "n": 363,
          "pct": 29.3,
          "win": 5.5,
          "top5": 23.4
        },
        {
          "en": "Fuse",
          "n": 294,
          "pct": 23.7,
          "win": 4.8,
          "top5": 21.8
        },
        {
          "en": "Mad Maggie",
          "n": 275,
          "pct": 22.2,
          "win": 4.0,
          "top5": 17.5
        },
        {
          "en": "Newcastle",
          "n": 267,
          "pct": 21.5,
          "win": 4.9,
          "top5": 30.7
        },
        {
          "en": "Wraith",
          "n": 266,
          "pct": 21.4,
          "win": 3.8,
          "top5": 32.3
        },
        {
          "en": "Rampart",
          "n": 223,
          "pct": 18.0,
          "win": 3.1,
          "top5": 28.7
        },
        {
          "en": "Crypto",
          "n": 199,
          "pct": 16.1,
          "win": 5.0,
          "top5": 25.1
        },
        {
          "en": "Pathfinder",
          "n": 163,
          "pct": 13.2,
          "win": 2.5,
          "top5": 21.5
        },
        {
          "en": "Valkyrie",
          "n": 158,
          "pct": 12.7,
          "win": 5.7,
          "top5": 26.6
        },
        {
          "en": "Axle",
          "n": 149,
          "pct": 12.0,
          "win": 6.0,
          "top5": 19.5
        }
      ],
      "combos": [
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 89,
          "pct": 7.2
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Seer"
          ],
          "n": 76,
          "pct": 6.1
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Valkyrie"
          ],
          "n": 61,
          "pct": 4.9
        },
        {
          "heroes": [
            "Alter",
            "Catalyst",
            "Crypto"
          ],
          "n": 58,
          "pct": 4.7
        },
        {
          "heroes": [
            "Alter",
            "Seer",
            "Wattson"
          ],
          "n": 53,
          "pct": 4.3
        },
        {
          "heroes": [
            "Seer",
            "Wattson",
            "Wraith"
          ],
          "n": 37,
          "pct": 3.0
        },
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Wattson"
          ],
          "n": 32,
          "pct": 2.6
        },
        {
          "heroes": [
            "Alter",
            "Fuse",
            "Wattson"
          ],
          "n": 30,
          "pct": 2.4
        },
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Seer"
          ],
          "n": 28,
          "pct": 2.3
        },
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 27,
          "pct": 2.2
        }
      ],
      "legendTotal": 3720
    },
    {
      "id": "Y6-Split1-Pro-League-APAC_S",
      "year": "Y6",
      "split": "Y6-Split1",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y6-Split1/Pro-League/APAC_S",
      "teams": 30,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Olympus",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "Wolves Esports",
      "standings": [
        {
          "rank": 1,
          "team": "Wolves Esports",
          "score": 403,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "S8UL",
          "score": 385,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "VK GAMING",
          "score": 333,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Team RRQ",
          "score": 317,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "PXX",
          "score": 310,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "GenG Esports",
          "score": 298,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "Kirisame",
          "score": 296,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Relove DCG",
          "score": 293,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "Dogred",
          "score": 282,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Finishers",
          "score": 271,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Wattson",
          "n": 471,
          "pct": 38.0,
          "win": 5.3,
          "top5": 24.6
        },
        {
          "en": "Alter",
          "n": 383,
          "pct": 30.9,
          "win": 4.4,
          "top5": 23.5
        },
        {
          "en": "Newcastle",
          "n": 354,
          "pct": 28.6,
          "win": 4.0,
          "top5": 28.2
        },
        {
          "en": "Wraith",
          "n": 323,
          "pct": 26.1,
          "win": 4.6,
          "top5": 27.6
        },
        {
          "en": "Valkyrie",
          "n": 308,
          "pct": 24.9,
          "win": 5.5,
          "top5": 26.9
        },
        {
          "en": "Gibraltar",
          "n": 304,
          "pct": 24.5,
          "win": 5.6,
          "top5": 27.6
        },
        {
          "en": "Mad Maggie",
          "n": 280,
          "pct": 22.6,
          "win": 5.7,
          "top5": 23.6
        },
        {
          "en": "Caustic",
          "n": 271,
          "pct": 21.9,
          "win": 4.8,
          "top5": 28.0
        },
        {
          "en": "Axle",
          "n": 194,
          "pct": 15.7,
          "win": 5.7,
          "top5": 20.1
        },
        {
          "en": "Crypto",
          "n": 190,
          "pct": 15.3,
          "win": 5.3,
          "top5": 23.7
        },
        {
          "en": "Rampart",
          "n": 177,
          "pct": 14.3,
          "win": 3.4,
          "top5": 24.3
        },
        {
          "en": "Bangalore",
          "n": 153,
          "pct": 12.3,
          "win": 5.2,
          "top5": 17.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Crypto"
          ],
          "n": 83,
          "pct": 6.7
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 66,
          "pct": 5.3
        },
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 58,
          "pct": 4.7
        },
        {
          "heroes": [
            "Mad Maggie",
            "Valkyrie",
            "Wattson"
          ],
          "n": 53,
          "pct": 4.3
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Mad Maggie"
          ],
          "n": 47,
          "pct": 3.8
        },
        {
          "heroes": [
            "Gibraltar",
            "Wattson",
            "Wraith"
          ],
          "n": 45,
          "pct": 3.6
        },
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Wattson"
          ],
          "n": 37,
          "pct": 3.0
        },
        {
          "heroes": [
            "Rampart",
            "Wattson",
            "Wraith"
          ],
          "n": 37,
          "pct": 3.0
        },
        {
          "heroes": [
            "Gibraltar",
            "Valkyrie",
            "Wattson"
          ],
          "n": 32,
          "pct": 2.6
        },
        {
          "heroes": [
            "Caustic",
            "Newcastle",
            "Wraith"
          ],
          "n": 31,
          "pct": 2.5
        }
      ],
      "legendTotal": 3717
    },
    {
      "id": "Y6-Split1-Pro-League-APAC_N",
      "year": "Y6",
      "split": "Y6-Split1",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y6-Split1/Pro-League/APAC_N",
      "teams": 30,
      "games": 64,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "E-District",
          "n": 22
        },
        {
          "en": "Olympus",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        }
      ],
      "champion": "",
      "pointsLeader": "ZETA DIVISION",
      "standings": [
        {
          "rank": 1,
          "team": "ZETA DIVISION",
          "score": 475,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "UNLIMIT",
          "score": 369,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "REJECT",
          "score": 357,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "WhiteGrimReaper",
          "score": 350,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "ENTER FORCE.36",
          "score": 346,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "RIDDLEORDER ONE",
          "score": 331,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "SBI eSports",
          "score": 317,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "KINOTROPE CLUB",
          "score": 306,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "REIGNITE",
          "score": 287,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "KINOTROPE gaming",
          "score": 280,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Alter",
          "n": 480,
          "pct": 37.5,
          "win": 5.4,
          "top5": 20.6
        },
        {
          "en": "Valkyrie",
          "n": 364,
          "pct": 28.4,
          "win": 7.1,
          "top5": 28.8
        },
        {
          "en": "Wattson",
          "n": 326,
          "pct": 25.5,
          "win": 4.6,
          "top5": 28.2
        },
        {
          "en": "Seer",
          "n": 316,
          "pct": 24.7,
          "win": 5.4,
          "top5": 21.8
        },
        {
          "en": "Wraith",
          "n": 311,
          "pct": 24.3,
          "win": 2.3,
          "top5": 28.9
        },
        {
          "en": "Newcastle",
          "n": 306,
          "pct": 23.9,
          "win": 4.6,
          "top5": 31.0
        },
        {
          "en": "Mad Maggie",
          "n": 306,
          "pct": 23.9,
          "win": 5.9,
          "top5": 19.6
        },
        {
          "en": "Gibraltar",
          "n": 219,
          "pct": 17.1,
          "win": 5.5,
          "top5": 30.6
        },
        {
          "en": "Bangalore",
          "n": 213,
          "pct": 16.6,
          "win": 4.2,
          "top5": 23.0
        },
        {
          "en": "Crypto",
          "n": 187,
          "pct": 14.6,
          "win": 5.3,
          "top5": 23.0
        },
        {
          "en": "Caustic",
          "n": 184,
          "pct": 14.4,
          "win": 5.4,
          "top5": 25.5
        },
        {
          "en": "Rampart",
          "n": 181,
          "pct": 14.1,
          "win": 3.9,
          "top5": 32.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 88,
          "pct": 6.9
        },
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Seer"
          ],
          "n": 62,
          "pct": 4.8
        },
        {
          "heroes": [
            "Alter",
            "Bangalore",
            "Seer"
          ],
          "n": 61,
          "pct": 4.8
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 51,
          "pct": 4.0
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Mad Maggie"
          ],
          "n": 50,
          "pct": 3.9
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Valkyrie"
          ],
          "n": 42,
          "pct": 3.3
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 38,
          "pct": 3.0
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Crypto"
          ],
          "n": 37,
          "pct": 2.9
        },
        {
          "heroes": [
            "Caustic",
            "Crypto",
            "Wraith"
          ],
          "n": 37,
          "pct": 2.9
        },
        {
          "heroes": [
            "Gibraltar",
            "Wattson",
            "Wraith"
          ],
          "n": 28,
          "pct": 2.2
        }
      ],
      "legendTotal": 3840
    },
    {
      "id": "Y6-Split1-ALGS-Playoffs-Global",
      "year": "Y6",
      "split": "Y6-Split1",
      "league": "ALGS-Playoffs",
      "region": "Global",
      "path": "Y6-Split1/ALGS-Playoffs/Global",
      "teams": 40,
      "games": 56,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 17
        },
        {
          "en": "E-District",
          "n": 17
        },
        {
          "en": "World's Edge",
          "n": 12
        },
        {
          "en": "Olympus",
          "n": 10
        }
      ],
      "champion": "",
      "pointsLeader": "Team RRQ",
      "standings": [
        {
          "rank": 1,
          "team": "Team RRQ",
          "score": 251,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Wolves Esports",
          "score": 248,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Team Liquid",
          "score": 243,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "ELITE Esports",
          "score": 242,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "NinjasinPyjamas",
          "score": 228,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Team Vision",
          "score": 226,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "ForFun Esports",
          "score": 215,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "ZETA DIVISION",
          "score": 206,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "ZEDI ESPORTS",
          "score": 203,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "AG GLOBAL",
          "score": 201,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Alter",
          "n": 500,
          "pct": 44.6,
          "win": 6.2,
          "top5": 22.4
        },
        {
          "en": "Wattson",
          "n": 464,
          "pct": 41.4,
          "win": 5.0,
          "top5": 25.9
        },
        {
          "en": "Valkyrie",
          "n": 253,
          "pct": 22.6,
          "win": 4.0,
          "top5": 24.9
        },
        {
          "en": "Newcastle",
          "n": 252,
          "pct": 22.5,
          "win": 6.3,
          "top5": 35.3
        },
        {
          "en": "Mad Maggie",
          "n": 228,
          "pct": 20.4,
          "win": 4.4,
          "top5": 23.7
        },
        {
          "en": "Wraith",
          "n": 226,
          "pct": 20.2,
          "win": 4.0,
          "top5": 35.0
        },
        {
          "en": "Seer",
          "n": 183,
          "pct": 16.3,
          "win": 5.5,
          "top5": 24.0
        },
        {
          "en": "Caustic",
          "n": 163,
          "pct": 14.6,
          "win": 4.9,
          "top5": 23.9
        },
        {
          "en": "Crypto",
          "n": 159,
          "pct": 14.2,
          "win": 5.0,
          "top5": 25.2
        },
        {
          "en": "Gibraltar",
          "n": 158,
          "pct": 14.1,
          "win": 5.7,
          "top5": 25.9
        },
        {
          "en": "Sparrow",
          "n": 134,
          "pct": 12.0,
          "win": 6.0,
          "top5": 22.4
        },
        {
          "en": "Fuse",
          "n": 133,
          "pct": 11.9,
          "win": 5.3,
          "top5": 16.5
        }
      ],
      "combos": [
        {
          "heroes": [
            "Alter",
            "Mad Maggie",
            "Wattson"
          ],
          "n": 85,
          "pct": 7.6
        },
        {
          "heroes": [
            "Alter",
            "Seer",
            "Wattson"
          ],
          "n": 82,
          "pct": 7.3
        },
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 68,
          "pct": 6.1
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Crypto"
          ],
          "n": 63,
          "pct": 5.6
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Seer"
          ],
          "n": 39,
          "pct": 3.5
        },
        {
          "heroes": [
            "Mad Maggie",
            "Wattson",
            "Wraith"
          ],
          "n": 31,
          "pct": 2.8
        },
        {
          "heroes": [
            "Newcastle",
            "Valkyrie",
            "Wattson"
          ],
          "n": 30,
          "pct": 2.7
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 28,
          "pct": 2.5
        },
        {
          "heroes": [
            "Seer",
            "Wattson",
            "Wraith"
          ],
          "n": 25,
          "pct": 2.2
        },
        {
          "heroes": [
            "Mad Maggie",
            "Valkyrie",
            "Wattson"
          ],
          "n": 24,
          "pct": 2.1
        }
      ],
      "legendTotal": 3360
    },
    {
      "id": "Y5-Split2-Pro-League-APAC_S",
      "year": "Y5",
      "split": "Y5-Split2",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y5-Split2/Pro-League/APAC_S",
      "teams": 30,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "Gen.G Esports",
      "standings": [
        {
          "rank": 1,
          "team": "Gen.G Esports",
          "score": 523,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Wolves Esports",
          "score": 450,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Boogie Boarders",
          "score": 370,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Five Fears",
          "score": 318,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "7VEN",
          "score": 315,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "S8UL",
          "score": 315,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "AlQadsiahEsports",
          "score": 303,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "DeepCrossGaming",
          "score": 302,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "Rex Regum Qeon",
          "score": 286,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "TEC-Academy",
          "score": 282,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Alter",
          "n": 364,
          "pct": 29.3,
          "win": 5.5,
          "top5": 24.5
        },
        {
          "en": "Wraith",
          "n": 339,
          "pct": 27.3,
          "win": 4.1,
          "top5": 29.4
        },
        {
          "en": "Newcastle",
          "n": 335,
          "pct": 27.0,
          "win": 6.6,
          "top5": 26.9
        },
        {
          "en": "Crypto",
          "n": 315,
          "pct": 25.4,
          "win": 4.3,
          "top5": 22.9
        },
        {
          "en": "Sparrow",
          "n": 300,
          "pct": 24.1,
          "win": 4.4,
          "top5": 24.2
        },
        {
          "en": "Wattson",
          "n": 291,
          "pct": 23.4,
          "win": 5.2,
          "top5": 25.5
        },
        {
          "en": "Ash",
          "n": 277,
          "pct": 22.3,
          "win": 5.4,
          "top5": 21.1
        },
        {
          "en": "Rampart",
          "n": 263,
          "pct": 21.2,
          "win": 4.0,
          "top5": 25.4
        },
        {
          "en": "Bangalore",
          "n": 239,
          "pct": 19.2,
          "win": 4.3,
          "top5": 21.3
        },
        {
          "en": "Caustic",
          "n": 181,
          "pct": 14.6,
          "win": 5.0,
          "top5": 24.3
        },
        {
          "en": "Catalyst",
          "n": 176,
          "pct": 14.2,
          "win": 6.9,
          "top5": 30.1
        },
        {
          "en": "Gibraltar",
          "n": 170,
          "pct": 13.7,
          "win": 8.7,
          "top5": 32.9
        }
      ],
      "combos": [
        {
          "heroes": [
            "Ash",
            "Crypto",
            "Fuse"
          ],
          "n": 58,
          "pct": 4.7
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Newcastle"
          ],
          "n": 54,
          "pct": 4.3
        },
        {
          "heroes": [
            "Alter",
            "Newcastle",
            "Wattson"
          ],
          "n": 49,
          "pct": 3.9
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 39,
          "pct": 3.1
        },
        {
          "heroes": [
            "Rampart",
            "Sparrow",
            "Wraith"
          ],
          "n": 35,
          "pct": 2.8
        },
        {
          "heroes": [
            "Crypto",
            "Wattson",
            "Wraith"
          ],
          "n": 34,
          "pct": 2.7
        },
        {
          "heroes": [
            "Ash",
            "Bangalore",
            "Crypto"
          ],
          "n": 32,
          "pct": 2.6
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 29,
          "pct": 2.3
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Sparrow"
          ],
          "n": 27,
          "pct": 2.2
        },
        {
          "heroes": [
            "Alter",
            "Newcastle",
            "Rampart"
          ],
          "n": 22,
          "pct": 1.8
        }
      ],
      "legendTotal": 3727
    },
    {
      "id": "Y5-Split2-Pro-League-APAC_N",
      "year": "Y5",
      "split": "Y5-Split2",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y5-Split2/Pro-League/APAC_N",
      "teams": 30,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "UNLIMIT",
      "standings": [
        {
          "rank": 1,
          "team": "UNLIMIT",
          "score": 444,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "SOTEN",
          "score": 400,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "FENNEL",
          "score": 355,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "ENTER FORCE.36",
          "score": 354,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "SYRALE",
          "score": 322,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "TIE",
          "score": 294,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "RIDDLEORDER ONE",
          "score": 273,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "FNATIC",
          "score": 270,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "O2 DOSUKOI",
          "score": 270,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "RIDDLEORDER ZERO",
          "score": 269,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Crypto",
          "n": 355,
          "pct": 28.6,
          "win": 4.2,
          "top5": 21.7
        },
        {
          "en": "Wraith",
          "n": 345,
          "pct": 27.8,
          "win": 4.3,
          "top5": 32.1
        },
        {
          "en": "Wattson",
          "n": 341,
          "pct": 27.5,
          "win": 5.0,
          "top5": 28.7
        },
        {
          "en": "Ash",
          "n": 339,
          "pct": 27.4,
          "win": 5.6,
          "top5": 21.8
        },
        {
          "en": "Alter",
          "n": 327,
          "pct": 26.4,
          "win": 4.3,
          "top5": 21.4
        },
        {
          "en": "Sparrow",
          "n": 302,
          "pct": 24.4,
          "win": 6.6,
          "top5": 24.2
        },
        {
          "en": "Newcastle",
          "n": 281,
          "pct": 22.7,
          "win": 5.3,
          "top5": 32.0
        },
        {
          "en": "Mad Maggie",
          "n": 227,
          "pct": 18.3,
          "win": 4.8,
          "top5": 21.6
        },
        {
          "en": "Caustic",
          "n": 210,
          "pct": 16.9,
          "win": 6.2,
          "top5": 28.1
        },
        {
          "en": "Bangalore",
          "n": 209,
          "pct": 16.9,
          "win": 4.3,
          "top5": 20.6
        },
        {
          "en": "Catalyst",
          "n": 164,
          "pct": 13.2,
          "win": 2.4,
          "top5": 21.3
        },
        {
          "en": "Gibraltar",
          "n": 136,
          "pct": 11.0,
          "win": 6.6,
          "top5": 29.4
        }
      ],
      "combos": [
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 64,
          "pct": 5.2
        },
        {
          "heroes": [
            "Crypto",
            "Wattson",
            "Wraith"
          ],
          "n": 60,
          "pct": 4.8
        },
        {
          "heroes": [
            "Ash",
            "Fuse",
            "Sparrow"
          ],
          "n": 52,
          "pct": 4.2
        },
        {
          "heroes": [
            "Ash",
            "Mad Maggie",
            "Seer"
          ],
          "n": 50,
          "pct": 4.0
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Crypto"
          ],
          "n": 48,
          "pct": 3.9
        },
        {
          "heroes": [
            "Caustic",
            "Crypto",
            "Wraith"
          ],
          "n": 34,
          "pct": 2.7
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Wattson"
          ],
          "n": 31,
          "pct": 2.5
        },
        {
          "heroes": [
            "Caustic",
            "Newcastle",
            "Wraith"
          ],
          "n": 30,
          "pct": 2.4
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 26,
          "pct": 2.1
        },
        {
          "heroes": [
            "Ash",
            "Bangalore",
            "Crypto"
          ],
          "n": 19,
          "pct": 1.5
        }
      ],
      "legendTotal": 3719
    },
    {
      "id": "Y5-Split2-ALGS-Championships-Global",
      "year": "Y5",
      "split": "Y5-Split2",
      "league": "ALGS-Championships",
      "region": "Global",
      "path": "Y5-Split2/ALGS-Championships/Global",
      "teams": 40,
      "games": 63,
      "rankBy": "bracket",
      "stage": "Finals",
      "maps": [
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "World's Edge",
          "n": 17
        },
        {
          "en": "E-District",
          "n": 17
        },
        {
          "en": "Olympus",
          "n": 8
        }
      ],
      "champion": "Oblivion",
      "pointsLeader": "",
      "standings": [
        {
          "rank": 1,
          "team": "Oblivion",
          "score": 86,
          "wins": 2,
          "stage": "Finals"
        },
        {
          "rank": 2,
          "team": "Team Falcons",
          "score": 75,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 3,
          "team": "ENTER FORCE.36",
          "score": 75,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 4,
          "team": "GROW Gaming",
          "score": 65,
          "wins": 0,
          "stage": "Finals"
        },
        {
          "rank": 5,
          "team": "S8UL",
          "score": 64,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 6,
          "team": "Crazy Thieves",
          "score": 61,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 7,
          "team": "TSM",
          "score": 59,
          "wins": 0,
          "stage": "Finals"
        },
        {
          "rank": 8,
          "team": "NinjasInPyjamas",
          "score": 57,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 9,
          "team": "FNATIC",
          "score": 50,
          "wins": 1,
          "stage": "Finals"
        },
        {
          "rank": 10,
          "team": "UNLIMIT",
          "score": 50,
          "wins": 0,
          "stage": "Finals"
        }
      ],
      "legends": [
        {
          "en": "Valkyrie",
          "n": 540,
          "pct": 43.1,
          "win": 3.9,
          "top5": 27.8
        },
        {
          "en": "Crypto",
          "n": 436,
          "pct": 34.8,
          "win": 4.8,
          "top5": 22.0
        },
        {
          "en": "Bangalore",
          "n": 420,
          "pct": 33.5,
          "win": 6.0,
          "top5": 23.8
        },
        {
          "en": "Rampart",
          "n": 365,
          "pct": 29.1,
          "win": 4.4,
          "top5": 25.5
        },
        {
          "en": "Alter",
          "n": 281,
          "pct": 22.4,
          "win": 5.3,
          "top5": 23.5
        },
        {
          "en": "Newcastle",
          "n": 279,
          "pct": 22.2,
          "win": 4.7,
          "top5": 25.8
        },
        {
          "en": "Wattson",
          "n": 277,
          "pct": 22.1,
          "win": 5.1,
          "top5": 26.7
        },
        {
          "en": "Caustic",
          "n": 264,
          "pct": 21.1,
          "win": 4.5,
          "top5": 25.8
        },
        {
          "en": "Mad Maggie",
          "n": 239,
          "pct": 19.1,
          "win": 5.9,
          "top5": 19.7
        },
        {
          "en": "Wraith",
          "n": 227,
          "pct": 18.1,
          "win": 6.2,
          "top5": 28.2
        },
        {
          "en": "Catalyst",
          "n": 120,
          "pct": 9.6,
          "win": 5.8,
          "top5": 32.5
        },
        {
          "en": "Seer",
          "n": 119,
          "pct": 9.5,
          "win": 7.6,
          "top5": 24.4
        }
      ],
      "combos": [
        {
          "heroes": [
            "Caustic",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 135,
          "pct": 10.8
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Valkyrie"
          ],
          "n": 72,
          "pct": 5.7
        },
        {
          "heroes": [
            "Bangalore",
            "Rampart",
            "Valkyrie"
          ],
          "n": 62,
          "pct": 4.9
        },
        {
          "heroes": [
            "Bangalore",
            "Valkyrie",
            "Wattson"
          ],
          "n": 56,
          "pct": 4.5
        },
        {
          "heroes": [
            "Crypto",
            "Rampart",
            "Wraith"
          ],
          "n": 54,
          "pct": 4.3
        },
        {
          "heroes": [
            "Crypto",
            "Wattson",
            "Wraith"
          ],
          "n": 53,
          "pct": 4.2
        },
        {
          "heroes": [
            "Alter",
            "Bangalore",
            "Crypto"
          ],
          "n": 51,
          "pct": 4.1
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Rampart"
          ],
          "n": 41,
          "pct": 3.3
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Mad Maggie"
          ],
          "n": 39,
          "pct": 3.1
        },
        {
          "heroes": [
            "Alter",
            "Caustic",
            "Newcastle"
          ],
          "n": 36,
          "pct": 2.9
        }
      ],
      "legendTotal": 3762
    },
    {
      "id": "Y5-Split1-Pro-League-APAC_S",
      "year": "Y5",
      "split": "Y5-Split1",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y5-Split1/Pro-League/APAC_S",
      "teams": 30,
      "games": 61,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "Broken Moon",
          "n": 20
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "VK GAMING",
      "standings": [
        {
          "rank": 1,
          "team": "VK GAMING",
          "score": 467,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Gen.G Esports",
          "score": 443,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Kirisame",
          "score": 375,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "S8UL",
          "score": 361,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "AlQadsiahEsports",
          "score": 300,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Five Fears",
          "score": 299,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "DeepCrossGaming",
          "score": 285,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Wolves Esports",
          "score": 274,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "RENDANG",
          "score": 267,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "DreamFire",
          "score": 263,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Fuse",
          "n": 396,
          "pct": 34.2,
          "win": 6.3,
          "top5": 24.7
        },
        {
          "en": "Wattson",
          "n": 310,
          "pct": 26.8,
          "win": 4.9,
          "top5": 33.8
        },
        {
          "en": "Ash",
          "n": 292,
          "pct": 25.2,
          "win": 6.8,
          "top5": 25.7
        },
        {
          "en": "Ballistic",
          "n": 269,
          "pct": 23.2,
          "win": 4.5,
          "top5": 24.9
        },
        {
          "en": "Catalyst",
          "n": 267,
          "pct": 23.1,
          "win": 4.5,
          "top5": 26.2
        },
        {
          "en": "Crypto",
          "n": 255,
          "pct": 22.0,
          "win": 6.3,
          "top5": 24.3
        },
        {
          "en": "Alter",
          "n": 254,
          "pct": 21.9,
          "win": 3.9,
          "top5": 26.4
        },
        {
          "en": "Newcastle",
          "n": 251,
          "pct": 21.7,
          "win": 5.6,
          "top5": 29.1
        },
        {
          "en": "Sparrow",
          "n": 238,
          "pct": 20.6,
          "win": 4.6,
          "top5": 26.5
        },
        {
          "en": "Wraith",
          "n": 225,
          "pct": 19.4,
          "win": 5.3,
          "top5": 27.6
        },
        {
          "en": "Pathfinder",
          "n": 209,
          "pct": 18.0,
          "win": 5.3,
          "top5": 24.4
        },
        {
          "en": "Bangalore",
          "n": 176,
          "pct": 15.2,
          "win": 7.4,
          "top5": 26.1
        }
      ],
      "combos": [
        {
          "heroes": [
            "Ash",
            "Crypto",
            "Fuse"
          ],
          "n": 45,
          "pct": 3.9
        },
        {
          "heroes": [
            "Alter",
            "Fuse",
            "Sparrow"
          ],
          "n": 31,
          "pct": 2.7
        },
        {
          "heroes": [
            "Ash",
            "Catalyst",
            "Newcastle"
          ],
          "n": 29,
          "pct": 2.5
        },
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Fuse"
          ],
          "n": 28,
          "pct": 2.4
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 26,
          "pct": 2.2
        },
        {
          "heroes": [
            "Alter",
            "Sparrow",
            "Wattson"
          ],
          "n": 24,
          "pct": 2.1
        },
        {
          "heroes": [
            "Alter",
            "Newcastle",
            "Wattson"
          ],
          "n": 24,
          "pct": 2.1
        },
        {
          "heroes": [
            "Catalyst",
            "Newcastle",
            "Wraith"
          ],
          "n": 23,
          "pct": 2.0
        },
        {
          "heroes": [
            "Ash",
            "Fuse",
            "Sparrow"
          ],
          "n": 22,
          "pct": 1.9
        },
        {
          "heroes": [
            "Alter",
            "Catalyst",
            "Newcastle"
          ],
          "n": 19,
          "pct": 1.6
        }
      ],
      "legendTotal": 3475
    },
    {
      "id": "Y5-Split1-Pro-League-APAC_N",
      "year": "Y5",
      "split": "Y5-Split1",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y5-Split1/Pro-League/APAC_N",
      "teams": 29,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Broken Moon",
          "n": 21
        },
        {
          "en": "Storm Point",
          "n": 21
        },
        {
          "en": "E-District",
          "n": 20
        }
      ],
      "champion": "",
      "pointsLeader": "REIGNITE",
      "standings": [
        {
          "rank": 1,
          "team": "REIGNITE",
          "score": 453,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "NOEZ FOXX",
          "score": 415,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "ENTER FORCE.36",
          "score": 354,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "SBI e-Sports",
          "score": 345,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "UNLIMIT",
          "score": 324,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "FNATIC",
          "score": 323,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "KINOTROPE gaming",
          "score": 298,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Arneb",
          "score": 269,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "CrazyRaccoon",
          "score": 259,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "CatJAM",
          "score": 249,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Wraith",
          "n": 400,
          "pct": 33.0,
          "win": 4.6,
          "top5": 29.9
        },
        {
          "en": "Wattson",
          "n": 377,
          "pct": 31.1,
          "win": 3.0,
          "top5": 30.1
        },
        {
          "en": "Ballistic",
          "n": 350,
          "pct": 28.9,
          "win": 5.8,
          "top5": 23.8
        },
        {
          "en": "Newcastle",
          "n": 325,
          "pct": 26.8,
          "win": 4.6,
          "top5": 31.1
        },
        {
          "en": "Catalyst",
          "n": 310,
          "pct": 25.6,
          "win": 4.9,
          "top5": 27.1
        },
        {
          "en": "Ash",
          "n": 293,
          "pct": 24.1,
          "win": 5.7,
          "top5": 21.3
        },
        {
          "en": "Alter",
          "n": 271,
          "pct": 22.3,
          "win": 4.5,
          "top5": 24.7
        },
        {
          "en": "Pathfinder",
          "n": 221,
          "pct": 18.2,
          "win": 5.0,
          "top5": 21.5
        },
        {
          "en": "Crypto",
          "n": 196,
          "pct": 16.1,
          "win": 6.5,
          "top5": 23.4
        },
        {
          "en": "Bangalore",
          "n": 177,
          "pct": 14.6,
          "win": 3.4,
          "top5": 23.7
        },
        {
          "en": "Fuse",
          "n": 160,
          "pct": 13.2,
          "win": 4.5,
          "top5": 18.7
        },
        {
          "en": "Mad Maggie",
          "n": 148,
          "pct": 12.2,
          "win": 6.1,
          "top5": 22.3
        }
      ],
      "combos": [
        {
          "heroes": [
            "Catalyst",
            "Newcastle",
            "Wraith"
          ],
          "n": 62,
          "pct": 5.1
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 42,
          "pct": 3.5
        },
        {
          "heroes": [
            "Bangalore",
            "Wattson",
            "Wraith"
          ],
          "n": 39,
          "pct": 3.2
        },
        {
          "heroes": [
            "Crypto",
            "Wattson",
            "Wraith"
          ],
          "n": 38,
          "pct": 3.1
        },
        {
          "heroes": [
            "Alter",
            "Catalyst",
            "Newcastle"
          ],
          "n": 31,
          "pct": 2.5
        },
        {
          "heroes": [
            "Alter",
            "Ballistic",
            "Catalyst"
          ],
          "n": 30,
          "pct": 2.5
        },
        {
          "heroes": [
            "Ash",
            "Ballistic",
            "Crypto"
          ],
          "n": 29,
          "pct": 2.4
        },
        {
          "heroes": [
            "Mad Maggie",
            "Wattson",
            "Wraith"
          ],
          "n": 29,
          "pct": 2.4
        },
        {
          "heroes": [
            "Catalyst",
            "Newcastle",
            "Pathfinder"
          ],
          "n": 24,
          "pct": 2.0
        },
        {
          "heroes": [
            "Ballistic",
            "Wattson",
            "Wraith"
          ],
          "n": 20,
          "pct": 1.6
        }
      ],
      "legendTotal": 3640
    },
    {
      "id": "Y5-Split1-EWC-Global",
      "year": "Y5",
      "split": "Y5-Split1",
      "league": "EWC",
      "region": "Global",
      "path": "Y5-Split1/EWC/Global",
      "teams": 40,
      "games": 39,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "E-District",
          "n": 11
        },
        {
          "en": "Storm Point",
          "n": 10
        },
        {
          "en": "World's Edge",
          "n": 9
        },
        {
          "en": "Broken Moon",
          "n": 9
        }
      ],
      "champion": "",
      "pointsLeader": "Gen.G Esports",
      "standings": [
        {
          "rank": 1,
          "team": "Gen.G Esports",
          "score": 206,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Team Nemesis",
          "score": 188,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "NinjasInPyjamas",
          "score": 182,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Alliance",
          "score": 179,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "ENTER FORCE.36",
          "score": 175,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Team Liquid",
          "score": 172,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "Team Falcons",
          "score": 169,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "ROC Esports",
          "score": 169,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "VK GAMING",
          "score": 161,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Sentinels",
          "score": 159,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Crypto",
          "n": 257,
          "pct": 33.0,
          "win": 5.8,
          "top5": 26.1
        },
        {
          "en": "Fuse",
          "n": 224,
          "pct": 28.7,
          "win": 5.4,
          "top5": 26.3
        },
        {
          "en": "Sparrow",
          "n": 209,
          "pct": 26.8,
          "win": 3.8,
          "top5": 21.1
        },
        {
          "en": "Wraith",
          "n": 203,
          "pct": 26.0,
          "win": 4.9,
          "top5": 26.6
        },
        {
          "en": "Ballistic",
          "n": 198,
          "pct": 25.4,
          "win": 4.5,
          "top5": 22.2
        },
        {
          "en": "Newcastle",
          "n": 168,
          "pct": 21.5,
          "win": 6.0,
          "top5": 30.4
        },
        {
          "en": "Pathfinder",
          "n": 162,
          "pct": 20.8,
          "win": 3.7,
          "top5": 22.8
        },
        {
          "en": "Wattson",
          "n": 142,
          "pct": 18.2,
          "win": 4.9,
          "top5": 26.8
        },
        {
          "en": "Bangalore",
          "n": 130,
          "pct": 16.7,
          "win": 4.6,
          "top5": 18.5
        },
        {
          "en": "Catalyst",
          "n": 128,
          "pct": 16.4,
          "win": 3.9,
          "top5": 25.8
        },
        {
          "en": "Rampart",
          "n": 114,
          "pct": 14.6,
          "win": 7.0,
          "top5": 29.8
        },
        {
          "en": "Ash",
          "n": 94,
          "pct": 12.1,
          "win": 4.3,
          "top5": 22.3
        }
      ],
      "combos": [
        {
          "heroes": [
            "Alter",
            "Crypto",
            "Wattson"
          ],
          "n": 34,
          "pct": 4.4
        },
        {
          "heroes": [
            "Ballistic",
            "Fuse",
            "Sparrow"
          ],
          "n": 28,
          "pct": 3.6
        },
        {
          "heroes": [
            "Ash",
            "Crypto",
            "Wattson"
          ],
          "n": 26,
          "pct": 3.3
        },
        {
          "heroes": [
            "Ballistic",
            "Crypto",
            "Fuse"
          ],
          "n": 25,
          "pct": 3.2
        },
        {
          "heroes": [
            "Ash",
            "Crypto",
            "Fuse"
          ],
          "n": 23,
          "pct": 3.0
        },
        {
          "heroes": [
            "Ballistic",
            "Pathfinder",
            "Sparrow"
          ],
          "n": 21,
          "pct": 2.7
        },
        {
          "heroes": [
            "Catalyst",
            "Newcastle",
            "Wraith"
          ],
          "n": 20,
          "pct": 2.6
        },
        {
          "heroes": [
            "Bangalore",
            "Fuse",
            "Pathfinder"
          ],
          "n": 19,
          "pct": 2.4
        },
        {
          "heroes": [
            "Newcastle",
            "Rampart",
            "Wraith"
          ],
          "n": 18,
          "pct": 2.3
        },
        {
          "heroes": [
            "Newcastle",
            "Wattson",
            "Wraith"
          ],
          "n": 16,
          "pct": 2.0
        }
      ],
      "legendTotal": 2340
    },
    {
      "id": "Y4-Split2-Pro-League-APAC_S",
      "year": "Y4",
      "split": "Y4-Split2",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y4-Split2/Pro-League/APAC_S",
      "teams": 37,
      "games": 60,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 31
        },
        {
          "en": "World's Edge",
          "n": 29
        }
      ],
      "champion": "",
      "pointsLeader": "Legends Gaming",
      "standings": [
        {
          "rank": 1,
          "team": "Legends Gaming",
          "score": 412,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "MKERS",
          "score": 358,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "XNY",
          "score": 320,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "SWQ",
          "score": 311,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "VK GAMING",
          "score": 308,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "BearClaw Gaming",
          "score": 298,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "DreamFire",
          "score": 275,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Weibo gaming",
          "score": 260,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "WeiBo Gaming",
          "score": 253,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "RENDANG",
          "score": 229,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1123,
          "pct": 95.8,
          "win": 4.9,
          "top5": 25.0
        },
        {
          "en": "Bloodhound",
          "n": 1041,
          "pct": 88.8,
          "win": 4.9,
          "top5": 25.3
        },
        {
          "en": "Wattson",
          "n": 512,
          "pct": 43.7,
          "win": 6.1,
          "top5": 30.5
        },
        {
          "en": "Fuse",
          "n": 313,
          "pct": 26.7,
          "win": 6.4,
          "top5": 23.3
        },
        {
          "en": "Catalyst",
          "n": 228,
          "pct": 19.4,
          "win": 2.2,
          "top5": 21.5
        },
        {
          "en": "Crypto",
          "n": 55,
          "pct": 4.7,
          "win": 10.9,
          "top5": 30.9
        },
        {
          "en": "Horizon",
          "n": 50,
          "pct": 4.3,
          "win": 4.0,
          "top5": 10.0
        },
        {
          "en": "Pathfinder",
          "n": 40,
          "pct": 3.4,
          "win": 2.5,
          "top5": 12.5
        },
        {
          "en": "Caustic",
          "n": 36,
          "pct": 3.1,
          "win": 5.6,
          "top5": 27.8
        },
        {
          "en": "Valkyrie",
          "n": 34,
          "pct": 2.9,
          "win": 5.9,
          "top5": 29.4
        },
        {
          "en": "Seer",
          "n": 21,
          "pct": 1.8,
          "win": 0.0,
          "top5": 28.6
        },
        {
          "en": "Lifeline",
          "n": 18,
          "pct": 1.5,
          "win": 5.6,
          "top5": 11.1
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Wattson"
          ],
          "n": 445,
          "pct": 38.0
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Fuse"
          ],
          "n": 270,
          "pct": 23.0
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Catalyst"
          ],
          "n": 228,
          "pct": 19.4
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 36,
          "pct": 3.1
        },
        {
          "heroes": [
            "Bloodhound",
            "Caustic",
            "Valkyrie"
          ],
          "n": 28,
          "pct": 2.4
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Wattson"
          ],
          "n": 25,
          "pct": 2.1
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Fuse"
          ],
          "n": 17,
          "pct": 1.4
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound"
          ],
          "n": 12,
          "pct": 1.0
        },
        {
          "heroes": [
            "Bangalore",
            "Pathfinder",
            "Wattson"
          ],
          "n": 12,
          "pct": 1.0
        },
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Wattson"
          ],
          "n": 11,
          "pct": 0.9
        }
      ],
      "legendTotal": 3517
    },
    {
      "id": "Y4-Split2-Pro-League-APAC_N",
      "year": "Y4",
      "split": "Y4-Split2",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y4-Split2/Pro-League/APAC_N",
      "teams": 30,
      "games": 67,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 34
        },
        {
          "en": "World's Edge",
          "n": 33
        }
      ],
      "champion": "",
      "pointsLeader": "FNATIC",
      "standings": [
        {
          "rank": 1,
          "team": "FNATIC",
          "score": 495,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "NOEZ FOXX",
          "score": 373,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "NewJ",
          "score": 347,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "HAO",
          "score": 332,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "ENTER FORCE.36",
          "score": 330,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "FENNEL",
          "score": 323,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "NORTHEPTION",
          "score": 315,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "GHS Professional",
          "score": 313,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "RIDDLEORDER ZERO",
          "score": 298,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "DOSUKOI Impact",
          "score": 275,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1182,
          "pct": 89.5,
          "win": 4.9,
          "top5": 23.9
        },
        {
          "en": "Bloodhound",
          "n": 893,
          "pct": 67.7,
          "win": 4.8,
          "top5": 24.0
        },
        {
          "en": "Wattson",
          "n": 554,
          "pct": 42.0,
          "win": 5.1,
          "top5": 28.5
        },
        {
          "en": "Crypto",
          "n": 344,
          "pct": 26.1,
          "win": 5.2,
          "top5": 28.2
        },
        {
          "en": "Fuse",
          "n": 300,
          "pct": 22.7,
          "win": 6.7,
          "top5": 21.7
        },
        {
          "en": "Catalyst",
          "n": 260,
          "pct": 19.7,
          "win": 2.7,
          "top5": 23.5
        },
        {
          "en": "Pathfinder",
          "n": 126,
          "pct": 9.6,
          "win": 7.1,
          "top5": 25.4
        },
        {
          "en": "Valkyrie",
          "n": 125,
          "pct": 9.5,
          "win": 4.0,
          "top5": 35.2
        },
        {
          "en": "Horizon",
          "n": 63,
          "pct": 4.8,
          "win": 4.8,
          "top5": 17.5
        },
        {
          "en": "Gibraltar",
          "n": 58,
          "pct": 4.4,
          "win": 6.9,
          "top5": 24.1
        },
        {
          "en": "Caustic",
          "n": 18,
          "pct": 1.4,
          "win": 5.6,
          "top5": 16.7
        },
        {
          "en": "Revenant",
          "n": 12,
          "pct": 0.9,
          "win": 8.3,
          "top5": 25.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Wattson"
          ],
          "n": 337,
          "pct": 25.5
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Fuse"
          ],
          "n": 246,
          "pct": 18.6
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Catalyst"
          ],
          "n": 212,
          "pct": 16.1
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Wattson"
          ],
          "n": 114,
          "pct": 8.6
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 88,
          "pct": 6.7
        },
        {
          "heroes": [
            "Bangalore",
            "Gibraltar",
            "Pathfinder"
          ],
          "n": 50,
          "pct": 3.8
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Fuse"
          ],
          "n": 41,
          "pct": 3.1
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 39,
          "pct": 3.0
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Pathfinder"
          ],
          "n": 28,
          "pct": 2.1
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Horizon"
          ],
          "n": 22,
          "pct": 1.7
        }
      ],
      "legendTotal": 3960
    },
    {
      "id": "Y4-Split2-ALGS-Playoffs-Global",
      "year": "Y4",
      "split": "Y4-Split2",
      "league": "ALGS-Playoffs",
      "region": "Global",
      "path": "Y4-Split2/ALGS-Playoffs/Global",
      "teams": 40,
      "games": 64,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 33
        },
        {
          "en": "Storm Point",
          "n": 31
        }
      ],
      "champion": "",
      "pointsLeader": "Not Moist",
      "standings": [
        {
          "rank": 1,
          "team": "Not Moist",
          "score": 326,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "GaiminGladiators",
          "score": 312,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Alliance",
          "score": 288,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "TSM",
          "score": 279,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "GUILD",
          "score": 273,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Complexity",
          "score": 253,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "Cloud9",
          "score": 252,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "FNATIC",
          "score": 251,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "SSG",
          "score": 245,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "BLEED Esports",
          "score": 243,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1012,
          "pct": 79.1,
          "win": 5.2,
          "top5": 25.4
        },
        {
          "en": "Crypto",
          "n": 915,
          "pct": 71.5,
          "win": 4.2,
          "top5": 22.7
        },
        {
          "en": "Wattson",
          "n": 651,
          "pct": 50.9,
          "win": 4.2,
          "top5": 24.8
        },
        {
          "en": "Newcastle",
          "n": 498,
          "pct": 38.9,
          "win": 6.5,
          "top5": 30.3
        },
        {
          "en": "Pathfinder",
          "n": 249,
          "pct": 19.4,
          "win": 4.5,
          "top5": 22.0
        },
        {
          "en": "Catalyst",
          "n": 230,
          "pct": 18.0,
          "win": 7.5,
          "top5": 30.7
        },
        {
          "en": "Fuse",
          "n": 178,
          "pct": 13.9,
          "win": 5.7,
          "top5": 24.4
        },
        {
          "en": "Wraith",
          "n": 30,
          "pct": 2.3,
          "win": 3.3,
          "top5": 26.7
        },
        {
          "en": "Valkyrie",
          "n": 29,
          "pct": 2.3,
          "win": 0.0,
          "top5": 14.3
        },
        {
          "en": "Revenant",
          "n": 24,
          "pct": 1.9,
          "win": 4.3,
          "top5": 8.7
        },
        {
          "en": "Mad Maggie",
          "n": 12,
          "pct": 0.9,
          "win": 0.0,
          "top5": 0.0
        },
        {
          "en": "Caustic",
          "n": 6,
          "pct": 0.5,
          "win": 0.0,
          "top5": 0.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Wattson"
          ],
          "n": 470,
          "pct": 36.7
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Newcastle"
          ],
          "n": 201,
          "pct": 15.7
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Fuse"
          ],
          "n": 170,
          "pct": 13.3
        },
        {
          "heroes": [
            "Crypto",
            "Newcastle",
            "Pathfinder"
          ],
          "n": 109,
          "pct": 8.5
        },
        {
          "heroes": [
            "Bangalore",
            "Newcastle",
            "Wattson"
          ],
          "n": 66,
          "pct": 5.2
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Pathfinder"
          ],
          "n": 47,
          "pct": 3.7
        },
        {
          "heroes": [
            "Newcastle",
            "Pathfinder",
            "Wattson"
          ],
          "n": 35,
          "pct": 2.7
        },
        {
          "heroes": [
            "Crypto",
            "Newcastle",
            "Wattson"
          ],
          "n": 26,
          "pct": 2.0
        },
        {
          "heroes": [
            "Crypto",
            "Pathfinder",
            "Revenant"
          ],
          "n": 21,
          "pct": 1.6
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Crypto"
          ],
          "n": 20,
          "pct": 1.6
        }
      ],
      "legendTotal": 3840
    },
    {
      "id": "Y4-Split2-ALGS-Championships-Global",
      "year": "Y4",
      "split": "Y4-Split2",
      "league": "ALGS-Championships",
      "region": "Global",
      "path": "Y4-Split2/ALGS-Championships/Global",
      "teams": 40,
      "games": 69,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 23
        },
        {
          "en": "Storm Point",
          "n": 23
        },
        {
          "en": "E-District",
          "n": 23
        }
      ],
      "champion": "",
      "pointsLeader": "Team Falcons",
      "standings": [
        {
          "rank": 1,
          "team": "Team Falcons",
          "score": 348,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Alliance",
          "score": 318,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Aurora",
          "score": 293,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "FNATIC",
          "score": 275,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "ShopifyRebellion",
          "score": 274,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Noctem",
          "score": 265,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "VK GAMING",
          "score": 260,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Virtus.pro",
          "score": 259,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "GoNext",
          "score": 254,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Complexity",
          "score": 247,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Gibraltar",
          "n": 1377,
          "pct": 99.8,
          "win": 5.0,
          "top5": 25.1
        },
        {
          "en": "Newcastle",
          "n": 1322,
          "pct": 95.8,
          "win": 5.1,
          "top5": 25.3
        },
        {
          "en": "Rampart",
          "n": 958,
          "pct": 69.4,
          "win": 4.6,
          "top5": 23.5
        },
        {
          "en": "Catalyst",
          "n": 226,
          "pct": 16.4,
          "win": 6.6,
          "top5": 24.8
        },
        {
          "en": "Valkyrie",
          "n": 142,
          "pct": 10.3,
          "win": 4.2,
          "top5": 33.8
        },
        {
          "en": "Loba",
          "n": 56,
          "pct": 4.1,
          "win": 1.8,
          "top5": 19.6
        },
        {
          "en": "Mirage",
          "n": 37,
          "pct": 2.7,
          "win": 10.8,
          "top5": 37.8
        },
        {
          "en": "Mad Maggie",
          "n": 7,
          "pct": 0.5,
          "win": 0.0,
          "top5": 0.0
        },
        {
          "en": "Caustic",
          "n": 6,
          "pct": 0.4,
          "win": 0.0,
          "top5": 16.7
        },
        {
          "en": "Bangalore",
          "n": 4,
          "pct": 0.3,
          "win": 0.0,
          "top5": 0.0
        },
        {
          "en": "Wattson",
          "n": 2,
          "pct": 0.1,
          "win": 0.0,
          "top5": 0.0
        },
        {
          "en": "Horizon",
          "n": 2,
          "pct": 0.1,
          "win": 0.0,
          "top5": 0.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Rampart"
          ],
          "n": 906,
          "pct": 65.7
        },
        {
          "heroes": [
            "Catalyst",
            "Gibraltar",
            "Newcastle"
          ],
          "n": 214,
          "pct": 15.5
        },
        {
          "heroes": [
            "Gibraltar",
            "Newcastle",
            "Valkyrie"
          ],
          "n": 142,
          "pct": 10.3
        },
        {
          "heroes": [
            "Gibraltar",
            "Loba",
            "Rampart"
          ],
          "n": 45,
          "pct": 3.3
        },
        {
          "heroes": [
            "Gibraltar",
            "Mirage",
            "Newcastle"
          ],
          "n": 37,
          "pct": 2.7
        },
        {
          "heroes": [
            "Gibraltar",
            "Mad Maggie",
            "Newcastle"
          ],
          "n": 7,
          "pct": 0.5
        },
        {
          "heroes": [
            "Caustic",
            "Gibraltar",
            "Newcastle"
          ],
          "n": 6,
          "pct": 0.4
        },
        {
          "heroes": [
            "Catalyst",
            "Gibraltar",
            "Loba"
          ],
          "n": 6,
          "pct": 0.4
        },
        {
          "heroes": [
            "Catalyst",
            "Gibraltar",
            "Rampart"
          ],
          "n": 5,
          "pct": 0.4
        },
        {
          "heroes": [
            "Gibraltar",
            "Loba",
            "Newcastle"
          ],
          "n": 3,
          "pct": 0.2
        }
      ],
      "legendTotal": 4140
    },
    {
      "id": "Y4-Split1-Pro-League-APAC_S",
      "year": "Y4",
      "split": "Y4-Split1",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y4-Split1/Pro-League/APAC_S",
      "teams": 34,
      "games": 64,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 33
        },
        {
          "en": "Storm Point",
          "n": 31
        }
      ],
      "champion": "",
      "pointsLeader": "wonton dumpling",
      "standings": [
        {
          "rank": 1,
          "team": "wonton dumpling",
          "score": 432,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Legends Gaming",
          "score": 392,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Serenity",
          "score": 324,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "MDY-White",
          "score": 312,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "Boogie Boarders",
          "score": 306,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "BearClaw Gaming",
          "score": 280,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "XNY",
          "score": 278,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Akuma",
          "score": 276,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "DreamFire",
          "score": 275,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "AlQadsiahEsports",
          "score": 271,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1077,
          "pct": 85.0,
          "win": 5.6,
          "top5": 26.3
        },
        {
          "en": "Bloodhound",
          "n": 541,
          "pct": 42.7,
          "win": 5.4,
          "top5": 24.4
        },
        {
          "en": "Wattson",
          "n": 409,
          "pct": 32.3,
          "win": 5.1,
          "top5": 30.8
        },
        {
          "en": "Catalyst",
          "n": 383,
          "pct": 30.2,
          "win": 5.0,
          "top5": 26.1
        },
        {
          "en": "Conduit",
          "n": 341,
          "pct": 26.9,
          "win": 5.9,
          "top5": 21.7
        },
        {
          "en": "Caustic",
          "n": 307,
          "pct": 24.2,
          "win": 5.5,
          "top5": 26.7
        },
        {
          "en": "Horizon",
          "n": 273,
          "pct": 21.5,
          "win": 5.5,
          "top5": 19.8
        },
        {
          "en": "Crypto",
          "n": 181,
          "pct": 14.3,
          "win": 3.3,
          "top5": 27.1
        },
        {
          "en": "Valkyrie",
          "n": 178,
          "pct": 14.0,
          "win": 2.2,
          "top5": 21.3
        },
        {
          "en": "Wraith",
          "n": 39,
          "pct": 3.1,
          "win": 2.6,
          "top5": 33.3
        },
        {
          "en": "Revenant",
          "n": 23,
          "pct": 1.8,
          "win": 4.3,
          "top5": 8.7
        },
        {
          "en": "Mad Maggie",
          "n": 13,
          "pct": 1.0,
          "win": 0.0,
          "top5": 15.4
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Caustic"
          ],
          "n": 222,
          "pct": 17.5
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Conduit"
          ],
          "n": 166,
          "pct": 13.1
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Wattson"
          ],
          "n": 106,
          "pct": 8.4
        },
        {
          "heroes": [
            "Bangalore",
            "Conduit",
            "Horizon"
          ],
          "n": 91,
          "pct": 7.2
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 78,
          "pct": 6.2
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Wattson"
          ],
          "n": 76,
          "pct": 6.0
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Catalyst"
          ],
          "n": 65,
          "pct": 5.1
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 59,
          "pct": 4.7
        },
        {
          "heroes": [
            "Bangalore",
            "Caustic",
            "Crypto"
          ],
          "n": 50,
          "pct": 3.9
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Horizon"
          ],
          "n": 49,
          "pct": 3.9
        }
      ],
      "legendTotal": 3803
    },
    {
      "id": "Y4-Split1-Pro-League-APAC_N",
      "year": "Y4",
      "split": "Y4-Split1",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y4-Split1/Pro-League/APAC_N",
      "teams": 31,
      "games": 60,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 31
        },
        {
          "en": "Storm Point",
          "n": 29
        }
      ],
      "champion": "",
      "pointsLeader": "FNATIC",
      "standings": [
        {
          "rank": 1,
          "team": "FNATIC",
          "score": 432,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "REJECT WINNITY",
          "score": 359,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "KINOTROPE gaming",
          "score": 356,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "papiko",
          "score": 299,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "RIDDLEORDER ZERO",
          "score": 292,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "CRAZY RACCOON",
          "score": 276,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "HAO",
          "score": 273,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "NORTHEPTION",
          "score": 269,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "PULVEREX",
          "score": 248,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "FENNEL",
          "score": 247,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1031,
          "pct": 86.1,
          "win": 4.7,
          "top5": 25.0
        },
        {
          "en": "Catalyst",
          "n": 450,
          "pct": 37.6,
          "win": 5.1,
          "top5": 28.2
        },
        {
          "en": "Bloodhound",
          "n": 426,
          "pct": 35.6,
          "win": 5.2,
          "top5": 21.4
        },
        {
          "en": "Conduit",
          "n": 311,
          "pct": 26.0,
          "win": 3.5,
          "top5": 25.7
        },
        {
          "en": "Wattson",
          "n": 292,
          "pct": 24.4,
          "win": 5.8,
          "top5": 33.2
        },
        {
          "en": "Valkyrie",
          "n": 255,
          "pct": 21.3,
          "win": 3.1,
          "top5": 26.7
        },
        {
          "en": "Horizon",
          "n": 224,
          "pct": 18.7,
          "win": 6.7,
          "top5": 21.4
        },
        {
          "en": "Crypto",
          "n": 206,
          "pct": 17.2,
          "win": 5.8,
          "top5": 26.2
        },
        {
          "en": "Caustic",
          "n": 137,
          "pct": 11.4,
          "win": 3.6,
          "top5": 21.2
        },
        {
          "en": "Gibraltar",
          "n": 95,
          "pct": 7.9,
          "win": 6.3,
          "top5": 18.9
        },
        {
          "en": "Rampart",
          "n": 48,
          "pct": 4.0,
          "win": 2.1,
          "top5": 4.2
        },
        {
          "en": "Newcastle",
          "n": 34,
          "pct": 2.8,
          "win": 2.9,
          "top5": 20.6
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Conduit"
          ],
          "n": 196,
          "pct": 16.4
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 114,
          "pct": 9.5
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Catalyst"
          ],
          "n": 78,
          "pct": 6.5
        },
        {
          "heroes": [
            "Bangalore",
            "Valkyrie",
            "Wattson"
          ],
          "n": 56,
          "pct": 4.7
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Conduit"
          ],
          "n": 52,
          "pct": 4.3
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Caustic"
          ],
          "n": 51,
          "pct": 4.3
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Horizon"
          ],
          "n": 43,
          "pct": 3.6
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Wattson"
          ],
          "n": 41,
          "pct": 3.4
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Valkyrie"
          ],
          "n": 40,
          "pct": 3.3
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Wattson"
          ],
          "n": 34,
          "pct": 2.8
        }
      ],
      "legendTotal": 3594
    },
    {
      "id": "Y4-Split1-EWC-Global",
      "year": "Y4",
      "split": "Y4-Split1",
      "league": "EWC",
      "region": "Global",
      "path": "Y4-Split1/EWC/Global",
      "teams": 40,
      "games": 43,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 19
        },
        {
          "en": "Storm Point",
          "n": 18
        },
        {
          "en": "Kings Canyon",
          "n": 2
        },
        {
          "en": "Olympus",
          "n": 2
        },
        {
          "en": "Broken Moon",
          "n": 2
        }
      ],
      "champion": "",
      "pointsLeader": "Team Falcons",
      "standings": [
        {
          "rank": 1,
          "team": "Team Falcons",
          "score": 245,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Guild Esports",
          "score": 223,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Alliance",
          "score": 210,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Team Liquid",
          "score": 186,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "Twisted Minds",
          "score": 178,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "SpaceStation Gaming",
          "score": 170,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "GaiminGladiators",
          "score": 168,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "Luminosity Gaming",
          "score": 168,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "EXO Clan",
          "score": 160,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Aurora",
          "score": 155,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 827,
          "pct": 97.7,
          "win": 5.1,
          "top5": 25.0
        },
        {
          "en": "Wattson",
          "n": 412,
          "pct": 48.7,
          "win": 4.4,
          "top5": 24.8
        },
        {
          "en": "Pathfinder",
          "n": 371,
          "pct": 43.8,
          "win": 4.0,
          "top5": 22.1
        },
        {
          "en": "Fuse",
          "n": 327,
          "pct": 38.6,
          "win": 5.8,
          "top5": 27.2
        },
        {
          "en": "Seer",
          "n": 288,
          "pct": 34.0,
          "win": 7.3,
          "top5": 32.3
        },
        {
          "en": "Crypto",
          "n": 106,
          "pct": 12.5,
          "win": 2.8,
          "top5": 17.9
        },
        {
          "en": "Bloodhound",
          "n": 90,
          "pct": 10.6,
          "win": 3.3,
          "top5": 16.7
        },
        {
          "en": "Lifeline",
          "n": 39,
          "pct": 4.6,
          "win": 7.7,
          "top5": 20.5
        },
        {
          "en": "Horizon",
          "n": 19,
          "pct": 2.2,
          "win": 0.0,
          "top5": 15.8
        },
        {
          "en": "Catalyst",
          "n": 13,
          "pct": 1.5,
          "win": 15.4,
          "top5": 61.5
        },
        {
          "en": "Wraith",
          "n": 9,
          "pct": 1.1,
          "win": 0.0,
          "top5": 11.1
        },
        {
          "en": "Conduit",
          "n": 8,
          "pct": 0.9,
          "win": 0.0,
          "top5": 25.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Pathfinder",
            "Wattson"
          ],
          "n": 154,
          "pct": 18.2
        },
        {
          "heroes": [
            "Bangalore",
            "Fuse",
            "Seer"
          ],
          "n": 134,
          "pct": 15.8
        },
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Wattson"
          ],
          "n": 116,
          "pct": 13.7
        },
        {
          "heroes": [
            "Bangalore",
            "Fuse",
            "Pathfinder"
          ],
          "n": 114,
          "pct": 13.5
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Wattson"
          ],
          "n": 84,
          "pct": 9.9
        },
        {
          "heroes": [
            "Bangalore",
            "Lifeline",
            "Pathfinder"
          ],
          "n": 38,
          "pct": 4.5
        },
        {
          "heroes": [
            "Bangalore",
            "Fuse",
            "Wattson"
          ],
          "n": 35,
          "pct": 4.1
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Pathfinder"
          ],
          "n": 33,
          "pct": 3.9
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Fuse"
          ],
          "n": 23,
          "pct": 2.7
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Wattson"
          ],
          "n": 21,
          "pct": 2.5
        }
      ],
      "legendTotal": 2520
    },
    {
      "id": "Y4-Split1-ALGS-Playoffs-Global",
      "year": "Y4",
      "split": "Y4-Split1",
      "league": "ALGS-Playoffs",
      "region": "Global",
      "path": "Y4-Split1/ALGS-Playoffs/Global",
      "teams": 40,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 31
        },
        {
          "en": "Storm Point",
          "n": 31
        }
      ],
      "champion": "",
      "pointsLeader": "DarkZero",
      "standings": [
        {
          "rank": 1,
          "team": "DarkZero",
          "score": 356,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "FNATIC",
          "score": 283,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "REJECT WINNITY",
          "score": 272,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Elev8 Gaming",
          "score": 264,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "Alliance",
          "score": 253,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Aurora",
          "score": 247,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "Disguised",
          "score": 240,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "SSG",
          "score": 231,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "Cloud9",
          "score": 228,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Legends Gaming",
          "score": 225,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1099,
          "pct": 88.6,
          "win": 5.0,
          "top5": 25.7
        },
        {
          "en": "Bloodhound",
          "n": 1079,
          "pct": 87.0,
          "win": 5.6,
          "top5": 25.8
        },
        {
          "en": "Caustic",
          "n": 717,
          "pct": 57.8,
          "win": 5.7,
          "top5": 28.5
        },
        {
          "en": "Horizon",
          "n": 207,
          "pct": 16.7,
          "win": 4.3,
          "top5": 15.9
        },
        {
          "en": "Wattson",
          "n": 152,
          "pct": 12.3,
          "win": 6.6,
          "top5": 23.7
        },
        {
          "en": "Conduit",
          "n": 108,
          "pct": 8.7,
          "win": 4.6,
          "top5": 15.7
        },
        {
          "en": "Lifeline",
          "n": 79,
          "pct": 6.4,
          "win": 2.5,
          "top5": 20.3
        },
        {
          "en": "Valkyrie",
          "n": 77,
          "pct": 6.2,
          "win": 0.0,
          "top5": 27.3
        },
        {
          "en": "Crypto",
          "n": 52,
          "pct": 4.2,
          "win": 1.9,
          "top5": 13.5
        },
        {
          "en": "Wraith",
          "n": 47,
          "pct": 3.8,
          "win": 6.4,
          "top5": 25.5
        },
        {
          "en": "Rampart",
          "n": 32,
          "pct": 2.6,
          "win": 0.0,
          "top5": 37.5
        },
        {
          "en": "Pathfinder",
          "n": 20,
          "pct": 1.6,
          "win": 0.0,
          "top5": 25.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Caustic"
          ],
          "n": 659,
          "pct": 53.1
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 116,
          "pct": 9.3
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Wattson"
          ],
          "n": 96,
          "pct": 7.7
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Lifeline"
          ],
          "n": 65,
          "pct": 5.2
        },
        {
          "heroes": [
            "Bloodhound",
            "Conduit",
            "Horizon"
          ],
          "n": 45,
          "pct": 3.6
        },
        {
          "heroes": [
            "Bangalore",
            "Conduit",
            "Horizon"
          ],
          "n": 33,
          "pct": 2.7
        },
        {
          "heroes": [
            "Bloodhound",
            "Caustic",
            "Wraith"
          ],
          "n": 33,
          "pct": 2.7
        },
        {
          "heroes": [
            "Bangalore",
            "Rampart",
            "Valkyrie"
          ],
          "n": 28,
          "pct": 2.3
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Conduit"
          ],
          "n": 21,
          "pct": 1.7
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 19,
          "pct": 1.5
        }
      ],
      "legendTotal": 3720
    },
    {
      "id": "Y3-Split2-Pro-League-APAC_S",
      "year": "Y3",
      "split": "Y3-Split2",
      "league": "Pro-League",
      "region": "APAC_S",
      "path": "Y3-Split2/Pro-League/APAC_S",
      "teams": 31,
      "games": 60,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 31
        },
        {
          "en": "World's Edge",
          "n": 29
        }
      ],
      "champion": "",
      "pointsLeader": "Moist Esports",
      "standings": [
        {
          "rank": 1,
          "team": "Moist Esports",
          "score": 472,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "ONIC",
          "score": 415,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "BLVKHVND",
          "score": 379,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "DreamFire",
          "score": 334,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "AGL",
          "score": 306,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "Tom Yum Kung",
          "score": 305,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "MDY-WHITE",
          "score": 274,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "DEWA UNITED",
          "score": 271,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "IronBloodGaming",
          "score": 238,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Buriram United",
          "score": 233,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Seer",
          "n": 1133,
          "pct": 96.6,
          "win": 5.2,
          "top5": 25.7
        },
        {
          "en": "Valkyrie",
          "n": 934,
          "pct": 79.7,
          "win": 4.8,
          "top5": 25.6
        },
        {
          "en": "Catalyst",
          "n": 792,
          "pct": 67.5,
          "win": 6.2,
          "top5": 28.8
        },
        {
          "en": "Bangalore",
          "n": 280,
          "pct": 23.9,
          "win": 4.6,
          "top5": 22.9
        },
        {
          "en": "Horizon",
          "n": 113,
          "pct": 9.6,
          "win": 1.8,
          "top5": 13.3
        },
        {
          "en": "Wattson",
          "n": 83,
          "pct": 7.1,
          "win": 2.4,
          "top5": 14.5
        },
        {
          "en": "Wraith",
          "n": 71,
          "pct": 6.0,
          "win": 5.6,
          "top5": 32.4
        },
        {
          "en": "Mad Maggie",
          "n": 66,
          "pct": 5.6,
          "win": 9.1,
          "top5": 28.8
        },
        {
          "en": "Crypto",
          "n": 13,
          "pct": 1.1,
          "win": 0.0,
          "top5": 7.7
        },
        {
          "en": "Loba",
          "n": 8,
          "pct": 0.7,
          "win": 0.0,
          "top5": 37.5
        },
        {
          "en": "Caustic",
          "n": 6,
          "pct": 0.5,
          "win": 0.0,
          "top5": 33.3
        },
        {
          "en": "Gibraltar",
          "n": 5,
          "pct": 0.4,
          "win": 0.0,
          "top5": 0.0
        }
      ],
      "combos": [
        {
          "heroes": [
            "Catalyst",
            "Seer",
            "Valkyrie"
          ],
          "n": 634,
          "pct": 54.1
        },
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Valkyrie"
          ],
          "n": 126,
          "pct": 10.7
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Seer"
          ],
          "n": 82,
          "pct": 7.0
        },
        {
          "heroes": [
            "Seer",
            "Valkyrie",
            "Wattson"
          ],
          "n": 62,
          "pct": 5.3
        },
        {
          "heroes": [
            "Horizon",
            "Seer",
            "Valkyrie"
          ],
          "n": 54,
          "pct": 4.6
        },
        {
          "heroes": [
            "Bangalore",
            "Horizon",
            "Seer"
          ],
          "n": 38,
          "pct": 3.2
        },
        {
          "heroes": [
            "Bangalore",
            "Mad Maggie",
            "Seer"
          ],
          "n": 25,
          "pct": 2.1
        },
        {
          "heroes": [
            "Catalyst",
            "Mad Maggie",
            "Seer"
          ],
          "n": 24,
          "pct": 2.0
        },
        {
          "heroes": [
            "Catalyst",
            "Seer",
            "Wraith"
          ],
          "n": 22,
          "pct": 1.9
        },
        {
          "heroes": [
            "Seer",
            "Valkyrie",
            "Wraith"
          ],
          "n": 12,
          "pct": 1.0
        }
      ],
      "legendTotal": 3518
    },
    {
      "id": "Y3-Split2-Pro-League-APAC_N",
      "year": "Y3",
      "split": "Y3-Split2",
      "league": "Pro-League",
      "region": "APAC_N",
      "path": "Y3-Split2/Pro-League/APAC_N",
      "teams": 31,
      "games": 58,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 29
        },
        {
          "en": "Storm Point",
          "n": 29
        }
      ],
      "champion": "",
      "pointsLeader": "FNATIC",
      "standings": [
        {
          "rank": 1,
          "team": "FNATIC",
          "score": 394,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "NORTHEPTION",
          "score": 362,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "GANBARE OTOUSAN",
          "score": 347,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Crazy Raccoon",
          "score": 330,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "fun123",
          "score": 327,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "NAKED",
          "score": 316,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "PULVEREX",
          "score": 314,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "RIDDLEORDER ZERO",
          "score": 308,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "FC destroy",
          "score": 251,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "REIGNITE",
          "score": 231,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Valkyrie",
          "n": 863,
          "pct": 74.5,
          "win": 5.1,
          "top5": 25.7
        },
        {
          "en": "Bangalore",
          "n": 748,
          "pct": 64.6,
          "win": 4.9,
          "top5": 23.4
        },
        {
          "en": "Seer",
          "n": 639,
          "pct": 55.2,
          "win": 4.5,
          "top5": 21.6
        },
        {
          "en": "Crypto",
          "n": 429,
          "pct": 37.0,
          "win": 4.7,
          "top5": 29.6
        },
        {
          "en": "Catalyst",
          "n": 283,
          "pct": 24.4,
          "win": 5.3,
          "top5": 26.9
        },
        {
          "en": "Wattson",
          "n": 195,
          "pct": 16.8,
          "win": 4.1,
          "top5": 30.3
        },
        {
          "en": "Horizon",
          "n": 132,
          "pct": 11.4,
          "win": 1.5,
          "top5": 13.6
        },
        {
          "en": "Gibraltar",
          "n": 58,
          "pct": 5.0,
          "win": 12.1,
          "top5": 32.8
        },
        {
          "en": "Wraith",
          "n": 39,
          "pct": 3.4,
          "win": 0.0,
          "top5": 28.2
        },
        {
          "en": "Rampart",
          "n": 33,
          "pct": 2.9,
          "win": 15.2,
          "top5": 36.4
        },
        {
          "en": "Newcastle",
          "n": 22,
          "pct": 1.9,
          "win": 18.2,
          "top5": 40.9
        },
        {
          "en": "Pathfinder",
          "n": 13,
          "pct": 1.1,
          "win": 0.0,
          "top5": 7.7
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Valkyrie"
          ],
          "n": 345,
          "pct": 29.8
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 113,
          "pct": 9.8
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Valkyrie"
          ],
          "n": 113,
          "pct": 9.8
        },
        {
          "heroes": [
            "Catalyst",
            "Seer",
            "Valkyrie"
          ],
          "n": 102,
          "pct": 8.8
        },
        {
          "heroes": [
            "Bangalore",
            "Horizon",
            "Seer"
          ],
          "n": 84,
          "pct": 7.2
        },
        {
          "heroes": [
            "Catalyst",
            "Crypto",
            "Valkyrie"
          ],
          "n": 75,
          "pct": 6.5
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Seer"
          ],
          "n": 66,
          "pct": 5.7
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Crypto"
          ],
          "n": 23,
          "pct": 2.0
        },
        {
          "heroes": [
            "Newcastle",
            "Valkyrie",
            "Wattson"
          ],
          "n": 22,
          "pct": 1.9
        },
        {
          "heroes": [
            "Bangalore",
            "Valkyrie",
            "Wattson"
          ],
          "n": 21,
          "pct": 1.8
        }
      ],
      "legendTotal": 3474
    },
    {
      "id": "Y3-Split2-ALGS-Playoffs-Global",
      "year": "Y3",
      "split": "Y3-Split2",
      "league": "ALGS-Playoffs",
      "region": "Global",
      "path": "Y3-Split2/ALGS-Playoffs/Global",
      "teams": 40,
      "games": 60,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "World's Edge",
          "n": 31
        },
        {
          "en": "Storm Point",
          "n": 29
        }
      ],
      "champion": "",
      "pointsLeader": "TSM",
      "standings": [
        {
          "rank": 1,
          "team": "TSM",
          "score": 326,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "Alliance",
          "score": 285,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "DarkZero",
          "score": 268,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "Oxygen Esports",
          "score": 246,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "XSET",
          "score": 241,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "FNATIC",
          "score": 224,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "OpTic Gaming",
          "score": 208,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "100 Thieves",
          "score": 208,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "FaZe",
          "score": 206,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "Fire Beavers",
          "score": 206,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Seer",
          "n": 737,
          "pct": 61.4,
          "win": 4.5,
          "top5": 24.3
        },
        {
          "en": "Bangalore",
          "n": 659,
          "pct": 54.9,
          "win": 4.2,
          "top5": 22.2
        },
        {
          "en": "Horizon",
          "n": 582,
          "pct": 48.5,
          "win": 4.1,
          "top5": 23.9
        },
        {
          "en": "Catalyst",
          "n": 523,
          "pct": 43.6,
          "win": 4.0,
          "top5": 27.5
        },
        {
          "en": "Valkyrie",
          "n": 249,
          "pct": 20.8,
          "win": 6.0,
          "top5": 27.7
        },
        {
          "en": "Crypto",
          "n": 183,
          "pct": 15.2,
          "win": 7.7,
          "top5": 27.9
        },
        {
          "en": "Wattson",
          "n": 167,
          "pct": 13.9,
          "win": 7.8,
          "top5": 25.7
        },
        {
          "en": "Rampart",
          "n": 94,
          "pct": 7.8,
          "win": 4.3,
          "top5": 28.7
        },
        {
          "en": "Caustic",
          "n": 94,
          "pct": 7.8,
          "win": 8.5,
          "top5": 22.3
        },
        {
          "en": "Loba",
          "n": 88,
          "pct": 7.3,
          "win": 5.7,
          "top5": 29.5
        },
        {
          "en": "Newcastle",
          "n": 83,
          "pct": 6.9,
          "win": 8.4,
          "top5": 27.7
        },
        {
          "en": "Bloodhound",
          "n": 52,
          "pct": 4.3,
          "win": 5.8,
          "top5": 21.2
        }
      ],
      "combos": [
        {
          "heroes": [
            "Catalyst",
            "Horizon",
            "Seer"
          ],
          "n": 195,
          "pct": 16.2
        },
        {
          "heroes": [
            "Bangalore",
            "Horizon",
            "Seer"
          ],
          "n": 180,
          "pct": 15.0
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Seer"
          ],
          "n": 149,
          "pct": 12.4
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Horizon"
          ],
          "n": 88,
          "pct": 7.3
        },
        {
          "heroes": [
            "Caustic",
            "Horizon",
            "Seer"
          ],
          "n": 52,
          "pct": 4.3
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 43,
          "pct": 3.6
        },
        {
          "heroes": [
            "Loba",
            "Rampart",
            "Valkyrie"
          ],
          "n": 36,
          "pct": 3.0
        },
        {
          "heroes": [
            "Newcastle",
            "Valkyrie",
            "Wattson"
          ],
          "n": 31,
          "pct": 2.6
        },
        {
          "heroes": [
            "Bangalore",
            "Crypto",
            "Valkyrie"
          ],
          "n": 31,
          "pct": 2.6
        },
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Valkyrie"
          ],
          "n": 30,
          "pct": 2.5
        }
      ],
      "legendTotal": 3600
    },
    {
      "id": "Y3-Split2-ALGS-Championships-Global",
      "year": "Y3",
      "split": "Y3-Split2",
      "league": "ALGS-Championships",
      "region": "Global",
      "path": "Y3-Split2/ALGS-Championships/Global",
      "teams": 40,
      "games": 68,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Storm Point",
          "n": 34
        },
        {
          "en": "World's Edge",
          "n": 34
        }
      ],
      "champion": "",
      "pointsLeader": "NRG",
      "standings": [
        {
          "rank": 1,
          "team": "NRG",
          "score": 296,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "BLVKHVND",
          "score": 290,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "OpTic Gaming",
          "score": 287,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "LG Chivas",
          "score": 261,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "Pioneers",
          "score": 260,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "TSM",
          "score": 256,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "DreamFire",
          "score": 254,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "DarkZero",
          "score": 254,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "Alliance",
          "score": 251,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "FaZe",
          "score": 236,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Bangalore",
          "n": 1067,
          "pct": 78.6,
          "win": 5.3,
          "top5": 25.6
        },
        {
          "en": "Catalyst",
          "n": 1053,
          "pct": 77.6,
          "win": 5.5,
          "top5": 26.1
        },
        {
          "en": "Horizon",
          "n": 916,
          "pct": 67.5,
          "win": 5.5,
          "top5": 25.2
        },
        {
          "en": "Bloodhound",
          "n": 298,
          "pct": 21.9,
          "win": 3.4,
          "top5": 18.5
        },
        {
          "en": "Valkyrie",
          "n": 175,
          "pct": 12.9,
          "win": 5.1,
          "top5": 25.1
        },
        {
          "en": "Wattson",
          "n": 138,
          "pct": 10.2,
          "win": 8.7,
          "top5": 33.3
        },
        {
          "en": "Fuse",
          "n": 112,
          "pct": 8.2,
          "win": 6.3,
          "top5": 23.2
        },
        {
          "en": "Crypto",
          "n": 109,
          "pct": 8.0,
          "win": 7.3,
          "top5": 28.4
        },
        {
          "en": "Gibraltar",
          "n": 69,
          "pct": 5.1,
          "win": 1.4,
          "top5": 17.4
        },
        {
          "en": "Newcastle",
          "n": 57,
          "pct": 4.2,
          "win": 7.0,
          "top5": 22.8
        },
        {
          "en": "Loba",
          "n": 21,
          "pct": 1.6,
          "win": 4.8,
          "top5": 14.3
        },
        {
          "en": "Wraith",
          "n": 17,
          "pct": 1.2,
          "win": 0.0,
          "top5": 11.8
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Horizon"
          ],
          "n": 588,
          "pct": 43.3
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 125,
          "pct": 9.2
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Catalyst"
          ],
          "n": 82,
          "pct": 6.0
        },
        {
          "heroes": [
            "Catalyst",
            "Fuse",
            "Horizon"
          ],
          "n": 72,
          "pct": 5.3
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Gibraltar"
          ],
          "n": 67,
          "pct": 4.9
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 49,
          "pct": 3.6
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Valkyrie"
          ],
          "n": 36,
          "pct": 2.6
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Crypto"
          ],
          "n": 33,
          "pct": 2.4
        },
        {
          "heroes": [
            "Catalyst",
            "Horizon",
            "Newcastle"
          ],
          "n": 32,
          "pct": 2.4
        },
        {
          "heroes": [
            "Bangalore",
            "Catalyst",
            "Wattson"
          ],
          "n": 31,
          "pct": 2.3
        }
      ],
      "legendTotal": 4072
    },
    {
      "id": "Y3-Split1-ALGS-Playoffs-Global",
      "year": "Y3",
      "split": "Y3-Split1",
      "league": "ALGS-Playoffs",
      "region": "Global",
      "path": "Y3-Split1/ALGS-Playoffs/Global",
      "teams": 40,
      "games": 62,
      "rankBy": "points",
      "stage": "",
      "maps": [
        {
          "en": "Finals - Storm Point",
          "n": 4
        },
        {
          "en": "Finals - World's Edge",
          "n": 4
        },
        {
          "en": "Losers bracket 2 - World's Edge",
          "n": 3
        },
        {
          "en": "Losers bracket 2 - Storm Point",
          "n": 3
        },
        {
          "en": "Winners bracket - Storm Point",
          "n": 3
        },
        {
          "en": "Winners bracket - World's Edge",
          "n": 3
        },
        {
          "en": "Losers bracket 1 - Storm Point",
          "n": 3
        },
        {
          "en": "A vs. D - World's Edge",
          "n": 3
        },
        {
          "en": "A vs. D - Storm Point",
          "n": 3
        },
        {
          "en": "A vs. C - Storm Point",
          "n": 3
        },
        {
          "en": "A vs. C - World's Edge",
          "n": 3
        },
        {
          "en": "B vs. C - World's Edge",
          "n": 3
        },
        {
          "en": "B vs. C - Storm Point",
          "n": 3
        },
        {
          "en": "B vs. D - Storm Point",
          "n": 3
        },
        {
          "en": "B vs. D - World's Edge",
          "n": 3
        },
        {
          "en": "C vs. D - World's Edge",
          "n": 3
        },
        {
          "en": "C vs. D - Storm Point",
          "n": 3
        },
        {
          "en": "A vs. B - World's Edge",
          "n": 3
        },
        {
          "en": "A vs. B - Storm Point",
          "n": 3
        },
        {
          "en": "Losers bracket 1 - World's Edge",
          "n": 2
        },
        {
          "en": "Losers Bracket 1 - World's Edge",
          "n": 1
        }
      ],
      "champion": "",
      "pointsLeader": "NRG",
      "standings": [
        {
          "rank": 1,
          "team": "NRG",
          "score": 283,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 2,
          "team": "TSM",
          "score": 268,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 3,
          "team": "Luminosity Gaming",
          "score": 267,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 4,
          "team": "EXOClan",
          "score": 253,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 5,
          "team": "Spacestation",
          "score": 252,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 6,
          "team": "FNATIC",
          "score": 249,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 7,
          "team": "DarkZero",
          "score": 248,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 8,
          "team": "ACEND",
          "score": 244,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 9,
          "team": "ONICEsports",
          "score": 239,
          "wins": 0,
          "stage": ""
        },
        {
          "rank": 10,
          "team": "XSET",
          "score": 237,
          "wins": 0,
          "stage": ""
        }
      ],
      "legends": [
        {
          "en": "Valkyrie",
          "n": 993,
          "pct": 80.1,
          "win": 5.3,
          "top5": 27.0
        },
        {
          "en": "Seer",
          "n": 839,
          "pct": 67.7,
          "win": 4.8,
          "top5": 23.0
        },
        {
          "en": "Bangalore",
          "n": 567,
          "pct": 45.8,
          "win": 4.9,
          "top5": 21.2
        },
        {
          "en": "Horizon",
          "n": 362,
          "pct": 29.2,
          "win": 5.0,
          "top5": 21.5
        },
        {
          "en": "Crypto",
          "n": 324,
          "pct": 26.1,
          "win": 5.9,
          "top5": 29.3
        },
        {
          "en": "Wattson",
          "n": 318,
          "pct": 25.7,
          "win": 5.7,
          "top5": 30.5
        },
        {
          "en": "Bloodhound",
          "n": 131,
          "pct": 10.6,
          "win": 2.3,
          "top5": 17.6
        },
        {
          "en": "Loba",
          "n": 61,
          "pct": 4.9,
          "win": 6.6,
          "top5": 37.7
        },
        {
          "en": "Newcastle",
          "n": 40,
          "pct": 3.2,
          "win": 5.0,
          "top5": 30.0
        },
        {
          "en": "Mad Maggie",
          "n": 24,
          "pct": 1.9,
          "win": 0.0,
          "top5": 12.5
        },
        {
          "en": "Caustic",
          "n": 19,
          "pct": 1.5,
          "win": 5.3,
          "top5": 36.8
        },
        {
          "en": "Octane",
          "n": 11,
          "pct": 0.9,
          "win": 0.0,
          "top5": 36.4
        }
      ],
      "combos": [
        {
          "heroes": [
            "Bangalore",
            "Seer",
            "Valkyrie"
          ],
          "n": 343,
          "pct": 27.7
        },
        {
          "heroes": [
            "Crypto",
            "Valkyrie",
            "Wattson"
          ],
          "n": 186,
          "pct": 15.0
        },
        {
          "heroes": [
            "Horizon",
            "Seer",
            "Valkyrie"
          ],
          "n": 175,
          "pct": 14.1
        },
        {
          "heroes": [
            "Bangalore",
            "Horizon",
            "Seer"
          ],
          "n": 95,
          "pct": 7.7
        },
        {
          "heroes": [
            "Crypto",
            "Seer",
            "Valkyrie"
          ],
          "n": 74,
          "pct": 6.0
        },
        {
          "heroes": [
            "Seer",
            "Valkyrie",
            "Wattson"
          ],
          "n": 73,
          "pct": 5.9
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Horizon"
          ],
          "n": 56,
          "pct": 4.5
        },
        {
          "heroes": [
            "Crypto",
            "Loba",
            "Valkyrie"
          ],
          "n": 45,
          "pct": 3.6
        },
        {
          "heroes": [
            "Newcastle",
            "Valkyrie",
            "Wattson"
          ],
          "n": 40,
          "pct": 3.2
        },
        {
          "heroes": [
            "Bangalore",
            "Bloodhound",
            "Seer"
          ],
          "n": 29,
          "pct": 2.3
        }
      ],
      "legendTotal": 3718
    }
  ]
};
