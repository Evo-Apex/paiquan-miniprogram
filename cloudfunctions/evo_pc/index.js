// 电脑上的 Evo 调用的云函数（AI-CONTEXT.md §17「Evo 战绩」）：Evo 用云开发的匿名登录领一个身份，经 HTTP API 调这里。
// 云端按这个身份（TCB_UUID）认电脑：一台电脑一个匿名用户，设备编号存在 Evo 的数据文件夹里（Evo 仓库的 code/cloud_sync.py）。
//
// event.action：
// - hello：这台电脑绑定了没有（第一次调用时登记这台电脑）
// - bind_code：要一个绑定码（5 分钟内有效、只能用一次），尽量连同小程序码（PNG，base64）：从码池 evo_qr_pool 领一个
//   （云函数 evo_qrpool 定时生成；这里生成不了：云调用只能从小程序里或定时触发器触发，电脑调的回 INVALID_WX_ACCESS_TOKEN）。
//   码池空了只回绑定码，Evo 自己画二维码（要在小程序「我的」里点"扫码绑定"扫）
// - upload：传对局、大厅读数、账号（只有绑定了才收）；deleted 是电脑上删掉的局
// - unbind：解绑，同时删掉这台电脑传上来的所有数据（2026-11-11 起一律删，不再看 delete_data：
//   原来"只解绑、云端留着"的数据谁也看不到、也删不掉。0.5.x 的 Evo 还会传 false，照样删）
// 回 { ok: true, ... } 或 { ok: false, error: 'not_bound' | 'bad_request' | 'no_identity' | 'server', message }
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const CODE_TTL_MS = 5 * 60 * 1000
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉容易看错的 0 O 1 I
const CODE_LENGTH = 10
const MAX_MATCHES = 20 // 一次最多收几局（云函数默认 3 秒超时，Evo 那边分批传）
const MAX_LOBBY = 100
const MAX_DELETED = 100
const MAX_ACCOUNTS = 20
const QR_ENV_VERSION = 'release' // 码池里的小程序码打开哪个版本，同 evo_qrpool/index.js（2026-10-29 派圈助手正式发布，两边一起改成 release）

// 只取认调用者用的一项：context.environ 里还有临时密钥，不能整个用
function callerUid(context) {
  for (const pair of String((context && context.environ) || '').split(';')) {
    const i = pair.indexOf('=')
    if (i > 0 && pair.slice(0, i) === 'TCB_UUID') return pair.slice(i + 1) || null
  }
  return process.env.TCB_UUID || null
}

// ---------- 收到的数据：只留认识的项，类型不对的当作没有（null） ----------

const INT = 'int'
const STR = 'str'
const BOOL = 'bool'
const MATCH_FIELDS = {
  match_id: INT, started_at: STR, ended_at: STR, player_name: STR, player_key: STR, mode: STR, map: STR, legend: STR,
  placement: INT, squad_kills: INT, kills: INT, assists: INT, knockdowns: INT, participation: INT, damage: INT,
  survival_time: INT, revives: INT, respawns: INT, rp_delta: INT, rp_source: STR, rank_tier: STR, rank_division: STR,
  rank_progress: INT, rank_name: STR, rank_score: INT, needs_review: BOOL, review_note: STR, no_summary: BOOL,
  kills_counted: BOOL, app_version: STR,
}
const MATE_FIELDS = {
  slot: STR, name: STR, player_id: STR, legend: STR, kills: INT, assists: INT, knockdowns: INT, damage: INT,
  survival_time: INT, revives: INT, respawns: INT,
}
const LOBBY_FIELDS = {
  reading_id: INT, read_at: STR, player_name: STR, player_key: STR, rank_tier: STR, rank_division: STR,
  rank_progress: INT, rank_name: STR, score: INT,
}

function cleanValue(kind, value, maxLength) {
  if (kind === INT) return Number.isInteger(value) && Math.abs(value) < 1e7 ? value : null
  if (kind === BOOL) return typeof value === 'boolean' ? value : null
  return typeof value === 'string' ? value.slice(0, maxLength) : null
}

function clean(fields, raw, maxLength = 100) {
  const out = {}
  for (const key of Object.keys(fields)) {
    out[key] = cleanValue(fields[key], raw ? raw[key] : undefined, key === 'review_note' ? 500 : maxLength)
  }
  return out
}

function strList(raw, maxItems, maxLength = 100) {
  return Array.isArray(raw)
    ? raw.filter((s) => typeof s === 'string').slice(0, maxItems).map((s) => s.slice(0, maxLength))
    : []
}

function cleanMatch(raw) {
  const m = clean(MATCH_FIELDS, raw)
  if (m.match_id === null) return null
  m.edited = strList(raw.edited, 20, 40)
  m.mates = Array.isArray(raw.mates) ? raw.mates.slice(0, 2).map((x) => clean(MATE_FIELDS, x)) : []
  return m
}

function cleanAccounts(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_ACCOUNTS).map((a) => ({
    id: cleanValue(INT, a && a.id),
    name: cleanValue(STR, a && a.name, 100),
    keys: strList(a && a.keys, 20),
  })).filter((a) => a.id !== null)
}

function cleanBounds(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 60).filter((b) => Array.isArray(b) && Number.isInteger(b[0]) && typeof b[1] === 'string')
    .map((b) => [b[0], b[1].slice(0, 40)])
}

// ---------- 数据库：集合第一次用到时自动建 ----------

function missingCollection(err) {
  return err && (err.errCode === -502005 || /collection.*not.*exist/i.test(String(err.message || err.errMsg)))
}

async function withCollection(name, fn) {
  try {
    return await fn(db.collection(name))
  } catch (err) {
    if (!missingCollection(err)) throw err
    await db.createCollection(name).catch(() => {})
    return fn(db.collection(name))
  }
}

