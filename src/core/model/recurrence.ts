/**
 * 重复规则转换（SPEC 6.4）。输入是 Graph 的 patternedRecurrence。
 *
 * - toRRule：RFC 5545 RRULE，供 ICS 使用
 * - describe：人读描述，用于 CSV、Markdown 纯文本风格和不支持重复规则的格式
 * - toTodoist：Todoist 能识别的英文自然语言
 * - toObsidianTasks：Obsidian Tasks 插件 🔁 后面的规则文本
 *
 * 人读描述的各语言措辞写在本文件里（而不是 i18n 文案文件），因为它们需要按结构拼装。
 * Record<Locale, …> 类型保证新增语言时编译器会提示补全。
 */
import type { Locale } from "../../i18n/locales";
import type { GraphDayOfWeek, GraphWeekIndex } from "../graph/types";
import type { Recurrence } from "./types";

const WEEK_ORDER: GraphDayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const RRULE_DAY: Record<GraphDayOfWeek, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
};

const INDEX_NUMBER: Record<GraphWeekIndex, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  last: -1,
};

const intervalOf = (rec: Recurrence) => Math.max(1, Math.trunc(rec.pattern.interval || 1));

/** 按周一到周日排序并去重 */
function sortedDays(days: GraphDayOfWeek[] | undefined): GraphDayOfWeek[] {
  const set = new Set((days ?? []).map((d) => d.toLowerCase() as GraphDayOfWeek));
  return WEEK_ORDER.filter((d) => set.has(d));
}

function validEndDate(rec: Recurrence): string | undefined {
  const end = rec.range.endDate;
  if (rec.range.type !== "endDate" || !end || end.startsWith("0001-")) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : undefined;
}

function occurrences(rec: Recurrence): number | undefined {
  const n = rec.range.numberOfOccurrences;
  return rec.range.type === "numbered" && n && n > 0 ? n : undefined;
}

/** 重复是否有结束条件（结束日期或次数）。Todoist 和 Obsidian Tasks 的规则文本都无法表达它。 */
export function hasEnd(rec: Recurrence): boolean {
  return Boolean(validEndDate(rec) ?? occurrences(rec));
}

const validMonth = (m: number | undefined): m is number =>
  typeof m === "number" && Number.isInteger(m) && m >= 1 && m <= 12;

// ───────────────────────────── RRULE ─────────────────────────────

/** 转为 RRULE 值（不含 "RRULE:" 前缀）。无法表达时返回 undefined。 */
export function toRRule(rec: Recurrence): string | undefined {
  const { pattern } = rec;
  const parts: string[] = [];
  const interval = intervalOf(rec);
  const relativeDays = () => {
    const n = INDEX_NUMBER[pattern.index ?? "first"];
    const sign = n > 0 ? "+" : "";
    return sortedDays(pattern.daysOfWeek)
      .map((d) => `${sign}${n}${RRULE_DAY[d]}`)
      .join(",");
  };

  switch (pattern.type) {
    case "daily":
      parts.push("FREQ=DAILY", `INTERVAL=${interval}`);
      break;
    case "weekly": {
      parts.push("FREQ=WEEKLY", `INTERVAL=${interval}`);
      const days = sortedDays(pattern.daysOfWeek);
      if (days.length) parts.push(`BYDAY=${days.map((d) => RRULE_DAY[d]).join(",")}`);
      if (pattern.firstDayOfWeek) parts.push(`WKST=${RRULE_DAY[pattern.firstDayOfWeek]}`);
      break;
    }
    case "absoluteMonthly":
      if (!pattern.dayOfMonth) return undefined;
      parts.push("FREQ=MONTHLY", `INTERVAL=${interval}`, `BYMONTHDAY=${pattern.dayOfMonth}`);
      break;
    case "relativeMonthly": {
      const byDay = relativeDays();
      if (!byDay) return undefined;
      parts.push("FREQ=MONTHLY", `INTERVAL=${interval}`, `BYDAY=${byDay}`);
      break;
    }
    case "absoluteYearly":
      if (!pattern.month || !pattern.dayOfMonth) return undefined;
      parts.push(
        "FREQ=YEARLY",
        `INTERVAL=${interval}`,
        `BYMONTH=${pattern.month}`,
        `BYMONTHDAY=${pattern.dayOfMonth}`,
      );
      break;
    case "relativeYearly": {
      const byDay = relativeDays();
      if (!pattern.month || !byDay) return undefined;
      parts.push(
        "FREQ=YEARLY",
        `INTERVAL=${interval}`,
        `BYMONTH=${pattern.month}`,
        `BYDAY=${byDay}`,
      );
      break;
    }
    default:
      return undefined;
  }

  const until = validEndDate(rec);
  const count = occurrences(rec);
  if (until) parts.push(`UNTIL=${until.replace(/-/g, "")}`);
  else if (count) parts.push(`COUNT=${count}`);
  return parts.join(";");
}

