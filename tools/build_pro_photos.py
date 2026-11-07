"""选手照片（2026-11-07）：把 ALGS 的选手照片对到 Liquipedia 的选手页面名，压成 WebP，准备传到云存储。

照片是 August 拿到 EA 授权后自己收集的（不进任何仓库）：文件夹里按年份分，每人一个文件夹，
文件夹名是 ALGS 的叫法（"PanicApex"），文件名是当时的队名（"Team Liquid_front.png"）：
    01_定妆照 26 年/<ALGS 名>/<队名>_front.png      02_赛场照片/<ALGS 名>/<队名>_personality.png
    定妆照 25 年/…、定妆照 24 年/…（和 26 年大多是同一张）
选手页、战队页认的是 Liquipedia 的页面名（"Panic_(American_player)"），所以要先对名字：
  ① 去掉空格、大小写后完全一样；② 用对上的队友推出「Liquipedia 队名 → ALGS 队名」（Rex Regum Qeon = Team RRQ）；
  ③ 剩下的只在对应的那支 ALGS 队里找：名字一边包含另一边（PanicApex ⊃ Panic）→ 名字相似（Kan0n ≈ Kanon）；
  ④ 还对不上的看 OVERRIDES（人工确认过的）。对不上就不放照片（页面照旧剪影），不猜。
用哪张：定妆照优先（26 → 25 → 24 年），没有定妆照用赛场照（August 定的）。都是透明底抠图，裁掉四周的透明边、保留透明。

出两种尺寸（WebP，质量 82，和 PNG 肉眼看不出差别，大小约十分之一）：
    <slug>_hero.webp  480px 宽（选手页大卡）      <slug>_card.webp  320px 宽（战队页选手卡）
slug 和云数据库的文档 _id 同一种编码（proStore.docId）：只留字母数字和 - _，别的写成 ~十六进制~。
对照表写进 cloudfunctions/apex/pro_photos.json（云函数据此给页面照片地址，见 proPhotos.js）。

用法（要 Pillow；只读本机文件，不联网）：
    python tools/build_pro_photos.py <照片文件夹> <参赛名单.json> <输出文件夹>
参赛名单是云函数 proRoster 返回的 data（{ teams: [{ team, players: [{ page, id }] }] }）。
输出文件夹整个传到云存储的 pro/photos/v1/ 下（换了照片就用 v2，免得手机上缓存着旧图）。
"""
import collections
import difflib
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MAP_FILE = os.path.join(HERE, "..", "cloudfunctions", "apex", "pro_photos.json")
VERSION = "v1"
YEARS = [("01_定妆照 26 年", 26), ("定妆照 25 年", 25), ("定妆照 24 年", 24)]
PERSONALITY = "02_赛场照片"
SIZES = {"hero": 480, "card": 320}
QUALITY = 82

