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

const validDayOfMonth = (d: number | undefined): d is number =>
  typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31;

const JS_DAY_NAME: readonly GraphDayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MS_PER_DAY = 86_400_000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseIsoDate(iso: string): [number, number, number] | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  return [year, month, day];
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toEpochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function formatEpochDay(epochDay: number): string {
  const dt = new Date(epochDay * MS_PER_DAY);
  return formatIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0=sunday .. 6=saturday（1970-01-01 为星期四 = 4） */
function dowOfEpochDay(epochDay: number): number {
  return (((epochDay + 4) % 7) + 7) % 7;
}

/**
 * 某年某月中，在候选星期 days 中排第 index 位的单个日期（Graph relativeMonthly / relativeYearly 语义）。
 * 例如 days=[monday, wednesday], index="first" 表示该月所有周一和周三中最早的那 1 天。
 */
function relativeDateInMonth(
  year: number,
  month: number,
  days: GraphDayOfWeek[],
  index: GraphWeekIndex,
): string | undefined {
  const daySet = new Set(days.map((d) => JS_DAY_NAME.indexOf(d)));
  const total = daysInMonth(year, month);
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const matches: number[] = [];
  for (let day = 1; day <= total; day++) {
    if (daySet.has((firstDow + day - 1) % 7)) matches.push(day);
  }
  if (!matches.length) return undefined;
  const picked = index === "last" ? matches[matches.length - 1] : matches[INDEX_NUMBER[index] - 1];
  return picked === undefined ? undefined : formatIsoDate(year, month, picked);
}

export type ResolvedRecurrenceStart = {
  /** 与原重复序列同相且不早于 anchor 的首个日期（"YYYY-MM-DD"） */
  date: string;
  /** range.type === "numbered" 时，扣除 anchor 之前已消耗期数后剩余的次数（≥ 1） */
  remainingCount?: number;
};

/**
 * 从原重复序列起点（range.startDate，缺省则用 anchor）出发，按 interval 与周起始日计算：
 * 1. 不早于 anchor 且落在原序列有效周期内的首个日期（满足 RFC 5545 §3.8.5.3，且不偏离隔周/隔月相位）；
 * 2. 若为 numbered 范围，扣除之前已消耗的次数并给出剩余 COUNT（避免从第 2 期导出时多排）。
 * 超过 range.endDate 或已无剩余次数时返回 undefined。
 */
export function resolveRecurrenceStart(
  anchor: string,
  rec: Recurrence,
): ResolvedRecurrenceStart | undefined {
  const parsedAnchor = parseIsoDate(anchor);
  if (!parsedAnchor) return undefined;

  const rawRangeStart = rec.range.startDate;
  const parsedRangeStart =
    rawRangeStart && !rawRangeStart.startsWith("0001-") ? parseIsoDate(rawRangeStart) : undefined;
  const seriesStart = parsedRangeStart ? rawRangeStart! : anchor;
  const [sy, sm, sd] = parsedRangeStart ?? parsedAnchor;
  const [ay, am, ad] = parsedAnchor;
  const startDay = toEpochDay(sy, sm, sd);
  const anchorDay = toEpochDay(ay, am, ad);
  const targetDay = Math.max(startDay, anchorDay);
  const targetIso = targetDay === startDay ? seriesStart : anchor;

  const end = validEndDate(rec);
  if (end && targetIso > end) return undefined;
  const totalCount = occurrences(rec);
  const { pattern } = rec;
  const interval = intervalOf(rec);

  const finish = (
    date: string | undefined,
    consumed: number,
  ): ResolvedRecurrenceStart | undefined => {
    if (!date) return undefined;
    if (end && date > end) return undefined;
    if (totalCount !== undefined) {
      const remaining = totalCount - consumed;
      if (remaining <= 0) return undefined;
      return { date, remainingCount: remaining };
    }
    return { date };
  };

  switch (pattern.type) {
    case "daily": {
      const k = anchorDay <= startDay ? 0 : Math.ceil((anchorDay - startDay) / interval);
      return finish(formatEpochDay(startDay + k * interval), k);
    }
    case "weekly": {
      const days = sortedDays(pattern.daysOfWeek);
      const effectiveDays = days.length ? days : [JS_DAY_NAME[dowOfEpochDay(startDay)]!];
      const daySet = new Set(effectiveDays.map((d) => JS_DAY_NAME.indexOf(d)));
      // 与 toRRule 一致：未显式提供 firstDayOfWeek 时 RFC 5545 默认 WKST=MO
      const rawWkst = pattern.firstDayOfWeek?.toLowerCase() as GraphDayOfWeek | undefined;
      const wkstIndex = rawWkst ? JS_DAY_NAME.indexOf(rawWkst) : -1;
      const wkstDow = wkstIndex >= 0 ? wkstIndex : 1;
      const week0 = startDay - ((dowOfEpochDay(startDay) - wkstDow + 7) % 7);
      const weekDays = (k: number): number[] => {
        const base = week0 + k * interval * 7;
        const out: number[] = [];
        for (let offset = 0; offset < 7; offset++) {
          const day = base + offset;
          if (day >= startDay && daySet.has(dowOfEpochDay(day))) out.push(day);
        }
        return out;
      };

      const targetWeek = targetDay - ((dowOfEpochDay(targetDay) - wkstDow + 7) % 7);
      const weeksElapsed = (targetWeek - week0) / 7;
      let k =
        weeksElapsed % interval === 0
          ? weeksElapsed / interval
          : Math.floor(weeksElapsed / interval) + 1;
      let inWeek = weekDays(k);
      let picked = inWeek.find((day) => day >= targetDay);
      if (picked === undefined) {
        k += 1;
        inWeek = weekDays(k);
        picked = inWeek[0];
      }
      if (picked === undefined) return undefined;

      const beforeInWeek = inWeek.filter((day) => day < picked).length;
      const consumed =
        k === 0 ? beforeInWeek : weekDays(0).length + (k - 1) * effectiveDays.length + beforeInWeek;
      return finish(formatEpochDay(picked), consumed);
    }
    case "absoluteMonthly": {
      const dom = pattern.dayOfMonth;
      if (!validDayOfMonth(dom)) return undefined;
      const monthAt = (k: number): [number, number] => {
        const totalMonths = sm - 1 + k * interval;
        return [sy + Math.floor(totalMonths / 12), (totalMonths % 12) + 1];
      };
      if (totalCount === undefined) {
        const diff = (ay - sy) * 12 + (am - sm);
        const k0 = Math.max(0, Math.floor(diff / interval));
        // 最多向后找 48 个周期，可覆盖闰年 2 月 29 日与 31 日
        for (let k = k0; k <= k0 + 48; k++) {
          const [curY, curM] = monthAt(k);
          if (dom <= daysInMonth(curY, curM)) {
            const cand = formatIsoDate(curY, curM, dom);
            if (cand >= targetIso) return finish(cand, 0);
          }
        }
        return undefined;
      }
      if (dom <= 28) {
        const firstCand = formatIsoDate(sy, sm, dom);
        const hasMonth0 = firstCand >= seriesStart ? 1 : 0;
        const diff = (ay - sy) * 12 + (am - sm);
        let k = Math.max(0, Math.floor(diff / interval));
        let [curY, curM] = monthAt(k);
        let cand = formatIsoDate(curY, curM, dom);
        if (cand < targetIso) {
          k += 1;
          [curY, curM] = monthAt(k);
          cand = formatIsoDate(curY, curM, dom);
        }
        const consumed = k === 0 ? 0 : hasMonth0 + (k - 1);
        return finish(cand, consumed);
      }
      // 29/30/31 日会跳过天数不足的小月，需逐周期累计已发生次数
      let consumed = 0;
      const maxSteps = Math.min(totalCount * 12 + 48, 50_000);
      for (let k = 0; k <= maxSteps; k++) {
        const [curY, curM] = monthAt(k);
        if (dom <= daysInMonth(curY, curM)) {
          const cand = formatIsoDate(curY, curM, dom);
          if (cand >= seriesStart) {
            if (cand >= targetIso) return finish(cand, consumed);
            consumed++;
            if (consumed >= totalCount) return undefined;
          }
        }
      }
      return undefined;
    }
    case "relativeMonthly": {
      const days = sortedDays(pattern.daysOfWeek);
      if (!days.length) return undefined;
      const index = pattern.index ?? "first";
      const monthAt = (k: number): [number, number] => {
        const totalMonths = sm - 1 + k * interval;
        return [sy + Math.floor(totalMonths / 12), (totalMonths % 12) + 1];
      };
      const d0 = relativeDateInMonth(sy, sm, days, index);
      const hasMonth0 = d0 !== undefined && d0 >= seriesStart ? 1 : 0;
      const diff = (ay - sy) * 12 + (am - sm);
      let k = Math.max(0, Math.floor(diff / interval));
      let [curY, curM] = monthAt(k);
      let cand = relativeDateInMonth(curY, curM, days, index);
      if (!cand || cand < targetIso) {
        k += 1;
        [curY, curM] = monthAt(k);
        cand = relativeDateInMonth(curY, curM, days, index);
      }
      const consumed = k === 0 ? 0 : hasMonth0 + (k - 1);
      return finish(cand, consumed);
    }
    case "absoluteYearly": {
      const month = pattern.month;
      const dom = pattern.dayOfMonth;
      if (!validMonth(month) || !validDayOfMonth(dom)) return undefined;
      const isLeapDay = month === 2 && dom === 29;
      if (totalCount === undefined) {
        const k0 = Math.max(0, Math.floor((ay - sy) / interval));
        for (let k = k0; k <= k0 + 8; k++) {
          const curY = sy + k * interval;
          if (dom <= daysInMonth(curY, month)) {
            const cand = formatIsoDate(curY, month, dom);
            if (cand >= targetIso) return finish(cand, 0);
          }
        }
        return undefined;
      }
      if (!isLeapDay) {
        const d0 = formatIsoDate(sy, month, dom);
        const hasYear0 = d0 >= seriesStart ? 1 : 0;
        let k = Math.max(0, Math.floor((ay - sy) / interval));
        let cand = formatIsoDate(sy + k * interval, month, dom);
        if (cand < targetIso) {
          k += 1;
          cand = formatIsoDate(sy + k * interval, month, dom);
        }
        const consumed = k === 0 ? 0 : hasYear0 + (k - 1);
        return finish(cand, consumed);
      }
      let consumed = 0;
      const maxSteps = Math.min(totalCount * 8 + 8, 10_000);
      for (let k = 0; k <= maxSteps; k++) {
        const curY = sy + k * interval;
        if (dom <= daysInMonth(curY, month)) {
          const cand = formatIsoDate(curY, month, dom);
          if (cand >= seriesStart) {
            if (cand >= targetIso) return finish(cand, consumed);
            consumed++;
            if (consumed >= totalCount) return undefined;
          }
        }
      }
      return undefined;
    }
    case "relativeYearly": {
      const month = pattern.month;
      const days = sortedDays(pattern.daysOfWeek);
      if (!validMonth(month) || !days.length) return undefined;
      const index = pattern.index ?? "first";
      const d0 = relativeDateInMonth(sy, month, days, index);
      const hasYear0 = d0 !== undefined && d0 >= seriesStart ? 1 : 0;
      let k = Math.max(0, Math.floor((ay - sy) / interval));
      let cand = relativeDateInMonth(sy + k * interval, month, days, index);
      if (!cand || cand < targetIso) {
        k += 1;
        cand = relativeDateInMonth(sy + k * interval, month, days, index);
      }
      const consumed = k === 0 ? 0 : hasYear0 + (k - 1);
      return finish(cand, consumed);
    }
    default:
      return undefined;
  }
}

/** 找到不早于 anchor 且落在原重复序列中的首个日期（resolveRecurrenceStart 的简写）。 */
export function firstOccurrenceOnOrAfter(anchor: string, rec: Recurrence): string | undefined {
  return resolveRecurrenceStart(anchor, rec)?.date;
}

// ───────────────────────────── RRULE ─────────────────────────────

export type RRuleOptions = {
  /** 当 DTSTART 使用本地浮动 DATE-TIME 时，UNTIL 需同为本地 DATE-TIME（如 "235959"） */
  untilTime?: string;
  /** 覆盖 range.numberOfOccurrences（从中间某一期导出时写入剩余次数） */
  count?: number;
};

/**
 * 转为 RRULE 值（不含 "RRULE:" 前缀）。无法表达时返回 undefined。
 */
export function toRRule(rec: Recurrence, options?: RRuleOptions): string | undefined {
  const { pattern } = rec;
  const parts: string[] = [];
  const interval = intervalOf(rec);
  const appendRelativeDays = () => {
    const days = sortedDays(pattern.daysOfWeek);
    if (!days.length) return false;
    const n = INDEX_NUMBER[pattern.index ?? "first"];
    if (days.length === 1) {
      const sign = n > 0 ? "+" : "";
      parts.push(`BYDAY=${sign}${n}${RRULE_DAY[days[0]!]}`);
    } else {
      // Graph 相对月 / 年规则列出多个星期时，每期只取符合条件的第 index 个日期，
      // 对应 RFC 5545 §3.3.10 的 BYDAY=...;BYSETPOS=n，而非每个星期各排一次
      parts.push(`BYDAY=${days.map((d) => RRULE_DAY[d]).join(",")}`, `BYSETPOS=${n}`);
    }
    return true;
  };

  switch (pattern.type) {
    case "daily":
      parts.push("FREQ=DAILY", `INTERVAL=${interval}`);
      break;
    case "weekly": {
      parts.push("FREQ=WEEKLY", `INTERVAL=${interval}`);
      const days = sortedDays(pattern.daysOfWeek);
      if (days.length) parts.push(`BYDAY=${days.map((d) => RRULE_DAY[d]).join(",")}`);
      const wkst = pattern.firstDayOfWeek?.toLowerCase() as GraphDayOfWeek | undefined;
      if (wkst && RRULE_DAY[wkst]) parts.push(`WKST=${RRULE_DAY[wkst]}`);
      break;
    }
    case "absoluteMonthly":
      if (!validDayOfMonth(pattern.dayOfMonth)) return undefined;
      parts.push("FREQ=MONTHLY", `INTERVAL=${interval}`, `BYMONTHDAY=${pattern.dayOfMonth}`);
      break;
    case "relativeMonthly":
      parts.push("FREQ=MONTHLY", `INTERVAL=${interval}`);
      if (!appendRelativeDays()) return undefined;
      break;
    case "absoluteYearly":
      if (!validMonth(pattern.month) || !validDayOfMonth(pattern.dayOfMonth)) return undefined;
      parts.push(
        "FREQ=YEARLY",
        `INTERVAL=${interval}`,
        `BYMONTH=${pattern.month}`,
        `BYMONTHDAY=${pattern.dayOfMonth}`,
      );
      break;
    case "relativeYearly":
      if (!validMonth(pattern.month)) return undefined;
      parts.push("FREQ=YEARLY", `INTERVAL=${interval}`, `BYMONTH=${pattern.month}`);
      if (!appendRelativeDays()) return undefined;
      break;
    default:
      return undefined;
  }

  const until = validEndDate(rec);
  const count = options?.count ?? occurrences(rec);
  if (until) {
    const date = until.replace(/-/g, "");
    parts.push(`UNTIL=${options?.untilTime ? `${date}T${options.untilTime}` : date}`);
  } else if (options?.count !== undefined && options.count <= 0) {
    return undefined;
  } else if (count) {
    parts.push(`COUNT=${count}`);
  }
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
