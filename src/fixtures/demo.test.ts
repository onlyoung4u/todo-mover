import { describe, expect, it } from "vitest";
import { normalize } from "../core/model/normalize";
import { LOCALES } from "../i18n/locales";
import { demoRawData } from "./demo";

describe("demo data", () => {
  it.each(LOCALES)("is written in %s and normalizes without warnings", (locale) => {
    const data = normalize(demoRawData(locale, "Asia/Shanghai"), { timeZone: "Asia/Shanghai" });
    expect(data.warnings).toEqual([]);
    expect(data.lists).toHaveLength(5);
    expect(data.lists.reduce((n, l) => n + l.tasks.length, 0)).toBe(15);
  });

  it("uses each language's own list names and titles", () => {
    const names = (locale: (typeof LOCALES)[number]) =>
      demoRawData(locale, "UTC").lists.map((l) => l.displayName);
    expect(names("en")[0]).toBe("Tasks");
    expect(names("zh-CN")[0]).toBe("任务");
    expect(names("zh-TW")[0]).toBe("工作");
    expect(new Set(LOCALES.map((l) => names(l).join("|"))).size).toBe(3);
  });

  it("stores due dates like To Do (local midnight in UTC), so they round-trip in any time zone", () => {
    for (const tz of ["Asia/Shanghai", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
      const raw = demoRawData("en", tz);
      const passport = raw.tasksByListId.DEMO_TASKS!.find((t) => t.id === "DEMO_PASSPORT")!;
      expect(passport.dueDateTime!.timeZone).toBe("UTC");
      const data = normalize(raw, { timeZone: tz });
      const task = data.lists[0]!.tasks.find((t) => t.id === "DEMO_PASSPORT")!;
      expect(task.dueDate, tz).toBe("2027-01-15");
    }
    const shanghai = demoRawData("en", "Asia/Shanghai").tasksByListId.DEMO_TASKS!;
    expect(shanghai.find((t) => t.id === "DEMO_PASSPORT")!.dueDateTime!.dateTime).toBe(
      "2027-01-14T16:00:00.0000000",
    );
  });

  it("covers the features shown in the viewer", () => {
    const raw = demoRawData("en", "UTC");
    const tasks = Object.values(raw.tasksByListId).flat();
    expect(raw.lists.some((l) => l.wellknownListName === "flaggedEmails")).toBe(true);
    expect(raw.lists.some((l) => l.isShared && !l.isOwner)).toBe(true);
    expect(tasks.some((t) => t.recurrence)).toBe(true);
    expect(tasks.some((t) => t.isReminderOn && t.reminderDateTime)).toBe(true);
    expect(tasks.some((t) => t.body?.contentType === "html")).toBe(true);
    expect(tasks.some((t) => (t.checklistItems ?? []).length > 0)).toBe(true);
    expect(tasks.some((t) => t.status === "completed" && t.completedDateTime)).toBe(true);
    expect(Object.keys(raw.attachmentsByTaskId)).toEqual(["DEMO_SPEC"]);
  });
});