# 名字两边写法差太多、程序对不上的，人工看过照片（队服）以后写在这里：Liquipedia 页面名 → ALGS 名
OVERRIDES = {
    "Walking_L": "W-L-A2",   # 7VEN，新加坡；August 2026-11-07 确认
    "JR": "JonnyR",          # VK Gaming，香港；August 2026-11-07 确认
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def core(page):
    return norm(re.sub(r"_?\(.*\)$", "", page or ""))


def doc_id(page):
    """和 cloudfunctions/apex/proStore.js 的 docId 一样"""
    return "p_" + re.sub(r"[^A-Za-z0-9_-]", lambda m: "~%x~" % ord(m.group(0)), page)


def index_photos(root):
    """ALGS 名 -> { front: [(年, 队名, 路径)], personality: 路径 }"""
    idx = collections.defaultdict(lambda: {"front": [], "personality": ""})
    for folder, year in YEARS:
        base = os.path.join(root, folder)
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            for f in os.listdir(os.path.join(base, name)):
                if f.endswith("_front.png"):
                    idx[name]["front"].append((year, f[: -len("_front.png")], os.path.join(base, name, f)))
    pbase = os.path.join(root, PERSONALITY)
    if os.path.isdir(pbase):
        for name in os.listdir(pbase):
            files = [f for f in os.listdir(os.path.join(pbase, name)) if f.endswith(".png")]
            if files:
                idx[name]["personality"] = os.path.join(pbase, name, files[0])
                idx[name]["pteam"] = files[0].rsplit("_", 1)[0]
    return idx


def latest_team(entry):
    if entry["front"]:
        return sorted(entry["front"], key=lambda t: -t[0])[0][1]
    return entry.get("pteam", "")


def pick_file(entry):
    """定妆照优先（新的年份在前），没有就用赛场照"""
    if entry["front"]:
        return sorted(entry["front"], key=lambda t: -t[0])[0][2], "front"
    return entry["personality"], "personality"


def match(idx, roster):
    players = [(t["team"], p) for t in roster["teams"] for p in t["players"]]
    keys = lambda p: {k for k in (norm(p.get("id")), core(p["page"])) if k}
    exact = {p["page"]: [n for n in idx if norm(n) in keys(p)] for _, p in players}
    team26 = collections.defaultdict(list)
    for n, e in idx.items():
        team26[norm(latest_team(e))].append(n)
    votes = collections.defaultdict(collections.Counter)
    for team, p in players:
        if len(exact[p["page"]]) == 1:
            votes[team][norm(latest_team(idx[exact[p["page"]][0]]))] += 1
    alias = {team: c.most_common(1)[0][0] for team, c in votes.items()}
    out, used = {}, set()

    def take(p, n, how):
        out[p["page"]] = (n, how)
        used.add(n)

    for team, p in players:
        if p["page"] in OVERRIDES and OVERRIDES[p["page"]] in idx:
            take(p, OVERRIDES[p["page"]], "override")
    for team, p in players:
        if p["page"] in out:
            continue
        ex = exact[p["page"]]
        if len(ex) > 1:
            ex = [n for n in ex if norm(latest_team(idx[n])) == alias.get(team)]
        # 名字一样但 ALGS 队对不上（另一个同名的人，如 GEARED GAMING 的 PANIC）：这支队里有别的候选时不要它
        if len(ex) == 1 and (team not in alias or norm(latest_team(idx[ex[0]])) == alias[team] or not team26.get(alias[team])):
            take(p, ex[0], "exact")
    for team, p in players:
        if p["page"] in out or team not in alias:
            continue
        pool = [n for n in team26.get(alias[team], []) if n not in used]
        ks = [k for k in keys(p) if len(k) >= 2]
        c = [n for n in pool if any(k in norm(n) or norm(n) in k for k in ks)]
        how = "contain"
        if len(c) != 1:
            sc = sorted(((max(difflib.SequenceMatcher(None, k, norm(n)).ratio() for k in ks), n) for n in pool), reverse=True)
            ok = sc and sc[0][0] >= 0.6 and (len(sc) == 1 or sc[0][0] - sc[1][0] >= 0.15)
            c = [sc[0][1]] if ok else []
            how = "similar"
        if len(c) == 1:
            take(p, c[0], how)
    return players, out


def save(src, dst, width):
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)            # 裁掉四周的透明边（抠图本身不动）
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    return os.path.getsize(dst)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")   # Windows 控制台默认 GBK，中文会乱码
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    root, roster_file, out_dir = sys.argv[1:4]
    roster = json.load(open(roster_file, encoding="utf-8"))
    idx = index_photos(root)
    players, got = match(idx, roster)
    os.makedirs(out_dir, exist_ok=True)
    files, total = {}, 0
    for page, (name, how) in sorted(got.items()):
        src, kind = pick_file(idx[name])
        slug = doc_id(page)
        for size, width in SIZES.items():
            total += save(src, os.path.join(out_dir, "%s_%s.webp" % (slug, size)), width)
        files[page] = slug
        if how != "exact" or kind != "front":
            print("  %-10s %-26s <- %s（%s）" % (how, page, name, "定妆照" if kind == "front" else "赛场照"))
    old = json.load(open(MAP_FILE, encoding="utf-8")) if os.path.exists(MAP_FILE) else {}
    data = {
        "note": "选手照片对照表（tools/build_pro_photos.py 生成，别手改）：Liquipedia 页面名 → 云存储里的文件名前缀。"
                "base = 云存储里 pro/photos/<version>/ 的 fileID 前缀，传完照片以后填；空着就不放照片（页面照旧剪影）",
        "version": VERSION,
        "base": old.get("base", "") if old.get("version") == VERSION else "",
        "files": files,
    }
    with open(MAP_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    missing = [p["page"] for _, p in players if p["page"] not in got]
    print("参赛选手 %d 人，有照片 %d 人，没对上 %d 人：%s" % (len(players), len(got), len(missing), ", ".join(missing) or "无"))
    print("输出 %d 个文件，共 %.1f MB → %s" % (len(files) * len(SIZES), total / 1048576, out_dir))
    print("对照表 → %s" % os.path.normpath(MAP_FILE))


if __name__ == "__main__":
    main()
