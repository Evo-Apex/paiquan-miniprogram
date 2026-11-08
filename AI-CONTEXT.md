# AI-CONTEXT · Apex 小程序交接说明书

> 给接手这个项目的 AI 看的**完整背景**。读完它，你应该能在没有原作者在场的情况下：
> 判断一个改动该动哪个文件、知道哪些东西不能碰、并且知道改完怎么自证没弄坏。
>
> 事实核对于 **2026-10-26**（代码快照当日）：30 个测试文件 / 600 条断言全绿。
> 文中「实测」= 我读过代码/跑过命令得到的结论；「据 README」= 沿用原作者记录、我未独立验证。

---

## 1. 产品事实

| 项 | 内容 |
|---|---|
| 名字 | 「英雄地图轮换助手」（名称**不含 APEX**，EA 注册商标） |
| 形态 | 微信小程序，已上线（2026-10-09 首日 248 人访问） |
| AppID | `wx8b0175f85d4bb06c`（作者本人的，交给你用不了） |
| 云环境 | `cloud1-d8ggx095757c58e20`（写死在 `miniprogram/app.js`） |
| 用户 | 国内 Apex 玩家，**赛前/赛中、单手、碎片时间**打开 |
| 用户要什么 | 现在哪张图 / 还有多久轮换 / 猎杀线多少分 / 下一场几点 |
| 成功标准 | **点开 → 一眼拿到数 → 关掉**。停留时间是成本，不是指标 |
| 参照机型 | iPhone 12/13，可视高 **1288rpx** |

**产品原则（改东西时用来判断"该不该做"）**

1. ~~**一屏出结论**~~。2026-10-27 起取消：所有页面都可以滑动（August 定的：重构方案需要滑动）。编号保留，免得别处引用对不上。
2. **不编数据**。取不到、算不出、没记录就诚实留空或显示英文原值 —— 假数据比空缺糟得多。
3. **零配置**。任何要用户自己申请 Key、登录、填表的步骤都算产品缺陷。
4. **两个主题、两种语言都是真需求**。新样式必须在 深/浅 × 中/英 四种组合下同时成立。
5. **先改工艺再动风格**。字号偏小、对比度不达标是硬缺陷，优先级高于任何审美偏好。

**信息架构**（2026-10-27 首页改版后；首页和「我的」页由 Evo 作者 August 负责，结构可以改）：
- **首页**（第 1 个 tab，`pages/home/`）自上而下：Evo（没绑定 = 怎么绑定；绑定了 = 我的段位、今日、上一局）→
  现在玩什么（置顶的模式一张深色大卡 + 其余模式的小卡）→ 大家在玩什么（所有 Evo 玩家近 7 天）→ 赛事与更多（下一场比赛、小游戏）。
- **全部地图**（`pages/maps/`，首页点进去的子页面，不再是 tab）：原来的四行 = 匹配 → 排位 → 外卡 → 轮换，
  顺序由 `utils/viewmodel.js` 决定，**不在 WXML 里写死**。⚙ 里的「显示哪些模式」「置顶」首页也跟着走。

**明确不做的三件事**（别"顺手加上"）

- 全天换图时间表（上游只给当前+下一场，硬编码循环顺序赛季一换就失准）。
- 段位分布"官方数据"（Respawn 不发布，网上百分比都是自制的）。
- 用户历史对局记录（上游 API 已实测拿不到，见 §13）。

---

## 2. 系统架构

三层，中间那层不是可选的：

```
┌─────────────────┐   wx.cloud.callFunction    ┌──────────────────┐   HTTPS   ┌────────────────────────────┐
│ 微信小程序前端   │ ─────────────────────────▶ │ 云函数 apex       │ ────────▶ │ api.apexlegendsstatus.com  │
│ miniprogram/     │   （微信私有协议，不受      │ cloudfunctions/  │           │  + apexlegendsstatus.com   │
│                  │     域名白名单限制）        │ apex/            │           │    （网页站，抓 HTML）      │
└─────────────────┘                            └────────┬─────────┘           └────────────────────────────┘
                                                        │
                                                        ▼
                                              云开发数据库（5 个集合）
```

**为什么必须这么绕**（微信官方写死的两条规则）：

> 「每个微信小程序需要事先设置通讯域名，小程序只可以跟指定的域名进行网络通信」
> 「**域名必须经过 ICP 备案**」

`api.apexlegendsstatus.com` 是未备案境外域名 → **小程序端直连必被拦**。
云函数出网不受此限，于是它既做代理、又做数据归一化，还替用户藏住了 API Key。

**由此带来的三个结构性后果**（改动时别破坏）：

1. 上游字段一改，**只改云函数、重新部署即可**，不用提审、用户无感。
2. Key 只在云函数环境变量里，**永远不下发到客户端**（`sync.test.mjs` 静态检查守着）。
3. 能放在云端的逻辑就放云端（归一化、译名表、抗变化），这是第一优先级。

---

## 3. 数据流（一次开屏）

```
app.js onLaunch → wx.cloud.init({env: CLOUD_ENV})
   │
   ▼
pages/maps: cloud.callCloud({action:"rotation"})  ──▶ 云函数 handler → /maprotation?version=2
             cloud.callCloud({action:"schedule"})  ──▶ rotation_log 集合（后台定时攒的）
   │
   ▼
utils/viewmodel.js  buildModes() / buildSchedule()  ← 纯函数：数据 → 界面字段（含文案、差额、进度条）
   │
   ▼
pages/maps.wxml  {{...}}  ← 只渲染，不含业务判断
```

**分层铁律**：`页面 js` 只管"取数 + 调 setData"；**判断/换算全在 `utils/` 的纯函数里**。
理由很实际：页面 js 里有 `Page({...})`，Node 里 require 不了，**放进页面就没法写单元测试**。
所以凡是值得测的逻辑，都在 `utils/`。

---

## 4. 云函数：action 总表

入口 `cloudfunctions/apex/index.js`；共享逻辑在 `handler.js`。
**两种调用方式**：前端按需 `callFunction({action})`，或定时触发器 `event.Type === "Timer"`。

| action | 做什么 | 上游/数据 | 缓存 | 依赖数据库 |
|---|---|---|---|---|
| `rotation` | 当前 + 下一场轮换（4 个模式） | `GET /maprotation?version=2` | 30 秒 | — |
| `predator` | 四平台猎杀底分 + 较昨日涨幅 | `GET /predator` | 10 分钟 | `predator_snapshots` |
| `player` | 玩家详情（名字或 uid） | `GET /bridge?version=5` | 不缓存（含个人） | `player_rank_snapshots` |
| `servers` | 服务器状态 | `GET /servers` | 60 秒 | — |
| `esports` | 某场比赛的赛程 + 积分榜 | **overstat.gg** 公开 JSON（不需要 Key） | 5 分钟 / 1 分钟 | — |
| `trackAdd` / `trackList` / `trackRemove` | 追踪名单（按 openid 隔离，每人最多 5 个） | 数据库 | — | `tracked_players` |
| `schedule` | 轮换时间表（后台攒下来的场次） | `rotation_log` | — | `rotation_log` |
| `config` | 赛季结束时间 + 活动 + 赛程 | `site_config`，缺了用内置兜底 | — | `site_config`（可缺） |
| `comps` | 职业热门三人组合 | 解析 `apexlegendsstatus.com/algs/...` HTML | 6 小时 | — |
| `pickrates` | 英雄选取率（分段位） | 解析 `apexlegendsstatus.com` 网页 | 1 小时 | — |
| `rankdist` | 段位分布（实时） | `/lib/php/rankdistrib.php?unranked=yes`（JSON） | 6 小时 | — |
| `teams` | 战队专区（名单 + 当前分） | `curated_roster_resolved.json` + `/bridge` | 30 分钟 | — |
| `proRoster` | 比赛页：一场赛事的参赛队伍和队员（Liquipedia，带国籍、键鼠/手柄、有没有战队页），用来把名次行、选手名连到选手页、战队页 | 只读数据库 | — | `pro_meta`、`pro_players`、`pro_teams` |
| `proPlayer` | 选手页：一位选手的资料、队伍经历、历届成绩、合作过的队友，和他待过的队里哪些有战队页（Liquipedia） | 只读数据库 | — | `pro_players`、`pro_teams` |
| `proTeam` | 战队页（2026-11-07）：一支战队的资料、历史名单（选手 + 教练）、历届成绩、转会记录（Liquipedia） | 只读数据库 | — | `pro_teams`、`pro_players` |
| `proSeason` | 比赛页（2026-11-08）：这个赛季的五站、中国的小比赛 + 自己录入的比赛、所有 CN 战队（手动名单）、选主队用的队伍列表 | 只读数据库 | — | `pro_meta`（season）、`pro_teams`、`pro_manual_events`、`pro_cn_teams` |
| `prostats` | 主播排位数据（英雄/阵容/武器/配枪）的热更新读取 | 云数据库 `prostats/current` | — | `prostats`（可缺，缺了用包内快照） |
| `prostatsSet` | 同上，**写入**。只认云函数环境变量 `PROSTATS_TOKEN`，小程序端不持有 | 云数据库 | — | `prostats` |
| `Timer` | 定时轮询追踪名单 + 顺手记一条轮换 + 抓一点职业选手数据（每次最多 1 个 Liquipedia 请求，见 §18） | Liquipedia 数据库 API（`LIQUIPEDIA_API_KEY`） | 一轮抓完歇 24 小时 | 同上 + `pro_meta`、`pro_players`、`pro_teams` |

**数据库集合（5 个，都要在云开发控制台手动建）**

| 集合 | 内容 | 建不建的影响 |
|---|---|---|
| `predator_snapshots` | 每小时一条猎杀底分 | 不建 → 没有「较昨日 +X」，分数线照常 |
| `tracked_players` | 追踪名单（by openid） | 不建 → 追踪功能不可用 |
| `player_rank_snapshots` | 玩家排位快照 | 同上 |
| `rotation_log` | 轮换记录（`_id = 模式_开始时间`，天然幂等） | 不建 → 地图列显示「待记录」 |
| `site_config` | 赛季结束时间 / 活动 / 赛程（可在控制台直接改 doc）；`_id = "pro_events"` 的 `list` 是选手页收录哪些赛事（§18） | 不建 → 用内置兜底值 |

