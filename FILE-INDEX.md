# FILE-INDEX · 文件地图

> 230 个文件里，**真正要读的代码只有约 60 个**。下面是逐个说明。
> 图上标 ✅ 的优先读；标 ⚠️ 的是"看起来能改、其实不该手改"的。

---

## 根目录

| 文件 | 说明 |
|---|---|
| `AGENTS.md` | ✅ **给 AI 的硬规则**（八条红线、常用命令、提交规范、不要做的事）。动手前先看这个 |
| `START-HERE.md` | 入口，先读 |
| `AI-CONTEXT.md` | ✅ 交接主文档（架构/约定/红线/坑/状态） |
| `FILE-INDEX.md` | 本文件 |
| `.gitignore` | 已忽略：`project.private.config.json`、`preview/`、`out_*.html`、日志、`*.bak-*` |
| `MANIFEST.txt` | 全文件大小 + SHA-256 清单（**只在打包快照里**，仓库里没有） |
| `SOURCE-ALL.md` | 全部源码拼接版（**只在打包快照里**；给聊天型 AI 一次性喂进来用） |
| `PRODUCT.md` | ✅ 产品事实与硬约束（平台/用户/定位/品牌/证据） |
| `README.md` | 作者长文档（为什么这么架构、配置步骤、走过的弯路）。**部分章节过时**，见 AI-CONTEXT §14 |
| `上线清单.md` | 发版步骤清单 |
| `project.config.json` | 微信开发者工具项目配置。`miniprogramRoot=miniprogram/`、`cloudfunctionRoot=cloudfunctions/`、`appid` 在这里 |
| `project.private.config.json` | 开发者工具本机私有设置（`libVersion: 3.17.3`）。可删，工具会重建 |

---

## `miniprogram/` —— 小程序前端

### 入口与全局

| 文件 | 行数 | 说明 |
|---|---|---|
| `app.js` | 38 | 只做一件事：`wx.cloud.init`，环境 ID 是常量 `CLOUD_ENV`。刻意不设 `traceUser`（不采集用户） |
| `app.json` | 75 | 8 个主包页面 + 分包 `evo`（3 个页面）+ 5 个 tabBar + `"cloud": true` + `lazyCodeLoading` |
| `app.wxss` | 1,117 | ⚠️ **全站设计系统**：顶部是主题令牌（`page{}` 深色 / `.wrap.theme-light` 浅色），下面还有**地图页的全部样式**（地图页自己没有 wxss）。49 KB，改动影响全站 |
| `sitemap.json` | 9 | 搜索索引配置（`allow` 全部页面） |

### 页面（每个目录 4 个文件：`<名>.js/.json/.wxml/.wxss`）

| 页面 | 数据来自 | 说明 |
|---|---|---|
| `pages/home/` | 云端 `rotation`；分包组件走 `evo_mp` | **首页**（第 1 个 tab，2026-10-27）。Evo（`evo-home` 组件）→ 现在玩什么（大卡 + 小卡，`utils/home.js` 挑）→ 大家在玩什么（`evo-crowd` 组件）→ 赛事与更多 + 广告位。有自己的 `home.wxss` |
| `pages/maps/` | 云端（`rotation`/`schedule`） | **全部地图**（首页点进去的子页面，2026-10-27 前是第 1 个 tab）。四行卡片（匹配/排位/外卡/轮换）+ 倒计时 + 设置面板（语言/主题/模式显隐/置顶）+ 广告位。⚠️ **无 wxss**（样式在 `app.wxss`） |
| `pages/predator/` | 云端（`predator`/`config`/`rankdist`/`teams`/`player`）+ 离线 `prostats_data.js`；「我的战绩」走云函数 `evo_mp` | **「战绩」tab**（2026-10-27 前叫排位专区）。顶部切换：「我的战绩」= 分包 evo 的 overview 组件（Evo 同步的个人战绩）；「排位资讯」= 原来的猎杀分数线、职业选手数据、段位分布、战队专区、战绩查询 |
| `pages/matches/` | **纯离线**（`algs_data.js` + `next_match_data.js`） | 下一场比赛 + ALGS 赛场（赛事/选取率/组合/战队排名）。不联网 |
| `pages/games/` | 本地 | 小游戏分类入口页（3 张入口卡） |
| `games/ringguessr/`（分包） | 本地 `games/data/match_rings_data.js` | 猜圈练习：canvas、拖动 + 双指缩放、8 题 20 秒 |
| `games/ringpick/`（分包） | 本地 `games/data/rings_data.js` + `map_ends_data.js` | 圈型速判：四选一、10 秒一题 |
| `games/wheel/`（分包） | 本地 `codex_data.js` | 英雄 / 武器轮盘（canvas 扇形） |
| `pages/me/` | 云函数 `evo_mp` | **「我的」tab**（2026-10-27）：外壳页（导航栏 + ⚙），内容是分包 evo 的 devices 组件（绑定的电脑、扫码绑定、解绑、游戏账号）。没有 wxss |

