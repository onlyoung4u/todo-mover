import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
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
    // ical.js 重新序列化时会调整各部分的顺序
    expect(weekly.toString()).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260629;WKST=SU");

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