另有两个集合**要在控制台里手动加记录**（比赛页用，2026-11-08，格式见 §18「比赛页」）：`pro_manual_events`（Liquipedia 没收的国内比赛）、`pro_cn_teams`（「所有 CN 战队」的名单）。
还有三个集合**不用手动建**（第一次写入时代码自己建，2026-11）：`pro_players`（一位选手一条）、`pro_teams`（一支战队一条：历史名单、资料、成绩、转会，算队友、战队页用）、`pro_meta`（选手数据的同步进度 + 参赛名单）。

**容错铁律**：数据库/上游的任何错误都必须被**吞掉并降级**，绝不让用户看不到主数据。
`index.js` 里 `require("wx-server-sdk")` 整个包在 try/catch 里；`store.js` / `playerStore.js` 每个操作都 catch；
`handler.js` 用 `settle(promise, 1500)` 给所有查库加超时（数据库卡住不能拖到云函数超时）。

**运行时**：Node.js **16.13**，依赖只有 `wx-server-sdk`（锁 `~2.7.x`）。
→ **不能用全局 `fetch`**（Node 18 才内置），所以有自写的 `fetcher.js`（只用 `http/https/zlib/url`）。
这条有测试盯着（`sync.test.mjs`），别"顺手换成 axios/fetch"。

---

## 5. 前端：页面矩阵

| 页面 | 路径 | 数据来源 | 关键文件 | 备注 |
|---|---|---|---|---|
| 首页（tab，2026-10-27） | `pages/home/` | 云端 `rotation`；Evo 那两块走 `evo_mp`（`home` / `crowd`）；赛事卡用离线 `next_match_data.js` | `home.js`、`viewmodel.js`、分包 `evo/components/home`、`evo/components/crowd` | 旗舰页（见 §1 信息架构）；没有 ⚙（语言、主题在「我的」里切） |
| 全部地图（首页点进去） | `pages/maps/` | 云端 `rotation` + `schedule` | `viewmodel.js`、`prefs.js` | 原来的地图页：四行卡片 + 倒计时 + 设置面板；左上角返回（分享卡片直接打开时回首页） |
| 战绩（tab，原排位专区） | `pages/predator/` | 云端 `predator`/`config`/`rankdist`/`teams`/`player` + 离线 `prostats_data.js`；「我的战绩」走 `evo_mp` | `rankdist.js`、`prostats.js`、`viewmodel.js`、`evo/utils/view.js` | 顶部切换：我的战绩（Evo，§17）｜排位资讯（猎杀线 / 职业选手数据 / 段位分布 / 战队 / 战绩查询） |
| 比赛（tab） | `pages/matches/`（外壳）+ 分包组件 `pro/components/season` | 云端 `proSeason`（只读数据库） | `pro/utils/seasonview.js` | 2026-11-08 照 August 的「赛季进度条」设计稿改版：赛季卡 → 主队 → 近期比赛 → 这个赛季 → 所有 CN 战队（§18「比赛页」）；取不到数据整块不出 |
| 赛季的一站（比赛页点进去） | 分包 `pro/event/` | 云端 `proSeason` + `proRoster`；本地快照 `match_result_data.js` / `next_match_data.js` / `algs_data.js` | `seasonview.js`、`matchresult.js`、`nextmatch.js`、`algs.js`、`prolink.js` | 原来比赛页的三块（最终成绩、下一场比赛、ALGS 职业赛场）挪到这里，按这一站有什么放什么 |
| 选手页（比赛页点进去） | 分包 `pro/player/` | 云端 `proPlayer`（只读数据库；数据由定时器从 Liquipedia 抓，§18） | `pro/utils/view.js`、`utils/pronames.js` | 照 August 的设计稿：深色大卡 → 资料 → 合作过的队友 → 常用传奇 → 战队经历 → 重要比赛成绩 → 数据来源入口 |
| 战队页（选手页、比赛页的战队名点进去） | 分包 `pro/team/` | 云端 `proTeam`（只读数据库；同上由定时器抓） | `pro/utils/teamview.js`（复用 `view.js` 的成绩、时长、缩写）、`utils/pronames.js` | 照 August 的战队页设计稿：深色大卡 → 现役阵容 → 重要比赛成绩 → 阵容变动 → 历任队员 → 数据来源入口（§18） |
| 数据来源说明（选手页、战队页最底下点进去） | 分包 `pro/sources/` | 本地文案 + 上次同步时间（打开参数 `at`） | `pro/utils/view.js` 的 `syncedText` | Liquipedia 署名（CC BY-SA 3.0）、照片为什么是剪影、粉丝工具声明都放这里，选手页上不放 |
| 小游戏（tab） | `pages/games/` | 本地 | `wheel_data.js`、`games_meta.js`（两个题量，测试核对） | 分类入口页（3 个入口卡片）；三个玩法在分包 `games/`，进这个 tab 时预下载（`app.json` 的 `preloadRule`） |
| 猜圈练习 | 分包 `games/ringguessr/` | 本地 `games/data/match_rings_data.js` | `games/utils/rings.js` | canvas 游戏：拖动 + 双指缩放，8 题 / 20 秒 |
| 圈型速判 | 分包 `games/ringpick/` | 本地 `games/data/rings_data.js` + `map_ends_data.js` | `games/utils/ringpick.js` | 四选一，10 秒一题 |
| 英雄/武器轮盘 | 分包 `games/wheel/` | 本地 `codex_data.js` | `wheel_data.js`（在主包 `utils/`，分类页也要用） | 纯随机，不按选取率加权 |
| 我的（tab） | `pages/me/` | 云端 `evo_mp`（`me`） | 分包 `evo/components/devices`、`utils/theme.js` | 2026-11-08 照 August 的设计稿改版：游戏 ID + 三格统计 + 电脑上的 Evo（组件）→ 设置列表（分享卡片、外观、语言、隐私说明、关于 Evo、版本）（§17） |
| 游戏账号 / 关于 Evo / 玩家群 | 分包 `evo/accounts`、`evo/about`、`evo/group` | `evo_mp`（`me`）/ 本地文案 | `evo/utils/view.js` | 「我的」页的三个二级页（2026-11-08） |
| 全部对局 / 对局详情 / 绑定电脑 | 分包 `evo/matches`、`evo/match`、`evo/bind` | 云端 `evo_mp` | `evo/utils/view.js` | Evo 战绩的子页面（§17） |

**注意**：`pages/maps/` **没有自己的 `.wxss`**（只有 js/json/wxml），它的样式全部在根目录 `app.wxss` 里。
改「全部地图」视觉 = 改 `app.wxss`（全局文件，会波及其他页面，小心）。
首页有自己的 `pages/home/home.wxss`（类名都以 `h` 开头），分包里首页的两个组件（`apply-shared`）也用它的 `.hcard` / `.hpair` / `.hbar`。

**广告位**：`utils/ad.js` 的 `AD_UNITS` 已填**真实**广告位 ID（`adunit-419d525ab9b59819`，首页、全部地图、战绩、比赛、猜圈共用），
流量主已开通。ID 为空/格式不对时 `adUnitFor()` 返回空串，页面 `wx:if` 不成立，组件完全不渲染 —— 填错不会崩。

---

## 6. 代码分层与职责

### 前端 `miniprogram/`

| 文件 | 职责 | 能碰 wx.* 吗 |
|---|---|---|
| `utils/core.js` | 归一化 / 格式化 / 错误分类 / 译名表（`MAP_CN`） / 涨幅窗口判定 | ❌ 纯函数 |
| `utils/viewmodel.js` | 数据 → 界面字段（四行顺序、倒计时文案、差额、分享链接） | ❌ 纯函数 |
| `utils/cloud.js` | 云函数调用封装：**永远 resolve，不 reject**，错误文案截断 60 字 | ✅ |
| `utils/i18n.js` | 中英两套词典 + 语言开关（`T.xxx`，默认 `zh`） | ❌ |
| `utils/theme.js` | 主题开关 + 原生外壳同步（导航栏/tabBar/窗口底色） | ✅ |
| `utils/prefs.js` | **唯一**允许碰本地存储的文件（只存界面偏好） | ✅ |
| `utils/ad.js` | 广告位 ID + 开关 | ✅ |
| `utils/algs.js` / `nextmatch.js` / `matchresult.js` / `prostats.js` / `rankdist.js` / `wheel_data.js` | 各自区块的"数据 → 视图模型" | ❌ 纯函数 |
| `games/utils/rings.js` / `ringpick.js`（分包） | 猜圈、速判：题库、判定、几何（2026-11-07 从 `utils/` 搬来） | ❌ 纯函数 |
| `utils/games_meta.js` | 小游戏分类页显示的两个题量（主包读不到分包里的题库，只能抄数；`page.test.mjs` 拿真题库核对） | ❌ 纯数据 |
| `utils/prolink.js` | 比赛页的战队名、选手名（ALS 写法）→ Liquipedia 选手页面名（§18） | ❌ 纯函数 |
| `utils/pronames.js` | Liquipedia 英文取值的中文叫法：国籍、赛区、键鼠/手柄、队里的身份、比赛类型（查不到保留英文） | ❌ 纯数据 |
| `pro/utils/view.js`（分包） | 选手页：云端数据 → 界面字段 | ❌ 纯函数 |
| `pro/utils/teamview.js`（分包） | 战队页：云端数据 → 界面字段（阵容、转会说法、历任队员合并） | ❌ 纯函数 |
| `pro/utils/seasonview.js`（分包） | 比赛页的赛季、一站的详情页：云端数据 → 界面字段（进度条、主队、近期比赛、时间线、CN 战队、选主队） | ❌ 纯函数 |
| `data/*_data.js` | 离线数据快照（见下表），**只读、别手改**（2026-11-07 从 `utils/` 分出来，`utils/` 只放代码；小游戏的三个在 `games/data/`） | ❌ |