### `miniprogram/evo/` —— 分包：Evo 战绩（2026-10-27，见 AI-CONTEXT §17）

主包当时只剩约 120 KB 余量（2026-11-07 小游戏也搬进分包 `games/` 后，主包按文件大小算约 1.2 MB），Evo 的页面、组件、段位徽章都放这个分包；主包的两个 tab 页**异步引用**这里的组件（页面 json 的 `componentPlaceholder`）。

| 文件 | 说明 |
|---|---|
| `utils/view.js` | ✅ 纯函数：云函数 `evo_mp` 回的数字和代号 → 界面字段，中英文都在这里拼（`tests/evo.test.mjs`） |
| `utils/cloud.js` | 调 `evo_mp`（永远 resolve）+ 扫码绑定 `scanToBind` |
| `utils/state.js` | 几个页面共用的内存状态（选中的账号、绑定后要重读），**不写本地存储** |
| `evo.wxss` | 共用样式（列表行、名次、按钮、账号切换），各页面 / 组件 `@import` |
| `components/overview/` | 「我的战绩」：段位、RP 走势（canvas）、统计数字、最近 5 局、传奇表现 |
| `components/devices/` | 「我的」里的 Evo：电脑列表、解绑（每次问要不要删云端数据）、账号、说明 |
| `components/home/` | 首页最上面一块（2026-10-27）：没绑定时三步怎么绑；绑定了显示我的段位、今日、上一局（可转发） |
| `components/crowd/` | 首页「大家在玩什么」：所有 Evo 玩家近 7 天的热门传奇、最好的三人组合（人数不够时整块不显示） |
| `matches/` | 全部对局（筛选模式 / 只看待确认 / 切账号，每页 20 局） |
| `match/` | 单局详情（这一局的数字 + 两名队友） |
| `bind/` | 绑定确认（扫码后打开；小程序码的 scene 或 Evo 二维码的 c 是绑定码） |
| `assets/ranks/*.png` | 段位徽章（7 张 256 色 png，80 KB；EA 的游戏素材，同 `assets/heroes/`。不用 webp：iPhone 上的微信显示不了包里的 webp） |

> 页面 js 里**只该有**：`onLoad/onShow`、`cloud.callCloud`、`setData`。
> 任何判断/换算逻辑都应该在 `utils/` 的纯函数里（否则没法测）。

### `miniprogram/utils/` —— 纯逻辑层（大部分不碰 `wx.*`）

