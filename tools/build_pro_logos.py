"""战队队标（2026-11-08）：给战队页、选手页、比赛页冠军卡准备队标，压成小 PNG，准备传到云存储。

队标从哪来（August 2026-11-08 定的）：
  · 这一届比赛（next_match_data.js 里那场）的队伍：用 ALS 赛事页上的队标——比赛页分组卡片用的就是这一批；
  · 其他队：用 Liquipedia 战队资料里的队标（深色、不带字的那一版，放在深色方块里看得清）。
    Liquipedia 数据库 API 的 team 表直接给了缩略图地址（textlesslogodarkurl），一次请求拿全 Apex 维基所有队；
    图片按这个地址下载，两次至少隔 2 秒（Liquipedia 的规矩）。队标是各战队的商标，图片不在 CC BY-SA 授权里。
  · 用的是 Apex 通用标志的（ALS 的 fa.png / worldwide.png，Liquipedia 文件名带 "Apex Legends" 的）不算队标，不放，页面照旧写缩写。

ALS 的队名和 Liquipedia 的对法同 utils/prolink.js：只在这场比赛的参赛队里找（Liquipedia placement 表，1 次请求），
去掉空格、大小写后相等 → 一边包含另一边（只有一个候选时）→ OVERRIDES（人工看过队标的）。对不上就用 Liquipedia 的。

输出（都压成最长边 192px、256 色的 PNG：队标是平面图形，256 色看不出差别，一张 2～8 KB）：
    <工作文件夹>/v1/t_<slug>.png       整个 v1 文件夹传到云存储 pro/logos/v1/（换了图就用 v2，免得手机上缓存着旧图）
    <工作文件夹>/_check.png            所有队标放在深色底上的总览，传之前看一眼有没有看不见的
    <工作文件夹>/_src/                 下载下来的原图和 API 结果（缓存，再跑不重复下载；--refresh 重新查 API）
slug 和云数据库的文档 _id 同一种编码（proStore.docId）：只留字母数字和 - _，别的写成 ~十六进制~。
对照表写进 cloudfunctions/apex/pro_logos.json（云函数据此给页面队标地址，见 proLogos.js）；base 传完以后填。

用法（要 Pillow；Key 从环境变量 LIQUIPEDIA_API_KEY 或 ~/.liquipedia_key 读，不打印）：
    python tools/build_pro_logos.py <工作文件夹> [--refresh] [--event 赛事页面名]
第一次跑要下载 800 多张图，约半小时。
"""
import gzip
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MAP_FILE = os.path.join(HERE, "..", "cloudfunctions", "apex", "pro_logos.json")
NEXT_MATCH = os.path.join(HERE, "..", "miniprogram", "data", "next_match_data.js")
VERSION = "v1"
SIZE = 192
EVENT = "Apex_Legends_Global_Series/2026/Split_2/Playoffs"

API = "https://api.liquipedia.net/api/v3/"
WIKI = "apexlegends"
UA = "PaiquanHelper/1.0 (WeChat mini program; Apex esports player pages)"   # 同 liquipedia.js
LP_WAIT = 2.0            # liquipedia.net 两次下载至少隔 2 秒
ALS_BASE = "https://apexlegendsstatus.com/algs/assets/teams/"
ALS_GENERIC = {"fa.png", "worldwide.png"}   # ALS 上没有队标的队用的 Apex 通用标志