**离线数据文件（8 个 `*_data.js`，改数据等于改产品口径）**

> 其中 7 个是纯数据快照；`wheel_data.js` 除了候选池还含扇形几何（是代码，所以留在 `utils/`），改它要看 `wheel.test.mjs`。
> 表里没列的 `data/match_result_data.js` 是比赛页的赛果快照（`utils/matchresult.js` 读）。

| 文件 | 内容 | 快照日期 | 来源 |
|---|---|---|---|
| `data/algs_data.js` | ALGS 赛事统计（战队/局数/选取率/组合） | 2026-10-20 | `apexlegendsstatus.com/algs` 赛事总览页 |
| `data/next_match_data.js` | 下一场比赛（赛程树 + 分组 + 队员） | 2026-10-26 | 同上（赛程树 + 分组名单） |
| `data/prostats_data.js` | 职业选手排位数据（英雄/组合/枪械） | 2026-10-26 | B 站直播录像识别（离线） |
| `data/codex_data.js` | 英雄/武器图鉴（28 英雄 + 枪） | 2026-10-16 | 项目自建 |
| `games/data/match_rings_data.js` | 完整圈序列（猜圈题库） | 2026-10-25 | DGS + 社区数据，半径已按当前版本缩放 |
| `games/data/rings_data.js` | 3 圈序列（速判题库） | 2026-10-25 | 上游 ring-guessr API |
| `games/data/map_ends_data.js` | 每张图最终圈可能落点 | 2026-10-17 | 交互地图页内联数据 |
| `wheel_data.js` | 轮盘候选池 + 扇形几何 | — | 读 codex |

**文件搬家（2026-11-07，August 和合作者说好的）**：① 三个小游戏连同逻辑、题库、平面图整体搬进分包 `games/`，
主包按文件大小算从 1.66 MB 降到约 1.2 MB（上限 2 MB）；② 主包里的离线数据快照从 `utils/` 分到 `data/`，`utils/` 只放代码。
路径都相对 `miniprogram/`。
**仓库外的生成脚本（`直播识别/` 那几个）要照这张表改输出路径**：

| 原来 | 现在 |
|---|---|
| `pages/ringguessr/`、`pages/ringpick/`、`pages/wheel/` | `games/ringguessr/`、`games/ringpick/`、`games/wheel/`（页面路径 `/games/<名>/<名>`） |
| `utils/rings.js`、`utils/ringpick.js` | `games/utils/` |
| `utils/rings_data.js`、`utils/match_rings_data.js`、`utils/map_ends_data.js` | `games/data/` |
| `assets/maps/flat/*.jpg`（`build_flatmaps.py` 生成） | `games/assets/flat/` |
| `utils/algs_data.js`（`build_algs.py`）、`utils/codex_data.js`（`build_codex.py`）、`utils/next_match_data.js`（`build_next_match.mjs`）、`utils/prostats_data.js`（`s29_to_miniapp.py`）、`utils/match_result_data.js` | `data/` |

分包的规矩：分包可以 require 主包（`utils/`、`assets/`），**主包不能 require 分包，分包之间也不行**
（写错了只有开发者工具编译时才报错，`static.test.mjs`「分包：引用方向」提前拦）。

### 云端 `cloudfunctions/apex/`

| 文件 | 职责 |
|---|---|
| `index.js` | 入口：读 `ALS_API_KEY` / `LIQUIPEDIA_API_KEY`、初始化数据库、分发 Timer/schedule/config/comps/pickrates/rankdist/teams/proPlayer/proRoster/proTeam、兜底不抛异常 |
| `handler.js` | 主逻辑：拼 URL、调用、错误分类、缓存、猎杀涨幅、追踪增删查 |
| `core.js` | **与 `miniprogram/utils/core.js` 字节一致的副本** |
| `fetcher.js` | 极简 HTTP 客户端（只用 Node 内置模块，兼容 Node 8~22） |
| `esports.js` | overstat.gg 赛事接口（不需要 Key） |
| `comps.js` / `pickrates.js` / `rankdist.js` | 三个"抓网页/JSON"的数据源，各自带内存缓存 |
| `teams.js` | 战队专区：读名单 + 并行查分 |
| `snapshot.js` / `store.js` | 猎杀快照的纯逻辑 / 数据库读写 |
| `playerSnapshots.js` / `playerStore.js` | 玩家快照的纯逻辑 / 数据库读写 |
| `rotationLog.js` | 轮换记录器（给"接下来两天几点打哪张图"供数） |
| `trackerPoll.js` | 定时轮询追踪名单（超 200 人/400 人自动分片降频） |
| `curated_roster.json` / `curated_roster_resolved.json` | 战队名单（换赛季直接改 JSON 重新部署，不动逻辑） |
| `liquipedia.js` | Liquipedia 数据库 API：拼请求、取数、把原始字段整理成我们的格式（§18） |
| `proSync.js` | 选手、战队、赛季数据：定时器每次做一步（最多 1 个请求）；`proPlayer`（带队友）/ `proRoster` / `proTeam` 三个读取接口 |
| `proSeason.js` | 比赛页的赛季：配置 `SEASON`（五站的 Liquipedia 页面名，**换赛季改这里**）+ 读取接口 `proSeason` |
| `proPhotos.js` + `pro_photos.json` | 选手照片：Liquipedia 页面名 → 云存储的 cloud:// 地址（对照表由 `tools/build_pro_photos.py` 生成，§18） |
| `proStore.js` | 选手数据的数据库读写（`pro_players`、`pro_teams`、`pro_meta`，比赛页的 `pro_manual_events`、`pro_cn_teams`），错误一律吞掉降级 |

---

## 7. 界面硬约束（违反即返工）

来源：`docs/apex-miniapp-ui/SKILL.md` + `reference/tokens.md`，与 `app.wxss` 顶部令牌层一致。

**数值**

- 换算基准 375px：**1px = 2rpx**。
- 字号只允许 7 档：`44 / 40 / 34 / 30 / 28 / 26 / 24` rpx（首页另有两档大数字 `--fs-hero` 64、`--fs-big` 52，
  2026-10-27 首页改版加的，只给首页和它的两个组件用；2026-11 起选手页大卡上的选手 ID 也用 `--fs-hero`，照 August 的设计稿）。**24rpx 是绝对下限**
  （微信官方最小档，12pt）。历史上出现过 19rpx（9.5px）—— 这是"看着累"的主因，别再犯。
- 间距只走 4rpx 网格：4 / 8 / 12 / 16 / 20 / 24 / 32 / 64。
- 字重只留 3 档：400 / 700 / 800（800 仅用于大数字）。不存在 600（中文字体上几乎同形）。
- **地图卡另更严**：只留 44 / 34 / 24 三档、字重只留 400 / 700，**不用 800**（中文上是合成加粗，发虚）。
- 中文**不加 `letter-spacing`**；标签/页脚小字可 0.5~1rpx。

**颜色**

- **只准写 `var(--x)`**，除白色外禁止写死色值。变量定义在 `app.wxss`：
  `page{}` 深色（默认），`.wrap.theme-light{}` 覆盖同名变量。
- **浅色必须覆盖深色的每一个变量**，漏一个就是"白底上的近白字"（`theme.test.mjs` 盯着）。
- `color` **必须在 `.wrap` 上再声明一次**：`page{color:var(--ink)}` 在 page 层就把变量算成具体颜色了，
  子元素继承的是算好的颜色而非变量。
- 彩色文字浅色下要换同色系深色版（深色绿 `#3ddc84` 在白底只有 ~1.9:1，浅色用 `#0f8a4a`）。
- 强调色**不照抄官方纯红 `#ff0000`**（白字对比度仅 4.00:1）；现用 `#d92b2b`（4.85:1）。
- 强调色刻意拆成两个：`--accent`（填充用，够深）+ `--accent-ink`（文字用，够亮），别想着用一个红干两件事。

**无障碍**

- 正文/占位符 ≥ **4.5:1**，大字（≥18pt）≥ **3:1**（微信《适老化与无障碍设计指南》）。
- 热区 ≥ **80×80rpx**（40×40pt）。
- **颜色不单独承载语义**：百分比、名次、涨跌都要配文字（`static.test.mjs` 有用例）。

**原生外壳**（WXSS 管不到）：导航栏/tabBar/回弹底色走 `utils/theme.js` 的 `applyChrome()`，
`frontColor` 只接受 `#ffffff` / `#000000`。

---

## 8. 双语 × 主题（四种组合都要成立）

- 文案：WXML 里**不许写死中文**，一律 `{{T.xxx}}`；`utils/i18n.js` 的 `DICT.zh` / `DICT.en` **必须成对**。
  加新文案 = 两边各加一条（`i18n.test.mjs` 守望）。
- 云函数返回的多语言字段必须成对给（`name` / `nameEn` / `label` / `labelEn`）。
- 地图译名：查得到中文才显示中文，**查不到保留英文**。
  `translateMapName` 会先去掉开头的 `the ` 再查一次（上游同图会写 `Dome` 和 `The Dome`）。
  `i18n.test.mjs` 钉着一份译名清单，少一个就红。
- **不许为了消掉英文就编译名**：`The Core` / `Zeus Station` / `Runoff` 保持英文。
  猜错的名字比露出英文更糟（`core.test.mjs` 有断言）。
- 主题：默认深色；`theme.js` 记当前值 + 同步外壳；`prefs.js` 落本地存储。
- 自查清单：深×中、深×英、浅×中、浅×英 —— **四种都看一眼**，别只看你改的那一种。

---

## 9. 隐私与合规（这条是这个项目的招牌，别弄坏）