// ───────────────────────────── describe ─────────────────────────────

type Phrases = {
  dayNames: Record<GraphDayOfWeek, string>;
  daySep: string;
  index: Record<GraphWeekIndex, string>;
  monthName: (m: number) => string;
  daily: (n: number) => string;
  weekly: (n: number, days: string) => string;
  absoluteMonthly: (n: number, day: number) => string;
  relativeMonthly: (n: number, index: string, days: string) => string;
  absoluteYearly: (n: number, month: string, day: number) => string;
  relativeYearly: (n: number, month: string, index: string, days: string) => string;
  until: (date: string) => string;
  count: (n: number) => string;
};

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const en: Phrases = {
  dayNames: {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  },
  daySep: ", ",
  index: { first: "first", second: "second", third: "third", fourth: "fourth", last: "last" },
  monthName: (m) => EN_MONTHS[m - 1] ?? String(m),
  daily: (n) => (n === 1 ? "Every day" : `Every ${n} days`),
  weekly: (n, days) => (n === 1 ? "Every week" : `Every ${n} weeks`) + (days ? ` on ${days}` : ""),
  absoluteMonthly: (n, day) => (n === 1 ? "Every month" : `Every ${n} months`) + ` on day ${day}`,
  relativeMonthly: (n, index, days) =>
    (n === 1 ? "Every month" : `Every ${n} months`) + ` on the ${index} ${days}`,
  absoluteYearly: (n, month, day) =>
    (n === 1 ? "Every year" : `Every ${n} years`) + ` on ${month} ${day}`,
  relativeYearly: (n, month, index, days) =>
    (n === 1 ? "Every year" : `Every ${n} years`) + ` on the ${index} ${days} of ${month}`,
  until: (date) => `, until ${date}`,
  count: (n) => `, ${n} times`,
};

function chinese(variant: "zh-CN" | "zh-TW"): Phrases {
  const tw = variant === "zh-TW";
  const week = tw ? "週" : "周";
  const dayNames = {
    monday: `${week}一`,
    tuesday: `${week}二`,
    wednesday: `${week}三`,
    thursday: `${week}四`,
    friday: `${week}五`,
    saturday: `${week}六`,
    sunday: `${week}日`,
  };
  const ge = tw ? "個" : "个";
  const every = (n: number, unit: string, unitN = unit) =>
    n === 1 ? `每${unit}` : `每 ${n} ${unitN}`;
  return {
    dayNames,
    daySep: "、",
    index: {
      first: `第一${ge}`,
      second: `第二${ge}`,
      third: `第三${ge}`,
      fourth: `第四${ge}`,
      last: tw ? "最後一個" : "最后一个",
    },
    monthName: (m) => `${m} 月`,
    daily: (n) => every(n, "天"),
    weekly: (n, days) => every(n, week) + (days ? `（${days}）` : ""),
    absoluteMonthly: (n, day) => `${every(n, "月", `${ge}月`)} ${day} 日`,
    relativeMonthly: (n, index, days) => `${every(n, "月", `${ge}月`)}${index}${days}`,
    absoluteYearly: (n, month, day) => `${every(n, "年")} ${month} ${day} 日`,
    relativeYearly: (n, month, index, days) => `${every(n, "年")} ${month}${index}${days}`,
    until: (date) => `，直到 ${date}`,
    count: (n) => `，共 ${n} 次`,
  };
}

const PHRASES: Record<Locale, Phrases> = {
  en,
  "zh-CN": chinese("zh-CN"),
  "zh-TW": chinese("zh-TW"),
};

