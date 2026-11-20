import { describe as suite, expect, it } from "vitest";
import type { GraphRecurrencePattern, GraphRecurrenceRange } from "../graph/types";
import { describe, hasEnd, toObsidianTasks, toRRule, toTodoist } from "./recurrence";
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
  it("does not throw on an out-of-range month", () => {
    for (const month of [0, 13, -1, 1.5]) {
      const yearly = rec({ type: "absoluteYearly", month, dayOfMonth: 3 });
      expect(toTodoist(yearly)).toBeUndefined();
      expect(toObsidianTasks(yearly)).toBe("every year");
      expect(() => describe(yearly, "en")).not.toThrow();
    }
  });

  it("knows when a repeat ends", () => {
    expect(hasEnd(weeklyMonWed)).toBe(true);
    expect(hasEnd(rec({}, { type: "numbered", numberOfOccurrences: 5 }))).toBe(true);
    expect(hasEnd(daily)).toBe(false);
  });
});
