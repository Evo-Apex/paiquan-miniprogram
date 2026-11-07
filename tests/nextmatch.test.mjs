// 比赛专区 · 下一场比赛（赛程 / 分组 / 队员）。
//
// 这一块的数据是离线快照（next_match_data.js），但**视图逻辑必须能处理三种真实情况**：
//   1) 官方排好了时间 → 显示赛程 + 分组；
//   2) 还没排时间     → 只显示分组（用户 2026-10-18 的原话），不许编时间；
//   3) 名单还没公布   → 显示「待公布」，不许编队员。
// 所以这里大部分用例用**注入的假数据**，只有最后几组钉真实快照的形状。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(HERE, "..", "miniprogram");
const require = createRequire(import.meta.url);

const next = require(path.join(MP, "utils", "nextmatch.js"));

// 1793293200 = 北京时间 2026-10-30 01:00（周五）
const T1 = 1793293200;
const T2 = 1793466000;   // 2026-11-01 01:00
const T3 = 1793496600;   // 2026-11-01 09:30

function fixture(over = {}) {
  return Object.assign({
    updated: "2026-10-18",
    event: { split: "Y6-Split2", league: "ALGS-Playoffs", region: "Global" },
    schedule: [
      { key: "k1", day: "Day1", bracket: "AvB", name: "Group A vs. B", at: T1 },
      { key: "k2", day: "Day3", bracket: "LosersRound1", name: "Losers R. 1", at: T2 },
      { key: "k3", day: "Day3", bracket: "CustomRound", name: "Custom Round", at: T3 },
      { key: "k4", day: "Day1", bracket: "BvC", name: "Group B vs. C", at: null }
    ],
    groups: [
      {
        key: "A", teams: [
          { name: "Alpha", players: [
            { name: "p1", cc: "cn", country: "China", input: "Mouse & Keyboard" },
            { name: "p2", cc: "", country: "", input: "" }
          ] },
          { name: "Bravo", players: [] }
        ]
      },
      { key: "B", teams: [{ name: "Charlie", players: [{ name: "p3", cc: "se", country: "Sweden", input: "Controller" }] }] }
    ]
  }, over);
}

const stripCjk = (s) => !/[\u4e00-\u9fff]/.test(String(s));

describe("下一场比赛 · 赛程与时间", () => {
  test("主卡片：未来最近一场的北京时间 + 场次名", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    assert.equal(v.nextTimeText, "10月30日 周五 01:00");
    assert.equal(v.nextMatchText, "A 组 vs B 组");
    assert.equal(v.hasNext, true);
    assert.equal(v.hasStatus, true);
  });

  test("倒计时按打开页面的那一刻算（12 天 / 小时 / 分钟）", () => {
    const day = 86400000;
    assert.equal(next.build("zh", T1 * 1000 - 12 * day, "A", fixture()).statusText, "还有 12 天");
    assert.equal(next.build("zh", T1 * 1000 - 5 * 3600000, "A", fixture()).statusText, "还有 5 小时");
    assert.equal(next.build("zh", T1 * 1000 - 20 * 60000, "A", fixture()).statusText, "还有 20 分钟");
    assert.equal(next.build("en", T1 * 1000 - 12 * day, "A", fixture()).statusText, "in 12 days");
  });

  test("过了最后一场就不再说「下一场」：先到点、后结束（不猜比分）", () => {
    const started = next.build("zh", (T3 + 600) * 1000, "A", fixture());
    assert.equal(started.hasNext, false);
    assert.equal(started.statusText, "已到开赛时间");
    const ended = next.build("zh", (T3 + 3 * 3600) * 1000, "A", fixture());
    assert.equal(ended.statusText, "赛程已结束");
  });

  test("赛程格子：日期 + 时间 + 场次，已排期的按时间升序", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    assert.deepEqual(v.slots.map((s) => s.label), ["10/30 01:00", "11/01 01:00", "11/01 09:30"]);
    assert.equal(v.slots[0].name, "A组 vs B组");
    assert.equal(v.slots[1].name, "败者组第 1 轮");
    assert.equal(v.hasTimes, true);
    assert.equal(v.hasUntimed, true);
    assert.equal(v.untimed[0].name, "B 组 vs C 组");
  });

  test("认不出的阶段名给上游原文（不猜中文）", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    assert.equal(v.slots[2].name, "Custom Round");
  });

  test("官方还没排时间：只显示分组，主卡片写「时间待定」", () => {
    const data = fixture();
    data.schedule.forEach((m) => { m.at = null; });
    const v = next.build("zh", T1 * 1000, "A", data);
    assert.equal(v.hasTimes, false);
    assert.deepEqual(v.slots, []);
    assert.equal(v.nextTimeText, "时间待定");
    assert.equal(v.statusText, "时间待定");
    assert.equal(v.hasNext, false);
    assert.equal(v.nextMatchText, "A 组 vs B 组");
    assert.equal(v.noTimeNote, "官方还没公布开赛时间，先看分组。");
    assert.equal(v.hasStatus, false);          // 没有时间可说时，胶囊也不显示
    assert.equal(v.groups.length, 2);          // 分组照常给
  });

  test("赛程只有开始时间，不会自己补时长/比分", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    const keys = Object.keys(v.slots[0]).sort();
    assert.deepEqual(keys, ["key", "label", "name"]);
  });
});

