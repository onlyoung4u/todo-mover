#!/usr/bin/env node
/**
 * 生成 src/fixtures/synthetic.json（SPEC 第 12 节）。
 * 按 Graph 文档构造，非真实数据。输出是确定的：重复运行结果一致。
 *
 * 结构与 JSON 备份中的 raw 部分保持一致：
 *   lists               — GET /me/todo/lists 的响应
 *   tasksByListId       — 每个清单的 GET .../tasks?$expand=checklistItems,linkedResources 响应
 *   attachmentsByTaskId — 每个任务的 GET .../attachments 响应
 *
 * 用法：npm run fixtures:synthetic
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/fixtures/synthetic.json", import.meta.url));
const CONTEXT = "https://graph.microsoft.com/v1.0/$metadata#users('user%40example.com')";

const utc = (dateTime) => ({ dateTime, timeZone: "UTC" });
const emptyBody = { content: "", contentType: "text" };

/** 生成一条任务，带上 Graph 总会返回的字段；空值字段不出现（与真实响应一致）。 */
function task(id, title, extra = {}) {
  return {
    "@odata.etag": `W/"etag-${id}"`,
    importance: "normal",
    isReminderOn: false,
    status: "notStarted",
    title,
    createdDateTime: "2026-01-02T03:04:05.1234567Z",
    lastModifiedDateTime: "2026-01-03T04:05:06.7654321Z",
    hasAttachments: false,
    categories: [],
    id,
    body: emptyBody,
    checklistItems: [],
    linkedResources: [],
    ...extra,
  };
}

function list(id, displayName, wellknownListName = "none", extra = {}) {
  return {
    "@odata.etag": `W/"etag-${id}"`,
    displayName,
    isOwner: true,
    isShared: false,
    wellknownListName,
    id,
    ...extra,
  };
}

const lists = [
  list("SYN_LIST_MAIN", '工作 / 项目: "Q1"*?'),
  list("SYN_LIST_FLAGGED", "Flagged email", "flaggedEmails"),
  list("SYN_LIST_SHARED", "家庭共享清单", "none", { isOwner: false, isShared: true }),
  list("SYN_LIST_BULK", "Bulk list 📦"),
];

const mainTasks = [
  task("SYN_WEEKLY", "周会（每周一、三）", {
    dueDateTime: utc("2026-01-04T16:00:00.0000000"),
    recurrence: {
      pattern: {
        type: "weekly",
        interval: 1,
        month: 0,
        dayOfMonth: 0,
        daysOfWeek: ["monday", "wednesday"],
        firstDayOfWeek: "sunday",
        index: "first",
      },
      range: {
        type: "endDate",
        startDate: "2026-01-05",
        endDate: "2026-06-29",
        recurrenceTimeZone: "China Standard Time",
        numberOfOccurrences: 0,
      },
    },
  }),
  task("SYN_MONTHLY", "Monthly review on the first Monday", {
    dueDateTime: utc("2026-02-01T16:00:00.0000000"),
    recurrence: {
      pattern: {
        type: "relativeMonthly",
        interval: 1,
        month: 0,
        dayOfMonth: 0,
        daysOfWeek: ["monday"],
        firstDayOfWeek: "sunday",
        index: "first",
      },
      range: {
        type: "noEnd",
        startDate: "2026-02-02",
        endDate: "0001-01-01",
        recurrenceTimeZone: "China Standard Time",
        numberOfOccurrences: 0,
      },
    },
  }),
  task("SYN_REMINDER", "Call the dentist", {
    isReminderOn: true,
    reminderDateTime: utc("2026-03-10T01:30:00.0000000"),
    dueDateTime: utc("2026-03-09T16:00:00.0000000"),
  }),
  task("SYN_START", "Plan the trip", {
    startDateTime: utc("2026-04-01T16:00:00.0000000"),
    dueDateTime: utc("2026-04-09T16:00:00.0000000"),
  }),
  task("SYN_HTML_NOTES", "HTML notes", {
    body: {
      content:
        '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><p>第一行<br>第二行</p><ul><li>要点 A</li><li>要点 B</li></ul><p><b>加粗</b> &amp; 结尾</p></body></html>',
      contentType: "html",
    },
  }),
  task("SYN_LOW", "Low priority someday", { importance: "low" }),
  task("SYN_CATEGORIES", "Two categories", { categories: ["工作", "Home Errands"] }),
  task("SYN_ATTACHMENT", "Has attachments", { hasAttachments: true }),
  task("SYN_FORMULA", "=SUM(A1:A2)"),
  task("SYN_ESCAPE", '买菜, "牛奶"\n🥛 & 鸡蛋; a\\b', {
    body: { content: "  备注第一行\r\n备注, 第二行; 含分号  ", contentType: "text" },
  }),
  task(
    "SYN_LONG",
    "这是一个很长的中文标题，用来测试 ICS 按 75 字节折行时不会把多字节字符拆开——🚀🚀🚀 emoji 也一样",
  ),
  task("SYN_WINDOWS_TZ", "Windows time zone name", {
    dueDateTime: { dateTime: "2026-05-20T00:00:00.0000000", timeZone: "China Standard Time" },
  }),
  task("SYN_COMPLETED", "Completed with steps", {
    status: "completed",
    importance: "high",
    completedDateTime: utc("2026-01-15T00:00:00.0000000"),
    dueDateTime: utc("2026-01-14T16:00:00.0000000"),
    checklistItems: [
      {
        displayName: "Done step",
        createdDateTime: "2026-01-10T01:00:00.0000000Z",
        checkedDateTime: "2026-01-14T02:00:00.0000000Z",
        isChecked: true,
        id: "SYN_COMPLETED_STEP_1",
      },
      {
        displayName: "Open step",
        createdDateTime: "2026-01-10T01:01:00.0000000Z",
        isChecked: false,
        id: "SYN_COMPLETED_STEP_2",
      },
    ],
  }),
  task("SYN_IN_PROGRESS", "In progress", { status: "inProgress" }),
];