async function getDoc(name, id) {
  try {
    const res = await withCollection(name, (c) => c.doc(id).get())
    return res.data || null
  } catch (err) {
    if (/not exist|cannot find|does not exist/i.test(String(err.message || err.errMsg))) return null
    throw err
  }
}

async function getDevice(uid) {
  return getDoc('evo_devices', uid)
}

// ---------- 各个 action ----------

async function hello(uid, event) {
  let device = await getDevice(uid)
  const meta = { last_seen: db.serverDate(), app_version: cleanValue(STR, event.app_version, 20), tz: cleanValue(INT, event.tz) }
  if (!device) {
    device = { openid: null, created_at: Date.now() }
    await withCollection('evo_devices', (c) => c.doc(uid).set({ data: { ...device, ...meta } }))
  } else {
    await withCollection('evo_devices', (c) => c.doc(uid).update({ data: meta }))
  }
  return { ok: true, bound: Boolean(device.openid), bound_at: device.bound_at || null }
}

function newCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

async function bindCode(uid) {
  const device = await getDevice(uid)
  if (!device) return { ok: false, error: 'bad_request', message: '先调 hello' }
  // 同一台电脑只留最新的一个绑定码
  await withCollection('evo_bind_codes', (c) => c.where({ uid, used: false }).remove())
  const claimed = await claimQr(uid)
  const code = claimed ? claimed.code : newCode()
  const now = Date.now()
  await withCollection('evo_bind_codes', (c) => c.doc(code).set({
    data: { uid, used: false, created_at: now, expires_at: now + CODE_TTL_MS },
  }))
  return { ok: true, code, expires_in: CODE_TTL_MS / 1000, image: claimed ? claimed.image : null }
}

// 从码池领一个小程序码：先找一个没领的，再"只在还没被领时"标成领走（两台电脑同时来也不会领到同一个）
async function claimQr(uid) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let doc = null
    try {
      const res = await db.collection('evo_qr_pool').where({ assigned: false, env_version: QR_ENV_VERSION })
        .limit(1).get()
      doc = res.data[0]
    } catch (err) {
      return null // 码池还没建（evo_qrpool 还没跑过）
    }
    if (!doc) return null
    const res = await db.collection('evo_qr_pool').where({ _id: doc._id, assigned: false })
      .update({ data: { assigned: true, assigned_at: Date.now(), uid } })
    if (res.stats && res.stats.updated === 1) return { code: doc._id, image: doc.image }
  }
  return null
}

async function upload(uid, event) {
  const device = await getDevice(uid)
  if (!device || !device.openid) return { ok: false, error: 'not_bound', message: '这台电脑还没有绑定微信' }
  const rawMatches = Array.isArray(event.matches) ? event.matches : []
  const rawLobby = Array.isArray(event.lobby) ? event.lobby : []
  const deleted = Array.isArray(event.deleted) ? event.deleted.filter(Number.isInteger) : []
  if (rawMatches.length > MAX_MATCHES || rawLobby.length > MAX_LOBBY || deleted.length > MAX_DELETED) {
    return { ok: false, error: 'bad_request', message: '一次传得太多' }
  }
  const now = db.serverDate()
  const matches = rawMatches.map(cleanMatch).filter(Boolean)
  const lobby = rawLobby.map((r) => clean(LOBBY_FIELDS, r)).filter((r) => r.reading_id !== null)
  await Promise.all([
    ...matches.map((m) => withCollection('evo_matches', (c) => c.doc(`${uid}:${m.match_id}`).set({
      data: { ...m, uid, updated_at: now },
    }))),
    ...lobby.map((r) => withCollection('evo_lobby', (c) => c.doc(`${uid}:${r.reading_id}`).set({
      data: { ...r, uid, updated_at: now },
    }))),
    ...deleted.map((id) => withCollection('evo_matches', (c) => c.doc(`${uid}:${id}`).remove()).catch(() => null)),
  ])
  if (event.accounts !== undefined) {
    await withCollection('evo_accounts', (c) => c.doc(uid).set({
      data: { uid, accounts: cleanAccounts(event.accounts), bounds: cleanBounds(event.bounds), updated_at: now },
    }))
  }
  await withCollection('evo_devices', (c) => c.doc(uid).update({
    data: { last_upload_at: now, app_version: cleanValue(STR, event.app_version, 20), tz: cleanValue(INT, event.tz) },
  }))
  return { ok: true, matches: matches.length, lobby: lobby.length, deleted: deleted.length }
}

async function removeData(uid) {
  for (const name of ['evo_matches', 'evo_lobby']) {
    await withCollection(name, (c) => c.where({ uid }).remove())
  }
  await withCollection('evo_accounts', (c) => c.doc(uid).remove()).catch(() => null)
}

async function unbind(uid, event) {
  const device = await getDevice(uid)
  if (device) {
    await withCollection('evo_devices', (c) => c.doc(uid).update({ data: { openid: null, unbound_at: Date.now() } }))
  }
  await removeData(uid)
  return { ok: true, deleted: true }
}

exports.main = async (event, context) => {
  const uid = callerUid(context)
  if (!uid || cloud.getWXContext().OPENID) return { ok: false, error: 'no_identity', message: '只给电脑上的 Evo 用' }
  try {
    switch (event && event.action) {
      case 'hello': return await hello(uid, event)
      case 'bind_code': return await bindCode(uid)
      case 'upload': return await upload(uid, event)
      case 'unbind': return await unbind(uid, event)
      default: return { ok: false, error: 'bad_request', message: '不认识的 action' }
    }
  } catch (err) {
    console.error(err)
    return { ok: false, error: 'server', message: String(err.errMsg || err.message || err).slice(0, 200) }
  }
}