describe("下一场比赛 · 分组与队员", () => {
  test("分组标签：组名 + 队数；选中的那组带 active", () => {
    const v = next.build("zh", T1 * 1000, "B", fixture());
    assert.deepEqual(v.groups.map((g) => g.name), ["A 组", "B 组"]);
    assert.deepEqual(v.groups.map((g) => g.countText), ["2 队", "1 队"]);
    assert.equal(v.groups[0].active, false);
    assert.equal(v.groups[1].active, true);
    assert.equal(v.activeGroupName, "B 组");
    assert.deepEqual(v.teams.map((t) => t.name), ["Charlie"]);
  });

  test("队伍行：队员数 + 队员名 + 「国家名 · 键鼠/手柄」", () => {
    const v = next.build("zh", T1 * 1000, "A", fixture());
    assert.equal(v.teams[0].countText, "2 人");
    assert.equal(v.teams[0].players[0].meta, "中国 · 键鼠");
    assert.equal(v.teams[0].players[1].meta, "");        // 没标注就留空，不猜
    assert.equal(v.teams[0].hasPlayers, true);
  });

  test("台湾选手的国籍写「中国台湾」（中文）/「Taiwan, China」（英文）", () => {
    const data = {
      updated: "2026-10-18",
      event: {},
      schedule: [{ key: "k", bracket: "AvB", name: "", at: T1 }],
      groups: [{
        key: "A", teams: [{
          name: "Wolves Esports",
          players: [{ name: "QQ", cc: "tw", country: "Taiwan", input: "Mouse & Keyboard" }]
        }]
      }]
    };
    assert.equal(next.build("zh", T1 * 1000, "A", data).teams[0].players[0].meta, "中国台湾 · 键鼠");
    assert.equal(next.build("en", T1 * 1000, "A", data).teams[0].players[0].meta, "Taiwan, China · MnK");
  });

  test("名单还没公布：显示「待公布」，hasPlayers=false", () => {
    const v = next.build("zh", T1 * 1000, "A", fixture());
    assert.equal(v.teams[1].hasPlayers, false);
    assert.equal(v.teams[1].countText, "待公布");
    assert.equal(next.build("en", T1 * 1000, "A", fixture()).teams[1].countText, "TBD");
  });

  test("没有旗标代码但有国家名时，退回国家全称（不硬编一个代码）", () => {
    const data = {
      updated: "2026-10-18",
      event: {},
      schedule: [{ key: "k", bracket: "AvB", name: "", at: T1 }],
      groups: [{ key: "A", teams: [{ name: "Alpha", players: [{ name: "p", cc: "", country: "Japan", input: "" }] }] }]
    };
    const v = next.build("zh", T1 * 1000 - 1000, "A", data);
    assert.equal(v.teams[0].players[0].meta, "Japan");
  });

  test("代码认不出但有英文全称：给全称，绝不把两个字母丢给用户", () => {
    const data = {
      updated: "2026-10-18",
      event: {},
      schedule: [{ key: "k", bracket: "AvB", name: "", at: T1 }],
      groups: [{ key: "A", teams: [{ name: "Alpha", players: [{ name: "p", cc: "zz", country: "Neverland", input: "" }] }] }]
    };
    const v = next.build("zh", T1 * 1000 - 1000, "A", data);
    assert.equal(v.teams[0].players[0].meta, "Neverland");
    assert.notEqual(v.teams[0].players[0].meta, "ZZ");
  });

  test("选一个不存在的组分不到时，退回第一组（不空白）", () => {
    const v = next.build("zh", T1 * 1000, "Z", fixture());
    assert.equal(v.activeGroup, "A");
    assert.equal(v.teams[0].name, "Alpha");
  });

  test("一条数据都没有就整块不渲染（返回 null，不硬造占位）", () => {
    assert.equal(next.build("zh", Date.now(), "A", { schedule: [], groups: [] }), null);
    assert.equal(next.build("zh", Date.now(), "A", {}), null);
  });
});

