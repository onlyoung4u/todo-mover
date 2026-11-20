/**
 * 时区与日期规则（SPEC 6.3）。
 *
 * To Do 存储"只有日期"的字段（截止、开始）时，会把用户本地零点换算成 UTC。
 * 例如北京时间 2019-11-30 存为 "2019-11-29T16:00:00 UTC"。所以必须先还原成时间点，
 * 再换算到用户选择的导出时区，才能得到正确的日期。
 */
import type { GraphDateTimeTimeZone } from "../graph/types";
import { WINDOWS_TO_IANA } from "./windowsZones";

const UTC_NAMES = new Set([
  "utc",
  "etc/utc",
  "gmt",
  "coordinated universal time",
  "tzone://microsoft/utc",
]);

/** 解析结果：能确定时间点时给出 instant；时区无法识别时只能退化为字面上的本地日期时间。 */
export type ParsedDateTime =
  | { kind: "instant"; instant: Date }
  | { kind: "local"; /** "YYYY-MM-DDTHH:mm:ss" */ local: string };

type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const validZones = new Map<string, boolean>();

/** 是否为当前运行环境能识别的 IANA 时区名。 */
export function isValidTimeZone(timeZone: string): boolean {
  let ok = validZones.get(timeZone);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      ok = true;
    } catch {
      ok = false;
    }
    validZones.set(timeZone, ok);
  }
  return ok;
}

/** 浏览器默认时区，作为导出时区的默认值（规则 6）。 */
export function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** 把 Graph 的 timeZone 字段解析为 IANA 名称；"UTC" 返回 "UTC"；无法识别返回 undefined。 */
export function resolveTimeZone(timeZone: string): string | undefined {
  const trimmed = timeZone.trim();
  if (UTC_NAMES.has(trimmed.toLowerCase())) return "UTC";
  const windows = WINDOWS_TO_IANA[trimmed];
  if (windows) return windows;
  // IANA 名称都带 "/"（UTC 已在上面处理）；不带 "/" 的缩写如 "EST" 含义不明确，不予采用
  if (trimmed.includes("/") && isValidTimeZone(trimmed)) return trimmed;
  return undefined;
}

/** 解析 "YYYY-MM-DDTHH:mm:ss[.fffffff]"（忽略末尾的 Z 或偏移量，由调用方根据 timeZone 决定含义）。 */
function parseWallTime(dateTime: string): WallTime | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/.exec(
    dateTime.trim(),
  );
  if (!m) return undefined;
  const [, y, mo, d, h = "0", mi = "0", s = "0", frac = ""] = m;
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: Number(s),
    // Graph 返回 7 位小数秒，JS Date 只支持毫秒：截断到 3 位
    millisecond: Number(frac.slice(0, 3).padEnd(3, "0")),
  };
}

function wallTimeToUtcMs(w: WallTime): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, w.millisecond);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** 时间点在某时区下的本地日期时间。 */
export function zonedWallTime(instant: Date, timeZone: string): WallTime {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
    millisecond: instant.getUTCMilliseconds(),
  };
}

/** 某时区在某时间点相对 UTC 的偏移（毫秒）。 */
function offsetMs(utcMs: number, timeZone: string): number {
  return wallTimeToUtcMs(zonedWallTime(new Date(utcMs), timeZone)) - utcMs;
}

