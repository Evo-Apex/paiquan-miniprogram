/**
 * 职业选手资料（Liquipedia）里英文取值的中文叫法：国籍、赛区、键鼠/手柄、队里的身份、比赛类型。
 *
 * 纯数据 + 纯函数（比赛页的队员弹层和分包 pro/ 的选手页共用，所以放主包）。
 * 规矩和地图译名一样：**查得到才翻，查不到保留英文原文**，不猜（AI-CONTEXT §8）。
 * 取值是 2026-11 抓到的季后赛 121 人里实际出现的，加上 ALGS 各赛区常见的国家。
 */

// 台湾、香港、澳门按国内规范写
var NAT_ZH = {
  "United States": "美国", "Canada": "加拿大", "Mexico": "墨西哥", "Brazil": "巴西", "Argentina": "阿根廷",
  "Chile": "智利", "Colombia": "哥伦比亚", "Peru": "秘鲁", "Uruguay": "乌拉圭", "Venezuela": "委内瑞拉",
  "El Salvador": "萨尔瓦多", "Guatemala": "危地马拉", "Costa Rica": "哥斯达黎加", "Puerto Rico": "波多黎各",
  "Dominican Republic": "多米尼加",
  "United Kingdom": "英国", "Ireland": "爱尔兰", "France": "法国", "Germany": "德国", "Austria": "奥地利",
  "Switzerland": "瑞士", "Netherlands": "荷兰", "Belgium": "比利时", "Spain": "西班牙", "Portugal": "葡萄牙",
  "Italy": "意大利", "Greece": "希腊", "Sweden": "瑞典", "Norway": "挪威", "Denmark": "丹麦", "Finland": "芬兰",
  "Poland": "波兰", "Czech Republic": "捷克", "Slovakia": "斯洛伐克", "Hungary": "匈牙利", "Romania": "罗马尼亚",
  "Bulgaria": "保加利亚", "Serbia": "塞尔维亚", "Croatia": "克罗地亚", "Slovenia": "斯洛文尼亚",
  "Estonia": "爱沙尼亚", "Latvia": "拉脱维亚", "Lithuania": "立陶宛", "Ukraine": "乌克兰", "Belarus": "白俄罗斯",
  "Russia": "俄罗斯", "Kazakhstan": "哈萨克斯坦", "Turkey": "土耳其", "Israel": "以色列",
  "Saudi Arabia": "沙特阿拉伯", "United Arab Emirates": "阿联酋", "Morocco": "摩洛哥", "Egypt": "埃及",
  "South Africa": "南非",
  "China": "中国", "Taiwan": "中国台湾", "Hong Kong": "中国香港", "Macau": "中国澳门",
  "Japan": "日本", "South Korea": "韩国", "Mongolia": "蒙古", "Thailand": "泰国", "Vietnam": "越南",
  "Philippines": "菲律宾", "Malaysia": "马来西亚", "Singapore": "新加坡", "Indonesia": "印度尼西亚",
  "India": "印度", "Australia": "澳大利亚", "New Zealand": "新西兰"
};
// 不代表任何国家：不显示
var NAT_HIDE = { "Non-representing": true };

var REGION = {
  "north america": ["北美", "North America"],
  "south america": ["南美", "South America"],
  "latin america": ["拉丁美洲", "Latin America"],
  "americas": ["美洲", "Americas"],
  "emea": ["EMEA（欧洲、中东、非洲）", "EMEA"],
  "europe": ["欧洲", "Europe"],
  "middle east": ["中东", "Middle East"],
  "asia-pacific north": ["亚太北", "APAC North"],
  "asia-pacific south": ["亚太南", "APAC South"],
  "asia-pacific": ["亚太", "Asia-Pacific"],
  "asia": ["亚洲", "Asia"],
  "oceania": ["大洋洲", "Oceania"],
  "china": ["中国", "China"],
  // 战队的赛区（2026-11-07 实测 Apex 维基 889 支队用到的：上面没有的这几个）
  "japan": ["日本", "Japan"],
  "korea": ["韩国", "Korea"],
  "southeast asia": ["东南亚", "Southeast Asia"],
  "south asia": ["南亚", "South Asia"],
  "africa": ["非洲", "Africa"],
  "cis": ["独联体", "CIS"]
};

var INPUT = {
  "controller": ["手柄", "Controller"],
  "mouse & keyboard": ["键鼠", "Mouse & keyboard"],
  "hybrid": ["键鼠、手柄混用", "Hybrid"]
};

var STATUS = {
  "active": ["现役", "Active"],
  "inactive": ["暂停比赛", "Inactive"],
  "retired": ["已退役", "Retired"]
};

// 队员表里的身份（空 = 正式队员，不标）
var ROLE_ZH = {
  "Captain": "队长", "Stand-in": "临时替补", "Substitute": "替补", "Tryout": "试训", "Loan": "租借",
  "Suspended": "停赛", "Coach": "教练", "Head Coach": "主教练", "Assistant Coach": "助理教练",
  "Analyst": "分析师", "Manager": "经理", "Team Manager": "领队", "Streamer": "主播",
  "Content Creator": "内容创作者", "Owner": "老板", "Co-Owner": "联合老板", "CEO": "CEO"
};

// 比赛类型（Liquipedia 的 liquipediatiertype；空 = 正式比赛）
var TIER_TYPE = {
  "Qualifier": ["预选赛", "Qualifier"],
  "Showmatch": ["表演赛", "Showmatch"],
  "Weekly": ["周赛", "Weekly"],
  "Monthly": ["月赛", "Monthly"],
  "Misc": ["其他", "Misc"]
};

function pick(table, raw, lang) {
  var row = table[String(raw || "").toLowerCase()];
  if (!row) return String(raw || "");
  return lang === "en" ? row[1] : row[0];
}

function nat(raw, lang) {
  var s = String(raw || "");
  if (!s || NAT_HIDE[s]) return "";
  if (lang === "en") return s;
  return NAT_ZH[s] || s;
}

function region(raw, lang) { return pick(REGION, raw, lang); }
function input(raw, lang) { return pick(INPUT, raw, lang); }
function status(raw, lang) { return pick(STATUS, raw, lang); }

function role(raw, lang) {
  var s = String(raw || "");
  if (!s || lang === "en") return s;
  return ROLE_ZH[s] || s;
}

function tierType(raw, lang) {
  var row = TIER_TYPE[String(raw || "")];
  if (!row) return String(raw || "");
  return lang === "en" ? row[1] : row[0];
}

/** 队员弹层里一个人的副标题：国籍 · 键鼠/手柄（哪项没有就不写） */
function playerMeta(natRaw, inputRaw, lang) {
  return [nat(natRaw, lang), inputRaw ? input(inputRaw, lang) : ""].filter(function (x) { return x; }).join(" · ");
}

module.exports = {
  nat: nat,
  region: region,
  input: input,
  status: status,
  role: role,
  tierType: tierType,
  playerMeta: playerMeta
};
