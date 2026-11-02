// 守一条约束：云函数目录里的 core.js 必须和小程序端那份字节一致。
// 小程序与云函数是两个独立的上传根目录，没法互相 require，只能各放一份。
// 一旦有人只改了一边，两端的归一化/分类行为就会悄悄分叉 —— 这个测试就是防这个。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const A = path.join(ROOT, "miniprogram", "utils", "core.js");
const B = path.join(ROOT, "cloudfunctions", "apex", "core.js");

test("两份 core.js 必须完全一致", () => {
  assert.ok(existsSync(A), "缺少 " + A);
  assert.ok(existsSync(B), "缺少 " + B);
  const a = readFileSync(A, "utf8");
  const b = readFileSync(B, "utf8");
  if (a !== b) {
    const la = a.split("\n"), lb = b.split("\n");
    const diff = [];
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) diff.push("  第 " + (i + 1) + " 行：\n    小程序: " + JSON.stringify(la[i]) + "\n    云函数: " + JSON.stringify(lb[i]));
      if (diff.length >= 5) break;
    }
    assert.fail("两份 core.js 已经分叉，请同步（改完一边照抄到另一边）：\n" + diff.join("\n"));
  }
  assert.equal(a, b);
});

test("云函数的依赖只有 wx-server-sdk，且锁在 2.7.x（运行环境是 Node 16）", () => {
  // 这条原本是「零依赖」。加了猎杀底分涨幅之后必须用云开发数据库，
  // 也就必须引 wx-server-sdk —— 所以把它改成「依赖白名单」而不是干脆删掉：
  // 以后多出任何一个没想清楚的依赖，都要在这里被拦下来。
  const pkgPath = path.join(ROOT, "cloudfunctions", "apex", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = pkg.dependencies || {};
  assert.deepEqual(Object.keys(deps), ["wx-server-sdk"], "只允许 wx-server-sdk，多一个都要先想清楚");
  // 运行环境是 Node.js 16.13（云开发控制台里写的）。3.x/4.x 换过底层 @cloudbase/node-sdk，
  // 2.7.x 是那一代最稳的一支；用 ~ 锁在小版本，免得某天自动跳到不兼容的大版本。
  assert.match(deps["wx-server-sdk"], /^~2\.7\./, "必须锁在 2.7.x，别装成 4.x");
});

test("除了数据库那一层，云函数其余代码只用 Node 内置模块", () => {
  const dir = path.join(ROOT, "cloudfunctions", "apex");
  const reqsOf = (f) => {
    const src = readFileSync(path.join(dir, f), "utf8");
    return [...src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  };
  // index.js / store.js 是唯一允许 require wx-server-sdk 的两个文件
  assert.deepEqual(reqsOf("core.js"), [], "core.js 是纯逻辑，不该 require 任何东西（它要被小程序端共用）");
  assert.deepEqual([...reqsOf("fetcher.js")].sort(), ["http", "https", "url", "zlib"], "fetcher 只用 Node 内置模块");
  assert.deepEqual([...reqsOf("handler.js")].sort(), ["./core", "./esports", "./fetcher"],
    "handler 只该依赖本地文件（esports 是赛事数据模块，走 overstat 公开接口）");
  assert.deepEqual([...reqsOf("esports.js")].sort(), ["./fetcher"],
    "esports 只该依赖本地的 fetcher，不许碰 wx-server-sdk 或第三方包");
  assert.deepEqual(reqsOf("snapshot.js"), ["./core"], "snapshot 依赖 core 的窗口判定");
});

test("快照存储初始化失败时不能让整个云函数挂掉", () => {
  // 万一上传时忘了选「云端安装依赖」，依赖装不上；
  // 那时函数仍然要能查分数线，只是没有涨幅 —— 所以必须有 try/catch 兜底
  const src = readFileSync(path.join(ROOT, "cloudfunctions", "apex", "index.js"), "utf8");
  assert.match(src, /try\s*\{[\s\S]*require\("wx-server-sdk"\)[\s\S]*\}\s*catch/, "require 必须包在 try/catch 里");
  assert.match(src, /snapshots:\s*snapshots/, "要把 store 注入给 handler");
});

test("请求上游不依赖全局 fetch（微信云开发 Node 16 没有它，真机实测会直接挂）", () => {
  const dir = path.join(ROOT, "cloudfunctions", "apex");
  const h = readFileSync(path.join(dir, "handler.js"), "utf8");
  const noComments = h.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  assert.equal(/typeof fetch\s*===/.test(noComments), false,
    "不能把全局 fetch 当默认实现：微信云开发运行时没有它");
  assert.match(noComments, /require\("\.\/fetcher"\)/, "默认实现应当来自内置的 fetcher");
  assert.ok(existsSync(path.join(dir, "fetcher.js")), "缺少 fetcher.js");
});

test("fetcher.js 只用 Node 内置模块（这样才能跨 Node 版本）", () => {
  const src = readFileSync(path.join(ROOT, "cloudfunctions", "apex", "fetcher.js"), "utf8");
  const reqs = [...src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  assert.ok(reqs.length > 0, "没解析到 require");
  for (const r of reqs) {
    assert.ok(["http", "https", "zlib", "url"].includes(r),
      "fetcher 只能依赖 Node 内置模块，出现了：" + r);
  }
});

/** 递归收集小程序目录里的源文件（拆成多页之后不该再逐个列文件名） */
function mpFiles(exts) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      // 例外：第三方 vendor（ECharts 打包产物）不参与外链检查。
      // 里面的 http 地址是许可证文本和 XML 命名空间常量，不是网络请求。
      if (/ec-canvas[\\/]/.test(p)) continue;
      if (exts.some((e) => p.endsWith(e))) out.push(p);
    }
  })(path.join(ROOT, "miniprogram"));
  return out;
}

test("小程序端不硬编码任何 API Key", () => {
  const files = mpFiles([".js", ".wxml", ".json"]);
  assert.ok(files.length >= 8, "没扫到文件，路径可能写错了（扫到 " + files.length + " 个）");
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    const rel = f.replace(ROOT, "");
    assert.equal(/[0-9a-f]{32}/.test(s), false, rel + " 里疑似写了 32 位十六进制 Key");
    assert.equal(/ALS_API_KEY\s*[:=]\s*["'][^"']+["']/.test(s), false, rel + " 里不该给 ALS_API_KEY 赋值");
  }
});

test("小程序端不得引用任何外部域名（图片/请求都不行，境外域名无法备案）", () => {
  const files = mpFiles([".js", ".wxml", ".wxss", ".json"]);
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    const rel = f.replace(ROOT, "");
    const urls = [...s.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
    // 只允许白名单里这几个：都不是用来发请求的，只是文档链接/提示文字
    const bad = urls.filter((u) => !/^https?:\/\/(developers\.weixin\.qq\.com|portal\.apexlegendsapi\.com)/.test(u));
    assert.deepEqual(bad, [], rel + " 里出现了外部地址，会被小程序域名白名单拦掉：" + JSON.stringify(bad));
  }
});

test("三个页面都真的存在（拆页之后最容易漏一个）", () => {
  for (const n of ["maps", "predator", "ringguessr"]) {
    for (const ext of [".js", ".wxml", ".json"]) {
      const p = path.join(ROOT, "miniprogram", "pages", n, n + ext);
      assert.ok(existsSync(p), "缺少页面文件 " + n + ext);
    }
  }
});
