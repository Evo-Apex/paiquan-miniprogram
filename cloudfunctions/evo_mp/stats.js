// Evo 战绩的统计（纯函数，tests/evo.test.mjs 直接测）。算法和 Evo 电脑窗口一样
// （Evo 仓库 code/panel_app.py 的 group_numbers、rank_card、rp_chart、legend_bars），两边显示的数字要对得上。
//
// 这里只回数字和代号，不回给人看的文字：中英文由小程序的 evo/utils/view.js 拼（同项目「判断/换算在 utils/ 纯函数里」的约定）。
// 读不出来的项回 null（"不编数据"：界面上显示"—"，不当作 0）。

const DAY_START_HOUR = 5 // "今日"从早上 5 点算起（同 panel_app.DAY_START_HOUR）
const DEFAULT_TZ = 480 // 电脑没传时区时按北京时间（分钟）
const MODES = ['ranked', 'pubs', 'other']
const RP_SOURCES = { 经验值页: 'xp', 对局中: 'hud', 大厅校准: 'lobby' }
// Evo 记下的段位名是游戏里的中文；这里换成代号，小程序按语言显示（徽章图片也按代号取）
const TIERS = {
  菜鸟: 'rookie', 青铜: 'bronze', 白银: 'silver', 黄金: 'gold', 白金: 'platinum',
  钻石: 'diamond', 大师: 'master', 'Apex 猎杀者': 'predator',
}
const DIVISIONS = ['IV', 'III', 'II', 'I']

// ---------- 时间：电脑上的时间是没有时区的文字（如 2026-10-24 21:03:15），按电脑的时区算 ----------

function deviceTz(devices) {
  const withTz = devices.filter((d) => Number.isInteger(d.tz))
  return withTz.length ? withTz[withTz.length - 1].tz : DEFAULT_TZ
}

function localNow(tz, nowMs = Date.now()) {
  const d = new Date(nowMs + tz * 60000)
  const pad = (n) => String(n).padStart(2, '0')
  const day = (e) => `${e.getUTCFullYear()}-${pad(e.getUTCMonth() + 1)}-${pad(e.getUTCDate())}`
  return {
    date: day(d),
    yesterday: day(new Date(d.getTime() - 86400000)),
    hour: d.getUTCHours(),
  }
}

// "今日"从哪一刻开始（早上 5 点前算前一天）
function dayStartText(now) {
  return `${now.hour >= DAY_START_HOUR ? now.date : now.yesterday} 0${DAY_START_HOUR}:00:00`
}

// 毫秒时间戳 → 电脑时区的"2026-10-24 21:03"
function stampText(ms, tz) {
  return ms ? new Date(ms + tz * 60000).toISOString().slice(0, 16).replace('T', ' ') : null
}

// ---------- 赛季（「我的」页的「赛季最高」用，2026-11-08） ----------

// 每个赛季从什么时候开始（官方开赛时刻，UTC），和 Evo 的 config/seasons.json 一样。
// 新赛季开始时两边都要加一行，evo_mp 重新部署；忘了加的话「赛季最高」会把上个赛季的段位也算进来
const SEASONS = [
  { number: 30, start: '2026-08-04T17:00:00Z' },
  { number: 31, start: '2026-11-03T18:00:00Z' },
]

// 这个赛季从电脑上的几点开始（电脑上的时间是没有时区的文字，按电脑的时区换算），如 "2026-11-04 02:00:00"
function seasonStartText(tz, nowMs = Date.now()) {
  const started = SEASONS.filter((s) => Date.parse(s.start) <= nowMs)
  if (!started.length) return null
  return stampText(Date.parse(started[started.length - 1].start), tz) + ':00'
}

const TIER_ORDER = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'predator']

