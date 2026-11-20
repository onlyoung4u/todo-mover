/**
 * 演示模式的数据：按界面语言生成，内容为虚构（不含任何真实数据）。
 * 结构与 Graph 的原始响应一致（日期按 To Do 的方式存为 UTC），走和真实数据完全相同的归一化与导出流程，
 * 覆盖界面和导出器展示的各种情况：步骤、重复、提醒、HTML 备注、分类、附件、标记邮件清单、共享清单。
 * 单元测试使用 sample-*.json 和 synthetic.json，不依赖这里的文案。
 */
import type {
  GraphChecklistItem,
  GraphItemBody,
  GraphLinkedResource,
  GraphPatternedRecurrence,
  GraphTaskFileAttachment,
  GraphTodoTask,
  GraphTodoTaskList,
  RawData,
} from "../core/graph/types";
import { localToGraphUtc } from "../core/model/dates";
import type { Locale } from "../i18n/locales";

type L10n = Record<Locale, string>;

type DemoTask = {
  id: string;
  title: L10n;
  status?: GraphTodoTask["status"];
  importance?: GraphTodoTask["importance"];
  /** 本地日期 "YYYY-MM-DD" */
  due?: string;
  start?: string;
  /** 本地时间 "YYYY-MM-DDTHH:mm" */
  reminder?: string;
  completed?: string;
  notes?: L10n;
  html?: boolean;
  categories?: L10n[];
  steps?: { title: L10n; checked?: boolean }[];
  recurrence?: GraphPatternedRecurrence;
  link?: { title: L10n; url: string };
  attachments?: { name: string; size: number; contentType: string }[];
};

type DemoList = {
  id: string;
  name: L10n;
  wellknown?: string;
  shared?: boolean;
  tasks: DemoTask[];
};

const weekly = (
  days: ("monday" | "wednesday" | "sunday")[],
  end?: string,
): GraphPatternedRecurrence => ({
  pattern: { type: "weekly", interval: 1, daysOfWeek: days, firstDayOfWeek: "sunday" },
  range: end
    ? { type: "endDate", startDate: "2026-12-01", endDate: end }
    : { type: "noEnd", startDate: "2026-12-01", endDate: "0001-01-01" },
});

