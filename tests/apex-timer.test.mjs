// 云函数入口（cloudfunctions/apex/index.js）怎么认定时触发器的测试。
// 线上定时器传的 Type 是小写 "timer"（2026-11-08 实测），之前只认大写，定时任务一次都没跑。

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 不配 Key：定时分支什么都不抓，也不发网络请求
delete process.env.ALS_API_KEY;
delete process.env.LIQUIPEDIA_API_KEY;
const { main } = require(path.resolve(HERE, "..", "cloudfunctions", "apex", "index.js"));

describe("apex 入口：定时触发器", () => {
  test("线上真实的调用内容（小写 timer）走定时任务", async () => {
    const r = await main({
      Type: "timer",
      TriggerName: "poll",
      Time: "2026-11-08T18:35:00Z",
      Message: "",
      tcbContext: {},
      userInfo: {}
    });
    assert.equal(r.ok, true);
    assert.equal(r.message, "poll done");
  });

  test("大写 Timer 也认", async () => {
    const r = await main({ Type: "Timer" });
    assert.equal(r.message, "poll done");
  });

  test("不是定时器的调用不走定时任务", async () => {
    for (const event of [{}, { Type: "other" }, { Type: 123 }, null]) {
      const r = await main(event || undefined).catch(() => null);
      assert.notEqual(r && r.message, "poll done");
    }
  });
});