// 这个赛季到过的最高段位：每局结束时和每次回大厅读到的段位里最高的那个 → { tier, division }；没有 → null
// 大师、猎杀者没有小段
function seasonPeak(rows, lobby, since) {
  if (!since) return null
  let best = null
  const look = (tier, division, when) => {
    if (!when || when < since) return
    const key = tierKey(tier)
    if (!key) return
    const top = key === 'master' || key === 'predator'
    const div = !top && DIVISIONS.includes(division) ? division : null
    const value = TIER_ORDER.indexOf(key) * 4 + (div ? DIVISIONS.indexOf(div) : 3)
    if (!best || value > best.value) best = { value, tier: key, division: div }
  }
  for (const r of rows) look(r.rank_tier, r.rank_division, r.ended_at)
  for (const l of lobby) look(l.rank_tier, l.rank_division, l.read_at)
  return best ? { tier: best.tier, division: best.division } : null
}

// 拿了几次第 1 名（所有模式）
function winCount(rows) {
  return rows.filter((r) => r.placement === 1).length
}

// ---------- 数字 ----------

// 四舍五入和 Python 一样（Evo 窗口用 Python 算，两边显示的数字要一样）：按这个数在计算机里的真实值算，
// 正好在一半时取偶数。如 12.5% → 12%；8.35 实际是 8.3499…，保留一位是 8.3
function pyRound(x, digits = 0) {
  const text = Math.abs(x).toFixed(Math.min(100, digits + 30)) // toFixed 写出真实值的十进制展开
  const [whole, frac] = text.split('.')
  const rest = frac.slice(digits)
  let n = Number(whole + frac.slice(0, digits))
  const tail = rest.slice(1)
  if (rest[0] > '5' || (rest[0] === '5' && /[1-9]/.test(tail)) || (rest[0] === '5' && n % 2 === 1)) n += 1
  return (x < 0 ? -n : n) / 10 ** digits
}

function has(v) {
  return v !== null && v !== undefined
}

function tierKey(tier) {
  return TIERS[tier] || null
}

// ---------- 每一局 ----------

function rowData(r) {
  return {
    id: r._id,
    ended_at: r.ended_at || null,
    placement: has(r.placement) ? r.placement : null,
    mode: MODES.includes(r.mode) ? r.mode : null,
    map: r.map || null,
    legend: r.legend || null,
    kills: has(r.kills) ? r.kills : null,
    assists: has(r.assists) ? r.assists : null,
    knockdowns: has(r.knockdowns) ? r.knockdowns : null,
    damage: has(r.damage) ? r.damage : null,
    rp: has(r.rp_delta) ? r.rp_delta : null,
    needs_review: Boolean(r.needs_review),
  }
}

function mateData(m) {
  const pick = (k) => (has(m[k]) ? m[k] : null)
  return {
    name: m.name || null,
    player_id: m.player_id || null,
    legend: m.legend || null,
    kills: pick('kills'),
    assists: pick('assists'),
    knockdowns: pick('knockdowns'),
    damage: pick('damage'),
    survival_time: pick('survival_time'),
    revives: pick('revives'),
    respawns: pick('respawns'),
  }
}

function detailData(r) {
  const rpKnown = has(r.rp_delta)
  return {
    ...rowData(r),
    player_name: r.player_name || null,
    participation: has(r.participation) ? r.participation : null,
    survival_time: has(r.survival_time) ? r.survival_time : null,
    revives: has(r.revives) ? r.revives : null,
    respawns: has(r.respawns) ? r.respawns : null,
    squad_kills: has(r.squad_kills) ? r.squad_kills : null,
    rp_source: rpKnown && r.rp_source ? RP_SOURCES[r.rp_source] || 'other' : null,
    rank_tier: tierKey(r.rank_tier),
    rank_division: DIVISIONS.includes(r.rank_division) ? r.rank_division : null,
    rank_progress: has(r.rank_progress) ? r.rank_progress : null,
    review_note: r.needs_review ? r.review_note || null : null,
    no_summary: Boolean(r.no_summary),
    mates: (r.mates || []).map(mateData),
  }
}