**禁用接口清单**（`static.test.mjs` 扫全项目 `.js`，命中即红）：
`getUserProfile` `getUserInfo` `getPhoneNumber` `getLocation` `chooseLocation` `chooseImage`
`chooseMedia` `getClipboardData` `setClipboardData` `getWeRunData` `startRecord` `chooseAddress` `getUserCryptoManager`

**本地存储口径（2026-10 已收窄，注意文档不同步）**

- 原承诺："全项目不使用本地存储"。现在收窄为："**只存界面偏好，不含任何用户数据**"。
- 只有 `utils/prefs.js` 能碰存储；键必须在上表白名单里：`lang` `theme` `modes` `pin` `hide_pubs_hint`。
  想存新东西 → 先去 `static.test.mjs` 加白名单并想清楚它是不是用户数据。
- `app.js` 刻意不设 `traceUser`：不采集 openid，就不用配《用户隐私保护指引》、不用弹授权框、不用逐项声明。
- 没有「一键复制 UID」按钮是**故意的**：`wx.setClipboardData` 是隐私接口，用了就要配隐私指引。
  改成 `<text user-select>` 让用户长按走系统复制，一个 API 都不碰。

---

## 10. 数据口径（"不编数据"具体长什么样）

这些不是风格偏好，是产品的可信度底线，改代码时要能对上：

| 现象 | 规则 | 反例（别做） |
|---|---|---|
| 猎杀线涨幅 | 必须存在 20~28 小时前的快照才显示；否则**整行不显示** | 显示 `+0`（会被读成"没涨"） |
| 「X 分钟前更新」 | 上游那份数据的刷新时间，**不是**本地取数时间 | 用 `Date.now()` 现算 |
| 中文译名 | 查不到就保留英文 | 猜一个像样的中文名 |
| 轮换时间表 | 没记录显示「待记录」 | 编一个循环顺序 |
| 选取率/组合解析失败 | **整块不显示** | 返回空数组（会被读成"没人玩"） |
| 服务器状态认不出 | 整块不显示 | 硬凑一行「全部正常」 |
| 轮盘 | 纯随机，不按选取率加权，不承诺"推荐" | 说"推荐你用这个" |
| 圈型速判四选项 | 都在真实内切轨迹上，不做"一真三假"送分题 | 随机放三个假点 |
| 段位分布 | 明确标注"第三方站点自己账号库里的分布，不是官方" | 说成官方数据 |

---

## 11. 测试地图（改完必跑）

**怎么跑**：逐个文件，`node tests/xxx.test.mjs`。
**不要用 `node --test tests/`** —— 运行器会 spawn 子进程并用管道收输出，在受控环境里报 `EPERM`。
测试用 `node:test` + `node:assert/strict`，**零依赖**，任何 Node ≥18 都能跑。

| 文件 | 断言数 | 守什么 | 改什么必须跑 |
|---|---|---|---|
| `core.test.mjs` | 68 | 归一化、uid、错误分类、涨幅计算、译名"不许猜" | 改 core.js |
| `handler.test.mjs` | 49 | 云函数 handler：uid 重试、store 注入、追踪 action | 改 handler/index |
| `page.test.mjs` | 89 | 页面行为：取数、查询、涨幅、猜圈、速判、轮盘、赛季的一站（原来比赛页的三块）、选手页、战队页、「我的」设置列表 | 改页面 |
| `static.test.mjs` | 55 | 隐私接口黑名单、本地存储白名单、WXML 一致性、颜色不表意 | 改任何 WXML/JS |
| `sync.test.mjs` | 9 | 两份 core.js 字节一致、依赖白名单、不许用全局 fetch | 改 core.js / 云函数 |
| `i18n.test.mjs` | 19 | 中英成对、不混排、地图译名清单、外壳跟随、词条不许重名 | 加文案/改译名 |
| `theme.test.mjs` | 9 | 浅色是否覆盖深色每一个变量；跟随系统 | 改 app.wxss 变量 / theme.js |
| `viewmodel.test.mjs` | 31 | 数据 → 界面字段 | 改 viewmodel |
| `snapshot.test.mjs` | 15 | 快照分桶、挑基准、清理 | 改 snapshot/store |
| `snapshot-store.test.mjs` | 13 | 数据库读写与错误降级（假 cloud） | 改 store |
| `player-snapshots.test.mjs` | 10 | 玩家快照分桶/基准 | 改 playerSnapshots |
| `player-store.test.mjs` | 11 | 追踪名单 + 玩家快照存储层 | 改 playerStore |
| `tracker.test.mjs` | 10 | 追踪 action：配额、验人、增删查 | 改追踪 |
| `tracker-poll.test.mjs` | 6 | 定时轮询 + 200/400 安全阀 | 改 trackerPoll |
| `teams.test.mjs` | 3 | 战队专区：读名单 + 取分 | 改 teams |
| `servers.test.mjs` | 22 | 服务器状态归一化（后端保留、前端已移除） | 改 servers |
| `predgap.test.mjs` | 20 | 距猎杀线差额 | 改差额逻辑 |
| `share.test.mjs` | 21 | 分享链接参数（含 uid）往返 | 改分享 |
| `cloud.test.mjs` | 9 | 云调用封装（永不 reject、错误截断） | 改 cloud.js |
| `ad.test.mjs` | 6 | 广告位开关 | 改 ad.js |
| `prostats.test.mjs` | 14 | 职业选手数据：英雄名与头像 | 改 prostats |
| `algs.test.mjs` | 21 | ALGS 快照：赛事/选取率/组合 | 改 algs |
| `nextmatch.test.mjs` | 30 | 下一场比赛：赛程/分组/队员/双语 | 改 nextmatch |
| `pro.test.mjs` | 50 | 选手页：Liquipedia 归一化、定时同步（每次 ≤1 个请求、4 分钟间隔、失败重试、24 小时一轮）、三个读取接口、队友重叠计算、战队的名单 / 转会 / 成绩、选手照片的地址和对照表、视图模型（每一块、不编数据、S/A 级筛选和展开）、名字连接 | 改 liquipedia / proSync / proStore / pro/ / prolink / pronames |
| `season.test.mjs` | 13 | 比赛页的赛季：进度条、小比赛圆点、主队、近期比赛、时间线、CN 战队、选主队、一站的详情页 | 改 pro/utils/seasonview.js / pro/components/season / pro/event |
| `proteam.test.mjs` | 14 | 战队页视图模型：大卡（赛区标签、进入 Apex、解散）、现役阵容、阵容变动的说法、历任队员合并 | 改 pro/utils/teamview.js / pro/team/ |
| `comps.test.mjs` | 14 | 职业三人组合解析 | 改 comps |
| `pickrates.test.mjs` | 14 | 英雄选取率解析 | 改 pickrates |
| `rankdist.test.mjs` | 15 | 段位分布 | 改 rankdist |
| `rings.test.mjs` | 31 | 猜圈题库与判定 | 改 rings |
| `rings-render.test.mjs` | 6 | 猜圈视图模型渲染字段 | 改 rings 渲染 |
| `wheel.test.mjs` | 15 | 轮盘候选池/抽签/扇形几何 | 改 wheel |
| `ringpick.test.mjs` | 14 | 速判题库/四选一几何/视口 | 改 ringpick |

`tests/live.mjs` 是**联机**校验（真 Key 打真接口），**不是** `.test.mjs`，别放进上面的统计：

```powershell
$env:APEX_API_KEY="你的key"; node tests/live.mjs
```

**测试挂了怎么读**：先看断言里那句中文说明，基本都是"哪条产品规则被破了"，比堆栈有用。
`sync.test.mjs` 失败会直接打印两份 core.js 的差异行号。

---

## 12. 红线清单（违反就会坏，编号便于引用）

1. `miniprogram/utils/core.js` 与 `cloudfunctions/apex/core.js` **必须字节一致**，改一份原样复制另一份。
2. 小程序端**不许**出现 API Key、32 位十六进制串、`ALS_API_KEY=` 赋值。
3. 小程序端**不许**引用任何外部域名（图片/请求都不行）。
4. 云函数**只能用 Node 内置模块** + `wx-server-sdk`（`~2.7.x`）；不许用全局 `fetch`。
5. 云函数**任何**数据库/上游错误都要降级，不许把异常抛给前端。
6. 不用 `wx.setStorage*`（`prefs.js` 例外），不许存用户数据。
7. 不硬编码颜色（白色除外）；不加新字号档位（首页的 `--fs-hero` / `--fs-big` 除外，见 §7）；不小于 24rpx。
8. 浅色主题必须覆盖深色的每一个变量；`color` 在 `.wrap` 上再声明一次。
9. WXML 不写死中文；中英词表必须成对。
10. 不编数据：取不到 → 留空/显示英文/整块隐藏，不许给 0、空数组、占位文案。
11. 「全部地图」四行顺序不写死在 WXML 里，由 viewmodel 决定；首页的大卡、小卡由 `utils/home.js` 挑。
12. 不用 EA 的 logo、官方纯红、官方地图以外来源的地图照片；产品名不带 APEX。
13. `pages/maps/` 没有自己的 wxss，改地图页样式 = 改 `app.wxss`（会波及其他页面）。
14. `cloudfunctions/apex/` 现有代码是 **ES5 风格**（`var` + `function`）。别在里面混入 `?.`、`??`、顶层 await
    之类的新语法：运行环境是 Node 16，风格统一比写起来顺手更重要。
15. 快照 `*_data.js` 是**离线抓取的产物**，改它等于改产品口径，需要说明数据来源与日期。
16. 新增云函数 action：先加进 `handler.js` 的 `ACTIONS`（或 `index.js` 的分支），**再加测试**。
17. 新增页面：`app.json` 的 `pages` 顺序有意义（第一项是启动页），并同步 §5 的矩阵文档。
18. 不许在页面 js 里写业务判断（放不进测试 = 下一轮必被改坏）。
19. 广告位 ID 只能是 `adunit-` 开头；填错不崩，但会白占位置。
20. 别删 `try/catch`——每一个都是为了"某个附加功能挂了不影响主功能"。

---