| 文件 | 大小 | 说明 |
|---|---|---|
| `core.js` | 29 KB | ✅ 归一化、格式化、uid 判定、错误分类、译名表 `MAP_CN`、涨幅窗口。**与 `cloudfunctions/apex/core.js` 字节一致** |
| `viewmodel.js` | 30 KB | ✅ 数据 → 界面字段：四行顺序、倒计时、差额、分享链接 |
| `home.js` | 5 KB | ✅ 首页：问候语、挑大卡小卡（跟「全部地图」⚙ 的设置）、「9 分后 → 残月」、赛事卡（`tests/home.test.mjs`） |
| `i18n.js` | 37 KB | ✅ `DICT.zh` / `DICT.en` 两套词典 + 语言开关（默认 `zh`） |
| `cloud.js` | 3 KB | 云函数调用封装：**永远 resolve、不 reject**，错误文案截断 60 字 |
| `theme.js` | 3 KB | 主题开关 + `applyChrome()` 同步原生外壳（导航栏/tabBar/窗口底色） |
| `prefs.js` | 2 KB | 界面偏好落本地存储（**唯一**允许碰存储的文件，4 个白名单键） |
| `ad.js` | 4 KB | 广告位 ID（`adunit-419d525ab9b59819`，4 页共用）+ 开关 |
| `algs.js` | 10 KB | ALGS 赛场：离线数据 → 视图模型（赛事中文名、选取率、组合） |
| `nextmatch.js` | 17 KB | 下一场比赛：赛程树/分组/队员/赛制 → 视图模型（北京时间 UTC+8） |
| `prolink.js` | 5 KB | 比赛页的战队名、选手名（ALS 写法）→ Liquipedia 选手页面名（2026-11，AI-CONTEXT §18） |
| `pronames.js` | 5 KB | Liquipedia 取值的中文叫法：国籍 / 赛区 / 键鼠手柄 / 队里身份 / 比赛类型 |
| `../pro/`（分包） | — | 选手页 `pro/player/`、战队页 `pro/team/`（2026-11-07）、数据来源说明 `pro/sources/`、视图模型 `pro/utils/view.js` / `teamview.js`、剪影占位图 `pro/assets/silhouette.svg`（数据来自 Liquipedia） |
| `prostats.js` | 11 KB | 职业选手排位数据 → 视图模型（英雄选取率/组合/枪械） |
| `rankdist.js` | 4 KB | 段位分布 → 视图模型（含"你在哪"的位置换算） |
| `wheel_data.js` | 11 KB | 轮盘：候选池（读 codex）+ 扇形几何（留在主包：小游戏分类页也要用） |
| `games_meta.js` | 1 KB | 小游戏分类页显示的两个题量（题库在分包里，主包读不到，只能抄数；`tests/page.test.mjs` 核对） |
| `../games/`（分包，2026-11-07） | — | 三个玩法页 `games/ringguessr/`、`ringpick/`、`wheel/`；`games/utils/rings.js`（26 KB，猜圈：题库、判定、缩放/平移、评分）、`games/utils/ringpick.js`（13 KB，速判：出题、四个候选方向几何、视口）；题库 `games/data/`；平面图 `games/assets/flat/` |

### `miniprogram/data/` —— ⚠️ 离线数据快照（只读，别手改；2026-11-07 从 `utils/` 分出来）

| 文件 | 大小 | 内容 | 日期 |
|---|---|---|---|
| `algs_data.js` | 135 KB | ALGS 赛事统计 | 2026-10-20 |
| `next_match_data.js` | 32 KB | 下一场赛程/分组/队员 | 2026-10-26 |
| `prostats_data.js` | 116 KB | 职业选手排位数据 | 2026-10-26 |
| `codex_data.js` | 10 KB | 英雄/武器图鉴（28 英雄） | 2026-10-16 |
| `match_result_data.js` | 9 KB | 比赛页的赛果（`utils/matchresult.js` 读） | — |
| `games/data/match_rings_data.js`（分包） | 72 KB | 完整圈序列（猜圈题库） | 2026-10-25 |
| `games/data/rings_data.js`（分包） | 6 KB | 3 圈序列（速判题库） | 2026-10-25 |
| `games/data/map_ends_data.js`（分包） | 15 KB | 每图最终圈可能落点 | 2026-10-17 |
| `wheel_data.js` 的候选池来源 | — | 见上表 `wheel_data.js` | — |

