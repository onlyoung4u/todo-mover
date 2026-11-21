import { describe as suite, expect, it } from "vitest";
import type { GraphRecurrencePattern, GraphRecurrenceRange } from "../graph/types";
import {
  describe,
  firstOccurrenceOnOrAfter,
  hasEnd,
  resolveRecurrenceStart,
  toObsidianTasks,
  toRRule,
  toTodoist,
} from "./recurrence";
import type { Recurrence } from "./types";

const noEnd: GraphRecurrenceRange = {
  type: "noEnd",
  startDate: "2026-01-05",
  endDate: "0001-01-01",
};

function rec(pattern: Partial<GraphRecurrencePattern>, range: Partial<GraphRecurrenceRange> = {}) {
  return {
    pattern: { type: "daily", interval: 1, ...pattern },
    range: { ...noEnd, ...range },
  } as Recurrence;
}

const daily = rec({ type: "daily" });
const every3Days = rec({ type: "daily", interval: 3 });
const weeklyMonWed = rec(
  { type: "weekly", daysOfWeek: ["wednesday", "monday"], firstDayOfWeek: "sunday" },
  { type: "endDate", endDate: "2026-06-29" },
);
const biweeklyMonWed = rec({
  type: "weekly",
  interval: 2,
  daysOfWeek: ["monday", "wednesday"],
  firstDayOfWeek: "monday",
});
const monthly15 = rec(
  { type: "absoluteMonthly", dayOfMonth: 15 },
  { type: "numbered", numberOfOccurrences: 10 },
);
const firstMonday = rec({ type: "relativeMonthly", daysOfWeek: ["monday"], index: "first" });
const lastFriday = rec({ type: "relativeMonthly", daysOfWeek: ["friday"], index: "last" });
const yearlyMar5 = rec({ type: "absoluteYearly", month: 3, dayOfMonth: 5 });
const yearlyFirstMondayOfMarch = rec({
  type: "relativeYearly",
  month: 3,
  daysOfWeek: ["monday"],
  index: "first",
});

suite("toRRule", () => {
  it.each([
    [daily, "FREQ=DAILY;INTERVAL=1"],
    [every3Days, "FREQ=DAILY;INTERVAL=3"],
    [weeklyMonWed, "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;WKST=SU;UNTIL=20260629"],
    [biweeklyMonWed, "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=MO"],
    [monthly15, "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;COUNT=10"],
    [firstMonday, "FREQ=MONTHLY;INTERVAL=1;BYDAY=+1MO"],
    [lastFriday, "FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR"],
    [yearlyMar5, "FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYMONTHDAY=5"],
    [yearlyFirstMondayOfMarch, "FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYDAY=+1MO"],
  ])("%#: %s", (input, expected) => {
    expect(toRRule(input)).toBe(expected);
  });

  it("ignores the placeholder end date of noEnd ranges", () => {
    expect(toRRule(rec({ type: "daily" }, { type: "noEnd", endDate: "0001-01-01" }))).toBe(
      "FREQ=DAILY;INTERVAL=1",
    );
  });

  it("returns undefined when required fields are missing", () => {
    expect(toRRule(rec({ type: "absoluteMonthly" }))).toBeUndefined();
    expect(toRRule(rec({ type: "relativeMonthly", daysOfWeek: [] }))).toBeUndefined();
  });

  it("uses BYSETPOS for relativeMonthly and relativeYearly with multiple weekdays", () => {
    expect(
      toRRule(
        rec(
          { type: "relativeMonthly", daysOfWeek: ["wednesday", "monday"], index: "first" },
          { type: "numbered", numberOfOccurrences: 3 },
        ),
      ),
    ).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=MO,WE;BYSETPOS=1;COUNT=3");
    expect(
      toRRule(rec({ type: "relativeMonthly", daysOfWeek: ["monday", "wednesday"], index: "last" })),
    ).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=MO,WE;BYSETPOS=-1");
    expect(
      toRRule(
        rec({
          type: "relativeYearly",
          month: 3,
          daysOfWeek: ["monday", "wednesday"],
          index: "first",
        }),
      ),
    ).toBe("FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYDAY=MO,WE;BYSETPOS=1");
  });

  it("allows overriding COUNT with remaining occurrences", () => {
    expect(toRRule(monthly15, { count: 2 })).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;COUNT=2");
    expect(toRRule(monthly15, { count: 0 })).toBeUndefined();
  });
});