## 13. 上游的坑（实测结论，别再试一遍）

来自 README 与代码注释，都是踩过的：

| 接口 | 结论 |
|---|---|
| `/leaderboard`（完整 750 人名单） | ❌ `Unauthorized. You must be whitelisted`。放弃 |
| 网页版 `/leaderboard`、`/live-ranked-leaderboards` | ❌ 403，是登录墙 |
| 玩家近期对局 `/games` | ❌ 新 Key 无权限；旧 `history=1` 返回的是最后一次被追踪时的**陈旧数据**（实测 shroud 的 7 条全是 1881 天前） |
| `/predator/history` | ❌ 返回的就是当前值，上游没有历史 → 涨幅只能自己存快照 |
| 段位分布官方数据 | ❌ Respawn 不发布；网上百分比分母都是"被追踪玩家"，各站还对不上 |
| `/algs/*` 的深层页面 | ❌ Cloudflare 人机校验，云函数拿不到 → 只能做离线快照 |
| `/maprotation` | ✅ 每个模式只给 current + **一个** next |
| `/bridge?player=` | ✅ 但 EA ID 不区分大小写且"游戏名"常查不到（用 EA 账号 ID） |
| 网页 `/lib/php/rankdistrib.php` | ✅ 纯 JSON、无校验、~2.5KB，是少见的"能实时拿"的数据 |
| overstat.gg（赛事） | ✅ 公开 JSON、免 Key、体积极小 |
| ALGS 赛事总览页 | ✅ 可抓（robots `Allow: /`），其他页不行 |
| Liquipedia 数据库 API（LPDB v3，2026-11 授权） | ✅ 选手资料、队伍经历、历届成绩、每场比赛的参赛名单都有；**每小时最多 60 次**、Key 不许外传、页面要写"数据来自 Liquipedia（CC BY-SA 3.0）"、不许抓网页。位置（IGL 之类）字段 121 人全是空的 |
| `pickrates` 网页 | ✅ 可抓，但**解析失败必须整块隐藏**（结构一变就静默出错） |

**通用教训**：上游改字段名是**真实发生过**的事（`arenas` 被废弃、`predator` 结构换过形态）。
所以归一化必须写在云函数里、必须容错、必须有测试钉住返回形状。

---

## 14. 当前状态与技术债（诚实版）

**已确认**

- 线上已发布过（2026-10-09）。本地这份代码是 2026-10-26 的快照，**测试 600 条全绿**。
- **Git 仓库已于 2026-10-26 建立**（分支 `main`，首次提交即本快照）。
  在这之前该目录在 `D:\点餐` 仓库里是 `untracked`，所以**更早的历史无据可查**——
  想找回更早的版本，只能看 `.backups/` 里的目录副本。
- 没有构建步骤、没有 npm 依赖：**源码即产物**，开发者工具直接编译。
  （`cloudfunctions/apex/package.json` 是唯一的 package.json，只声明 `wx-server-sdk`，云函数那边的事。）

**不确定 / 需要找原作者确认**

- 本地代码与线上版本是否一致（README 的「这次要做什么」一节写于上一轮，可能已完成）。
- 云开发数据库里 5 个集合的当前数据量（`predator_snapshots` 是否够 20 小时以上历史）。

**已知技术债**

| 债 | 影响 | 建议 |
|---|---|---|
| 仓库还没推到远端 | 两人仍只能靠 zip 交换，必然分叉 | **建私有库推上去 + 加协作者**（见 §15） |
| `core.js` 双份手工同步 | 忘同步就两端行为分叉 | 已有测试拦；长期可考虑构建期复制 |
| 地图页样式混在 `app.wxss`（49KB） | 改地图页会影响全站 | 若要重构，先跑 `theme/static/page` 三个测试 |
| 四个页面共用一个广告位 ID | 分不出各页收益 | 后台建 3~4 个独立位，改 `AD_UNITS` 即可 |
| 职业选手数据靠人工/离线识别 | 数据会过期（当前 2026-10-26） | 需要周期性重跑 `直播识别/` 的流程（**不在本包**） |
| 档位/组件规范分散在 3 处文档 | 新人容易只看到一处 | 以 `app.wxss` 令牌层为准 |

**文档与代码已不同步的地方**（别被误导）

1. `docs/apex-miniapp-ui/SKILL.md` 说"三个 tab / 三个页面" → 实际 **4 个 tab、7 个页面**。
2. 同文件说"全项目不使用本地存储" → 2026-10 已收窄（见 §9）。
3. 同文件说"24 个测试文件" → 实际 **30 个 `.test.mjs`**。
4. `README.md` 目录树里云函数只列了 4 个文件 → 实际 **15 个模块**。
5. `README.md` 说"测试 594 条"、更早处说"413 条" → 实测 **600 条断言**（数字随版本变，别当契约）。
6. `README.md` 提到 `apex-web/` 也各存一份 `core.js`/`handler.js` → **本包不含网页版**；
   若你在本包改 `core.js`，网页版仓库需要另行同步（那是另一个项目的 sync 测试管的）。

---

## 15. 协作建议（两个人 + 两台 AI 同时改）

**第一件事：以 Git 仓库为唯一基线**

仓库已于 2026-10-26 在本机建好（分支 `main`，首次提交就是 §14 提到的那份快照）。
剩下要做的只有一件事：**把它推到远端，让第二个人 clone 而不是收 zip**。

```powershell
# 仓库所有者（你）：建一个「私有」仓库并推上去（Gitee / GitHub 都行）
git remote add origin <仓库地址>
git push -u origin main
# 然后把对方加成协作者：
#   Gitee  → 仓库 → 管理 → 仓库成员管理 → 添加（开发者权限）
#   GitHub → Settings → Collaborators → Add people
```

```powershell
# 协作者（朋友）：clone，不要 git init
git clone <仓库地址> apex-miniapp
cd apex-miniapp
node tests/core.test.mjs        # 先确认基线是绿的
```

**为什么必须这样**：zip 是单向快照，没有任何回传通道；两个人在各自的 zip 目录里 `git init`，
会得到**两个没有共同祖先的仓库**，将来想合并只能人工搬文件。
如果你已经收到过 zip 并建了仓库——删掉那份 `.git`（`rm -rf .git`）再 clone，别想"两边拼一下"。

**日常同步纪律**（三个人都要守）

1. 开工前 `git pull --rebase`；收工前 commit + push。**不要攒一周再推**。
2. 一次提交只包含一件事；提交信息写"为什么"（本项目文档风格就是记录取舍）。
3. 改完跑相关测试再提交；全量 30 个文件约 1 分钟。
4. 冲突不要"用我的覆盖"：`core.js` 两份副本、`i18n.js` 成对词条这类冲突，逐行看，改完立刻跑 `sync` / `i18n` 测试。

**本机差异怎么处理（必读，否则每次 `git status` 都是脏的）**

协作者必须用自己的 AppID 和云环境才能跑起来，而这两处**在受跟踪的文件里**：
`project.config.json` 的 `appid`、`miniprogram/app.js` 的 `CLOUD_ENV`。

推荐做法（不提交本机差异，也不影响别人）：

```powershell
# 让 git 不跟踪你本机对这两个文件的改动
git update-index --skip-worktree project.config.json miniprogram/app.js
# 需要恢复跟踪（例如别人真的改了这两个文件、你要拉下来）：
git update-index --no-skip-worktree project.config.json miniprogram/app.js
```

> ⚠️ 代价：`skip-worktree` 期间对这两个文件的 `pull` 会被挡住。真的有人改了它们，先 `--no-skip-worktree`、
> `git checkout --` 拿远端版本，改回自己的 AppID，再重新 skip。
> 更省事的替代：**协作者干脆别用自己 AppID**，两人共用一个测试号跑；上传/提审只由一个人做。

**发布权限归一个人**（这是最容易出事的地方）

- **云函数**：线上只有一个版本，谁后部署谁生效，且没有回滚记录 → **只让一个人部署**。
- **小程序代码**：多人上传会互相覆盖"开发版" → **只让一个人上传/提审**。
- 两人改同一份代码时，先 push 到 `main`（或分支合并），**由发布者从他的工作区上传**，不要各自上传。

**按文件分工最省事**（冲突面从小到大）

| 区域 | 谁改 | 冲突风险 |
|---|---|---|
| `app.wxss` 令牌层 | **同一个人**独占 | 极高：全站共用，两人同时改必冲突 |
| `utils/i18n.js` | 同一个人独占（每条文案都要成对加两条） | 高 |
| `utils/core.js` ↔ `cloudfunctions/apex/core.js` | 一次改动必须同一人做完两边 | 中（有测试拦） |
| 单个页面目录（js/wxml/wxss） | 可以一人一个页面 | 低 |
| `cloudfunctions/apex/*.js`（除 core.js） | 一人一个模块 | 低 |
| `tests/*.test.mjs` | 谁改功能谁加测试；改别人的测试要说明 | 低 |
| `utils/*_data.js` 快照 | 更新数据的人独占 | 低 |

**建议的常规流程**

1. `git pull` → 跑 3 个核心测试确认基线绿（`core` / `static` / `page`）。
2. 小步改：一次只动一个功能面，改完立刻跑相关测试。
3. 改完跑全量（30 个文件，约 1 分钟），全绿再 commit。
4. 提交信息写"为什么"（这个项目的文档风格就是记录取舍，别只写"改样式"）。
5. 发版：开发者工具「上传」→ 小程序后台「版本管理」→ 提交审核。

**发布注意**

- 小程序**一旦发布，改一行都要重新提审**。所以凡是"抗上游变化"的逻辑（字段归一化、译名表）
  一律放云函数；**改云函数不需要提审**，这是本项目最重要的运维优势，别破坏它。
- 云函数上传时必须选「**上传并部署：云端安装依赖**」，否则 `wx-server-sdk` 装不上
  （代码有 try/catch 兜底，但涨幅/追踪会缺）。云函数超时需设为 **20 秒**。