const DEMO: DemoList[] = [
  {
    id: "DEMO_TASKS",
    name: { en: "Tasks", "zh-CN": "任务", "zh-TW": "工作" },
    wellknown: "defaultList",
    tasks: [
      {
        id: "DEMO_BACKUP",
        title: {
          en: "Back up Microsoft To Do before it shuts down",
          "zh-CN": "在停服前备份 Microsoft To Do",
          "zh-TW": "在停止服務前備份 Microsoft To Do",
        },
        importance: "high",
        due: "2027-06-01",
        reminder: "2027-05-25T09:00",
        notes: {
          en: "Keep the JSON backup somewhere safe. It can be converted again later, even offline.",
          "zh-CN": "把 JSON 备份保存在安全的地方，以后即使离线也能重新转换。",
          "zh-TW": "把 JSON 備份保存在安全的地方，之後即使離線也能重新轉換。",
        },
        categories: [{ en: "Important", "zh-CN": "重要", "zh-TW": "重要" }],
      },
      {
        id: "DEMO_PASSPORT",
        title: { en: "Renew passport", "zh-CN": "更新护照", "zh-TW": "更新護照" },
        due: "2027-01-15",
        steps: [
          {
            title: { en: "Book an appointment", "zh-CN": "预约办理时间", "zh-TW": "預約辦理時間" },
            checked: true,
          },
          { title: { en: "Fill out the form", "zh-CN": "填写申请表", "zh-TW": "填寫申請表" } },
          { title: { en: "Get new photos", "zh-CN": "拍证件照", "zh-TW": "拍證件照" } },
        ],
      },
      {
        id: "DEMO_BILL",
        title: { en: "Pay the electricity bill", "zh-CN": "缴电费", "zh-TW": "繳電費" },
        due: "2026-12-05",
        recurrence: {
          pattern: { type: "absoluteMonthly", interval: 1, dayOfMonth: 5 },
          range: { type: "noEnd", startDate: "2026-12-05", endDate: "0001-01-01" },
        },
      },
      {
        id: "DEMO_CALL",
        title: { en: "Call Mom", "zh-CN": "给妈妈打电话", "zh-TW": "打電話給媽媽" },
        due: "2026-12-06",
        recurrence: weekly(["sunday"]),
      },
      {
        id: "DEMO_GIFT",
        title: { en: "Buy a birthday gift", "zh-CN": "买生日礼物", "zh-TW": "買生日禮物" },
        status: "completed",
        due: "2026-11-20",
        completed: "2026-11-18",
      },
    ],
  },
  {
    id: "DEMO_GROCERIES",
    name: { en: "Groceries 🛒", "zh-CN": "购物清单 🛒", "zh-TW": "購物清單 🛒" },
    tasks: [
      { id: "DEMO_MILK", title: { en: "Milk", "zh-CN": "牛奶", "zh-TW": "牛奶" } },
      {
        id: "DEMO_COFFEE",
        title: { en: "Coffee beans", "zh-CN": "咖啡豆", "zh-TW": "咖啡豆" },
        notes: {
          en: "Medium roast, whole bean",
          "zh-CN": "中度烘焙，整豆",
          "zh-TW": "中度烘焙，整豆",
        },
      },
      { id: "DEMO_BREAD", title: { en: "Bread", "zh-CN": "面包", "zh-TW": "麵包" } },
      {
        id: "DEMO_EGGS",
        title: { en: "Eggs", "zh-CN": "鸡蛋", "zh-TW": "雞蛋" },
        status: "completed",
        completed: "2026-11-28",
      },
    ],
  },
  {
    id: "DEMO_WORK",
    name: { en: "Work 💼", "zh-CN": "工作 💼", "zh-TW": "公司 💼" },
    tasks: [
      {
        id: "DEMO_REPORT",
        title: {
          en: "Prepare the Q4 report",
          "zh-CN": "准备第四季度报告",
          "zh-TW": "準備第四季報告",
        },
        importance: "high",
        start: "2026-12-01",
        due: "2026-12-12",
        reminder: "2026-12-10T10:00",
        categories: [
          { en: "Work", "zh-CN": "工作", "zh-TW": "工作" },
          { en: "Q4", "zh-CN": "第四季度", "zh-TW": "第四季" },
        ],
        steps: [
          {
            title: { en: "Collect numbers", "zh-CN": "收集数据", "zh-TW": "收集資料" },
            checked: true,
          },
          { title: { en: "Draft slides", "zh-CN": "写初稿", "zh-TW": "撰寫初稿" } },
          { title: { en: "Review with team", "zh-CN": "团队评审", "zh-TW": "團隊審閱" } },
        ],
      },
      {
        id: "DEMO_MEETING",
        title: { en: "Team sync", "zh-CN": "团队例会", "zh-TW": "團隊例會" },
        due: "2026-12-02",
        recurrence: weekly(["monday", "wednesday"], "2027-06-30"),
      },
      {
        id: "DEMO_SPEC",
        title: { en: "Review the design doc", "zh-CN": "审阅设计文档", "zh-TW": "審閱設計文件" },
        html: true,
        notes: {
          en: "<p>Focus on:</p><ul><li>Data model</li><li>Error handling</li></ul>",
          "zh-CN": "<p>重点关注：</p><ul><li>数据模型</li><li>错误处理</li></ul>",
          "zh-TW": "<p>重點關注：</p><ul><li>資料模型</li><li>錯誤處理</li></ul>",
        },
        attachments: [{ name: "design-doc.pdf", size: 184_320, contentType: "application/pdf" }],
      },
    ],
  },
  {
    id: "DEMO_FLAGGED",
    name: {
      en: "Flagged email",
      "zh-CN": "已标记的电子邮件",
      "zh-TW": "已標幟的電子郵件",
    },
    wellknown: "flaggedEmails",
    tasks: [
      {
        id: "DEMO_MAIL",
        title: { en: "Re: Contract renewal", "zh-CN": "回复：合同续签", "zh-TW": "回覆：合約續約" },
        importance: "high",
        link: {
          title: {
            en: "Re: Contract renewal",
            "zh-CN": "回复：合同续签",
            "zh-TW": "回覆：合約續約",
          },
          url: "https://outlook.live.com/mail/0/inbox/id/DEMO",
        },
      },
    ],
  },
  {
    id: "DEMO_TRIP",
    name: { en: "Family trip ✈️", "zh-CN": "家庭旅行 ✈️", "zh-TW": "家庭旅行 ✈️" },
    shared: true,
    tasks: [
      {
        id: "DEMO_HOTEL",
        title: { en: "Book the hotel", "zh-CN": "预订酒店", "zh-TW": "預訂飯店" },
        due: "2027-02-01",
        reminder: "2027-01-25T20:00",
      },
      {
        id: "DEMO_PACK",
        title: { en: "Pack sunscreen", "zh-CN": "带上防晒霜", "zh-TW": "帶上防曬乳" },
        importance: "low",
      },
    ],
  },
];

