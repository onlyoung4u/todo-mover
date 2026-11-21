/**
 * 按 UTC 把日期格式化为 YYYY-MM-DD。
 * YAML frontmatter 中的日期（如 `2026-11-20`）会被解析为 UTC 零点，
 * 用 UTC 字段提取可以避免因构建机本地时区不同而错一天。
 */
export function formatUtcDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid Date passed to formatUtcDate");
  }
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