// ---------- 总览 ----------

function groupNumbers(rows) {
  const placements = rows.map((r) => r.placement).filter(has)
  // 击杀是"计分次数"的局（只有经验值页）不算进场均击杀（同 panel_app.group_numbers）
  const kills = rows.filter((r) => has(r.kills) && r.kills_counted !== true).map((r) => r.kills)
  const damages = rows.map((r) => r.damage).filter(has)
  const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
  const rate = (hit) => (placements.length ? pyRound(placements.filter(hit).length / placements.length * 100) : null)
  const avgPlace = avg(placements)
  const avgKills = avg(kills)
  const avgDamage = avg(damages)
  return {
    games: rows.length,
    avg_place: avgPlace === null ? null : pyRound(avgPlace, 1),
    avg_kills: avgKills === null ? null : pyRound(avgKills, 1),
    avg_damage: avgDamage === null ? null : pyRound(avgDamage),
    top5: rate((p) => p <= 5),
    win_rate: rate((p) => p === 1),
  }
}

function rpSum(rows) {
  const values = rows.map((r) => r.rp_delta).filter(has)
  return values.length ? values.reduce((a, b) => a + b, 0) : null
}

// 最近一次读到的段位：经验值页和大厅读数里更新的那个，时间一样时以大厅为准（同 panel_app.latest_rank）
function rankCard(rows, lobby) {
  const row = rows.slice().reverse().find((r) => Number.isInteger(r.rank_score))
  const last = lobby.length ? lobby[lobby.length - 1] : null
  let found = null
  if (last && (!row || (last.read_at || '') >= (row.ended_at || ''))) {
    found = { tier: last.rank_tier, division: last.rank_division, progress: last.rank_progress, score: last.score, when: last.read_at, lobby: true }
  } else if (row) {
    found = { tier: row.rank_tier, division: row.rank_division, progress: row.rank_progress, score: row.rank_score, when: row.ended_at, lobby: false }
  }
  const tier = found && tierKey(found.tier)
  if (!tier) return null
  return {
    tier,
    division: DIVISIONS.includes(found.division) ? found.division : null,
    progress: has(found.progress) ? found.progress : null,
    score: Number.isInteger(found.score) ? found.score : null,
    when: found.when || null,
    from_lobby: found.lobby,
  }
}

// 首页段位条：离下一段还差多少分、这一段走了百分之几。分界线是 Evo 传来的 [这一段的起点分数, 段位名]；
// 最高一段（没有下一段）或分数、分界线读不出来时回 null（不画这条）
function rankStep(score, bounds) {
  if (!Number.isInteger(score) || !bounds || !bounds.length) return null
  const sorted = bounds.slice().sort((a, b) => a[0] - b[0])
  const next = sorted.find((b) => b[0] > score)
  const start = sorted.filter((b) => b[0] <= score).pop()
  const name = next && boundName(next[1])
  if (!start || !name) return null
  return {
    next_tier: name.tier,
    next_division: name.division,
    gap: next[0] - score,
    pct: pyRound((score - start[0]) / (next[0] - start[0]) * 100, 1),
  }
}

// 首页「今日」：局数、场均名次、击杀和伤害的总数、RP。
// 总数要每一局都读到才算：有一局没读到就回 null（显示"—"），不把没读到的当作 0
function dayNumbers(rows) {
  const total = (ok, key) => (rows.length && rows.every(ok) ? rows.reduce((sum, r) => sum + r[key], 0) : null)
  return {
    games: rows.length,
    avg_place: groupNumbers(rows).avg_place,
    kills: total((r) => has(r.kills) && r.kills_counted !== true, 'kills'),
    damage: total((r) => has(r.damage), 'damage'),
    rp: rpSum(rows),
  }
}