### `miniprogram/assets/` —— 图片资源（共 1.9 MB，随包发布、不联网）

| 目录 | 文件 | 说明 |
|---|---|---|
| `assets/`（根） | 12 个 `tab-*.png` | tabBar 图标：当前 4 页各一对（选中/未选中），另有 `tab-ring`、`tab-stats` 两对是旧图标残留（4 个文件） |
| `assets/heroes/` | 29 个 96×96 PNG | 28 个英雄头像（`alter/madmaggie` 有重名重复份） |
| `assets/maps/` | 16 个 JPG | 六张大图实景图 + 10 个轮换据点图（`mixtape-*`），EA 官方 CDN 来源 |
| `games/assets/flat/`（分包） | 5 个 JPG | 平面战术图，猜圈、速判用（2026-11-07 从 `assets/maps/flat/` 搬来） |
| `assets/teams/` | 40 个 PNG | ALGS 战队队标（`tools/build_team_icons.mjs` 抓取） |

---

## `cloudfunctions/apex/` —— 云函数（Node 16，唯一依赖 `wx-server-sdk ~2.7.x`）

| 文件 | 行数 | 说明 |
|---|---|---|
| `index.js` | 182 | ✅ 入口：读 Key、初始化数据库、分发 `Timer`/`schedule`/`config`/`comps`/`pickrates`/`rankdist`/`teams`，最后兜底 `handle()` 且**绝不抛异常** |
| `handler.js` | 320 | ✅ 主逻辑：`ACTIONS` 白名单、URL 拼接、上游调用、错误分类、内存缓存、猎杀涨幅、追踪增删查 |
| `core.js` | — | ⚠️ **与 `miniprogram/utils/core.js` 字节一致的副本**，不要单独改 |
| `fetcher.js` | 110 | 极简 HTTP 客户端（`http/https/zlib/url`），因为云开发 Node 16 没有全局 `fetch` |
| `esports.js` | 160 | overstat.gg 赛事接口（免 Key），缓存 5 分钟/1 分钟 |
| `comps.js` | 260 | 职业三人组合：解析 ALGS 赛事页 HTML，缓存 6 小时 |
| `pickrates.js` | 180 | 英雄选取率：解析网页，缓存 1 小时 |
| `rankdist.js` | 130 | 段位分布：抓 `/lib/php/rankdistrib.php` JSON，缓存 6 小时 |
| `teams.js` | 80 | 战队专区：读名单 + 并行查分，缓存 30 分钟 |
| `liquipedia.js` | 550 | Liquipedia 数据库 API：拼请求、取数、归一化（选手、战队、成绩、转会）、算队友重叠（每小时只给 60 次，所以只由定时器调） |
| `proSync.js` | 430 | 选手、战队数据：定时器每次一步（≤1 个请求）+ `proPlayer`（带队友）/ `proRoster` / `proTeam` 读取接口 |
| `proPhotos.js` | 40 | 选手照片：页面名 → 云存储的 cloud:// 地址；对照表 `pro_photos.json` 由 `tools/build_pro_photos.py` 生成 |
| `proLogos.js` | 46 | 战队队标：战队页面名 → 云存储的 cloud:// 地址；对照表 `pro_logos.json` 由 `tools/build_pro_logos.py` 生成 |
| `proStore.js` | 190 | `pro_players` / `pro_teams` / `pro_meta` 三个集合的读写（第一次写入时自动建） |
| `snapshot.js` | 70 | 猎杀快照纯逻辑（按小时分桶、20~28h 窗口挑基准） |
| `store.js` | 90 | 猎杀快照数据库读写（错误全部降级） |
| `playerSnapshots.js` | 60 | 玩家快照纯逻辑 |
| `playerStore.js` | 140 | 追踪名单 + 玩家快照存储层 |
| `rotationLog.js` | 80 | 轮换记录器（`_id = 模式_开始时间`，幂等） |
| `trackerPoll.js` | 70 | 定时轮询（>200 人 / >400 人自动分片降频） |
| `package.json` | 8 | 只有 `wx-server-sdk: ~2.7.x`（`sync.test.mjs` 锁死） |
| `curated_roster.json` | 4.6 KB | 战队名单（人工维护） |
| `curated_roster_resolved.json` | 2.8 KB | 解析后的名单（uid 已补全） |

