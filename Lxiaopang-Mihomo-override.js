
/**
 * LxiaopangClashRule.ini
 * Sub-Store Mihomo 完整覆写脚本
 *
 * 操作顺序：
 * 1. Add Proxies：来源 all
 * 2. Script：本脚本
 *
 * 核心功能：
 * - 动态注入 all 的全部节点
 * - 保留机场与自建节点原始顺序
 * - 三个手动选择组不包含 DIRECT
 * - 保留原 INI 的策略组和地区正则
 * - 自动生成远程规则集
 * - 保留原 INI 的规则分流顺序
 * - 兼容 JavaScript 正则表达式
 */

// =====================================================
// 1. 读取配置
// =====================================================

const raw = $content ?? ($files && $files[0]);

if (!raw) {
  throw new Error(
    "没有读取到配置，请确认 Script 位于 Add Proxies 之后。"
  );
}

const config = ProxyUtils.yaml.safeLoad(raw);

if (!config || !Array.isArray(config.proxies)) {
  throw new Error(
    "没有找到 proxies 数组，请检查 Add Proxies 是否成功。"
  );
}

const nodes = config.proxies.filter(
  p => p &&
  typeof p.name === "string" &&
  p.name.trim().length > 0
);

if (nodes.length === 0) {
  throw new Error(
    "all 组合订阅没有注入有效节点，请检查订阅来源。"
  );
}

const nodeNames = nodes.map(p => p.name);

// =====================================================
// 2. 正则兼容处理
// =====================================================

function regex(pattern) {

  if (!pattern) return /.*/i;

  let source = String(pattern);

  // 兼容 INI 中任意位置的 (?i)
  // JavaScript 不支持内联 (?i)，统一转换为 i 标志
  const ignoreCase = /\(\?i\)/.test(source);

  source = source.replace(/\(\?i\)/g, "");

  // 修复日本节点正则中的多余右中括号
  source = source.replace(
    /\(\?!\(游戏流媒体\]\)\)/g,
    "(?!(游戏流媒体))"
  );

  try {
    return new RegExp(
      source,
      ignoreCase ? "i" : ""
    );
  } catch (error) {
    throw new Error(
      "正则编译失败：" + pattern +
      "\n转换后：" + source +
      "\n原因：" + error.message
    );
  }
}

// =====================================================
// 3. 节点匹配与顺序处理
// =====================================================

function unique(items) {

  const seen = new Set();

  return items.filter(item => {

    if (
      typeof item !== "string" ||
      !item ||
      seen.has(item)
    ) return false;

    seen.add(item);
    return true;
  });
}

function matchNodes(include, exclude) {

  const inc = regex(include);
  const exc = exclude ? regex(exclude) : null;

  return unique(
    nodes
      .filter(node => {

        inc.lastIndex = 0;

        if (!inc.test(node.name)) {
          return false;
        }

        if (exc) {
          exc.lastIndex = 0;

          if (exc.test(node.name)) {
            return false;
          }
        }

        return true;
      })
      .map(node => node.name)
  );
}

// =====================================================
// 4. 策略组构建函数
// =====================================================

function select(name, proxies) {

  return {
    name,
    type: "select",
    proxies: unique(proxies)
  };
}

function urlTest(name, pattern, url) {

  return {
    name,
    type: "url-test",
    proxies: matchNodes(pattern),
    url,
    interval: 300,
    tolerance: 0,
    lazy: false
  };
}

// =====================================================
// 5. 策略组
// 完全按照原 INI 的组顺序
// =====================================================

