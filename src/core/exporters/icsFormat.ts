/** iCalendar（RFC 5545）的文本格式规则：转义、折行、日期格式。 */

/** TEXT 值转义：\ ; , 和换行（SPEC 7.4）。 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * 每行超过 75 个字节时折行：续行以一个空格开头（空格也计入 75 字节），
 * 只在完整的 Unicode 字符之间切分，不会把多字节字符拆开。
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74; // 续行开头的空格占 1 字节
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** 行之间用 CRLF，末尾也带 CRLF。 */
export function joinLines(lines: string[]): string {
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "YYYY-MM-DD" → "YYYYMMDD" */
export function icsDate(date: string): string {
  return date.replace(/-/g, "");
}

/** ISO 8601 时间点 → "YYYYMMDDTHHMMSSZ"；无法解析返回 undefined。 */
export function icsUtc(iso: string | Date): string | undefined {
  const ms = iso instanceof Date ? iso.getTime() : Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}