/** 人读描述，如 "每 2 周（周一、周三）" / "Every 2 weeks on Mon, Wed"。 */
export function describe(rec: Recurrence, locale: Locale): string {
  const p = PHRASES[locale] ?? en;
  const { pattern } = rec;
  const n = intervalOf(rec);
  const days = sortedDays(pattern.daysOfWeek)
    .map((d) => p.dayNames[d])
    .join(p.daySep);
  const index = p.index[pattern.index ?? "first"];
  const month = p.monthName(pattern.month ?? 1);

  let text: string;
  switch (pattern.type) {
    case "daily":
      text = p.daily(n);
      break;
    case "weekly":
      text = p.weekly(n, days);
      break;
    case "absoluteMonthly":
      text = p.absoluteMonthly(n, pattern.dayOfMonth ?? 1);
      break;
    case "relativeMonthly":
      text = p.relativeMonthly(n, index, days);
      break;
    case "absoluteYearly":
      text = p.absoluteYearly(n, month, pattern.dayOfMonth ?? 1);
      break;
    case "relativeYearly":
      text = p.relativeYearly(n, month, index, days);
      break;
    default:
      text = String(pattern.type);
  }

  const until = validEndDate(rec);
  const count = occurrences(rec);
  if (until) text += p.until(until);
  else if (count) text += p.count(count);
  return text;
}

// ───────────────────────────── Todoist ─────────────────────────────

const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

/**
 * Todoist 能识别的英文自然语言（DATE 列）。无法表达时返回 undefined，
 * 调用方把 describe() 的结果写进备注作为降级处理。
 * 结束条件不会体现在结果里：Todoist 文档只给出不带年份的 "until aug 3"，无法可靠表达，
 * 调用方用 hasEnd() 判断后把完整描述写进备注。
 */
export function toTodoist(rec: Recurrence): string | undefined {
  const { pattern } = rec;
  const n = intervalOf(rec);
  const days = sortedDays(pattern.daysOfWeek);
  const every = (unit: string) => (n === 1 ? `every ${unit}` : `every ${n} ${unit}s`);

  switch (pattern.type) {
    case "daily":
      return every("day");
    case "weekly":
      if (!days.length) return every("week");
      if (n === 1) return `every ${days.join(", ")}`;
      return `every ${n} weeks on ${days.join(", ")}`;
    case "absoluteMonthly":
      if (!pattern.dayOfMonth) return undefined;
      return `${every("month")} on the ${ordinal(pattern.dayOfMonth)}`;
    case "relativeMonthly":
      if (n !== 1 || days.length !== 1) return undefined;
      return `every ${pattern.index ?? "first"} ${days[0]}`;
    case "absoluteYearly":
      if (n !== 1 || !validMonth(pattern.month) || !pattern.dayOfMonth) return undefined;
      return `every year on ${EN_MONTHS[pattern.month - 1]!.toLowerCase()} ${pattern.dayOfMonth}`;
    default:
      return undefined;
  }
}

// ───────────────────────────── Obsidian Tasks ─────────────────────────────

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Obsidian Tasks 插件 🔁 后面的规则文本（插件按 rrule 的英文语法解析）。
 * 无法表达的部分会退化为更粗的规则，例如 "every year"。
 * 插件明确不支持 "until 日期" 和 "for N times"，结束条件需由调用方另行写出（见 hasEnd）。
 */
export function toObsidianTasks(rec: Recurrence): string {
  const { pattern } = rec;
  const n = intervalOf(rec);
  const days = sortedDays(pattern.daysOfWeek).map(capitalize);
  const every = (unit: string) => (n === 1 ? `every ${unit}` : `every ${n} ${unit}s`);
  const nth = pattern.index === "last" ? "last" : ordinal(INDEX_NUMBER[pattern.index ?? "first"]);

  switch (pattern.type) {
    case "daily":
      return every("day");
    case "weekly":
      return every("week") + (days.length ? ` on ${days.join(", ")}` : "");
    case "absoluteMonthly":
      return every("month") + (pattern.dayOfMonth ? ` on the ${ordinal(pattern.dayOfMonth)}` : "");
    case "relativeMonthly":
      return every("month") + (days.length === 1 ? ` on the ${nth} ${days[0]}` : "");
    case "absoluteYearly":
      if (n === 1 && validMonth(pattern.month) && pattern.dayOfMonth) {
        return `every ${FULL_MONTHS[pattern.month - 1]} on the ${ordinal(pattern.dayOfMonth)}`;
      }
      return every("year");
    default:
      return every("year");
  }
}
