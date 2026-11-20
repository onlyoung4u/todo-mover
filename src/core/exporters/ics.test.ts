import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { demoRawData, sampleRawData, syntheticRawData } from "../../fixtures";
import type { GraphPatternedRecurrence, GraphTodoTask, RawData } from "../graph/types";
import { localToGraphUtc } from "../model/dates";
import { normalize } from "../model/normalize";
import { icsExporter } from "./ics";
import { escapeText, foldLine, icsUtc } from "./icsFormat";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const sample = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const synthetic = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const encoder = new TextEncoder();

function parse(content: string) {
  return new ICAL.Component(ICAL.parse(content));
}

function todos(content: string) {
  return new Map(
    parse(content)
      .getAllSubcomponents("vtodo")
      .map((c) => [String(c.getFirstPropertyValue("uid")), c]),
  );
}

function expandDates(todo: ICAL.Component, limit = 100): string[] {
  const dates: string[] = [];
  const it = new ICAL.Event(todo).iterator();
  for (let next = it.next(); next && dates.length < limit; next = it.next()) {
    dates.push(next.toString().slice(0, 10));
  }
  return dates;
}

describe("ics exporter", () => {
  const sampleFiles = icsExporter.run(sample, {}, { locale: "zh-CN" }).files;
  const syntheticResult = icsExporter.run(synthetic, {}, { locale: "zh-CN" });

  it("writes one calendar per list", () => {
    expect(sampleFiles.map((f) => f.path)).toEqual(["任务.ics", "🐶Baby购物清单.ics"]);
    expect(syntheticResult.files).toHaveLength(4);
    expect(syntheticResult.warnings).toEqual([]);
  });

  it("parses with ical.js", () => {
    for (const file of [...sampleFiles, ...syntheticResult.files]) {
      const cal = parse(file.content as string);
      expect(cal.name).toBe("vcalendar");
      expect(cal.getFirstPropertyValue("version")).toBe("2.0");
    }
  });

  it("maps the sample tasks", () => {
    const content = sampleFiles[0]!.content as string;
    const cal = parse(content);
    expect(cal.getFirstPropertyValue("x-wr-calname")).toBe("任务");

    const byUid = todos(content);
    const augBlog = byUid.get("TASK_1@todo-mover")!;
    expect(augBlog.getFirstPropertyValue("summary")).toBe("AugBlog");
    expect(augBlog.getFirstPropertyValue("due")!.toString()).toBe("2019-11-30");
    expect(augBlog.getFirstProperty("due")!.type).toBe("date");
    expect(augBlog.getFirstPropertyValue("status")).toBe("NEEDS-ACTION");
    expect(augBlog.getFirstPropertyValue("priority")).toBe(5);
    expect(augBlog.getFirstPropertyValue("description")).toBe("[ ] Ant design pro\n[ ] Golang api");
    expect(augBlog.getFirstPropertyValue("created")!.toString()).toBe("2019-10-28T05:51:53Z");
    expect(augBlog.getFirstPropertyValue("dtstamp")!.toString()).toBe("2026-11-19T08:00:00Z");

    const done = byUid.get("TASK_2@todo-mover")!;
    expect(done.getFirstPropertyValue("status")).toBe("COMPLETED");
    expect(done.getFirstPropertyValue("completed")!.toString()).toBe("2019-04-14T00:00:00Z");
    expect(done.getFirstPropertyValue("priority")).toBe(1);
  });

  it("round-trips escaped text, categories, recurrence and alarms", () => {
    const main = todos(syntheticResult.files[0]!.content as string);

    const escaped = main.get("SYN_ESCAPE@todo-mover")!;
    expect(escaped.getFirstPropertyValue("summary")).toBe('买菜, "牛奶"\n🥛 & 鸡蛋; a\\b');
    expect(escaped.getFirstPropertyValue("description")).toBe("备注第一行\n备注, 第二行; 含分号");

    const long = main.get("SYN_LONG@todo-mover")!;
    expect(long.getFirstPropertyValue("summary")).toBe(
      "这是一个很长的中文标题，用来测试 ICS 按 75 字节折行时不会把多字节字符拆开——🚀🚀🚀 emoji 也一样",
    );

    expect(
      main.get("SYN_CATEGORIES@todo-mover")!.getFirstProperty("categories")!.getValues(),
    ).toEqual(["工作", "Home Errands"]);

    const weekly = main.get("SYN_WEEKLY@todo-mover")!.getFirstPropertyValue("rrule")!;
    // 同日重复任务使用本地浮动 DATE-TIME，UNTIL 与 DTSTART 同类型（RFC 5545 §3.3.10）
    expect(weekly.toString()).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260629T235959;WKST=SU");

    const reminder = main.get("SYN_REMINDER@todo-mover")!;
    const alarm = reminder.getFirstSubcomponent("valarm")!;
    expect(alarm.getFirstPropertyValue("action")).toBe("DISPLAY");
    expect(alarm.getFirstPropertyValue("trigger")!.toString()).toBe("2026-03-10T01:30:00Z");

    expect(main.get("SYN_START@todo-mover")!.getFirstPropertyValue("dtstart")!.toString()).toBe(
      "2026-04-02",
    );
    expect(main.get("SYN_LOW@todo-mover")!.getFirstPropertyValue("priority")).toBe(9);
    expect(main.get("SYN_IN_PROGRESS@todo-mover")!.getFirstPropertyValue("status")).toBe(
      "IN-PROCESS",
    );
  });

  it("satisfies RFC 5545 DTSTART / DUE / RRULE invariants for every VTODO", () => {
    const checkCalendar = (content: string) => {
      for (const todo of parse(content).getAllSubcomponents("vtodo")) {
        const dtstart = todo.getFirstPropertyValue("dtstart") as ICAL.Time | null;
        const due = todo.getFirstPropertyValue("due") as ICAL.Time | null;
        const rrule = todo.getFirstPropertyValue("rrule") as ICAL.Recur | null;
        if (dtstart && due) {
          // RFC 5545 §3.8.2.3：DUE 与 DTSTART 同类型且严格晚于 DTSTART
          expect(due.isDate).toBe(dtstart.isDate);
          expect(due.compare(dtstart)).toBeGreaterThan(0);
        }
        if (rrule) {
          expect(dtstart).not.toBeNull();
          if (rrule.until) expect(rrule.until.isDate).toBe(dtstart!.isDate);
        }
      }
    };

    for (const file of [...sampleFiles, ...syntheticResult.files]) {
      checkCalendar(file.content as string);
    }

    // 周会：每周一、三，截止日期（上海时区）2026-01-05，2026-06-29 结束
    const weekly = todos(syntheticResult.files[0]!.content as string).get("SYN_WEEKLY@todo-mover")!;
    const start = weekly.getFirstPropertyValue("dtstart") as ICAL.Time;
    const due = weekly.getFirstPropertyValue("due") as ICAL.Time;
    expect(start.toString()).toBe("2026-01-05T00:00:00");
    expect(due.toString()).toBe("2026-01-05T23:59:59");
    const event = new ICAL.Event(weekly);
    const it = event.iterator();
    const dates: string[] = [];
    for (let next = it.next(); next; next = it.next()) dates.push(next.toString().slice(0, 10));
    expect(dates.slice(0, 4)).toEqual(["2026-01-05", "2026-01-07", "2026-01-12", "2026-01-14"]);
    expect(dates.at(-1)).toBe("2026-06-29");
    expect(dates).toHaveLength(51);

    // 演示数据在上海和 UTC 两种时区下都应满足所有不变量
    const demoRaw = demoRawData("zh-CN", "Asia/Shanghai");
    for (const tz of ["Asia/Shanghai", "UTC"]) {
      const out = icsExporter.run(
        normalize(demoRaw, { timeZone: tz, exportedAt, locale: "zh-CN" }),
        {},
        { locale: "zh-CN" },
      );
      for (const file of out.files) checkCalendar(file.content as string);
    }
  });

  it("aligns an off-rule recurring start date and keeps the original due date in DESCRIPTION", () => {
    // 演示数据在上海时区生成：团队例会截止 2026-12-02（周三），按 UTC 导出时 dueDate 变为 2026-12-01（周二）
    const demoRaw = demoRawData("zh-CN", "Asia/Shanghai");
    const shanghai = icsExporter.run(
      normalize(demoRaw, { timeZone: "Asia/Shanghai", exportedAt, locale: "zh-CN" }),
      {},
      { locale: "zh-CN" },
    );
    expect(shanghai.warnings).toEqual([]);
    const workSh = todos(shanghai.files.find((f) => f.path.includes("工作"))!.content as string);
    const meetingSh = workSh.get("DEMO_MEETING@todo-mover")!;
    expect(meetingSh.getFirstPropertyValue("dtstart")!.toString()).toBe("2026-12-02T00:00:00");
    expect(meetingSh.getFirstPropertyValue("due")!.toString()).toBe("2026-12-02T23:59:59");

    const utc = icsExporter.run(
      normalize(demoRaw, { timeZone: "UTC", exportedAt, locale: "zh-CN" }),
      {},
      { locale: "zh-CN" },
    );
    const workUtc = todos(utc.files.find((f) => f.path.includes("工作"))!.content as string);
    const meetingUtc = workUtc.get("DEMO_MEETING@todo-mover")!;
    // 周二 2026-12-01 对齐到规则首期周三 2026-12-02，且每一期都落在周一或周三
    expect(meetingUtc.getFirstPropertyValue("dtstart")!.toString()).toBe("2026-12-02T00:00:00");
    expect(meetingUtc.getFirstPropertyValue("due")!.toString()).toBe("2026-12-02T23:59:59");
    expect(meetingUtc.getFirstPropertyValue("description")).toContain("截止日期: 2026-12-01");
    expect(utc.warnings.some((w) => w.includes("团队例会") && w.includes("2026-12-02"))).toBe(true);

    const expanded: ICAL.Time[] = [];
    const it = new ICAL.Event(meetingUtc).iterator();
    for (let next = it.next(); next; next = it.next()) expanded.push(next);
    expect(expanded).toHaveLength(61);
    expect(expanded[0]!.toString().slice(0, 10)).toBe("2026-12-02");
    expect(expanded.at(-1)!.toString().slice(0, 10)).toBe("2027-06-30");
    // ICAL.Time.dayOfWeek(): Sunday=1, Monday=2, Wednesday=4
    expect(expanded.every((t) => t.dayOfWeek() === 2 || t.dayOfWeek() === 4)).toBe(true);
  });

  it("preserves exact occurrence sequences for remaining COUNT, biweekly phase, and multi-day relativeMonthly", () => {
    const task = (
      id: string,
      title: string,
      dueShanghai: string,
      recurrence: GraphPatternedRecurrence,
    ): GraphTodoTask => ({
      id,
      title,
      status: "notStarted",
      importance: "normal",
      isReminderOn: false,
      createdDateTime: "2027-01-01T00:00:00Z",
      lastModifiedDateTime: "2027-01-01T00:00:00Z",
      dueDateTime: localToGraphUtc(dueShanghai, "Asia/Shanghai"),
      recurrence,
    });
    const raw: RawData = {
      lists: [
        {
          id: "L1",
          displayName: "2027 重复",
          isOwner: true,
          isShared: false,
          wellknownListName: "none",
        },
      ],
      tasksByListId: {
        L1: [
          task("T_COUNT", "隔周一共 3 次（第 2 期）", "2027-01-18", {
            pattern: {
              type: "weekly",
              interval: 2,
              daysOfWeek: ["monday"],
              firstDayOfWeek: "monday",
            },
            range: { type: "numbered", startDate: "2027-01-04", numberOfOccurrences: 3 },
          }),
          // 上海时区 2027-01-18，切到 UTC 后变成跳过那一周的周日 2027-01-17
          task("T_PHASE", "隔周周一和周日", "2027-01-18", {
            pattern: {
              type: "weekly",
              interval: 2,
              daysOfWeek: ["monday", "sunday"],
              firstDayOfWeek: "monday",
            },
            range: { type: "endDate", startDate: "2027-01-04", endDate: "2027-02-07" },
          }),
          task("T_REL_FIRST", "每月首个周一或周三", "2027-03-01", {
            pattern: {
              type: "relativeMonthly",
              interval: 1,
              daysOfWeek: ["monday", "wednesday"],
              index: "first",
            },
            range: { type: "numbered", startDate: "2027-03-01", numberOfOccurrences: 3 },
          }),
          task("T_REL_LAST", "每月最后一个周一或周三", "2027-03-31", {
            pattern: {
              type: "relativeMonthly",
              interval: 1,
              daysOfWeek: ["monday", "wednesday"],
              index: "last",
            },
            range: { type: "numbered", startDate: "2027-03-01", numberOfOccurrences: 3 },
          }),
          task("T_REL_YEARLY", "每年三月首个周一或周三", "2027-03-01", {
            pattern: {
              type: "relativeYearly",
              interval: 1,
              month: 3,
              daysOfWeek: ["monday", "wednesday"],
              index: "first",
            },
            range: { type: "numbered", startDate: "2027-03-01", numberOfOccurrences: 2 },
          }),
        ],
      },
      attachmentsByTaskId: {},
    };

    const shOut = icsExporter.run(
      normalize(raw, { timeZone: "Asia/Shanghai", exportedAt, locale: "zh-CN" }),
      {},
      { locale: "zh-CN" },
    );
    expect(shOut.warnings).toEqual([]);
    const shTodos = todos(shOut.files[0]!.content as string);

    // 1. 隔周一共 3 次，从第 2 期（1 月 18 日）导出，只剩 1 月 18 日与 2 月 1 日
    expect(expandDates(shTodos.get("T_COUNT@todo-mover")!)).toEqual(["2027-01-18", "2027-02-01"]);
    // 3. 3 月 1 日起每月取周一和周三中最先出现的一天，共 3 次
    expect(expandDates(shTodos.get("T_REL_FIRST@todo-mover")!)).toEqual([
      "2027-03-01",
      "2027-04-05",
      "2027-05-03",
    ]);
    expect(expandDates(shTodos.get("T_REL_LAST@todo-mover")!)).toEqual([
      "2027-03-31",
      "2027-04-28",
      "2027-05-31",
    ]);
    expect(expandDates(shTodos.get("T_REL_YEARLY@todo-mover")!)).toEqual([
      "2027-03-01",
      "2028-03-01",
    ]);

    // 2. 隔周周一和周日（周一为每周第一天），上海 1 月 18 日改用 UTC 重导（变成跳过周的周日 1 月 17 日）
    const utcOut = icsExporter.run(
      normalize(raw, { timeZone: "UTC", exportedAt, locale: "zh-CN" }),
      {},
      { locale: "zh-CN" },
    );
    const utcTodos = todos(utcOut.files[0]!.content as string);
    const phase = utcTodos.get("T_PHASE@todo-mover")!;
    expect(expandDates(phase)).toEqual(["2027-01-18", "2027-01-24", "2027-02-01", "2027-02-07"]);
    expect(phase.getFirstPropertyValue("description")).toContain("截止日期: 2027-01-17");
    expect(
      utcOut.warnings.some((w) => w.includes("隔周周一和周日") && w.includes("2027-01-18")),
    ).toBe(true);

    // 两个时区全部任务均满足 RFC 5545 §3.8.2.3 与 §3.8.5.3 不变量
    for (const map of [shTodos, utcTodos]) {
      for (const todo of map.values()) {
        const dtstart = todo.getFirstPropertyValue("dtstart") as ICAL.Time;
        const due = todo.getFirstPropertyValue("due") as ICAL.Time;
        expect(dtstart).not.toBeNull();
        expect(due.isDate).toBe(dtstart.isDate);
        expect(due.compare(dtstart)).toBeGreaterThan(0);
      }
    }
  });

  it("handles same-day and inverted start/due dates without violating RFC 5545", () => {
    const base = synthetic.lists[0]!.tasks.find((x) => x.id === "SYN_START")!;
    const sameDay = { ...base, id: "SAME", startDate: "2026-04-02", dueDate: "2026-04-02" };
    const inverted = { ...base, id: "INV", startDate: "2026-04-12", dueDate: "2026-04-10" };
    const data = { ...synthetic, lists: [{ ...synthetic.lists[0]!, tasks: [sameDay, inverted] }] };
    const byUid = todos(icsExporter.run(data, {}, { locale: "en" }).files[0]!.content as string);

    const s = byUid.get("SAME@todo-mover")!;
    expect(s.getFirstPropertyValue("dtstart")!.toString()).toBe("2026-04-02T00:00:00");
    expect(s.getFirstPropertyValue("due")!.toString()).toBe("2026-04-02T23:59:59");

    const inv = byUid.get("INV@todo-mover")!;
    expect(inv.hasProperty("dtstart")).toBe(false);
    expect(inv.getFirstPropertyValue("due")!.toString()).toBe("2026-04-10");
    expect(inv.getFirstPropertyValue("description")).toContain("Start date: 2026-04-12");
  });

  it("keeps VALUE=DATE for a recurring task whose startDate precedes dueDate", () => {
    const weekly = synthetic.lists[0]!.tasks.find((x) => x.id === "SYN_WEEKLY")!;
    const spanned = { ...weekly, id: "SPAN", startDate: "2026-01-05", dueDate: "2026-01-07" };
    const data = { ...synthetic, lists: [{ ...synthetic.lists[0]!, tasks: [spanned] }] };
    const result = icsExporter.run(data, {}, { locale: "en" });
    const todo = todos(result.files[0]!.content as string).get("SPAN@todo-mover")!;
    expect(todo.getFirstProperty("dtstart")!.type).toBe("date");
    expect(todo.getFirstProperty("due")!.type).toBe("date");
    expect(todo.getFirstPropertyValue("dtstart")!.toString()).toBe("2026-01-05");
    expect(todo.getFirstPropertyValue("due")!.toString()).toBe("2026-01-07");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to the rule's own start date, and drops a rule with no start at all", () => {
    const task = synthetic.lists[0]!.tasks.find((x) => x.id === "SYN_WEEKLY")!;
    const noDue = { ...task, dueDate: undefined };
    const noStart = {
      ...noDue,
      id: "NO_START",
      recurrence: { ...task.recurrence!, range: { ...task.recurrence!.range, startDate: "" } },
    };
    const data = { ...synthetic, lists: [{ ...synthetic.lists[0]!, tasks: [noDue, noStart] }] };
    const result = icsExporter.run(data, {}, { locale: "en" });
    const byUid = todos(result.files[0]!.content as string);
    expect(byUid.get("SYN_WEEKLY@todo-mover")!.getFirstPropertyValue("dtstart")!.toString()).toBe(
      "2026-01-05",
    );
    expect(byUid.get("NO_START@todo-mover")!.hasProperty("rrule")).toBe(false);
    expect(result.warnings).toEqual([
      "ICS: task “周会（每周一、三）” repeats but has no date to start from, so the repeat was left out.",
    ]);
  });

  it("writes COMPLETED only for completed tasks", () => {
    const task = { ...synthetic.lists[0]!.tasks[0]!, status: "notStarted" as const };
    const data = {
      ...synthetic,
      lists: [{ ...synthetic.lists[0]!, tasks: [{ ...task, completedDate: "2026-01-01" }] }],
    };
    const content = icsExporter.run(data, {}, { locale: "en" }).files[0]!.content as string;
    expect(content).not.toContain("COMPLETED:");
  });

  it("puts links of flagged e-mails in the description", () => {
    const flagged = todos(syntheticResult.files[1]!.content as string).get(
      "SYN_FLAGGED_1@todo-mover",
    )!;
    expect(flagged.getFirstPropertyValue("description")).toBe(
      "关联链接:\nRe: 季度报告: https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem",
    );
  });

  it("uses CRLF and keeps every physical line within 75 bytes", () => {
    for (const file of syntheticResult.files) {
      const content = file.content as string;
      expect(content.endsWith("\r\n")).toBe(true);
      const lines = content.split("\r\n").slice(0, -1);
      for (const line of lines) {
        expect(line).not.toMatch(/[\r\n]/);
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    }
  });
});

describe("icsFormat", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("does not fold short lines", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
    const exactly75 = "X".repeat(75);
    expect(foldLine(exactly75)).toBe(exactly75);
  });

  it("folds at 75 bytes with a leading space on continuation lines", () => {
    const folded = foldLine("X".repeat(160));
    const parts = folded.split("\r\n");
    // 75 + (空格 + 74) + (空格 + 11) = 160 个字符
    expect(parts.map((p) => p.length)).toEqual([75, 75, 12]);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe("X".repeat(160));
  });

  it("never splits a multi-byte character", () => {
    const line = "SUMMARY:" + "中".repeat(40) + "🚀".repeat(20);
    const parts = foldLine(line).split("\r\n");
    for (const part of parts) {
      const bytes = encoder.encode(part);
      expect(bytes.length).toBeLessThanOrEqual(75);
      // 解码后再编码不变，说明没有被截断的字节序列
      expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe(part);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });

  it("formats UTC date-times", () => {
    expect(icsUtc("2019-10-28T05:51:53.903693Z")).toBe("20191028T055153Z");
    expect(icsUtc("garbage")).toBeUndefined();
  });
});
