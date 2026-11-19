/**
 * 保存原始数据前去掉的字段（SPEC 6.1、第 9 节）：
 * `@odata.context` 里含有用户邮箱；`@microsoft.graph.tips` 是 Graph 给开发者的提示，没有数据价值。
 */
const STRIPPED_KEYS = new Set(["@odata.context", "@microsoft.graph.tips"]);

/** 递归去掉上述字段，其余内容原样保留。返回新对象，不修改输入。 */
export function cleanGraphObject<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanGraphObject) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (!STRIPPED_KEYS.has(key)) out[key] = cleanGraphObject(v);
    }
    return out as T;
  }
  return value;
}