/**
 * 生成演示数据。
 * @param timeZone 演示数据"所在"的时区：日期按这个时区的零点换算成 UTC，与 To Do 的存储方式一致
 */
export function demoRawData(locale: Locale, timeZone: string): RawData {
  const raw: RawData = { lists: [], tasksByListId: {}, attachmentsByTaskId: {} };
  const created = "2026-11-01T08:00:00.0000000Z";

  for (const list of DEMO) {
    const graphList: GraphTodoTaskList = {
      id: list.id,
      displayName: list.name[locale],
      isOwner: !list.shared,
      isShared: Boolean(list.shared),
      wellknownListName: list.wellknown ?? "none",
    };
    raw.lists.push(graphList);

    raw.tasksByListId[list.id] = list.tasks.map((task): GraphTodoTask => {
      const body: GraphItemBody = {
        content: task.notes?.[locale] ?? "",
        contentType: task.html ? "html" : "text",
      };
      const t: GraphTodoTask = {
        id: task.id,
        title: task.title[locale],
        status: task.status ?? "notStarted",
        importance: task.importance ?? "normal",
        isReminderOn: Boolean(task.reminder),
        createdDateTime: created,
        lastModifiedDateTime: created,
        hasAttachments: Boolean(task.attachments?.length),
        categories: (task.categories ?? []).map((c) => c[locale]),
        body,
        checklistItems: (task.steps ?? []).map((s, i): GraphChecklistItem => ({
          id: `${task.id}_STEP_${i + 1}`,
          displayName: s.title[locale],
          isChecked: Boolean(s.checked),
          createdDateTime: created,
          ...(s.checked ? { checkedDateTime: "2026-11-20T10:00:00.0000000Z" } : {}),
        })),
        linkedResources: task.link
          ? [
              {
                id: `${task.id}_LINK`,
                applicationName: "Outlook",
                displayName: task.link.title[locale],
                webUrl: task.link.url,
                externalId: `${task.id}_MAIL`,
              } satisfies GraphLinkedResource,
            ]
          : [],
      };
      if (task.due) t.dueDateTime = localToGraphUtc(task.due, timeZone);
      if (task.start) t.startDateTime = localToGraphUtc(task.start, timeZone);
      if (task.reminder) t.reminderDateTime = localToGraphUtc(task.reminder, timeZone);
      // 完成时间：To Do 存为"本地日期 + UTC 零点"（SPEC 6.3 规则 3）
      if (task.completed)
        t.completedDateTime = { dateTime: `${task.completed}T00:00:00.0000000`, timeZone: "UTC" };
      if (task.recurrence) t.recurrence = task.recurrence;

      if (task.attachments?.length) {
        raw.attachmentsByTaskId[task.id] = task.attachments.map(
          (a, i): GraphTaskFileAttachment => ({ id: `${task.id}_ATT_${i + 1}`, ...a }),
        );
      }
      return t;
    });
  }
  return raw;
}