/** 某时区下的本地日期时间 → 时间点。夏令时切换造成的不存在 / 重复时刻按常规方式取一个确定值。 */
function zonedWallTimeToInstant(w: WallTime, timeZone: string): Date {
  const asUtc = wallTimeToUtcMs(w);
  const firstOffset = offsetMs(asUtc, timeZone);
  let guess = asUtc - firstOffset;
  const secondOffset = offsetMs(guess, timeZone);
  if (secondOffset !== firstOffset) guess = asUtc - secondOffset;
  return new Date(guess);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function formatDate(w: WallTime): string {
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

function formatMinute(w: WallTime): string {
  return `${formatDate(w)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * 规则 1：把 Graph 的 dateTimeTimeZone 解析为时间点。
 * 无法识别的时区会退化为字面上的本地时间，并把说明写入 warnings。
 */
export function parseGraphDateTime(
  value: GraphDateTimeTimeZone,
  warnings?: string[],
): ParsedDateTime | undefined {
  const wall = parseWallTime(value.dateTime);
  if (!wall) {
    warnings?.push(`Unrecognized date-time "${value.dateTime}"`);
    return undefined;
  }
  const zone = resolveTimeZone(value.timeZone ?? "UTC");
  if (zone === "UTC") return { kind: "instant", instant: new Date(wallTimeToUtcMs(wall)) };
  if (zone) return { kind: "instant", instant: zonedWallTimeToInstant(wall, zone) };

  warnings?.push(
    `Unknown time zone "${value.timeZone}" for "${value.dateTime}"; used the date as written`,
  );
  return {
    kind: "local",
    local: `${formatDate(wall)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`,
  };
}

/**
 * 某时区的本地日期时间 → Graph 风格的 UTC dateTimeTimeZone（To Do 的存储方式，
 * 例如北京时间 2019-11-30 00:00 → "2019-11-29T16:00:00.0000000" UTC）。用于生成演示数据。
 * @param local "YYYY-MM-DD" 或 "YYYY-MM-DDTHH:mm"
 */
export function localToGraphUtc(local: string, timeZone: string): GraphDateTimeTimeZone {
  const wall = parseWallTime(local);
  if (!wall) throw new Error(`Invalid local date-time: ${local}`);
  const tz = resolveTimeZone(timeZone) ?? "UTC";
  const instant = tz === "UTC" ? new Date(wallTimeToUtcMs(wall)) : zonedWallTimeToInstant(wall, tz);
  return { dateTime: instant.toISOString().replace(/Z$/, "0000"), timeZone: "UTC" };
}

/** 时间点 → 导出时区下的 "YYYY-MM-DD"。 */
export function dateInZone(instant: Date, timeZone: string): string {
  return formatDate(zonedWallTime(instant, timeZone));
}

/** 时间点 → 导出时区下的 "YYYY-MM-DDTHH:mm"。 */
export function dateTimeInZone(instant: Date, timeZone: string): string {
  return formatMinute(zonedWallTime(instant, timeZone));
}

/** 时间点 → "YYYY-MM-DDTHH:mm:ssZ"（不带毫秒）。 */
export function formatUtc(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * 规则 2：只有日期含义的字段（dueDate、startDate）。
 * 先解析为时间点，再换算到导出时区，最后取日期部分。
 */
export function toLocalDate(
  value: GraphDateTimeTimeZone | undefined,
  exportTimeZone: string,
  warnings?: string[],
): string | undefined {
  if (!value) return undefined;
  const parsed = parseGraphDateTime(value, warnings);
  if (!parsed) return undefined;
  return parsed.kind === "instant"
    ? dateInZone(parsed.instant, exportTimeZone)
    : parsed.local.slice(0, 10);
}

/**
 * 规则 3：completedDate。
 * 时间部分为 00:00:00 时直接取日期部分，不做时区换算；否则按规则 2 处理。
 */
export function toCompletedDate(
  value: GraphDateTimeTimeZone | undefined,
  exportTimeZone: string,
  warnings?: string[],
): string | undefined {
  if (!value) return undefined;
  const dateTime = value.dateTime.trim();
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?$/.test(dateTime)) return dateTime.slice(0, 10);
  return toLocalDate(value, exportTimeZone, warnings);
}

/** 规则 4：提醒时间是真实的时间点，换算到导出时区，同时保留 UTC 原值。 */
export function toReminder(
  value: GraphDateTimeTimeZone | undefined,
  exportTimeZone: string,
  warnings?: string[],
): { local: string; utc?: string } | undefined {
  if (!value) return undefined;
  const parsed = parseGraphDateTime(value, warnings);
  if (!parsed) return undefined;
  if (parsed.kind === "local") return { local: parsed.local.slice(0, 16) };
  return {
    local: dateTimeInZone(parsed.instant, exportTimeZone),
    utc: formatUtc(parsed.instant),
  };
}

/**
 * 规则 5：UTC 时间戳（createdAt 等）在面向人阅读的格式中显示为导出时区的本地时间，
 * 格式 "YYYY-MM-DD HH:mm"。无法解析时原样返回。
 */
export function formatUtcInZone(isoUtc: string | undefined, exportTimeZone: string): string {
  if (!isoUtc) return "";
  // 截断 7 位小数秒，避免部分引擎解析失败
  const normalized = isoUtc.replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return isoUtc;
  return dateTimeInZone(new Date(ms), exportTimeZone).replace("T", " ");
}