const groups = [

  // 节点选择
  select("🚀 节点选择", [
    "香港",
    "🚀 手动切换1",
    "♻️ 自动选择",
    "机场",
    "🚀 手动切换2",
    "🚀 手动切换3",
    "HY",
    "GW",
    "AZ",
    "日本",
    "新加坡",
    "美国",
    "台湾",
    "DIRECT"
  ]),

  // 三个手动切换组：只保留 all 中的节点
  select("🚀 手动切换1", nodeNames),
  select("🚀 手动切换2", nodeNames),
  select("🚀 手动切换3", nodeNames),

  // Telegram
  select("📲 电报消息", [
    "香港",
    "🚀 手动切换1",
    "新加坡",
    "🚀 手动切换2",
    "HY",
    "GW",
    "🚀 节点选择",
    "AZ",
    "♻️ 自动选择",
    "日本",
    "机场",
    "🚀 手动切换3",
    "美国",
    "台湾",
    "DIRECT"
  ]),

  // 91卫图
  select("🗺 91卫图", [
    "香港",
    "♻️ 自动选择",
    "🚀 手动切换2",
    "机场",
    "AZ",
    "🚀 手动切换1",
    "🚀 手动切换3",
    "HY",
    "🚀 节点选择",
    "GW",
    "日本",
    "新加坡",
    "美国",
    "台湾",
    "DIRECT"
  ]),

  // YouTube
  select("📹 油管视频", [
    "🚀 手动切换3",
    "🚀 节点选择",
    "♻️ 自动选择",
    "GW",
    "香港",
    "AZ",
    "HY",
    "日本",
    "机场",
    "🚀 手动切换1",
    "🚀 手动切换2",
    "新加坡",
    "美国",
    "台湾",
    "DIRECT"
  ]),

  // Speedtest
  select("⚡ Speedtest", [
    "DIRECT",
    "🚀 节点选择",
    "♻️ 自动选择",
    "GW",
    "香港",
    "AZ",
    "HY",
    "日本",
    "🚀 手动切换1",
    "🚀 手动切换2",
    "🚀 手动切换3",
    "新加坡",
    "美国",
    "台湾",
    "机场"
  ]),

  // ChatGPT
  select("📡 ChatGPT", [
    "🚀 手动切换3",
    "美国",
    "WB",
    "AZ",
    "🚀 手动切换1",
    "🚀 手动切换2",
    "🚀 节点选择",
    "♻️ 自动选择",
    "GW",
    "HY",
    "香港",
    "日本",
    "新加坡",
    "台湾",
    "机场",
    "DIRECT"
  ]),

  // EMBY
  select("🎬 EMBY", [
    "🚀 手动切换3",
    "美国",
    "WB",
    "机场",
    "香港",
    "HY",
    "GW",
    "🚀 手动切换1",
    "AZ",
    "🚀 节点选择",
    "DIRECT",
    "♻️ 自动选择",
    "新加坡",
    "台湾",
    "日本",
    "🚀 手动切换2"
  ]),

  // Bing
  select("Ⓜ️ 必应", [
    "🚀 手动切换3",
    "美国",
    "WB",
    "AZ",
    "HY",
    "🚀 节点选择",
    "香港",
    "GW",
    "日本",
    "DIRECT",
    "🚀 手动切换1",
    "🚀 手动切换2",
    "新加坡",
    "台湾",
    "机场"
  ]),

  // 全球直连
  select("🎯 全球直连", [
    "DIRECT",
    "🚀 节点选择",
    "♻️ 自动选择"
  ]),

  // 漏网之鱼
  select("🐟 漏网之鱼", [
    "🚀 节点选择",
    "DIRECT",
    "♻️ 自动选择",
    "GW",
    "香港",
    "AZ",
    "HY",
    "日本",
    "🚀 手动切换1",
    "🚀 手动切换2",
    "🚀 手动切换3",
    "新加坡",
    "美国",
    "台湾",
    "机场"
  ]),

  // ===================================================
  // 6. 地区自动测速组
  // ===================================================

  // 香港
  urlTest(
    "香港",
    "(?=.*(港|HK|(?i)Hong))^((?!(游戏流媒体|送中)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // 美国
  urlTest(
    "美国",
    "(?=.*(美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|US|United States))^((?!(游戏)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // 自动选择
  urlTest(
    "♻️ 自动选择",
    "(?=.*)^((?!(游戏流媒体)).)*$",
    "http://cp.cloudflare.com/generate_204"
  ),

  // 机场
  urlTest(
    "机场",
    "(?=.*(港|HK|(?i)Hong|日本|JP|Japan|新加坡|SG|(?i)Singapore|台|TW|Taiwan|Tai wan))^((?!(游戏流媒体|cz|bz|ch|cc|cr|ws|ts|hy|ms|gcp|aws|ka|kb|kc|by|cw|bw|wb)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // 日本：修复原 INI 多余的 ]
  urlTest(
    "日本",
    "(?=.*(日本|川日|东京|大阪|泉日|埼玉|沪日|深日|JP|Japan))^((?!(游戏流媒体)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // 新加坡
  urlTest(
    "新加坡",
    "(?=.*(新加坡|狮|獅|SG|(?i)Singapore))^((?!(游戏流媒体)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // 台湾
  urlTest(
    "台湾",
    "(台|新北|彰化|TW|Taiwan|Tai wan)",
    "http://www.gstatic.com/generate_204"
  ),

  // GW
  urlTest(
    "GW",
    "(?=.*(bw|1663|wb|bz|cz|nr|bread))^((?!(游戏流媒体)).)*$",
    "http://www.gstatic.com/generate_204"
  ),

  // HY
  urlTest(
    "HY",
    "(wb|1663|nr|bread)",
    "http://cp.cloudflare.com/generate_204"
  ),

  // AZ
  urlTest(
    "AZ",
    "(cz|bz)",
    "http://cp.cloudflare.com/generate_204"
  ),

  // BZ
  urlTest(
    "BZ",
    "(bz)",
    "http://cp.cloudflare.com/generate_204"
  ),

  // WB
  urlTest(
    "WB",
    "(wb)",
    "http://cp.cloudflare.com/generate_204"
  )
];

// =====================================================
// 7. 远程规则集
// 按原 INI 的 URL 和顺序建立
// =====================================================

const providerRows = [

  ["chatgpt_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/ChatGPT.list"],

  ["chatgpt_gemini",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/Gemini/Gemini.list"],

  ["chatgpt_openai",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/OpenAI/OpenAI.list"],

  ["bing_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/bing.list"],

  ["googleplay_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/GooglePlay.list"],

  ["speedtest",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Speedtest/Speedtest.list"],

  ["az_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/zijigwf.list"],

  ["reject_91weitu",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/91weitu.list"],

  ["91weitu_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/91weitunew.list"],

  ["domain_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/zijiyuming.list"],

  ["lan",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list"],

  ["unban",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/UnBan.list"],

  ["googlefcm",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/GoogleFCM.list"],

  ["googlecn",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GoogleCN.list"],

  ["steamcn",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/SteamCN.list"],

  ["onedrive",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/OneDrive.list"],

  ["microsoft",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list"],

  ["apple",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list"],

  ["emby_meilieage",
   "https://raw.githubusercontent.com/Meilieage/webcdn/main/rule/list/Emby.list"],

  ["emby_custom",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/emby.list"],

  ["emby_ip",
   "https://raw.githubusercontent.com/lxp1663/ClashRule/main/embyip.list"],

  ["telegram",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Telegram/Telegram.list"],

  ["youtube",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list"],

  ["globalmedia",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/GlobalMedia/GlobalMedia.list"],

  ["proxymedia",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list"],

  ["proxy_gfw",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list"],

  ["china_max",
   "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaMax/ChinaMax.list"],

  ["china_domain",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list"],

  ["china_company_ip",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaCompanyIp.list"],

  ["download",
   "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Download.list"]
];

const providers = {};

for (const [name, url] of providerRows) {

  providers[name] = {
    type: "http",
    behavior: "classical",
    format: "text",
    url,
    path: "./rule_providers/lxiaopang/" + name + ".yaml",
    interval: 86400
  };
}

// =====================================================
// 8. 分流规则
// 对应原 INI ruleset 顺序
// =====================================================

const rules = [

  "RULE-SET,chatgpt_custom,📡 ChatGPT",
  "RULE-SET,chatgpt_gemini,📡 ChatGPT",
  "RULE-SET,chatgpt_openai,📡 ChatGPT",

  "RULE-SET,bing_custom,Ⓜ️ 必应",
  "RULE-SET,googleplay_custom,🚀 节点选择",
  "RULE-SET,speedtest,⚡ Speedtest",

  "RULE-SET,az_custom,AZ",
  "RULE-SET,reject_91weitu,REJECT",
  "RULE-SET,91weitu_custom,🗺 91卫图",
  "RULE-SET,domain_custom,🎯 全球直连",

  "RULE-SET,lan,🎯 全球直连",
  "RULE-SET,unban,🎯 全球直连",

  "RULE-SET,googlefcm,DIRECT",
  "RULE-SET,googlecn,🎯 全球直连",
  "RULE-SET,steamcn,🎯 全球直连",

  "RULE-SET,onedrive,DIRECT",
  "RULE-SET,microsoft,DIRECT",
  "RULE-SET,apple,DIRECT",

  "RULE-SET,emby_meilieage,🎬 EMBY",
  "RULE-SET,emby_custom,🎬 EMBY",
  "RULE-SET,emby_ip,🎬 EMBY",

  "RULE-SET,telegram,📲 电报消息",
  "RULE-SET,youtube,📹 油管视频",

  "RULE-SET,globalmedia,🚀 节点选择",
  "RULE-SET,proxymedia,🚀 节点选择",
  "RULE-SET,proxy_gfw,🚀 节点选择",

  "RULE-SET,china_max,🎯 全球直连",
  "RULE-SET,china_domain,🎯 全球直连",
  "RULE-SET,china_company_ip,🎯 全球直连",
  "RULE-SET,download,🎯 全球直连",

  // 原 INI 中 GEOIP,LAN 为注释，不在这里启用
  "GEOIP,CN,🎯 全球直连",

  "MATCH,🐟 漏网之鱼"
];

// =====================================================
// 9. 写入配置
// =====================================================

// 保留原 YAML 的 DNS、TUN、端口等配置
// 只重建策略组、规则提供者和规则

config["proxy-groups"] = groups;
config["rule-providers"] = providers;
config.rules = rules;

// 清除旧版排序字段
for (const group of config["proxy-groups"]) {
  delete group["include-all-proxies"];
  delete group["_substore-order-filter"];
  delete group["_substore-order-exclude-filter"];
}

// =====================================================
// 10. 最终完整性检查
// =====================================================

const groupNames = new Set(
  groups.map(group => group.name)
);

for (const group of groups) {
  if (!Array.isArray(group.proxies)) {
    throw new Error(
      "策略组缺少 proxies：" + group.name
    );
  }

  for (const item of group.proxies) {
    if (
      !nodeNames.includes(item) &&
      !groupNames.has(item) &&
      !["DIRECT", "REJECT"].includes(item)
    ) {
      throw new Error(
        "策略组引用不存在：" +
        group.name + " → " + item
      );
    }
  }
}

// 输出最终 Mihomo YAML
$content = ProxyUtils.yaml.dump(config);