describe("下一场比赛 · 中英文", () => {
  test("英文：赛事名/赛区/阶段名/设备标注都是英文", () => {
    const v = next.build("en", T1 * 1000 - 12 * 86400000, "A", fixture());
    assert.equal(v.eventLabel, "ALGS Playoffs");
    assert.match(v.eventSub, /^Year 6 · Split 2 · Global · Oct 30/);   // 末尾是日期范围
    assert.equal(v.nextMatchText, "Group A vs B");
    assert.equal(v.slots[1].name, "Losers R1");       // 格子里用短写，避免省略号
    assert.equal(v.teams[0].players[0].meta, "China · MnK");
    assert.equal(v.statusText, "in 12 days");
  });

  test("英文视图里不许出现中文", () => {
    const v = next.build("en", T1 * 1000 - 1000, "A", fixture());
    const walk = (o, trail) => {
      if (typeof o === "string") {
        assert.ok(stripCjk(o), trail + " 里混进了中文：" + o);
      } else if (Array.isArray(o)) {
        o.forEach((x, i) => walk(x, trail + "[" + i + "]"));
      } else if (o && typeof o === "object") {
        Object.keys(o).forEach((k) => walk(o[k], trail + "." + k));
      }
    };
    walk(v, "next");
  });

  test("没覆盖掉地图页在用的 nextUp 词条（「接着轮换」）", () => {
    // 命名撞过一次：新加的「下一场」一开始也叫 nextUp，把地图页的
    // "接着轮换" 覆盖成了 "下一场" —— 同一个对象字面量里后面的键会赢，而且不报错。
    const i18n = require(path.join(MP, "utils", "i18n.js"));
    assert.equal(i18n.T("zh").nextUp, "接着轮换");
    assert.equal(i18n.T("en").nextUp, "Up next");
    assert.equal(i18n.T("zh").nextMatchLabel, "下一场");
    assert.equal(i18n.T("en").nextMatchLabel, "Next up");
  });
});

