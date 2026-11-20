import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import { TOOL_VERSION } from "../version";
import { normalize, selectRaw } from "./normalize";

const exportedAt = new Date("2026-11-19T08:00:00Z");

describe("normalize (real sample)", () => {
  const data = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });

  it("fills meta", () => {
    expect(data.meta).toEqual({
      tool: "todo-mover",
      toolVersion: TOOL_VERSION,
      schemaVersion: 1,
      exportedAt: "2026-11-19T08:00:00.000Z",
      exportTimeZone: "Asia/Shanghai",
    });
    expect(data.warnings).toEqual([]);
  });

  it("keeps lists in order, including the empty one", () => {
    expect(data.lists.map((l) => [l.name, l.wellknown, l.tasks.length])).toEqual([
      ["任务", "defaultList", 2],
      ["🐶Baby购物清单", "none", 0],
    ]);
  });

  it("normalizes the first task exactly", () => {
    expect(data.lists[0]!.tasks[0]).toEqual({
      id: "TASK_1",
      title: "AugBlog",
      notes: "",
      status: "notStarted",
      importance: "normal",
      dueDate: "2019-11-30",
      isReminderOn: false,
      createdAt: "2019-10-28T05:51:53.903693Z",
      modifiedAt: "2020-03-02T09:33:58.9472473Z",
      categories: [],
      steps: [
        {
          id: "STEP_1_1",
          title: "Ant design pro",
          checked: false,
          createdAt: "2019-10-28T05:52:35.2119279Z",
        },
        {
          id: "STEP_1_2",
          title: "Golang api",
          checked: false,
          createdAt: "2019-10-28T05:52:46.9291864Z",
        },
      ],
      links: [],
      attachments: [],
    });
  });

  it("applies the completed-date rule", () => {
    const task = data.lists[0]!.tasks[1]!;
    expect(task.status).toBe("completed");
    expect(task.importance).toBe("high");
    expect(task.dueDate).toBe("2019-04-14");
    expect(task.completedDate).toBe("2019-04-14");
    expect(task.steps.map((s) => [s.checked, s.checkedAt])).toEqual([
      [true, "2019-04-14T11:04:18.6299485Z"],
      [true, "2019-04-14T11:04:18.8191026Z"],
      [true, "2019-04-07T12:53:45.5881639Z"],
    ]);
  });

  it("recomputes dates when the export time zone changes", () => {
    const inUtc = normalize(sampleRawData(), { timeZone: "UTC", exportedAt });
    expect(inUtc.lists[0]!.tasks[0]!.dueDate).toBe("2019-11-29");
  });

  it("falls back to UTC with a warning for an invalid export time zone", () => {
    const bad = normalize(sampleRawData(), { timeZone: "Not/AZone", exportedAt });
    expect(bad.meta.exportTimeZone).toBe("UTC");
    expect(bad.warnings).toHaveLength(1);
  });
});

describe("normalize (synthetic)", () => {
  const data = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });
  const tasks = new Map(data.lists.flatMap((l) => l.tasks).map((t) => [t.id, t]));

  it("converts reminders, start dates and HTML notes", () => {
    expect(tasks.get("SYN_REMINDER")).toMatchObject({
      isReminderOn: true,
      reminderAt: "2026-03-10T09:30",
      reminderAtUtc: "2026-03-10T01:30:00Z",
      dueDate: "2026-03-10",
    });
    expect(tasks.get("SYN_START")).toMatchObject({
      startDate: "2026-04-02",
      dueDate: "2026-04-10",
    });
    expect(tasks.get("SYN_HTML_NOTES")!.notes).toBe(
      "第一行\n第二行\n- 要点 A\n- 要点 B\n加粗 & 结尾",
    );
    expect(tasks.get("SYN_HTML_NOTES")!.notesHtml).toContain("<ul>");
  });

  it("keeps recurrence, categories, links and attachments", () => {
    expect(tasks.get("SYN_WEEKLY")!.recurrence?.pattern.daysOfWeek).toEqual([
      "monday",
      "wednesday",
    ]);
    expect(tasks.get("SYN_CATEGORIES")!.categories).toEqual(["工作", "Home Errands"]);
    expect(tasks.get("SYN_FLAGGED_1")!.links).toEqual([
      {
        app: "Outlook",
        title: "Re: 季度报告",
        url: "https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem",
        externalId: "AAMkAGSYNTHETIC",
      },
    ]);
    expect(tasks.get("SYN_ATTACHMENT")!.attachments.map((a) => a.name)).toEqual([
      "receipt.pdf",
      "photo: 1/2.jpg",
    ]);
    expect(tasks.get("SYN_ATTACHMENT")!.hasAttachments).toBe(true);
    expect(tasks.get("SYN_WEEKLY")).not.toHaveProperty("hasAttachments");
  });

  it("keeps hasAttachments when the attachment metadata couldn't be read", () => {
    const raw = syntheticRawData();
    raw.attachmentsByTaskId = {};
    const task = normalize(raw, { timeZone: "UTC" })
      .lists.flatMap((l) => l.tasks)
      .find((t) => t.id === "SYN_ATTACHMENT")!;
    expect(task.hasAttachments).toBe(true);
    expect(task.attachments).toEqual([]);
  });

  it("parses Windows time zone names without warnings", () => {
    expect(tasks.get("SYN_WINDOWS_TZ")!.dueDate).toBe("2026-05-20");
    expect(data.warnings).toEqual([]);
  });

  it("flags shared lists", () => {
    const shared = data.lists.find((l) => l.id === "SYN_LIST_SHARED")!;
    expect([shared.isShared, shared.isOwner]).toEqual([true, false]);
  });
});

describe("selectRaw", () => {
  const raw = syntheticRawData();

  it("keeps only the selected lists", () => {
    const selected = selectRaw(raw, { listIds: ["SYN_LIST_SHARED"], includeCompleted: true });
    expect(selected.lists.map((l) => l.id)).toEqual(["SYN_LIST_SHARED"]);
    expect(Object.keys(selected.tasksByListId)).toEqual(["SYN_LIST_SHARED"]);
    expect(selected.attachmentsByTaskId).toEqual({});
  });

  it("drops completed tasks when asked", () => {
    const all = selectRaw(raw, { includeCompleted: true }).tasksByListId.SYN_LIST_BULK!;
    const open = selectRaw(raw, { includeCompleted: false }).tasksByListId.SYN_LIST_BULK!;
    expect(all).toHaveLength(125);
    expect(open).toHaveLength(112);
    expect(open.every((t) => t.status !== "completed")).toBe(true);
  });
});

describe("TOOL_VERSION", () => {
  it("matches package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(TOOL_VERSION).toBe(pkg.version);
  });
});