const flaggedTasks = [
  task("SYN_FLAGGED_1", "Re: 季度报告", {
    importance: "high",
    linkedResources: [
      {
        "@odata.etag": 'W/"etag-lr-1"',
        id: "SYN_LR_1",
        webUrl:
          "https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem",
        applicationName: "Outlook",
        displayName: "Re: 季度报告",
        externalId: "AAMkAGSYNTHETIC",
      },
    ],
  }),
];

const sharedTasks = [task("SYN_SHARED_1", "牛奶"), task("SYN_SHARED_2", "面包")];

const bulkTasks = Array.from({ length: 125 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return task(`SYN_BULK_${n}`, `Bulk task ${n}`, i % 10 === 0 ? { status: "completed" } : {});
});

const tasksByListId = {
  SYN_LIST_MAIN: mainTasks,
  SYN_LIST_FLAGGED: flaggedTasks,
  SYN_LIST_SHARED: sharedTasks,
  SYN_LIST_BULK: bulkTasks,
};

const fixture = {
  _comment:
    "按 Graph 文档构造，非真实数据。由 scripts/generate-synthetic-fixture.mjs 生成，请勿手改。Synthetic data built from the Graph docs; not real data.",
  lists: { "@odata.context": `${CONTEXT}/todo/lists`, value: lists },
  tasksByListId: Object.fromEntries(
    Object.entries(tasksByListId).map(([listId, value]) => [
      listId,
      { "@odata.context": `${CONTEXT}/todo/lists('${listId}')/tasks`, value },
    ]),
  ),
  attachmentsByTaskId: {
    SYN_ATTACHMENT: {
      "@odata.context": `${CONTEXT}/todo/lists('SYN_LIST_MAIN')/tasks('SYN_ATTACHMENT')/attachments`,
      value: [
        {
          "@odata.type": "#microsoft.graph.taskFileAttachment",
          id: "SYN_ATT_1",
          name: "receipt.pdf",
          contentType: "application/pdf",
          size: 12345,
          lastModifiedDateTime: "2026-01-03T04:05:06Z",
        },
        {
          "@odata.type": "#microsoft.graph.taskFileAttachment",
          id: "SYN_ATT_2",
          name: "photo: 1/2.jpg",
          contentType: "image/jpeg",
          size: 204800,
          lastModifiedDateTime: "2026-01-03T04:05:07Z",
        },
      ],
    },
  },
};

writeFileSync(OUT, JSON.stringify(fixture, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
