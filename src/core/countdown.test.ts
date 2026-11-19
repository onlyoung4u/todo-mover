import { describe, expect, it } from "vitest";
import { daysUntil } from "./countdown";

describe("daysUntil", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2027-06-30", new Date(2027, 5, 29, 23, 59))).toBe(1);
    expect(daysUntil("2027-06-30", new Date(2027, 5, 30, 0, 1))).toBe(0);
    expect(daysUntil("2027-06-30", new Date(2026, 10, 19, 12))).toBe(223);
  });

  it("never goes negative", () => {
    expect(daysUntil("2027-06-30", new Date(2028, 0, 1))).toBe(0);
  });
});
