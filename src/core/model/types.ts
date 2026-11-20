/** 归一化模型（SPEC 6.2）。所有导出器只依赖这里的类型。 */
import type { GraphPatternedRecurrence } from "../graph/types";
import type { MessageKey } from "../../i18n";

/** 归一化过程中的问题：先记下文案的 key，按界面语言统一翻译 */
export type Warning = { key: MessageKey; params?: Record<string, string | number> };

export type Recurrence = GraphPatternedRecurrence;

export type ExportData = {
  meta: {
    tool: "todo-mover";
    toolVersion: string;
    schemaVersion: 1;
    /** ISO 8601 UTC */
    exportedAt: string;
    /** IANA，如 "Asia/Shanghai" */
    exportTimeZone: string;
    account?: { displayName?: string; username?: string };
    /**
     * 本次导出缺少的部分（登录读取时部分失败）。只有不完整时才出现，
     * 用来事后区分"读取失败"和"本来就是空的"。
     */
    incomplete?: Incomplete;
  };
  lists: TodoList[];
  /** 读取或转换过程中的非致命问题 */
  warnings: string[];
};

export type Incomplete = {
  /** 读取失败、没有包含在本次导出中的清单 */
  lists?: { id: string; name: string }[];
  /** 任务已导出，但附件信息（有哪些附件）没有读到 */
  attachmentMetadata?: { listId: string; taskId: string; taskTitle: string }[];
  /** 附件信息已读到，但附件内容下载失败、没有放进压缩包 */
  attachmentContent?: { taskId: string; attachmentId: string; name: string }[];
};

export type TodoList = {
  id: string;
  /** displayName（可能包含 emoji） */
  name: string;
  wellknown: "defaultList" | "flaggedEmails" | "none" | (string & {});
  isOwner: boolean;
  isShared: boolean;
  tasks: Task[];
};

export type TaskStatus = "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
export type TaskImportance = "low" | "normal" | "high";

export type Step = {
  id: string;
  title: string;
  checked: boolean;
  /** ISO 8601 UTC */
  checkedAt?: string;
  /** ISO 8601 UTC */
  createdAt: string;
};

export type Link = {
  app?: string;
  title?: string;
  url?: string;
  externalId?: string;
};

export type Attachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  /** 附件下载后在本次 zip 包中的路径（M4）；有值表示内容包含在本次导出中 */
  fileName?: string;
  /**
   * 从 JSON 备份重新导出时：附件在当初那个 zip 包中的路径。
   * 本次导出不含附件内容，靠它找到原来的文件。
   */
  previousFileName?: string;
};

export type Task = {
  id: string;
  title: string;
  /** 已转为纯文本 */
  notes: string;
  /** 原始备注为 HTML 时保留原文 */
  notesHtml?: string;
  status: TaskStatus;
  importance: TaskImportance;
  /** "YYYY-MM-DD"（导出时区下的本地日期） */
  dueDate?: string;
  /** 同上 */
  startDate?: string;
  /** 导出时区下的本地时间，"YYYY-MM-DDTHH:mm" */
  reminderAt?: string;
  /** ISO 8601 UTC */
  reminderAtUtc?: string;
  isReminderOn: boolean;
  /** "YYYY-MM-DD" */
  completedDate?: string;
  /** ISO 8601 UTC */
  createdAt: string;
  /** ISO 8601 UTC */
  modifiedAt: string;
  categories: string[];
  recurrence?: Recurrence;
  steps: Step[];
  /** 来自 linkedResources */
  links: Link[];
  /** Graph 标记任务有附件时为 true（即使附件元数据没有读到） */
  hasAttachments?: boolean;
  attachments: Attachment[];
};
