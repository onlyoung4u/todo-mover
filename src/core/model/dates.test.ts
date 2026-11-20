import { describe, expect, it } from "vitest";
import {
  formatUtcInZone,
  localToGraphUtc,
  parseGraphDateTime,
  resolveTimeZone,
  toCompletedDate,
  toLocalDate,
  toReminder,
} from "./dates";
import { WINDOWS_TO_IANA } from "./windowsZones";

const utc = (dateTime: string) => ({ dateTime, timeZone: "UTC" });

describe("SPEC 6.3 required cases (export time zone Asia/Shanghai)", () => {
  it("due 2019-11-29T16:00:00 UTC → 2019-11-30", () => {
    expect(toLocalDate(utc("2019-11-29T16:00:00.0000000"), "Asia/Shanghai")).toBe("2019-11-30");
  });

  it("due 2019-04-13T16:00:00 UTC → 2019-04-14", () => {
    expect(toLocalDate(utc("2019-04-13T16:00:00.0000000"), "Asia/Shanghai")).toBe("2019-04-14");
  });

  it("completed 2019-04-14T00:00:00 UTC → 2019-04-14", () => {
    expect(toCompletedDate(utc("2019-04-14T00:00:00.0000000"), "Asia/Shanghai")).toBe("2019-04-14");
  });

  it("the same due date in export time zone UTC → 2019-11-29", () => {
    expect(toLocalDate(utc("2019-11-29T16:00:00.0000000"), "UTC")).toBe("2019-11-29");
  });
});

describe("toCompletedDate", () => {
  it("does not shift a midnight completion date, whatever the export time zone", () => {
    for (const tz of ["Asia/Shanghai", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
      expect(toCompletedDate(utc("2019-04-14T00:00:00.0000000"), tz)).toBe("2019-04-14");
    }
  });

  it("converts a non-midnight completion time like a due date", () => {
    expect(toCompletedDate(utc("2019-04-13T20:00:00.0000000"), "Asia/Shanghai")).toBe("2019-04-14");
    expect(toCompletedDate(utc("2019-04-13T20:00:00.0000000"), "UTC")).toBe("2019-04-13");
  });
});

describe("toLocalDate", () => {
  it("returns undefined for a missing field", () => {
    expect(toLocalDate(undefined, "UTC")).toBeUndefined();
  });

  it("handles negative offsets", () => {
    // 洛杉矶用户设置的 2026-03-01，存为当地零点 = 08:00 UTC
    expect(toLocalDate(utc("2026-03-01T08:00:00.0000000"), "America/Los_Angeles")).toBe(
      "2026-03-01",
    );
  });

  it("parses an IANA time zone in the source value", () => {
    const value = { dateTime: "2026-05-20T00:00:00.0000000", timeZone: "Asia/Tokyo" };
    expect(toLocalDate(value, "Asia/Tokyo")).toBe("2026-05-20");
    expect(toLocalDate(value, "UTC")).toBe("2026-05-19");
  });

  it("parses a Windows time zone name in the source value", () => {
    const value = { dateTime: "2026-05-20T00:00:00.0000000", timeZone: "China Standard Time" };
    expect(toLocalDate(value, "Asia/Shanghai")).toBe("2026-05-20");
    expect(toLocalDate(value, "UTC")).toBe("2026-05-19");
  });

  it("falls back to the literal date with a warning for an unknown time zone", () => {
    const warnings: string[] = [];
    const value = { dateTime: "2026-05-20T00:00:00.0000000", timeZone: "Atlantis Standard Time" };
    expect(toLocalDate(value, "UTC", warnings)).toBe("2026-05-20");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Atlantis Standard Time");
  });

  it("handles DST transitions in the source time zone", () => {
    // 纽约 2026-03-08 02:30 不存在（夏令时开始），仍应落在同一天
    const value = { dateTime: "2026-03-08T02:30:00.0000000", timeZone: "America/New_York" };
    expect(toLocalDate(value, "America/New_York")).toBe("2026-03-08");
  });
});

describe("parseGraphDateTime", () => {
  it("truncates 7-digit fractional seconds", () => {
    const parsed = parseGraphDateTime(utc("2019-10-28T05:51:53.9036930"));
    expect(parsed).toEqual({ kind: "instant", instant: new Date("2019-10-28T05:51:53.903Z") });
  });

  it("warns on garbage input", () => {
    const warnings: string[] = [];
    expect(parseGraphDateTime(utc("not a date"), warnings)).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});

describe("toReminder", () => {
  it("converts to the export time zone and keeps the UTC value", () => {
    expect(toReminder(utc("2026-03-10T01:30:00.0000000"), "Asia/Shanghai")).toEqual({
      local: "2026-03-10T09:30",
      utc: "2026-03-10T01:30:00Z",
    });
    expect(toReminder(utc("2026-03-10T01:30:00.0000000"), "America/Los_Angeles")).toEqual({
      local: "2026-03-09T18:30",
      utc: "2026-03-10T01:30:00Z",
    });
  });
});

describe("formatUtcInZone", () => {
  it("shows a UTC timestamp as local time", () => {
    expect(formatUtcInZone("2019-10-28T05:51:53.903693Z", "Asia/Shanghai")).toBe(
      "2019-10-28 13:51",
    );
    expect(formatUtcInZone("2019-10-28T05:51:53.903693Z", "UTC")).toBe("2019-10-28 05:51");
    expect(formatUtcInZone(undefined, "UTC")).toBe("");
  });
});

describe("resolveTimeZone", () => {
  it("recognizes UTC spellings", () => {
    for (const name of ["UTC", "utc", "Etc/UTC", "tzone://Microsoft/Utc"]) {
      expect(resolveTimeZone(name)).toBe("UTC");
    }
  });

  it("does not accept ambiguous abbreviations", () => {
    expect(resolveTimeZone("EST")).toBeUndefined();
  });

  it("maps every Windows zone to a time zone this runtime supports", () => {
    for (const [windows, iana] of Object.entries(WINDOWS_TO_IANA)) {
      expect(resolveTimeZone(windows), windows).toBe(iana);
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: iana }), iana).not.toThrow();
    }
  });
});

describe("localToGraphUtc", () => {
  it("stores a local date the way To Do does", () => {
    expect(localToGraphUtc("2019-11-30", "Asia/Shanghai")).toEqual({
      dateTime: "2019-11-29T16:00:00.0000000",
      timeZone: "UTC",
    });
    expect(localToGraphUtc("2026-12-10T10:00", "UTC")).toEqual({
      dateTime: "2026-12-10T10:00:00.0000000",
      timeZone: "UTC",
    });
  });

  it("round-trips through toLocalDate in the same time zone", () => {
    for (const tz of ["Asia/Shanghai", "America/New_York", "Europe/London", "Pacific/Kiritimati"]) {
      expect(toLocalDate(localToGraphUtc("2027-03-14", tz), tz), tz).toBe("2027-03-14");
    }
  });
});