## `cloudfunctions/evo_*` —— Evo 战绩的三个云函数（2026-10-27，见 AI-CONTEXT §17）

和 `apex` 分开：依赖 `wx-server-sdk ~4.0.2`，写法是现代 JS（async/await）。`apex` 的 ES5 规矩和 `sync.test.mjs` 只管 `apex`。

| 文件 | 说明 |
|---|---|
| `evo_pc/index.js` | 电脑上的 Evo 调（HTTP API + 匿名登录）：`hello` / `bind_code` / `upload` / `unbind` |
| `evo_mp/index.js` | 小程序调（按 OPENID 只看自己的）：`status` / `bind` / `me` / `unbind` / `overview` / `matches` / `match` |
| `evo_mp/stats.js` | ✅ 纯函数：统计（和 Evo 电脑窗口同一套算法，`tests/evo.test.mjs`） |
| `evo_qrpool/` | 定时触发（每 5 分钟）：预先生成带绑定码的小程序码，存进 `evo_qr_pool` |

---

## `tests/` —— 30 个测试文件（`node:test`，零依赖）

| 文件 | 断言 | 守什么 |
|---|---|---|
| `core.test.mjs` | 68 | 归一化/uid/错误分类/涨幅/译名"不许猜" |
| `handler.test.mjs` | 49 | 云函数 handler |
| `page.test.mjs` | 65 | 七个页面行为 |
| `static.test.mjs` | 32 | 隐私接口黑名单、存储白名单、WXML 一致性 |
| `sync.test.mjs` | 9 | 两份 `core.js` 一致、依赖白名单、不用全局 fetch |
| `i18n.test.mjs` | 18 | 中英成对/不混排/译名清单 |
| `theme.test.mjs` | 8 | 浅色覆盖深色全部变量 |
| `viewmodel.test.mjs` | 31 | 数据 → 界面字段 |
| `snapshot.test.mjs` | 15 | 快照分桶/基准/清理 |
| `snapshot-store.test.mjs` | 13 | 数据库读写与降级（假 cloud） |
| `player-snapshots.test.mjs` | 10 | 玩家快照 |
| `player-store.test.mjs` | 11 | 追踪名单存储 |
| `tracker.test.mjs` | 10 | 追踪 action |
| `tracker-poll.test.mjs` | 6 | 定时轮询安全阀 |
| `teams.test.mjs` | 3 | 战队专区 |
| `servers.test.mjs` | 22 | 服务器状态归一化 |
| `predgap.test.mjs` | 20 | 距猎杀线差额 |
| `share.test.mjs` | 21 | 分享链接参数 |
| `cloud.test.mjs` | 9 | 云调用封装 |
| `ad.test.mjs` | 6 | 广告位开关 |
| `prostats.test.mjs` | 14 | 职业选手数据 |
| `algs.test.mjs` | 21 | ALGS 快照 |
| `nextmatch.test.mjs` | 30 | 下一场比赛 |
| `pro.test.mjs` | 50 | 选手页、战队（Liquipedia）：归一化 / 定时同步 / 读取接口 / 队友 / 视图模型 / 名字连接 |
| `proteam.test.mjs` | 14 | 战队页视图模型 |
| `comps.test.mjs` | 14 | 职业组合解析 |
| `pickrates.test.mjs` | 14 | 英雄选取率解析 |
| `rankdist.test.mjs` | 15 | 段位分布 |
| `rings.test.mjs` | 31 | 猜圈题库与判定 |
| `rings-render.test.mjs` | 6 | 猜圈渲染字段 |
| `wheel.test.mjs` | 15 | 轮盘 |
| `ringpick.test.mjs` | 14 | 速判几何 |
| `evo.test.mjs` | — | Evo 战绩：统计（四舍五入同 Python）、中英文字段、传奇 / 地图 / 段位译名、徽章文件 |
| `live.mjs` | — | **联机脚本**（真 Key 打真接口），不算测试 |

