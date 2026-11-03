/*
 * 模仿妙妙屋批量添加国旗：
 * 1. 查询节点 server 的 IP 归属地。
 * 2. 域名优先解析 IPv4，没有 IPv4 时使用 IPv6。
 * 3. 只添加国旗，保留原名称。
 * 4. 已有国旗的节点跳过。
 * 5. 查询失败保留原节点。
 * 6. 不改变节点顺序及其他配置。
 *
 * 适用于 Sub-Store Docker / Node.js。
 * 不需要 HTTP-META。
 */

// 在双引号内填写你自己的 IPinfo Token。
const IPINFO_TOKEN = "0cb6ce14f9e86c";

async function operator(proxies = []) {
  const args =
    typeof $arguments !== "undefined" ? $arguments : {};

  const token = String(args.token || IPINFO_TOKEN).trim();

  if (!token) {
    throw new Error(
      "请填写脚本顶部的 IPINFO_TOKEN，或在脚本参数中填写 token=你的Token"
    );
  }

  const dns = require("dns").promises;
  const net = require("net");

  const FLAG_PATTERN = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const CONCURRENCY = 3;

  // 同一服务器地址只查询一次。
  const pending = new Map();

  let cursor = 0;
  let added = 0;
  let skipped = 0;
  let failed = 0;

  // 将服务器地址解析成 IP，不修改节点的 server 字段。
  async function resolveServer(server) {
    const host = String(server || "")
      .trim()
      .replace(/^\[|\]$/g, "");

    if (!host) {
      throw new Error("节点缺少 server 地址");
    }

    // 已经是 IPv4 或 IPv6，直接使用。
    if (net.isIP(host)) {
      return host;
    }

    let timer;

    try {
      const addresses = await Promise.race([
        dns.lookup(host, { all: true }),

        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error("DNS 查询超时"));
          }, 8000);
        }),
      ]);

      // 优先 IPv4，没有时取第一个 IPv6。
      const selected =
        addresses.find(item => item.family === 4) ||
        addresses[0];

      if (!selected) {
        throw new Error("域名没有可用的 IP");
      }

      return selected.address;
    } finally {
      clearTimeout(timer);
    }
  }

  // 使用 IPinfo Lite 查询服务器 IP 的国家代码。
  async function queryCountry(ip) {
    const cacheKey =
      "server-ip-flag:ipinfo-lite:v1:" + ip;

    const cached = scriptResourceCache.get(cacheKey);

    if (/^[A-Z]{2}$/.test(cached || "")) {
      return cached;
    }

    const response = await $substore.http.get({
      url:
        "https://api.ipinfo.io/lite/" +
        encodeURIComponent(ip) +
        "?token=" +
        encodeURIComponent(token),

      timeout: 10000,
    });

    const status = Number(
      response.statusCode ?? response.status
    );

    if (status >= 400) {
      throw new Error("IPinfo HTTP " + status);
    }

    const data =
      typeof response.body === "string"
        ? JSON.parse(response.body)
        : response.body;

    const countryCode = String(
      data?.country_code || ""
    ).toUpperCase();

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error("未获取到有效国家代码");
    }

    scriptResourceCache.set(
      cacheKey,
      countryCode,
      CACHE_TTL
    );

    return countryCode;
  }

  // 将两位国家代码转换为国旗 Emoji。
  function countryCodeToFlag(code) {
    return String.fromCodePoint(
      ...Array.from(
        code,
        char => 127397 + char.charCodeAt(0)
      )
    );
  }

  async function worker() {
    while (cursor < proxies.length) {
      const node = proxies[cursor++];
      const originalName = String(node.name || "");

      // 与妙妙屋批量操作一致：已有国旗则跳过。
      if (FLAG_PATTERN.test(originalName)) {
        skipped++;
        continue;
      }

      try {
        const server = String(node.server || "");

        if (!pending.has(server)) {
          pending.set(
            server,
            resolveServer(server).then(queryCountry)
          );
        }

        const countryCode = await pending.get(server);
        const flag = countryCodeToFlag(countryCode);

        // 仅在原名称前添加国旗和一个空格。
        node.name = flag + " " + originalName;
        added++;
      } catch (_) {
        // 失败时保留原名、原节点，不删除。
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          CONCURRENCY,
          proxies.length
        ),
      },
      () => worker()
    )
  );

  $substore.info(
    `服务器IP国旗：新增 ${added}，` +
    `已有国旗跳过 ${skipped}，` +
    `失败保留原名 ${failed}`
  );

  return proxies;
}
