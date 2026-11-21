import { describe, expect, it } from "vitest";
import { formatUtcDate } from "./dates";

describe("formatUtcDate", () => {
  it("formats a UTC midnight Date as YYYY-MM-DD", () => {
    expect(formatUtcDate(new Date("2026-11-20T00:00:00.000Z"))).toBe("2026-11-20");
    expect(formatUtcDate(new Date("2027-01-05T00:00:00.000Z"))).toBe("2027-01-05");
  });

  it("ignores local timezone offset when crossing day boundaries", () => {
    // 即使在 UTC-8（2026-11-19 16:00）或 UTC+9（2026-11-20 09:00），UTC 日期仍是 2026-11-20
    expect(formatUtcDate(new Date(Date.UTC(2026, 10, 20, 0, 0, 0)))).toBe("2026-11-20");
    expect(formatUtcDate(new Date(Date.UTC(2026, 10, 20, 23, 59, 59)))).toBe("2026-11-20");
  });

  it("throws on invalid Date", () => {
    expect(() => formatUtcDate(new Date("not-a-date"))).toThrow(RangeError);
  });
});