- 数据库集合要手动建（5 个，见 §4）。忘了建不崩，只是对应功能缺失。

**接手时可以问原作者的 3 个问题**（这些从代码里看不出来）

1. 线上版本号和本地代码是否一致？最后一次发版是什么时候？
2. 云开发环境里 5 个集合现状（哪些有数据、`predator_snapshots` 存了多久）？
3. `ALS_API_KEY` 由谁持有、能不能给你一个（或让你用同一个 Key）？

---

## 16. 术语表

| 词 | 含义 |
|---|---|
| 猎杀线 / predator | 各平台大师段位进入"猎杀者"所需的最低 RP（上游只给第 750 名那个数） |
| 轮换 / rotation | 地图按模式轮着打；15 分钟~4.5 小时一场 |
| 模式 | 四个：`pubs`（匹配）/ `ranked`（排位）/ `wildcard`（外卡）/ `mixtape`（轮换，上游旧字段名 `ltm`）。界面顺序是 匹配 → 排位 → 外卡 → 轮换 |
| 据点 | 轮换模式用的小地图（碎片、骷髅镇、纪念碑…），官方地图页只有六张大图 |
| 圈 / ring | 缩圈；坐标用 **16384** 为边长基准的地图单位 |
| 内切 | 下一个圈的圆心距恰等于 `R1 - R2`（260 局全部如此），速判四选项都摆在这条轨迹上 |
| 速判 / ringpick | 看第一圈猜下一圈圆心方向，四选一，10 秒一题 |
| 猜圈 / ringguessr | 给前几圈、拖地图猜下一圈圆心，8 题 20 秒 |
| 快照 / snapshot | 离线抓下来的数据文件；页面要标明"更新于" |
| 基准 / basis | 20~28 小时前那条快照，用来算"较昨日同期" |
| `T.xxx` | i18n 词典条目，`{{T.xxx}}` 在 WXML 里取 |
| `.wrap` / `.wrap.theme-light` | 页面根容器；浅色主题挂在这个类上 |
| Chrome | 原生的导航栏 / tabBar / 窗口底色（WXSS 管不到，走 `theme.js`） |

---

## 17. Evo 战绩（2026-10-27 起）

**是什么**：Evo 是电脑上的 Apex 战绩记录器（只看屏幕画面、不碰游戏，开源，evotracker.cn）。
绑定以后，电脑上记下的每一局同步到**本小程序的云环境**，在「战绩」页的「我的战绩」看。
这补上了 §1「明确不做」里的"用户历史对局记录"（上游 API 拿不到，Evo 在电脑上自己记）。

**放在哪**

| 位置 | 内容 |
|---|---|
| 「战绩」tab（`pages/predator/`） | 顶部切换「我的战绩 ｜ 排位资讯」。排位资讯 = 原排位专区，**一点没改**，只是包进一个 `hidden` 的 view。绑定了 Evo 的人默认看「我的战绩」，其他人照旧先看排位资讯（`onEvoStatus`） |
| 首页（`pages/home/`，2026-10-27） | 最上面一块（分包组件 `evo/components/home`，云函数 `evo_mp.home`）：没绑定时三步怎么绑 + 扫码绑定；绑定了显示我的段位（离下一段还差多少）、今日（局数、场均名次、击杀和伤害的总数）、上一局（可转发）。中间「大家在玩什么」（`evo/components/crowd`，`evo_mp.crowd`）：所有 Evo 玩家近 7 天的热门传奇、场均名次最好的三人组合；**少于 5 位玩家时整块不显示**，结果存在集合 `evo_stats` 里管 30 分钟 |
| 「我的」tab（`pages/me/`） | 2026-11-08 照 August 的设计稿改版，见下面「「我的」页」 |
| 分包 `miniprogram/evo/` | 其余全部：两个组件（主包页面异步引用）、三个子页面、段位徽章、`utils/view.js` |

**为什么用分包**：主包 1.88 MB / 上限 2 MB。Evo 的东西放分包，主包只多了「我的」外壳、一个 tab 图标和词条（约 15 KB）。
首页改版（2026-10-27）主包又多了约 37 KB（首页本身、`utils/home.js`、几个图标和词条）；首页上 Evo 的两块（`home`、`crowd` 组件）还是在分包里。
上面的 MB 数是把文件大小直接加起来的；开发者工具打包（压缩、去掉 tests 等）后的才是微信算的：2026-10-27 预览时主包 1.5 MB、分包 evo 59 KB。

**数据流**

```
电脑上的 Evo ──HTTP API（匿名登录）──▶ 云函数 evo_pc ──▶ evo_devices / evo_matches / evo_lobby / evo_accounts
                                                              ▲
小程序（evo/ 分包）──callFunction──▶ 云函数 evo_mp ─────────┘  只读调用者自己（OPENID）绑定的电脑的数据
云函数 evo_qrpool（定时）──▶ evo_qr_pool（带绑定码的小程序码，evo_pc 的 bind_code 领用）
```

- **绑定**：Evo 设置页点「绑定微信」→ `evo_pc.bind_code` 给绑定码（5 分钟、一次性）+ 小程序码（从码池领）→
  用户用微信扫 → 打开 `evo/bind/bind?scene=绑定码` → 点「绑定」→ `evo_mp.bind`。
  码池为什么要定时生成：生成小程序码要云调用，云调用只能从小程序里或**定时触发器**触发，电脑经 HTTP 调的云函数用不了。
- **云函数只回数字和代号**（段位 `diamond`、RP 来源 `xp`、错误 `expired`…），中英文由 `evo/utils/view.js` 拼 ——
  同本项目"判断/换算在 utils/ 纯函数里"的约定，也免得英文模式露出中文。
- **统计**在 `evo_mp/stats.js`，和 Evo 电脑窗口同一套算法；四舍五入照 Python（正好一半取偶数），两边数字才对得上。
- 传奇、地图名是 Evo 从游戏画面读的中文。英文模式：传奇名 / 头像按 id 从 `codex_data.js` 取（图鉴有 4 个中文名和游戏里不一样，所以按 id 对），地图名反查 `core.MAP_CN`；查不到保留原文。

**「我的」页**（2026-11-08 照 August 的设计稿改版）：没有标题栏（顶上固定一条同色底，内容不钻到胶囊底下）。
- 上半部分是分包组件 `evo/components/devices`（字段由 `view.meView` 拼）：游戏 ID（首字母切角方块当头像，**不用微信头像昵称**：不采集个人信息）
  + 「已绑定 Evo · N 个游戏账号」；三格统计（记录局数 / 赛季最高 / 冠军次数，和首页一样只看默认账号，没有的格不出）；
  每台电脑一张「电脑上的 Evo」卡（状态标签「正常 / 还没同步」、几分钟前同步、Evo 版本；管理游戏账号 → `evo/accounts`，解除绑定照旧两步确认）。
  卡片说明照实写：会传队友名字，不传截图（设计稿写的"不上传队友名字"不对）。
- 「赛季最高」：`evo_mp/stats.js` 的 `SEASONS` 写着每个赛季的开赛时刻（同 Evo 的 `config/seasons.json`），按电脑时区换算；
  **新赛季开始时要加一行、重新部署 `evo_mp`**，否则会把上个赛季的段位算进来。
- 下面的设置列表在主包 `pages/me`：分享卡片（首页「上一局」转发标题带不带游戏名，界面偏好 `shareName`，默认不带）、
  外观（跟随系统 / 深色 / 浅色）、语言、隐私说明（`wx.openPrivacyContract`，打不开就弹一段本地说明）、
  加入玩家群（Evo 的 **QQ 群**，微信里加不了 → `evo/group` 写群号、放二维码 `evo/assets/qq-group.jpg`、讲怎么用 QQ 加；
  QQ 群码不会 7 天过期，换群时换图、改 `group.js` 的群号再发版）、关于 Evo（`evo/about`）、版本（正式版、体验版才有）、底部声明。
- 「跟随系统」：`app.json` 开了 `"darkmode": true`（只为读到手机的深浅色；导航栏、tab 照旧由 `theme.applyChrome` 设），
  `theme.js` 分「模式」（system / dark / light）和「主题」（dark / light），手机切换时 `app.js` 的 `wx.onThemeChange` 刷新当前页面。
  别的页面 ⚙ 面板里直接点深色 / 浅色 = 不再跟随。
- August 定的不做：每周战报 / 地图轮换推送（游戏工具只能一次性订阅）、意见反馈、导出战绩、删除全部战绩；底部 tab 不动。

**隐私**：只存战绩数字、段位、队友的名字和 ID，不存截图。「大家在玩什么」只回汇总的数字和传奇名，不回任何人的名字。`evo_devices` 里存了绑定者的 openid（和追踪名单 `tracked_players` 一样，用来认"这是谁的数据"）。
解绑时每次问要不要同时删云端数据。扫码用 `wx.scanCode`（不在隐私接口黑名单里）。

**上线前要在云开发控制台做的事**（不做也不会影响别的功能，只是 Evo 那部分用不了）：

1. 部署 `evo_pc`、`evo_mp`、`evo_qrpool`（「上传并部署：云端安装依赖」），`evo_qrpool` 再「上传触发器」
2. 身份认证 → 打开**匿名登录**（电脑上的 Evo 用它领身份）
3. 云函数权限：只放开 `evo_pc` 给匿名用户调用（**别**用 `"*"` 放开全部，否则 `apex` 也能被匿名调用、消耗 API Key 配额）
4. `evo_qrpool` 的小程序码打开的版本：发布前 `develop`，正式发布后 `evo_pc` / `evo_qrpool` 两处的 `QR_ENV_VERSION` 一起改成 `release`

集合不用手动建（第一次写入时自动建）。

**测试**：`node tests/evo.test.mjs`（统计 + 界面字段）；`static.test.mjs` 的 WXML 绑定 / 样式类 / 标签闭合检查已覆盖 evo 的页面和组件。

---

## 18. 选手页（Liquipedia，2026-11 起）

