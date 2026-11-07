/**
 * 把 ALGS 赛事页上的**战队队标**下载并压成 64×64 PNG，供「比赛专区」分组卡片使用。
 *
 * 为什么单独一个脚本：
 *   · 源图最大 2 MB 一张（40 张合计 11 MB），不能直接进小程序包；
 *   · 本机没有可用的 Python / ImageMagick，压缩这一步用浏览器 canvas 做
 *     （项目里 tools/shot.mjs 已经是同一套 playwright-core，不额外装东西）。
 *
 * 用法：
 *   node tools/build_team_icons.mjs
 *   node tools/build_team_icons.mjs --url https://apexlegendsstatus.com/algs/.../Overview
 *
 * 默认会读 miniprogram/data/next_match_data.js 里的 event.path，去抓**当前快照那一场**的队标，
 * 所以换赛事时的正确顺序是：先跑 直播识别/build_next_match.mjs（写出新的 event.path）→
 * 再跑本脚本 → 再跑一次 build_next_match.mjs（这次才会把 icon 写进数据）。
 *
 * 输出：miniprogram/assets/teams/<原文件名>.png（64×64，约 3 KB/张，40 张约 157 KB）
 *  ⚠️ 队标是各战队的商标，这里只用于"识别是哪支队伍"。如果审核/法务上有顾虑：
 *     删掉 assets/teams 目录并把 next_match_data.js 里的 icon 置空即可 ——
 *     界面会自动退回纯文字队伍卡（有测试守着"没有图标也能正常渲染"）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const OUT = path.join(MP, "assets", "teams");
const PLAYWRIGHT = "C:/Users/Lenovo/.dsh/profiles/web/node_modules/playwright-core";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const DEFAULT_URL = "https://apexlegendsstatus.com/algs/Y6-Split2/ALGS-Playoffs/Global/Overview";
const SIZE = 64;

const args = process.argv.slice(2);

/** 默认跟着快照里的赛事走；读不到才退回写死的 URL */
function defaultUrl() {
  try {
    const mod = require(path.join(MP, "data", "next_match_data.js"));
    if (mod && mod.event && mod.event.path) {
      return "https://apexlegendsstatus.com/algs/" + mod.event.path + "/Overview";
    }
  } catch (e) { /* 没有数据文件就走默认 */ }
  return DEFAULT_URL;
}

const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : defaultUrl();

const require = createRequire(import.meta.url);

async function fetchText(u) {
  const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + u);
  return r.text();
}

function parseTeams(html) {
  const start = html.indexOf('class="playoffs-group-rosters"');
  if (start < 0) throw new Error("页面里没有 playoffs-group-rosters（结构变了？）");
  const tail = html.slice(start);
  const sections = tail.split(/<div class="playoffs-group-roster group-([A-Z])">/).slice(1);
  const teams = [];
  for (let i = 0; i < sections.length; i += 2) {
    const letter = sections[i];
    const chunk = sections[i + 1];
    for (const tc of chunk.split('<div class="playoffs-group-roster_team">').slice(1)) {
      const name = (tc.match(/playoffs-group-roster_team-name">([^<]*)</) || [])[1] || "";
      const icon = (tc.match(/playoffs-group-roster_team-icon" src="([^"]+)"/) || [])[1] || "";
      if (name.trim() && icon) teams.push({ letter, name: name.trim(), icon });
    }
  }
  return teams;
}

async function shoot(pairs) {
  const { chromium } = require(PLAYWRIGHT);
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch (e) {
    browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ["--disable-gpu", "--no-sandbox"] });
  }
  try {
    const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
    const out = [];
    for (const { file, dataUrl } of pairs) {
      const png = await page.evaluate(async ({ src, size }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        const s = Math.min(size / img.width, size / img.height);
        const w = Math.max(1, Math.round(img.width * s));
        const h = Math.max(1, Math.round(img.height * s));
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
        return c.toDataURL("image/png");
      }, { src: dataUrl, size: SIZE });
      out.push({ file, png });
    }
    return out;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log("抓赛事页 …");
  const html = await fetchText(url);
  const teams = parseTeams(html);
  console.log("队伍", teams.length);

  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apexicons-"));
  const pairs = [];
  for (const t of teams) {
    const src = "https://apexlegendsstatus.com" + t.icon;
    const r = await fetch(src, { headers: { "User-Agent": UA } });
    if (!r.ok) { console.log("✖ 下载失败", t.name, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const file = path.basename(t.icon);
    const local = path.join(tmp, file);
    fs.writeFileSync(local, buf);
    pairs.push({ file, dataUrl: "data:image/png;base64," + buf.toString("base64") });
  }

  console.log("压成 64×64 …");
  const results = await shoot(pairs);
  let total = 0;
  for (const { file, png } of results) {
    const buf = Buffer.from(png.split(",")[1], "base64");
    fs.writeFileSync(path.join(OUT, file), buf);
    total += buf.length;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`写入 ${OUT}：${results.length} 张 / ${(total / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error("✖ " + e.message);
  process.exit(1);
});
