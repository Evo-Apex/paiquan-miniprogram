// 小程序码池（AI-CONTEXT.md §17「Evo 战绩」）：定时触发（每 5 分钟），预先生成一批带绑定码的小程序码存进 evo_qr_pool。
// 电脑要绑定时，云函数 evo_pc 的 bind_code 领一个（领了才开始算 5 分钟）；扫这个码，微信直接打开小程序的绑定页（scene = 绑定码）。
// 为什么这样绕：生成小程序码要用云调用，云调用只能从小程序里或定时触发器触发，电脑调的云函数用不了（INVALID_WX_ACCESS_TOKEN）；
// 用"扫普通链接打开小程序"又要域名 ICP 备案（evotracker.cn 没备案）。码池空了，电脑那边退回自己画的二维码（要在小程序里扫）
// 补完码顺带清解绑过的电脑留在云端的数据（2026-11-11 起，见文件末尾 sweepUnbound）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 小程序码打开哪个版本：发布前用开发版（扫码的人要是开发者，开发者工具里点过"上传"才有开发版）；
// 正式发布后改成 release（evo_pc/index.js 的 QR_ENV_VERSION 一起改），下一次运行会清掉旧版本的码重新生成。2026-10-29 已改
const QR_ENV_VERSION = 'release'
const POOL_SIZE = 6 // 备好几个（绑定一台电脑才用一个）
const PER_RUN = 2 // 每次最多补几个：云函数默认 3 秒超时，生成一个要几百毫秒
const TIME_BUDGET_MS = 1800
const KEEP_USED_MS = 24 * 3600 * 1000 // 领走的码留一天就删（图片很占地方）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 同 evo_pc：去掉容易看错的 0 O 1 I
const CODE_LENGTH = 10

function newCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

exports.main = async () => {
  const started = Date.now()
  await db.createCollection('evo_qr_pool').catch(() => {})
  const col = db.collection('evo_qr_pool')
  // 清理：别的版本的码（发布后换成正式版时）、领走一天以上的
  await col.where({ env_version: _.neq(QR_ENV_VERSION) }).remove().catch(() => null)
  await col.where({ assigned: true, assigned_at: _.lt(Date.now() - KEEP_USED_MS) }).remove().catch(() => null)
  const ready = (await col.where({ assigned: false, env_version: QR_ENV_VERSION }).count()).total
  const made = []
  const errors = []
  for (let i = 0; i < Math.min(PER_RUN, POOL_SIZE - ready); i++) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    const code = newCode()
    try {
      const res = await cloud.openapi.wxacode.getUnlimited({
        scene: code, page: 'evo/bind/bind', checkPath: false, envVersion: QR_ENV_VERSION, width: 430,
      })
      await col.doc(code).set({
        data: { image: Buffer.from(res.buffer).toString('base64'), env_version: QR_ENV_VERSION, assigned: false,
          created_at: Date.now() },
      })
      made.push(code)
    } catch (err) {
      errors.push(String(err.errMsg || err.message || err).slice(0, 200))
    }
  }
  const swept = await sweepUnbound(started, errors)
  return { ready: ready + made.length, made: made.length, swept, errors }
}

// ---------- 解绑过的电脑留在云端的数据（2026-11-11 August 定：解绑就删） ----------
// evo_mp、evo_pc 的 unbind 现在当场删；这里清 11-11 以前选「只解绑、云端留着」留下的（手机上看不到、也删不掉），
// 也兜底当场没删干净的。只看解绑过的电脑（有 unbound_at、现在没绑定）；清完记 swept_at，以后不再看。
// 放在补码后面、用剩下的时间：补码要紧（绑定要用），清不完下一次（5 分钟后）接着清
const SWEEP_PER_RUN = 5
const SWEEP_BUDGET_MS = 2200 // 云函数默认 3 秒超时

function missingCollection(err) {
  return err && (err.errCode === -502005 || /collection.*not.*exist/i.test(String(err.message || err.errMsg)))
}

async function sweepUnbound(started, errors) {
  let devices = []
  try {
    devices = (await db.collection('evo_devices')
      .where({ openid: null, unbound_at: _.exists(true), swept_at: _.exists(false) })
      .limit(SWEEP_PER_RUN).get()).data
  } catch (err) {
    if (!missingCollection(err)) errors.push('sweep: ' + String(err.errMsg || err.message || err).slice(0, 200))
    return 0
  }
  let swept = 0
  for (const device of devices) {
    if (Date.now() - started > SWEEP_BUDGET_MS) break
    const uid = device._id
    try {
      for (const name of ['evo_matches', 'evo_lobby']) {
        await db.collection(name).where({ uid }).remove().catch((err) => { if (!missingCollection(err)) throw err })
      }
      await db.collection('evo_accounts').doc(uid).remove().catch(() => null) // 没有这条也没关系
      await db.collection('evo_devices').doc(uid).update({ data: { swept_at: Date.now() } })
      swept++
    } catch (err) {
      // 删到一半出错：不记 swept_at，下一次再清
      errors.push('sweep ' + uid + ': ' + String(err.errMsg || err.message || err).slice(0, 200))
    }
  }
  return swept
}