suite("describe", () => {
  it("matches the SPEC examples", () => {
    expect(describe(biweeklyMonWed, "zh-CN")).toBe("每 2 周（周一、周三）");
    expect(describe(biweeklyMonWed, "en")).toBe("Every 2 weeks on Mon, Wed");
  });

  it.each([
    [daily, "每天", "Every day", "每天"],
    [every3Days, "每 3 天", "Every 3 days", "每 3 天"],
    [
      weeklyMonWed,
      "每周（周一、周三），直到 2026-06-29",
      "Every week on Mon, Wed, until 2026-06-29",
      "每週（週一、週三），直到 2026-06-29",
    ],
    [monthly15, "每月 15 日，共 10 次", "Every month on day 15, 10 times", "每月 15 日，共 10 次"],
    [firstMonday, "每月第一个周一", "Every month on the first Mon", "每月第一個週一"],
    [lastFriday, "每月最后一个周五", "Every month on the last Fri", "每月最後一個週五"],
    [yearlyMar5, "每年 3 月 5 日", "Every year on Mar 5", "每年 3 月 5 日"],
    [
      yearlyFirstMondayOfMarch,
      "每年 3 月第一个周一",
      "Every year on the first Mon of Mar",
      "每年 3 月第一個週一",
    ],
  ])("%#", (input, zhCN, en, zhTW) => {
    expect(describe(input, "zh-CN")).toBe(zhCN);
    expect(describe(input, "en")).toBe(en);
    expect(describe(input, "zh-TW")).toBe(zhTW);
  });

  it("uses a localized interval for months", () => {
    const every2Months = rec({ type: "absoluteMonthly", interval: 2, dayOfMonth: 1 });
    expect(describe(every2Months, "zh-CN")).toBe("每 2 个月 1 日");
    expect(describe(every2Months, "zh-TW")).toBe("每 2 個月 1 日");
  });
});

suite("toTodoist", () => {
  it.each([
    [daily, "every day"],
    [every3Days, "every 3 days"],
    [weeklyMonWed, "every monday, wednesday"],
    [biweeklyMonWed, "every 2 weeks on monday, wednesday"],
    [monthly15, "every month on the 15th"],
    [firstMonday, "every first monday"],
    [lastFriday, "every last friday"],
    [yearlyMar5, "every year on mar 5"],
  ])("%#: %s", (input, expected) => {
    expect(toTodoist(input)).toBe(expected);
  });

  it("returns undefined for patterns Todoist cannot express", () => {
    expect(toTodoist(yearlyFirstMondayOfMarch)).toBeUndefined();
    expect(
      toTodoist(rec({ type: "relativeMonthly", daysOfWeek: ["monday", "friday"] })),
    ).toBeUndefined();
  });

  it("uses correct ordinals", () => {
    const day = (d: number) => toTodoist(rec({ type: "absoluteMonthly", dayOfMonth: d }));
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(day)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"].map(
        (s) => `every month on the ${s}`,
      ),
    );
  });
});

suite("toObsidianTasks", () => {
  it.each([
    [daily, "every day"],
    [biweeklyMonWed, "every 2 weeks on Monday, Wednesday"],
    [monthly15, "every month on the 15th"],
    [firstMonday, "every month on the 1st Monday"],
    [lastFriday, "every month on the last Friday"],
    [yearlyMar5, "every March on the 5th"],
    [yearlyFirstMondayOfMarch, "every year"],
  ])("%#: %s", (input, expected) => {
    expect(toObsidianTasks(input)).toBe(expected);
  });
});

