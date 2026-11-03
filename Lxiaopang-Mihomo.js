
/**
 * Lxiaopang-Mihomo 节点顺序管理脚本
 *
 * 功能：
 * 1. 从 Add Proxies 注入的 all 组合订阅读取节点
 * 2. 完全按照 all 中的原始顺序排列
 * 3. 机场节点和自建节点混合排列
 * 4. 三个手动选择组不包含 DIRECT
 * 5. 三个手动选择组包含全部有效节点
 * 6. 保留香港、日本、美国、新加坡、台湾等地区正则分组
 * 7. 保留 GW、HY、AZ、BZ、WB 等自定义正则分组
 * 8. 自动删除 Mihomo include-all-proxies 排序机制
 * 9. 新增、删除节点后自动更新
 *
 * 操作顺序：
 * Add Proxies（来源 all）
 *          ↓
 * Script（本脚本）
 *          ↓
 * 输出 Mihomo YAML
 */

// =====================================================
// 1. 读取 Sub-Store 当前配置
// =====================================================

const raw = $content ?? ($files && $files[0]);

if (!raw) {
  throw new Error(
    "未读取到配置内容，请确认 Script 放在 Add Proxies 操作之后。"
  );
}

const config = ProxyUtils.yaml.safeLoad(raw);

if (!config || !Array.isArray(config.proxies)) {
  throw new Error(
    "配置中不存在 proxies 数组，请检查 Add Proxies 是否执行成功。"
  );
}

// =====================================================
// 2. 获取 all 组合订阅中的节点
// =====================================================

const nodes = config.proxies.filter(
  node =>
    node &&
    typeof node.name === "string" &&
    node.name.trim().length > 0
);

if (nodes.length === 0) {
  throw new Error(
    "proxies 数组为空：没有从 all 组合订阅中获取到有效节点。"
  );
}

// 按 Add Proxies 注入后的数组顺序记录节点名称
const allNames = nodes.map(node => node.name);

// =====================================================
// 3. 正则表达式兼容处理
// =====================================================

function compilePattern(pattern) {

  if (pattern == null || pattern === "") {
    return /.*/i;
  }

  let source = String(pattern);
  let flags = "";

  // 兼容常见的 (?i) 不区分大小写写法
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    flags = "i";
  }

  try {
    return new RegExp(source, flags);
  } catch (error) {
    throw new Error(
      "策略组正则表达式转换失败：" +
      pattern +
      "；原因：" +
      error.message
    );
  }
}

// =====================================================
// 4. 去重但保留原始顺序
// =====================================================

function uniqueInOrder(items) {

  const seen = new Set();

  return items.filter(item => {

    if (
      typeof item !== "string" ||
      item.length === 0 ||
      seen.has(item)
    ) {
      return false;
    }

    seen.add(item);

    return true;
  });
}

// =====================================================
// 5. 定义三个手动选择组
// =====================================================

const manualGroupNames = new Set([
  "🚀 手动切换1",
  "🚀 手动切换2",
  "🚀 手动切换3"
]);

// =====================================================
// 6. 遍历所有策略组
// =====================================================

for (const group of (config["proxy-groups"] || [])) {

  // ---------------------------------------------------
  // A. 三个手动选择组
  // ---------------------------------------------------

  if (manualGroupNames.has(group.name)) {

    // 只保留 all 中的真实节点
    // 不添加 DIRECT
    // 不添加其他固定占位项
    // 严格保持 all 原始顺序

    group.proxies = uniqueInOrder(allNames);

    // 删除 Mihomo 自动排序机制
    delete group["include-all-proxies"];

    continue;
  }

  // ---------------------------------------------------
  // B. 地区和自定义正则分组
  // ---------------------------------------------------

  const hasFilter =
    group["_substore-order-filter"] != null ||
    group["_substore-order-exclude-filter"] != null;

  if (hasFilter) {

    const include = compilePattern(
      group["_substore-order-filter"]
    );

    const exclude =
      group["_substore-order-exclude-filter"] == null
        ? null
        : compilePattern(
            group["_substore-order-exclude-filter"]
          );

    // 按 all 原始顺序筛选节点
    const matched = nodes

      .filter(node => {

        include.lastIndex = 0;

        if (!include.test(node.name)) {
          return false;
        }

        if (exclude) {

          exclude.lastIndex = 0;

          if (exclude.test(node.name)) {
            return false;
          }
        }

        return true;
      })

      .map(node => node.name);

    // 保留筛选结果的原始相对顺序
    group.proxies = uniqueInOrder(matched);
  }

  // ---------------------------------------------------
  // C. 清理临时字段
  // ---------------------------------------------------

  delete group["include-all-proxies"];

  delete group["_substore-order-filter"];

  delete group["_substore-order-exclude-filter"];
}

// =====================================================
// 7. 输出最终 Mihomo YAML
// =====================================================

// 将处理后的完整配置交还给 Sub-Store
$content = ProxyUtils.yaml.dump(config);