// 段位分界线的名字（Evo 传来的是"钻石 IV""大师"这样的中文）→ 代号
function boundName(name) {
  const parts = String(name || '').trim().split(' ')
  const division = DIVISIONS.includes(parts[parts.length - 1]) ? parts.pop() : null
  const tier = tierKey(parts.join(' '))
  return tier ? { tier, division } : null
}

// RP 走势：每局结束后的段位换算成分数连成线；最后一次大厅读数更晚、分数不一样时接在最后（同 panel_app.rp_chart）
function rpChart(rows, lobby, bounds) {
  const scored = rows.filter((r) => Number.isInteger(r.rank_score))
  const points = scored.map((r) => r.rank_score)
  if (points.length < 2) return null
  const count = points.length
  const last = lobby.length ? lobby[lobby.length - 1] : null
  if (last && Number.isInteger(last.score) && (last.read_at || '') > (scored[scored.length - 1].ended_at || '')
      && last.score !== points[points.length - 1]) points.push(last.score)
  let low = Math.min(...points)
  let high = Math.max(...points)
  const end = points[points.length - 1]
  const next = bounds.find((b) => b[0] > end)
  if (next && next[0] - high <= Math.max(200, high - low)) high = Math.max(high, next[0])
  const pad = Math.max(20, (high - low) * 0.1)
  low -= pad
  high += pad
  const y = (s) => Number((1 - (s - low) / (high - low)).toFixed(4)) // 0 = 顶，1 = 底
  return {
    points: points.map(y),
    lines: bounds.filter((b) => b[0] >= low && b[0] <= high && boundName(b[1]))
      .map((b) => ({ y: y(b[0]), ...boundName(b[1]) })),
    count,
  }
}

function placementBuckets(rows) {
  const places = rows.map((r) => r.placement)
  const counts = [
    places.filter((p) => p === 1).length,
    places.filter((p) => has(p) && p >= 2 && p <= 3).length,
    places.filter((p) => has(p) && p >= 4 && p <= 10).length,
    places.filter((p) => !has(p) || p > 10).length,
  ]
  return ['p1', 'p2', 'p3', 'p4'].map((css, i) => ({ css, n: counts[i] }))
}

// 传奇表现：玩得最多的 3 个，其余合成"其他"（name 为 null，other 为 true）
function legendBars(rows, top = 3) {
  const groups = new Map()
  for (const r of rows) if (r.legend) groups.set(r.legend, [...(groups.get(r.legend) || []), r])
  if (!groups.size) return null
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  const items = ordered.slice(0, top)
  const rest = ordered.slice(top).flatMap(([, rs]) => rs)
  if (rest.length) items.push([null, rest])
  const widest = Math.max(...items.map(([, rs]) => rs.length))
  return items.map(([name, rs]) => {
    const damages = rs.map((r) => r.damage).filter(has)
    return {
      name,
      games: rs.length,
      avg_damage: damages.length ? pyRound(damages.reduce((a, b) => a + b, 0) / damages.length) : null,
      segments: placementBuckets(rs).filter((s) => s.n).map((s) => ({ css: s.css, width: Number((s.n / widest * 100).toFixed(2)) })),
      other: name === null,
    }
  })
}

// ---------- 大家在玩什么：所有 Evo 玩家最近几天的对局，只回统计数字和传奇名，不回任何人的名字 ----------

// days 天前的那一刻，写成电脑上的时间文字（和 ended_at 比大小）
function daysAgoText(days, tz = DEFAULT_TZ, nowMs = Date.now()) {
  return new Date(nowMs + tz * 60000 - days * 86400000).toISOString().slice(0, 19).replace('T', ' ')
}