**是什么**：比赛页点选手名字（冠军卡的队员、选手榜的行、名次行 → 队员弹层里的人）进到分包 `pro/player/`。
数据来自 Liquipedia 数据库 API（August 2026-11-02 拿到授权）。版式照 August 的设计稿（`派圈选手页设计稿.html`，2026-11-02）：

- **深色大卡**（两套主题都是深色，同首页大卡用 `--hero-*`）：照片位置居中、下半截渐变进卡片底色，ID（`--fs-hero`）和真名压在渐变上；
  下面一排国籍 / 年龄 / 累计奖金；再下面现在的战队（队标 + 加入时间）。退役了换成「已退役 · 最后效力于 X」。
- **资料**：出生日期、输入设备、赛区。
- **合作过的队友**：现在的两个并排，以前的按一起的时间排（写明在哪几支队、一起多久）；我们收录了的人才能点进他的页面。
  从 Liquipedia 各战队的历史名单算重叠（`liquipedia.mates`）；加入或离队日期没记的那段不算。
- **常用传奇**：图鉴头像 + 中文名（中文界面下面再写英文名）。设计稿写的「近两个赛季」Liquipedia 没有这个范围，不写。
- **战队经历**：按在队时长切开的色条（红 = 现在的队）+ 时间线（菱形点，队长这类身份翻成中文）。
- **重要比赛成绩**：只列 S、A 级（Liquipedia 1、2 级的正式比赛，不含表演赛、预选赛），先 5 条 +「查看全部 N 场」；
  看完了再给「也看小比赛」（August 11-02 要的可以切到全部）。名次放大放左边，冠军用强调色，奖金写明是全队奖金。
- **最底下「数据来源 ›」** → `pro/sources/`：Liquipedia 署名、上次同步时间、照片说明、粉丝工具声明（页面上不放这些）。

**占位**（设计稿注释里定的）：没有照片的选手用剪影（`pro/assets/silhouette.svg`）；没有队标的队写队名缩写（Team Liquid → TL）；
队友头像用名字首字母。

**选手照片（2026-11-07 起）**：ALGS 的选手定妆照（透明底半身抠图），August 拿到 EA 授权、自己收集好的（2 GB，只在 August 本机，
不进任何仓库）。`tools/build_pro_photos.py` 把照片对到 Liquipedia 页面名（名字一样 → 用对上的队友推出两边队名的对应 → 同队里名字包含 / 相似
→ 人工确认的 `OVERRIDES`；对不上就不放、不猜），定妆照优先、没有用赛场照，裁掉透明边、保留透明，压成 WebP（质量 82，
大卡 480px 约 46 KB、选手卡 320px 约 26 KB，和 PNG 肉眼看不出差别；256 色 PNG 会把皮肤压出色块，不用）。
季后赛 121 人全有照片，共 8.6 MB，超过分包 2 MB，所以**放云存储**：整个输出文件夹传到云存储 `pro/photos/v1/`，
对照表 `cloudfunctions/apex/pro_photos.json`（页面名 → 文件名前缀）里的 `base` 填 fileID 前缀（`cloud://环境.存储桶/pro/photos/v1/`）。
`proPhotos.js` 据此给 `proPlayer` 的 `photo`（大卡）、`proTeam` 名单里选手的 `photo`（选手卡，教练不给）；`base` 空着就都不给，页面照旧剪影。
页面上 `<image webp>`（网络 WebP 要加这个属性 iPhone 才认；**包里的** WebP iPhone 显示不了，见 §7 附近的说明），加载失败 → 换回剪影，不出破图。
存储的权限要「所有用户可读」（默认就是），否则别人看不到。换了照片用 `v2` 文件夹（手机上有缓存），换比赛重跑脚本、补传新人的照片。
数据来源说明页写了「选手照片来自 ALGS 官方定妆照，经 EA 授权使用」。

**战队队标（2026-11-08 起）**：放在四个地方——战队页大卡、选手页大卡上现在的战队、选手页战队经历每一行、赛季每一站详情页（`pro/event/`）的冠军卡队名前。
一律放在**深色切角方块**里（大卡上用 `--hero-track`，普通卡片、红色冠军卡上用实心的 `--hero-bg`），四周留 16%，右下切角切不到；
没有队标或加载失败：大卡、战队经历写队名缩写，冠军卡只写队名。来源（August 定的）：这一届比赛的队用 ALS 赛事页上的队标
（比赛页分组卡片用的同一批），其他队用 Liquipedia 战队资料里的队标（API 的 team 表给的 `textlesslogodarkurl`：深色底用、不带字的一版）。
用 Apex 通用标志顶替的（ALS 的 `fa.png` / `worldwide.png`，Liquipedia 文件名带 "Apex Legends" 的，如 World Wide）不算队标，照旧写缩写。
`tools/build_pro_logos.py` 一次 API 请求拿 Apex 维基全部战队（约 890 支，850 支有真队标）+ 一次拿这场比赛的参赛队（对 ALS 队名），
下载（liquipedia.net 两次隔 2 秒，第一次约半小时，之后有缓存）、裁透明边、压成最长边 192px 的 256 色 PNG（队标是平面图形看不出差别，
一张 2～8 KB，共约 4 MB），**放云存储**（几百个打进分包会超过 2 MB，而且收录的队会越来越多）：整个输出文件夹传到 `pro/logos/v1/`，
对照表 `cloudfunctions/apex/pro_logos.json`（页面名 → 文件名，编码同 `proStore.docId`、前缀 `t_`）的 `base` 填 fileID 前缀。
`proLogos.js` 据此给 `proTeam` 的 `logo`、`proPlayer` 的 `teamLogos`（{ 战队页面名: 地址 }，现在的队和待过的队）、`proRoster` 每支队的 `teamLogo`；
`base` 空着就都不给。ALS 和 Liquipedia 叫法对不上的写在脚本的 `OVERRIDES`（PXX = Pork Xiaolongbao Xpert、Team RRQ = Rex Regum Qeon…）。
换比赛（next_match_data.js 换了）、Liquipedia 上有了新队：重跑脚本，补传新文件（换了图就用 `v2`）。队标是各战队的商标，图片不在 CC BY-SA 授权里。

**为什么用定时器、不现查**：Liquipedia 每小时只给 60 次请求。所以 `apex` 的定时器（每 5 分钟）每次最多发 1 个请求
（每小时最多 12 次，两次至少隔 4 分钟），一轮 = 每场赛事的参赛名单 1 次 + 资料 / 队伍经历各 40 人 1 次
+ 他们待过的战队：历史名单 30 队、资料 40 队、成绩 10 队、转会 15 队各 1 次 + 选手成绩 5 人 1 次；
季后赛 40 队 121 人、待过 339 支队，约 120 次、十个小时抓完，抓完歇 24 小时。正在比赛的队排在前面，先有战队页。
前端三个接口只读数据库。失败的一步下次再试，连续 3 次就跳过（旧数据保留）；一次返回到 API 上限（1000 条）就拆半重查。

**收录谁**：`site_config` 集合 `_id = "pro_events"` 的 `list`（Liquipedia 赛事页面名，最多 5 场），没有就用代码里的
`Apex_Legends_Global_Series/2026/Split_2/Playoffs`。名单是 Liquipedia 上这场比赛记录的每支队伍的队员（页面名，不用对名字）。

**比赛页的名字怎么对上**（`utils/prolink.js`）：比赛页写的是 ALS 的叫法（"TL PanicApex"、"Team RRQ"）。
战队按 去空格大小写相等 → 一边包含另一边（唯一）→ 同名次 对；选手只在对上的那支队里找（去掉队名缩写前缀，相等或唯一包含）。
对不上就不能点，不猜。2026-11-02 实测：冠军 3 人、名次表 20 队、选手榜 10 人全部对上。

**不编数据**：位置字段没人填，不显示；没生日不出年龄、出生日期；奖金 0 不写；没写常用传奇就没有那一块；
还没打的比赛（Liquipedia 会提前列出已晋级的）和个人奖项不算成绩；国籍 "Non-representing" 不写；查不到中文叫法保留英文。
"现在的队友"照 Liquipedia 战队页上的在队名单（实测狼队那页和季后赛上场的三人不完全一样，照 Liquipedia 显示，不自己改）。

**上线要做的事**（合作者部署）：
1. 部署 `apex`（「上传并部署：云端安装依赖」）
2. `apex` 的环境变量加 `LIQUIPEDIA_API_KEY`（August 给；**条款：Key 不许给第三方**）。没配就不抓，选手页显示"还没有这位选手的资料"，别的功能不受影响
3. 等两三个小时（第一轮抓完），比赛页的名次行、选手名才能点
4. 选手照片、战队队标传到云存储（`pro/photos/v1/`、`pro/logos/v1/`，权限「所有用户可读」），对照表填 `base` 后再部署一次 `apex`

**本机怎么看效果**：`tools/preview.mjs` 支持分包页面和打开参数：
`PREVIEW_FIXTURE=样本.json PREVIEW_OPTIONS='{"page":"Zer0"}' node tools/preview.mjs pro/player zh dark out.html`
（样本 = `{ "proPlayer": 云函数返回值, "proRoster": 云函数返回值 }`）。预览会把 wxss 的 `@import` 接上。
预览里底部弹层会比屏幕宽：工具把页面固定成 390px，弹层却按整个窗口铺，是预览的问题，真机正常。

**测试**：`node tests/pro.test.mjs`；比赛页的连接在 `page.test.mjs`「比赛页 · 连到选手页」。

### 比赛页（2026-11-08 起，照 August 的「赛季进度条」设计稿）

