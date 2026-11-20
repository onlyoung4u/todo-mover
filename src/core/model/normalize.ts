/** Graph 原始数据 → 归一化模型（SPEC 6.2）。纯函数：同样的输入和导出时区总是得到同样的结果。 */
import type {
  GraphTaskFileAttachment,
  GraphTodoTask,
  GraphTodoTaskList,
  RawData,
} from "../graph/types";
import { getTranslator, type Locale, type Translate } from "../../i18n";
import { TOOL_VERSION } from "../version";
import { isValidTimeZone, toCompletedDate, toLocalDate, toReminder } from "./dates";
import { normalizeNotes } from "./html";
import type { ExportData, Task, TodoList, Warning } from "./types";

export type NormalizeOptions = {
  /** 导出时区（IANA） */
  timeZone: string;
  /** 默认为当前时间 */
  exportedAt?: Date;
  account?: ExportData["meta"]["account"];
  incomplete?: ExportData["meta"]["incomplete"];
  /** warnings 使用的语言，默认英语 */
  locale?: Locale;
};

/** 预览页上的筛选条件（SPEC 3.4、7 通用约定）。 */
export type Selection = {
  /** 勾选的清单；不传表示全部 */
  listIds?: readonly string[];
  includeCompleted: boolean;
};

const STATUSES = new Set<Task["status"]>([
  "notStarted",
  "inProgress",
  "completed",
  "waitingOnOthers",
  "deferred",
]);
const IMPORTANCES = new Set<Task["importance"]>(["low", "normal", "high"]);

function normalizeTask(
  raw: GraphTodoTask,
  attachments: GraphTaskFileAttachment[] | undefined,
  timeZone: string,
  warnings: string[],
  t: Translate,
): Task {
  const local: Warning[] = [];
  const reminder = toReminder(raw.reminderDateTime, timeZone, local);

  const task: Task = {
    id: raw.id,
    title: raw.title ?? "",
    ...normalizeNotes(raw.body),
    status: STATUSES.has(raw.status) ? raw.status : "notStarted",
    importance: IMPORTANCES.has(raw.importance) ? raw.importance : "normal",
    dueDate: toLocalDate(raw.dueDateTime, timeZone, local),
    startDate: toLocalDate(raw.startDateTime, timeZone, local),
    reminderAt: reminder?.local,
    reminderAtUtc: reminder?.utc,
    isReminderOn: Boolean(raw.isReminderOn),
    completedDate: toCompletedDate(raw.completedDateTime, timeZone, local),
    createdAt: raw.createdDateTime,
    modifiedAt: raw.lastModifiedDateTime,
    categories: [...(raw.categories ?? [])],
    recurrence: raw.recurrence,
    steps: (raw.checklistItems ?? []).map((s) => ({
      id: s.id,
      title: s.displayName ?? "",
      checked: Boolean(s.isChecked),
      checkedAt: s.checkedDateTime,
      createdAt: s.createdDateTime,
    })),
    links: (raw.linkedResources ?? []).map((r) => ({
      app: r.applicationName,
      title: r.displayName,
      url: r.webUrl,
      externalId: r.externalId,
    })),
    hasAttachments: raw.hasAttachments || Boolean(attachments?.length) || undefined,
    attachments: (attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      contentType: a.contentType,
    })),
  };

  if (!STATUSES.has(raw.status)) {
    local.push({ key: "warning.unknownStatus", params: { status: String(raw.status) } });
  }
  for (const w of local) {
    warnings.push(t("warning.task", { task: task.title, message: t(w.key, w.params) }));
  }

  // 去掉值为 undefined 的可选字段，让 JSON 输出与"字段不存在"一致
  for (const key of Object.keys(task) as (keyof Task)[]) {
    if (task[key] === undefined) delete task[key];
  }
  return task;
}

function normalizeList(
  raw: GraphTodoTaskList,
  data: RawData,
  timeZone: string,
  warnings: string[],
  t: Translate,
): TodoList {
  const listWarnings: string[] = [];
  const tasks = (data.tasksByListId[raw.id] ?? []).map((task) =>
    normalizeTask(task, data.attachmentsByTaskId[task.id], timeZone, listWarnings, t),
  );
  for (const w of listWarnings) {
    warnings.push(t("warning.list", { list: raw.displayName ?? "", message: w }));
  }
  return {
    id: raw.id,
    name: raw.displayName ?? "",
    wellknown: raw.wellknownListName ?? "none",
    isOwner: raw.isOwner ?? true,
    isShared: raw.isShared ?? false,
    tasks,
  };
}

export function normalize(raw: RawData, options: NormalizeOptions): ExportData {
  const warnings: string[] = [];
  const t = getTranslator(options.locale ?? "en");
  let timeZone = options.timeZone;
  if (!isValidTimeZone(timeZone)) {
    warnings.push(t("warning.unknownExportTimeZone", { zone: String(timeZone) }));
    timeZone = "UTC";
  }

  const meta: ExportData["meta"] = {
    tool: "todo-mover",
    toolVersion: TOOL_VERSION,
    schemaVersion: 1,
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    exportTimeZone: timeZone,
  };
  if (options.account) meta.account = options.account;
  if (options.incomplete && Object.values(options.incomplete).some((v) => v?.length)) {
    meta.incomplete = options.incomplete;
  }

  return {
    meta,
    lists: raw.lists.map((l) => normalizeList(l, raw, timeZone, warnings, t)),
    warnings,
  };
}

/**
 * 按预览页的勾选结果裁剪原始数据。先裁剪再归一化，
 * 保证 JSON 备份中的 raw 与 normalized 包含的是同一批数据。
 */
export function selectRaw(raw: RawData, selection: Selection): RawData {
  const wanted = selection.listIds ? new Set(selection.listIds) : undefined;
  const lists = raw.lists.filter((l) => !wanted || wanted.has(l.id));

  const tasksByListId: RawData["tasksByListId"] = {};
  const attachmentsByTaskId: RawData["attachmentsByTaskId"] = {};
  for (const list of lists) {
    const tasks = (raw.tasksByListId[list.id] ?? []).filter(
      (t) => selection.includeCompleted || t.status !== "completed",
    );
    tasksByListId[list.id] = tasks;
    for (const t of tasks) {
      const attachments = raw.attachmentsByTaskId[t.id];
      if (attachments) attachmentsByTaskId[t.id] = attachments;
    }
  }
  return { lists, tasksByListId, attachmentsByTaskId };
}