# 两边叫法差太多、程序对不上的，人工看过队标以后写在这里：ALS 队名 → Liquipedia 队名
OVERRIDES = {
    "PXX": "Pork Xiaolongbao Xpert",        # 队标上写着 PORK XIAOLONGBAO XPERT
    "AG GLOBAL": "All Gamers Global",       # 队标上写着 ALL GAMERS
    "PVISION": "PARIVISION",
    "Team RRQ": "Rex Regum Qeon",
    "Relove DCG": "Deep Cross Gaming",      # 队标上写着 DEEP CROSS GAMING
    "RIDDLEORDER ZERO": "RIDDLE ZERO",
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def slug(page):
    """和 cloudfunctions/apex/proStore.js 的 docId 同一种编码，前缀换成 t_"""
    return "t_" + re.sub(r"[^A-Za-z0-9_-]", lambda m: "~%x~" % ord(m.group(0)), page)


def is_generic(name):
    return bool(re.search(r"apex[ _]legends", name or "", re.I))


def read_key():
    k = os.environ.get("LIQUIPEDIA_API_KEY", "").strip()
    if not k:
        path = os.path.join(os.path.expanduser("~"), ".liquipedia_key")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                k = f.read().strip()
    if not k:
        sys.exit("没有 Liquipedia 的 Key（环境变量 LIQUIPEDIA_API_KEY 或 ~/.liquipedia_key）")
    return k


def get(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=dict({"User-Agent": UA, "Accept-Encoding": "gzip"}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        return body


def api(kind, params, key):
    """查一次 Liquipedia 数据库 API，返回 result 列表；出错就退出（别带着半截数据往下走）"""
    q = dict(params, wiki=WIKI)
    url = API + kind + "?" + urllib.parse.urlencode(q)
    try:
        j = json.loads(get(url, {"Authorization": "Apikey " + key}))
    except Exception as e:  # noqa: BLE001
        sys.exit("Liquipedia 请求失败（%s）：%s" % (kind, e))
    if j.get("error"):
        sys.exit("Liquipedia 报错（%s）：%s" % (kind, j["error"]))
    return j.get("result") or []


def cached(path, refresh, fetch):
    if os.path.exists(path) and not refresh:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    data = fetch()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def lp_teams(key):
    """Apex 维基所有战队的队标地址（一页 1000 条，现在 900 支左右，一次就够）"""
    rows, offset = [], 0
    while True:
        got = api("team", {"conditions": "[[pagename::!]]", "limit": 1000, "offset": offset,
                           "query": "pagename,name,logo,logodark,textlesslogodarkurl,logodarkurl"}, key)
        rows += got
        if len(got) < 1000:
            return rows
        offset += 1000


def event_teams(key, event):
    rows = api("placement", {"conditions": "[[parent::%s]]" % event, "limit": 300,
                             "query": "opponentname,opponenttype"}, key)
    return sorted({r["opponentname"] for r in rows if r.get("opponenttype") == "team" and r.get("opponentname")})


def als_teams():
    """next_match_data.js 里每支队的 ALS 队名和队标文件名"""
    with open(NEXT_MATCH, encoding="utf-8") as f:
        text = f.read()
    return re.findall(r'"name":\s*"([^"]+)",\s*"icon":\s*"/assets/teams/([^"]+)"', text)


def match_als(als, names):
    """ALS 队名 → 这场比赛里的 Liquipedia 队名（对不上的不在结果里）"""
    out = {}
    for name, icon in als:
        if icon in ALS_GENERIC:
            continue
        n = norm(name)
        hit = [x for x in names if norm(x) == n]
        if len(hit) != 1:
            hit = [x for x in names if len(norm(x)) >= 3 and len(n) >= 3 and (norm(x) in n or n in norm(x))]
        if len(hit) != 1 and OVERRIDES.get(name) in names:
            hit = [OVERRIDES[name]]
        if len(hit) == 1:
            out[hit[0]] = icon
        else:
            print("  ALS 对不上（用 Liquipedia 的）：%s" % name)
    return out


_last_lp = [0.0]


def download(url, path, polite):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    if polite:
        wait = LP_WAIT - (time.time() - _last_lp[0])
        if wait > 0:
            time.sleep(wait)
        _last_lp[0] = time.time()
    try:
        body = get(url, timeout=30)
    except Exception as e:  # noqa: BLE001
        print("  下载失败 %s：%s" % (url, e))
        return False
    tmp = path + ".part"
    with open(tmp, "wb") as f:
        f.write(body)
    os.replace(tmp, path)
    return True


def shrink(src, dst):
    """裁掉四周的透明边，最长边缩到 SIZE，压成 256 色 PNG（保留透明）"""
    im = Image.open(src)
    im.seek(0)                      # GIF 只取第一帧
    im = im.convert("RGBA")
    box = im.getchannel("A").getbbox()
    if not box:
        return False                # 整张透明
    im = im.crop(box)
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(dst, "PNG", optimize=True)
    return True


def contact_sheet(items, out):
    """所有队标放在深色大卡底色上，传之前看一眼"""
    cell, cols = 110, 14
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 14)), (34, 36, 42))
    d = ImageDraw.Draw(sheet)
    for i, (page, path) in enumerate(items):
        im = Image.open(path).convert("RGBA")
        im.thumbnail((86, 86), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        d.text((x + 3, y + cell), page[:17], fill=(160, 160, 160))
    sheet.save(out)


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith("-"):
        sys.exit(__doc__)
    work = args[0]
    refresh = "--refresh" in args
    event = args[args.index("--event") + 1] if "--event" in args else EVENT
    src_lp = os.path.join(work, "_src", "liquipedia")
    src_als = os.path.join(work, "_src", "als")
    out_dir = os.path.join(work, VERSION)
    for d in (src_lp, src_als, out_dir):
        os.makedirs(d, exist_ok=True)

    key = None if (not refresh and os.path.exists(os.path.join(work, "_src", "teams.json"))
                   and os.path.exists(os.path.join(work, "_src", "event.json"))) else read_key()
    teams = cached(os.path.join(work, "_src", "teams.json"), refresh, lambda: lp_teams(key))
    names = cached(os.path.join(work, "_src", "event.json"), refresh, lambda: event_teams(key, event))
    print("Liquipedia 战队 %d 支，这场比赛 %d 支" % (len(teams), len(names)))

    # 每支队用哪张图：这场比赛的队先用 ALS 的，其他用 Liquipedia 的
    als = match_als(als_teams(), names)
    pick = {}
    for r in teams:
        page = r.get("pagename") or ""
        if not page or (is_generic(r.get("logo")) and is_generic(r.get("logodark"))):
            continue
        # 不带字的深色版优先；它是 Apex 默认图（Apex_Legends_default_darkmode.png，有的队只有带字的版本）就用带字的深色版
        for url in (r.get("textlesslogodarkurl"), r.get("logodarkurl")):
            if url and not is_generic(urllib.parse.unquote(url.rsplit("/", 1)[-1])):
                pick[page] = ("lp", url)
                break
    for name, icon in als.items():
        pick[name.replace(" ", "_")] = ("als", icon)   # 页面名 = 队名空格换成下划线（同 proSync.proRoster）
    print("有队标 %d 支（ALS %d、Liquipedia %d）" % (len(pick), len(als), len(pick) - len(als)))

    files, done = {}, 0
    for page in sorted(pick):
        kind, ref = pick[page]
        if kind == "als":
            src = os.path.join(src_als, ref)
            ok = download(ALS_BASE + urllib.parse.quote(ref), src, polite=False)
        else:
            src = os.path.join(src_lp, urllib.parse.unquote(ref.rsplit("/", 1)[-1]))
            ok = download(ref, src, polite=True)
        done += 1
        if done % 50 == 0:
            print("  %d / %d" % (done, len(pick)))
        if not ok:
            continue
        s = slug(page)
        try:
            if shrink(src, os.path.join(out_dir, s + ".png")):
                files[page] = s
        except Exception as e:  # noqa: BLE001
            print("  处理失败 %s：%s" % (page, e))

    # 输出文件夹里只留这次的
    keep = {s + ".png" for s in files.values()}
    for f in os.listdir(out_dir):
        if f.startswith("t_") and f.endswith(".png") and f not in keep:
            os.remove(os.path.join(out_dir, f))

    old = {}
    if os.path.exists(MAP_FILE):
        with open(MAP_FILE, encoding="utf-8") as f:
            old = json.load(f)
    data = {
        "note": "战队队标对照表（tools/build_pro_logos.py 生成，别手改）：Liquipedia 战队页面名 → 云存储里的文件名（不带 .png）。"
                "base = 云存储里 pro/logos/<version>/ 的 fileID 前缀，传完队标以后填；空着就不放队标（页面照旧写缩写）",
        "version": VERSION,
        "base": old.get("base", "") if old.get("version") == VERSION else "",
        "files": dict(sorted(files.items())),
    }
    with open(MAP_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")

    total = sum(os.path.getsize(os.path.join(out_dir, s + ".png")) for s in files.values())
    contact_sheet([(p, os.path.join(out_dir, s + ".png")) for p, s in sorted(files.items())],
                  os.path.join(work, "_check.png"))
    print("写好 %d 个队标，共 %.1f MB → %s" % (len(files), total / 1048576, out_dir))
    print("对照表 → %s" % os.path.normpath(MAP_FILE))


if __name__ == "__main__":
    main()