suite("malformed and finite rules", () => {
  it("does not throw on an out-of-range month or day", () => {
    for (const month of [0, 13, -1, 1.5]) {
      const yearly = rec({ type: "absoluteYearly", month, dayOfMonth: 3 });
      expect(toRRule(yearly)).toBeUndefined();
      expect(toTodoist(yearly)).toBeUndefined();
      expect(toObsidianTasks(yearly)).toBe("every year");
      expect(() => describe(yearly, "en")).not.toThrow();
    }
    expect(toRRule(rec({ type: "absoluteMonthly", dayOfMonth: 32 }))).toBeUndefined();
  });

  it("knows when a repeat ends and formats floating UNTIL time when requested", () => {
    expect(hasEnd(weeklyMonWed)).toBe(true);
    expect(hasEnd(rec({}, { type: "numbered", numberOfOccurrences: 5 }))).toBe(true);
    expect(hasEnd(daily)).toBe(false);
    expect(toRRule(weeklyMonWed, { untilTime: "235959" })).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;WKST=SU;UNTIL=20260629T235959",
    );
  });
});

suite("firstOccurrenceOnOrAfter", () => {
  it("keeps dates that already match the rule", () => {
    expect(firstOccurrenceOnOrAfter("2026-12-02", weeklyMonWed)).toBeUndefined(); // 超过 endDate 2026-06-29
    expect(firstOccurrenceOnOrAfter("2026-01-05", weeklyMonWed)).toBe("2026-01-05");
    expect(firstOccurrenceOnOrAfter("2026-01-07", weeklyMonWed)).toBe("2026-01-07");
    expect(firstOccurrenceOnOrAfter("2026-01-10", daily)).toBe("2026-01-10");
  });

  it("advances an off-rule date to the first matching occurrence", () => {
    const meeting = rec(
      { type: "weekly", daysOfWeek: ["monday", "wednesday"], firstDayOfWeek: "sunday" },
      { type: "endDate", endDate: "2027-06-30" },
    );
    // 2026-12-01 是周二 → 对齐到周三 2026-12-02；周四 2026-12-03 → 对齐到下周一 2026-12-07
    expect(firstOccurrenceOnOrAfter("2026-12-01", meeting)).toBe("2026-12-02");
    expect(firstOccurrenceOnOrAfter("2026-12-03", meeting)).toBe("2026-12-07");

    // 按月固定日（含 31 日跳过小月）
    const monthly15NoEnd = rec({ type: "absoluteMonthly", dayOfMonth: 15 });
    expect(firstOccurrenceOnOrAfter("2026-12-04", monthly15NoEnd)).toBe("2026-12-15");
    expect(firstOccurrenceOnOrAfter("2026-12-16", monthly15NoEnd)).toBe("2027-01-15");
    // monthly15 从 2026-01-05 起共 10 次（2026-01-15 .. 2026-10-15），12 月已无剩余期数
    expect(firstOccurrenceOnOrAfter("2026-12-04", monthly15)).toBeUndefined();
    expect(
      firstOccurrenceOnOrAfter("2026-02-01", rec({ type: "absoluteMonthly", dayOfMonth: 31 })),
    ).toBe("2026-03-31");

    // 按月相对星期
    expect(firstOccurrenceOnOrAfter("2026-02-01", firstMonday)).toBe("2026-02-02");
    expect(firstOccurrenceOnOrAfter("2026-02-03", firstMonday)).toBe("2026-03-02");
    expect(firstOccurrenceOnOrAfter("2026-02-01", lastFriday)).toBe("2026-02-27");

    // 按年绝对日（含闰日）与相对星期
    expect(firstOccurrenceOnOrAfter("2026-03-06", yearlyMar5)).toBe("2027-03-05");
    expect(
      firstOccurrenceOnOrAfter(
        "2026-01-01",
        rec({ type: "absoluteYearly", month: 2, dayOfMonth: 29 }),
      ),
    ).toBe("2028-02-29");
    expect(firstOccurrenceOnOrAfter("2026-03-01", yearlyFirstMondayOfMarch)).toBe("2026-03-02");
    expect(firstOccurrenceOnOrAfter("2026-03-03", yearlyFirstMondayOfMarch)).toBe("2027-03-01");
  });
});