**页面**：主包 `pages/matches` 只剩外壳（⚙ 导航栏、设置面板），内容是分包组件 `pro/components/season`（视图模型 `pro/utils/seasonview.js`）：
- 赛季卡（深色）：ALGS 第 6 年五站进度条（打完 / 现在这一站 / 还没到），下面一排小比赛圆点（落在开赛时的那一站下面；红点进行中、红圈主队参加），下一站（日期 + 还有几天）。
- 主队：选主队弹层（搜索、赛区、格子），存在界面偏好 `homeTeam`（只是一个队名）；主队卡写下一场（确定参加、还没打完的最早那场）和每一站名次。
- 近期比赛：进行中、60 天内开打、30 天内结束的；主队参加的置顶；类型标签写字（ALGS / 国内 / 资格赛 / 邀请赛），筛选胶囊换行不截断。
- 这个赛季：由近到远，五站大菱形（点进 `pro/event`）、小比赛小圆点（开关）。
- 所有 CN 战队：**手动名单**（August 定的），在 S2 亚太南联赛里的写名次和首发、按名次排；点进战队页。
- **只写日期**：Liquipedia 只有比赛的起止日期，没有几点开打；"进行中"按日期算，没有实时局数。

**一站的详情页** `pro/event?key=s1pl|s1po|s2pl|s2po|champ`：头（日期、状态、参赛队数、冠军）+ 原来比赛页的三块，按这一站有什么放什么：
S2 季后赛放 `match_result_data` 的最终成绩（`event.js` 的 `RESULT_STAGE`，换快照要跟着改）；`next_match_data` 对得上这一站且没打完时放分组赛程；
`algs_data` 有这一站（`ALGS_IDS`）时放战队名次、英雄选取率、三人组合；上面都没有名次表时放 Liquipedia 的名次（还没打的站是"已晋级的队"）。

**数据**（`proSeason.js`；定时器每轮多两步：`season` 取比赛列表 1 个请求、`seasonResults` 取五站 + 中国比赛的名次每 10 场 1 个请求；S2 亚太南联赛的队也加进战队同步）：
- 五站：`SEASON.stages` 的 Liquipedia 页面名。**换赛季**：改 `SEASON`（年份、from / to、五站页面名、`cnLeague`），重新部署 `apex`；
  `event.js` 的 `ALGS_IDS`、`RESULT_STAGE`，`i18n` 的 `stage_*` 跟着看一眼。
- 小比赛：开赛日期在 `SEASON.from`–`to` 里、**办在中国**的比赛（Liquipedia `tournament` 表的 `locations` 有 China / cn；August 定的只收中国的），全部等级。
- **自己录入的比赛**：集合 `pro_manual_events`，控制台里「添加记录」，一条一场：
  `name`（必填）、`start`（必填，"2026-11-22"）、`end`、`kind`（`"cn"` 国内 / `"qualifier"` 资格赛 / `"invitational"` 邀请赛，不填当国内）、
  `teams`（几支队）、`winner`（冠军队名）、`teamsIn`（参赛队名的数组，主队参加的会标出来）、`note`（一句说明）。名字或日期不对的整条不要。
- **所有 CN 战队的名单**：集合 `pro_cn_teams`。一条一支队 `{ team, name }`，或一条一整个名单 `{ list: [{ team, name }, "队名", ...] }`；
  `team` 写 Liquipedia 上的队名（对联赛名次、首发用），`name` 是页面上显示的名字。初始名单在 `tools/pro_cn_teams_import.json`
  （设计稿的 14 支去掉 TEC，13 支：Liquipedia 上的 Titan Esports Club 现役是泰国选手，August 2026-11-08 定的不再显示；一行一条记录，控制台「导入」选 JSON）。不自动认的原因：Liquipedia 战队的"赛区"对国内队不可靠（TEC、Kirisame 写成 Southeast Asia，Black Hole、2C1M 空着）。
- 名次里的 TBD（还没定的名额）不算一支队。

**测试**：`node tests/season.test.mjs`（视图模型）；云端在 `pro.test.mjs`「比赛页的赛季（云端）」；详情页在 `page.test.mjs`「赛季的一站」。

### 战队页（2026-11-07 起）

**是什么**：分包 `pro/team/`。入口：选手页大卡上现在的战队、战队经历那几行；比赛页冠军卡的队名、队伍弹层第一行「战队主页」。
只有我们存了这支队（`pro_teams` 里有）才能点，点不了的不显示 ›。版式照 August 的战队页设计稿（`战队页设计稿-浅色.svg`）：

- **深色大卡**：切角方块里放队标（没有写队名缩写，见上「战队队标」）、队名（`--fs-hero`）、赛区标签（红底缩写 NA / CN / JP… + 「北美赛区」）；
  下面进入 Apex /（解散的队多一格解散年份）/ 累计奖金。
- **现役阵容**：正式队员一张深色卡（剪影 + ID + 国籍，队长写上），教练、替补、暂停比赛的一行一个（写身份和加入时间）。
- **重要比赛成绩**：同选手页（S、A 级先 5 场）。
- **阵容变动**：+（进了阵容，强调色）/ −（离开，灰色），先 4 次（最近 4 次）+「查看全部 N 次」。说法照转会记录算：
  加入看新身份（来自哪队 / 自由选手 / 替补 / 出任教练），离队看原身份（离队 / 卸任教练，有下家写转会到哪），
  队内换身份写暂停比赛、恢复比赛、转为替补、转正、转任教练、转为主播这类；身份没变（队长换成普通队员）不算。
- **历任队员**：现在不在队的选手一人一行（教练不算），几段在队时间相加；最近离开的在前，先 5 个。
- 只看选手和教练（August 定的）：主播、经理、老板这些工作人员的名单和变动都不要。

**和设计稿不一样的地方**（数据没有，不编）：没有「所在地」（Apex 维基的战队只写了赛区，没写国家；赛区放在标签里）；
选手卡上没有指挥 / 突击这类分工（Liquipedia 没记）；阵容变动没有"退役"（转会记录只写去了哪队）。
「进入 Apex」取最早的队员加入、比赛、转会日期：维基上的成立日期各队写法不一（Alliance 写的是俱乐部 2013 年成立），都没有才用它。
赛区 2026-11-07 实测 Apex 维基 889 支队用到 12 种（Europe、North America、Japan、Southeast Asia、China、Korea…），`pronames.js` 都有中文。

**数据**（`pro_teams` 一支队一条，四样分开更新、互不覆盖）：`members`（squadplayer：选手全要、工作人员只留教练，带国籍）、
`info`（team 表：队名、赛区、状态、成立 / 解散日期、奖金）、`results`（placement 表按 `opponentname` = 队名查）、
`transfers`（transfer 表 `fromteam` / `toteam` = 队名；云端先按 role1 / role2 分成 player / sub / inactive / coach / coachInactive / other）。

**本机怎么看效果**：用开发者工具的测试副本（Evo 那边 `miniprogram/paiquan-preview` 的 `shots_team.js`，样本是 2026-11-07 抓的 9 支队）。

**测试**：`node tests/proteam.test.mjs`（视图模型）；云端部分在 `pro.test.mjs`「战队：队员表、转会、成绩、proTeam」；页面在 `page.test.mjs`「战队页」。

---

## 附：一页速查「要改 X → 动 Y → 跑 Z」

| 想做的事 | 改哪里 | 必须跑 |
|---|---|---|
| 改首页 | `pages/home/`（视觉在 `home.wxss`）、`utils/home.js`；Evo 那两块在 `evo/components/home`、`crowd` + `evo/utils/view.js` | home, evo, static, page |
| 改「全部地图」视觉 | `app.wxss`（+ `pages/maps/maps.wxml` 结构） | theme, static, page |
| 加一句文案 | `utils/i18n.js` 的 `DICT.zh` **和** `DICT.en` | i18n, page |
| 加一张地图的中文名 | `utils/core.js` 的 `MAP_CN` + 两份同步 | i18n, sync, core |
| 改四行顺序/卡片字段 | `utils/viewmodel.js` + `maps.wxml` | viewmodel, page |
| 改倒计时/差额算法 | `utils/core.js` | core, viewmodel, page |
| 换/加数据源（上游接口） | `cloudfunctions/apex/handler.js` 的 `UPSTREAM_PATH`/`ACTIONS` | handler, sync |
| 加新的云端 action | `index.js` 分支 或 `handler.js` 的 `ACTIONS` | handler |
| 改猎杀涨幅窗口 | `cloudfunctions/apex/snapshot.js` | snapshot, predgap |
| 改轮盘候选/几何 | `utils/wheel_data.js` | wheel, page |
| 改猜圈题库 | `games/data/match_rings_data.js`（题量变了要改 `utils/games_meta.js`，`page` 会提示） | rings, page |
| 改速判题库 | `games/data/rings_data.js` / `map_ends_data.js`（同上） | ringpick, page |
| 开/关/换广告位 | `utils/ad.js` | ad |
| 改主题令牌 | `app.wxss` 顶部（两套都要改） | theme, static |
| 换赛季（赛季结束时间） | **云开发控制台** `site_config` 集合（不用发版） | config 相关（无测试，手测） |
| 换战队名单 | `cloudfunctions/apex/curated_roster*.json` | teams |
| 选手页换一场赛事（收录谁） | **云开发控制台** `site_config` 集合加/改 `_id: "pro_events"`，`list: ["赛事页面名"]`（不用发版） | — |
| 改选手页 | `pro/player/`、`pro/utils/view.js`、`utils/pronames.js` | pro, static, i18n |
| 改战队页 | `pro/team/`、`pro/utils/teamview.js`（成绩那块在 `view.js`） | proteam, pro, page, static, i18n |
| 换比赛 / 补新战队的队标 | `python tools/build_pro_logos.py <工作文件夹>`，传新文件到云存储 `pro/logos/v1/`（对照表 `pro_logos.json`） | pro |
| 改比赛页 / 一站的详情页 | `pro/components/season/`、`pro/event/`、`pro/utils/seasonview.js`；数据 `cloudfunctions/apex/proSeason.js` | season, pro, page, static, i18n |
| 换赛季（比赛页） | `proSeason.js` 的 `SEASON`，`pro/event/event.js` 的 `ALGS_IDS` / `RESULT_STAGE`，`i18n` 的 `stage_*`；部署 `apex` | season, pro |