// rows：这几天所有人的对局（uid = 哪台电脑，一台电脑算一位玩家）
// - legends：自己用的传奇里最热门的 top 个，pct = 占所有知道传奇的局的百分比
// - combo：三个人传奇都读到了、名次也读到了的局，按三人组合分组，至少 comboGames 局的组合里场均名次最好的那个
// 玩家少于 minPlayers 位时只回人数（几个人的数字说明不了"大家"）
function crowdStats(rows, { minPlayers = 5, comboGames = 3, top = 3 } = {}) {
  const players = new Set(rows.map((r) => r.uid)).size
  if (players < minPlayers) return { players, enough: false }
  const picked = rows.filter((r) => r.legend)
  const counts = new Map()
  for (const r of picked) counts.set(r.legend, (counts.get(r.legend) || 0) + 1)
  const legends = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top)
    .map(([name, n]) => ({ name, pct: pyRound(n / picked.length * 100) }))
  const combos = new Map()
  for (const r of rows) {
    const names = [r.legend, ...(r.mates || []).map((m) => m && m.legend)]
    if (names.length !== 3 || !names.every(Boolean) || new Set(names).size !== 3 || !has(r.placement)) continue
    const key = names.slice().sort().join('|')
    if (!combos.has(key)) combos.set(key, { legends: names.slice().sort(), places: [] })
    combos.get(key).places.push(r.placement)
  }
  let best = null
  for (const c of combos.values()) {
    if (c.places.length < comboGames) continue
    const avg = c.places.reduce((a, b) => a + b, 0) / c.places.length
    if (!best || avg < best.avg || (avg === best.avg && c.places.length > best.games)) {
      best = { legends: c.legends, avg, games: c.places.length }
    }
  }
  return {
    players,
    enough: true,
    games: rows.length,
    legends,
    combo: best ? { legends: best.legends, avg_place: pyRound(best.avg, 1), games: best.games } : null,
  }
}

// ---------- 账号：和 Evo 窗口一样，只有 1 个账号时不分账号；2 个以上时默认看最近玩过的 ----------

// 几台电脑上的游戏账号合在一起：用过同一个名字的算同一个账号（同一个账号在两台电脑上打）
function mergeAccounts(docs) {
  const groups = []
  let bounds = []
  for (const doc of docs) {
    if (doc.bounds && doc.bounds.length) bounds = doc.bounds
    for (const a of doc.accounts || []) {
      const merged = { name: a.name, keys: new Set(a.keys || []) }
      for (const g of groups.filter((x) => [...merged.keys].some((k) => x.keys.has(k)))) {
        g.keys.forEach((k) => merged.keys.add(k))
        groups.splice(groups.indexOf(g), 1)
        merged.name = merged.name || g.name
      }
      groups.push(merged)
    }
  }
  return { accounts: groups, bounds }
}

function accountView(accounts, rows, wanted) {
  const list = accounts.map((a, i) => {
    let last = ''
    for (const r of rows) if (r.player_key && a.keys.has(r.player_key) && (r.ended_at || '') > last) last = r.ended_at
    return { key: String(i), name: a.name, keys: a.keys, last }
  })
  if (list.length < 2) return { accounts: [], current: null, filter: null }
  if (wanted === 'all') return { accounts: list, current: 'all', filter: null }
  const pick = list.find((a) => a.key === wanted) || list.slice().sort((a, b) => b.last.localeCompare(a.last))[0]
  return { accounts: list, current: pick.key, filter: pick.keys }
}

function publicAccounts(view) {
  return view.accounts.map((a) => ({ key: a.key, name: a.name }))
}

function onlyAccount(rows, filter) {
  return filter ? rows.filter((r) => r.player_key && filter.has(r.player_key)) : rows
}

function byTime(key) {
  return (a, b) => (a[key] || '').localeCompare(b[key] || '') || (a.match_id || a.reading_id || 0) - (b.match_id || b.reading_id || 0)
}

module.exports = {
  MODES, deviceTz, localNow, dayStartText, stampText, pyRound, rowData, detailData, groupNumbers, rpSum, rankCard,
  rankStep, dayNumbers, rpChart, legendBars, daysAgoText, crowdStats, mergeAccounts, accountView, publicAccounts,
  onlyAccount, byTime, SEASONS, seasonStartText, seasonPeak, winCount,
}
