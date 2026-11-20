import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import type { RawData } from "../graph/types";
import { normalize } from "../model/normalize";
import { todoistExporter } from "./todoist";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const sample = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const synthetic = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const defaults = todoistExporter.defaultOptions;

const lines = (content: string | Uint8Array) => (content as string).split("\r\n").slice(0, -1);

describe("todoist exporter", () => {
  it("matches the SPEC 7.5 expected output exactly", () => {
    const { files } = todoistExporter.run(sample, defaults, { locale: "zh-CN" });
    expect(files.map((f) => f.path)).toEqual(["任务.csv", "🐶Baby购物清单.csv"]);
    expect(files[0]!.content).toBe(
      [
        "TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE",
        "task,AugBlog,,4,1,,,2019-11-30,en,Asia/Shanghai",
        "task,Ant design pro,,4,2,,,,en,Asia/Shanghai",
        "task,Golang api,,4,2,,,,en,Asia/Shanghai",
        "",
      ].join("\r\n"),
    );
    // 空清单也生成文件，只有表头
    expect(lines(files[1]!.content)).toHaveLength(1);
  });

  it("can include completed tasks and checked steps", () => {
    const { files } = todoistExporter.run(
      sample,
      { ...defaults, includeCompleted: true, includeCheckedSteps: true },
      { locale: "zh-CN" },
    );
    expect(lines(files[0]!.content).slice(4)).toEqual([
      "task,剩余页面,,1,1,,,2019-04-14,en,Asia/Shanghai",
      "task,信息发布4.12,,4,2,,,,en,Asia/Shanghai",
      "task,我的信息4.12,,4,2,,,,en,Asia/Shanghai",
      "task,商家详情4.6,,4,2,,,,en,Asia/Shanghai",
    ]);
  });

  it("puts recurring rules in DATE and the due date in the description", () => {
    const { files, warnings } = todoistExporter.run(synthetic, defaults, { locale: "en" });
    const main = lines(files[0]!.content);
    // Todoist 的规则无法表达结束日期：完整描述写进备注，避免有限重复变成无限重复
    expect(main).toContain(
      'task,周会（每周一、三）,"Due date: 2026-01-05\nRepeat: Every week on Mon, Wed, until 2026-06-29",4,1,,,"every monday, wednesday",en,Asia/Shanghai',
    );
    expect(warnings).toEqual([
      "Todoist: 1 repeating task(s) end on a date or after a number of times, which Todoist can't express. The end is written in each task's notes.",
    ]);
    expect(main).toContain(
      "task,Monthly review on the first Monday,Due date: 2026-02-02,4,1,,,every first monday,en,Asia/Shanghai",
    );
  });

  it("adds categories as labels and can turn that off", () => {
    const on = lines(todoistExporter.run(synthetic, defaults, { locale: "en" }).files[0]!.content);
    expect(on.find((l) => l.includes("Two categories"))).toBe(
      "task,Two categories @工作 @Home_Errands,,4,1,,,,en,Asia/Shanghai",
    );
    const off = lines(
      todoistExporter.run(synthetic, { ...defaults, categoriesAsLabels: false }, { locale: "en" })
        .files[0]!.content,
    );
    expect(off.find((l) => l.includes("Two categories"))).toBe(
      "task,Two categories,,4,1,,,,en,Asia/Shanghai",
    );
  });

  it("keeps notes, reminders and links in the description, and titles on one line", () => {
    const content = todoistExporter.run(synthetic, defaults, { locale: "en" }).files[0]!
      .content as string;
    expect(content).toContain(
      'task,"买菜, ""牛奶"" 🥛 & 鸡蛋; a\\b","备注第一行\n备注, 第二行; 含分号",4,1',
    );
    expect(content).toContain("task,Call the dentist,Reminder: 2026-03-10 09:30,4,1,,,2026-03-10,");
    const flagged = todoistExporter.run(synthetic, defaults, { locale: "en" }).files[1]!.content;
    expect(flagged).toContain(
      "task,Re: 季度报告,Re: 季度报告: https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem,1,1",
    );
  });

  it("uses p1 for high and p4 for normal and low importance", () => {
    const rows = lines(
      todoistExporter.run(synthetic, { ...defaults, includeCompleted: true }, { locale: "en" })
        .files[0]!.content,
    );
    expect(rows.find((r) => r.startsWith("task,Completed with steps"))!.split(",")[3]).toBe("1");
    expect(rows.find((r) => r.startsWith("task,Low priority"))!.split(",")[3]).toBe("4");
  });

  it("splits lists over 300 task rows without separating sub-tasks", () => {
    const raw = syntheticRawData();
    const bulk = raw.tasksByListId.SYN_LIST_BULK!;
    const big: RawData = {
      ...raw,
      lists: raw.lists.filter((l) => l.id === "SYN_LIST_BULK"),
      tasksByListId: {
        SYN_LIST_BULK: [...bulk, ...bulk, ...bulk].map((t, i) => ({
          ...t,
          id: `BIG_${i}`,
          status: "notStarted" as const,
          checklistItems:
            i === 290
              ? Array.from({ length: 20 }, (_, j) => ({
                  id: `S${j}`,
                  displayName: `step ${j}`,
                  isChecked: false,
                  createdDateTime: "2026-01-01T00:00:00Z",
                }))
              : [],
        })),
      },
    };
    const data = normalize(big, { timeZone: "UTC", exportedAt });
    const result = todoistExporter.run(data, defaults, { locale: "en" });

    expect(result.files.map((f) => f.path)).toEqual([
      "Bulk list 📦 (part 1 of 2).csv",
      "Bulk list 📦 (part 2 of 2).csv",
    ]);
    const counts = result.files.map((f) => lines(f.content).length - 1);
    expect(counts.every((c) => c <= 300)).toBe(true);
    expect(counts.reduce((a, b) => a + b)).toBe(375 + 20);
    // 第 291 个任务和它的 20 个子任务在同一个文件里
    const second = lines(result.files[1]!.content);
    expect(second[1]).toMatch(/^task,Bulk task 041,/);
    expect(second.slice(2, 22).every((l) => l.split(",")[4] === "2")).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });
});