suite("resolveRecurrenceStart", () => {
  it("computes remaining COUNT from range.startDate for numbered series", () => {
    const biweekly3 = rec(
      { type: "weekly", interval: 2, daysOfWeek: ["monday"], firstDayOfWeek: "monday" },
      { type: "numbered", startDate: "2027-01-04", numberOfOccurrences: 3 },
    );
    expect(resolveRecurrenceStart("2027-01-04", biweekly3)).toEqual({
      date: "2027-01-04",
      remainingCount: 3,
    });
    expect(resolveRecurrenceStart("2027-01-18", biweekly3)).toEqual({
      date: "2027-01-18",
      remainingCount: 2,
    });
    expect(resolveRecurrenceStart("2027-02-01", biweekly3)).toEqual({
      date: "2027-02-01",
      remainingCount: 1,
    });
    expect(resolveRecurrenceStart("2027-02-15", biweekly3)).toBeUndefined();
  });

  it("keeps biweekly phase aligned to range.startDate and skips off-phase weeks", () => {
    const biweeklyMonSun = rec(
      {
        type: "weekly",
        interval: 2,
        daysOfWeek: ["monday", "sunday"],
        firstDayOfWeek: "monday",
      },
      { type: "endDate", startDate: "2027-01-04", endDate: "2027-02-07" },
    );
    // 2027-01-17 是跳过那一周的周日，不能当作有效起点，应向后对齐到 2027-01-18
    expect(resolveRecurrenceStart("2027-01-17", biweeklyMonSun)).toEqual({ date: "2027-01-18" });
    expect(resolveRecurrenceStart("2027-01-24", biweeklyMonSun)).toEqual({ date: "2027-01-24" });
  });

  it("treats a missing firstDayOfWeek as Sunday (Graph default) and writes WKST=SU", () => {
    const range = { type: "numbered", startDate: "2027-01-04", numberOfOccurrences: 3 } as const;
    const days: GraphRecurrencePattern["daysOfWeek"] = ["sunday", "monday"];
    const missing = rec({ type: "weekly", interval: 2, daysOfWeek: days }, range);
    const sunday = rec(
      { type: "weekly", interval: 2, daysOfWeek: days, firstDayOfWeek: "sunday" },
      range,
    );
    // 以周日为一周起点：有效周为 01-03~01-09、01-17~01-23，序列为 01-04、01-17、01-18；
    // 若误按周一起算，01-10 会被当成第二期
    for (const r of [missing, sunday]) {
      expect(resolveRecurrenceStart("2027-01-10", r)).toEqual({
        date: "2027-01-17",
        remainingCount: 2,
      });
      expect(toRRule(r)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU;WKST=SU;COUNT=3");
    }
  });

  it("picks one date per month for relativeMonthly with multiple daysOfWeek", () => {
    const firstMonOrWed = rec(
      { type: "relativeMonthly", daysOfWeek: ["monday", "wednesday"], index: "first" },
      { type: "numbered", startDate: "2027-03-01", numberOfOccurrences: 3 },
    );
    expect(resolveRecurrenceStart("2027-03-01", firstMonOrWed)).toEqual({
      date: "2027-03-01",
      remainingCount: 3,
    });
    // 3 月的首个周一/周三已是 3 月 1 日，因此 3 月 2 日起应跳到 4 月 5 日并剩余 2 次
    expect(resolveRecurrenceStart("2027-03-02", firstMonOrWed)).toEqual({
      date: "2027-04-05",
      remainingCount: 2,
    });
    expect(resolveRecurrenceStart("2027-05-03", firstMonOrWed)).toEqual({
      date: "2027-05-03",
      remainingCount: 1,
    });
    expect(resolveRecurrenceStart("2027-06-07", firstMonOrWed)).toBeUndefined();
  });

  it("keeps daily and month-31 numbered counts aligned with range.startDate", () => {
    const every3Days4 = rec(
      { type: "daily", interval: 3 },
      { type: "numbered", startDate: "2027-01-01", numberOfOccurrences: 4 },
    );
    expect(resolveRecurrenceStart("2027-01-05", every3Days4)).toEqual({
      date: "2027-01-07",
      remainingCount: 2,
    });

    const monthly31 = rec(
      { type: "absoluteMonthly", dayOfMonth: 31 },
      { type: "numbered", startDate: "2027-01-01", numberOfOccurrences: 3 },
    );
    expect(resolveRecurrenceStart("2027-02-01", monthly31)).toEqual({
      date: "2027-03-31",
      remainingCount: 2,
    });
  });
});