---

## `tools/` —— 开发期小工具（不参与发布）

| 文件 | 说明 |
|---|---|
| `preview.mjs` | 离线渲染器：拿真 WXML + 真 WXSS + 真数据渲成 HTML（`screenshots/` 的来源就是它这类流程）。改界面时用来"看见"效果。分包页面写 `pro/player`，打开参数用环境变量 `PREVIEW_OPTIONS`（JSON），wxss 的 `@import` 会接上 |
| `shot.mjs` / `shot.ps1` | 截图脚本（本机沙箱下 Edge 无头截图常常不可用） |
| `contrast.mjs` | 对比度计算（核 4.5:1 门槛） |
| `scan-hardcoded-colors.mjs` | 扫硬编码色值 |
| `fix-type-floor.mjs` / `fix-accent-border.mjs` | 一次性修正脚本（历史遗留，只作参考） |
| `build_team_icons.mjs` | 抓 ALGS 队标 → `assets/teams/` |
| `build_pro_photos.py` | 选手照片：ALGS 定妆照对到 Liquipedia 页面名、压成 WebP（传云存储），生成 `cloudfunctions/apex/pro_photos.json`（AI-CONTEXT §18） |
| `build_pro_logos.py` | 战队队标：这一届的队用 ALS 的、其他队用 Liquipedia 的，压成 192px PNG（传云存储），生成 `cloudfunctions/apex/pro_logos.json`（AI-CONTEXT §18） |
| `make-*-tabicon.py` | 生成 tabBar 图标 |
| `make-home-assets.py` | 生成「首页」tab 图标和首页导航栏的品牌标 `logo-mark.png`（Noto Sans SC） |
| `icon.html` / `tabicons.html` | 图标预览页 |

---

## `docs/` —— 设计知识库（历史文档，读来理解"为什么"，别当规范执行）

| 文件 | 说明 |
|---|---|
| `docs/design/README.md` | ✅ 设计总纲（三条已验证结论 + 算出来的硬缺陷） |
| `docs/design/00-baseline-current-ui.md` | 改版前基线 |
| `docs/design/01-wechat-design-guidelines.md` | 微信官方设计/无障碍要求摘录 |
| `docs/design/02-apex-visual-language.md` | Apex 视觉语言（红/暗/战术感） |
| `docs/design/03-competitor-ux-patterns.md` | 竞品 UX 分析 |
| `docs/design/04-asset-licensing-risk.md` | 素材版权风险清单 |
| `docs/design/05-wxss-rendering-capabilities.md` | WXSS 在真机上的能力边界 |
| `docs/design/06-ui-pass-2026-10.md` | 上一轮 UI 改动记录 |
| `docs/design/07-design-system.md` | ✅ 数值体系（上一轮基线） |
| `docs/apex-miniapp-ui/SKILL.md` | ✅ 界面规范（字号档位、硬规则、核验清单）。**有 3 处过时**，见 AI-CONTEXT §14 |
| `docs/apex-miniapp-ui/reference/tokens.md` | 完整令牌表 + 对比度算式 |
| `docs/apex-miniapp-ui/reference/components.md` | 卡片/导航/进度条结构规范与坑 |
| `docs/apex-miniapp-ui/reference/verify.md` | 怎么在本机"看见"改动（沙箱下哪些路是死的） |

---

## `screenshots/` —— 6 张界面图（**只在打包快照里**，仓库里没有）

**是离线预渲染稿，不是真机截图**。用途只有一个：快速理解界面长什么样、信息怎么排。
改 UI 请以 `wxml`/`wxss` 为准。详见 `screenshots/README.md`。
