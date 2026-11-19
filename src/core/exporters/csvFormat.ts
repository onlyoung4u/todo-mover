/** RFC 4180 CSV 编码（通用 CSV 与 Todoist CSV 共用）。 */

export const UTF8_BOM = String.fromCharCode(0xfeff);

/** 含逗号、引号或换行的字段加双引号，内部引号写成两个。 */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 行之间用 CRLF 分隔，末尾也带 CRLF。 */
export function toCsv(
  rows: readonly (readonly string[])[],
  options: { bom?: boolean } = {},
): string {
  const body = rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
  return (options.bom ? UTF8_BOM : "") + body;
}

/**
 * Excel 公式注入防护：以 = + - @（以及制表符、回车）开头的单元格前加一个 '，
 * 防止打开文件时被当作公式执行。
 */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