describe("下一场比赛 · 真实快照的形状", () => {
  const D = next.DATA;

  test("赛事是 Y6-Split2 的 ALGS 季后赛（2026-10 抓到的未来赛程）", () => {
    assert.equal(D.event.split, "Y6-Split2");
    assert.equal(D.event.league, "ALGS-Playoffs");
    assert.equal(D.event.region, "Global");
  });

  test("赛程：10 场、时间升序、都有开始时间", () => {
    assert.equal(D.schedule.length, 10);
    D.schedule.forEach((m) => {
      assert.ok(m.at > 0, m.key + " 没有开始时间");
      assert.ok(m.bracket, m.key + " 没有阶段键");
    });
    const ats = D.schedule.map((m) => m.at);
    assert.deepEqual(ats, [...ats].sort((a, b) => a - b), "赛程没有按时间排序");
  });

  test("分组：A/B/C/D 四组，各 10 队，队名不跨组重复", () => {
    assert.deepEqual(D.groups.map((g) => g.key), ["A", "B", "C", "D"]);
    D.groups.forEach((g) => assert.equal(g.teams.length, 10, g.key + " 组不是 10 队"));
    const names = D.groups.flatMap((g) => g.teams.map((t) => t.name));
    assert.equal(new Set(names).size, names.length, "有队伍同时出现在两个组里");
  });

  test("队员：每队都有人（赛事页公布的 3~4 人），名字非空", () => {
    let total = 0;
    D.groups.forEach((g) => g.teams.forEach((t) => {
      assert.ok(t.players.length >= 1, t.name + " 一个队员都没有");
      total += t.players.length;
      t.players.forEach((p) => assert.ok(p.name.trim(), t.name + " 有空队员名"));
    }));
    assert.ok(total >= 120, "队员总数偏少：" + total);
  });

  test("每位有国籍的队员都显示中文全名（不是代码，也不是英文）", () => {
    const checked = new Set();
    ["A", "B", "C", "D"].forEach((g) => {
      const v = next.build("zh", T1 * 1000 - 1000, g);
      v.teams.forEach((t) => t.players.forEach((p) => {
        if (!p.meta) return;                    // 上游没给国籍（教练/替补）就留空，不编
        const country = p.meta.split(" · ")[0];
        checked.add(country);
        assert.match(country, /[\u4e00-\u9fff]/, p.name + " 的国籍不是中文全名：" + p.meta);
      }));
    });
    assert.ok(checked.size >= 20, "该有的国家没覆盖到：" + checked.size);
    assert.ok(checked.has("中国台湾"), "快照里的台湾选手应显示「中国台湾」");
    assert.ok(checked.has("中国"), "快照里的中国大陆选手应显示「中国」");
  });

  test("首场：北京时间 2026-10-30 01:00，A 组 vs B 组", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A");
    assert.equal(v.nextTimeText, "10月30日 周五 01:00");
    assert.equal(v.nextMatchText, "A 组 vs B 组");
    assert.equal(v.groups.length, 4);
    assert.equal(v.teams.length, 10);
    assert.match(v.eventSub, /10\/30–11\/02$/);     // 赛事日期范围（北京时间）
  });

  test("赛制：官方 4 组循环 + 赛点制决赛，翻成四条中文路径", () => {
    assert.equal(D.format.key, "rr4-mp");
    const v = next.build("zh", T1 * 1000 - 1000, "A");
    assert.ok(v.format, "真实快照必须带赛制");
    assert.match(v.format.summary, /赛点制/);
    assert.equal(v.format.lines.length, 4);
    assert.equal(v.format.lines[0].k, "小组赛");
    assert.match(v.format.lines[0].v, /前 20 进胜者组/);
    assert.match(v.format.lines[1].v, /败者组第二轮/);
    // 英文版同样是四条，不是空壳
    const en = next.build("en", T1 * 1000 - 1000, "A");
    assert.equal(en.format.lines.length, 4);
    assert.match(en.format.summary, /winners \/ losers/);
    assert.match(en.format.lines[0].v, /Top 20/);
  });

  test("认不出的赛制不渲染（不猜晋级规则）", () => {
    assert.equal(next.formatView({ key: "unknown", text: "x" }, "zh"), null);
    assert.equal(next.formatView(null, "zh"), null);
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    assert.equal(v.format, null);
  });

  test("组内赛程：换组跟着换，且只列这个组的三场", () => {
    const a = next.build("zh", T1 * 1000 - 1000, "A");
    assert.match(a.activeMatchesText, /^小组赛：10\/30 01:00 vs B 组/);
    assert.equal((a.activeMatchesText.match(/vs/g) || []).length, 3);
    const d = next.build("zh", T1 * 1000 - 1000, "D");
    assert.notEqual(d.activeMatchesText, a.activeMatchesText);
    assert.equal((d.activeMatchesText.match(/vs/g) || []).length, 3);
  });

  test("队标：40 队都有 64×64 PNG，文件真实存在", () => {
    let n = 0;
    D.groups.forEach((g) => g.teams.forEach((t) => {
      assert.ok(t.icon, t.name + " 没有队标");
      const p = path.join(MP, t.icon);
      assert.ok(existsSync(p), t.name + " 的队标文件不存在：" + t.icon);
      const buf = readFileSync(p);
      assert.equal(buf.slice(1, 4).toString("ascii"), "PNG", t.name + " 不是 PNG");
      assert.equal(buf.readUInt32BE(16), 64, t.name + " 宽度不是 64");
      assert.equal(buf.readUInt32BE(20), 64, t.name + " 高度不是 64");
      n++;
    }));
    assert.equal(n, 40);
  });

  test("没有队标的队伍也能正常渲染（不出现破图）", () => {
    const v = next.build("zh", T1 * 1000 - 1000, "A", fixture());
    assert.equal(v.teams[0].hasIcon, false);
    assert.equal(v.teams[0].icon, "");
  });

  test("数据文件里不出现外部域名（小程序不许直连境外域名）", () => {
    const src = readFileSync(path.join(MP, "data", "next_match_data.js"), "utf8");
    assert.equal(/https?:\/\//.test(src), false, "快照里不该有完整 URL，只留赛事路径");
  });
});
