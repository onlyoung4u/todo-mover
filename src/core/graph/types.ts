/**
 * Microsoft Graph v1.0 To Do 原始响应类型（只列出本项目用到的字段）。
 * Graph 中值为空的字段直接不出现在响应里，所以除了总会返回的字段，其余都是可选的（SPEC 6.2）。
 * 原始对象可能带有这里没列出的字段，JSON 备份会原样保留它们。
 */

export type GraphDateTimeTimeZone = {
  /** 例如 "2019-11-29T16:00:00.0000000"（7 位小数秒，无时区后缀） */
  dateTime: string;
  /** "UTC"、IANA 名称或 Windows 时区名 */
  timeZone: string;
};

export type GraphItemBody = {
  content: string;
  contentType: "text" | "html";
};

export type GraphDayOfWeek =
  "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export type GraphWeekIndex = "first" | "second" | "third" | "fourth" | "last";

export type GraphRecurrencePatternType =
  "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly";

export type GraphRecurrencePattern = {
  type: GraphRecurrencePatternType;
  interval: number;
  /** 1–12，只有 yearly 类型有意义 */
  month?: number;
  /** 1–31，absoluteMonthly / absoluteYearly 使用 */
  dayOfMonth?: number;
  daysOfWeek?: GraphDayOfWeek[];
  firstDayOfWeek?: GraphDayOfWeek;
  index?: GraphWeekIndex;
};

export type GraphRecurrenceRange = {
  type: "endDate" | "noEnd" | "numbered";
  /** "YYYY-MM-DD" */
  startDate?: string;
  /** "YYYY-MM-DD"；noEnd 时可能是 "0001-01-01" */
  endDate?: string;
  recurrenceTimeZone?: string;
  numberOfOccurrences?: number;
};

export type GraphPatternedRecurrence = {
  pattern: GraphRecurrencePattern;
  range: GraphRecurrenceRange;
};

export type GraphChecklistItem = {
  id: string;
  displayName: string;
  isChecked: boolean;
  createdDateTime: string;
  checkedDateTime?: string;
};

export type GraphLinkedResource = {
  id: string;
  webUrl?: string;
  applicationName?: string;
  displayName?: string;
  externalId?: string;
};

export type GraphTodoTask = {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
  importance: "low" | "normal" | "high";
  isReminderOn: boolean;
  createdDateTime: string;
  lastModifiedDateTime: string;
  hasAttachments?: boolean;
  categories?: string[];
  body?: GraphItemBody;
  dueDateTime?: GraphDateTimeTimeZone;
  startDateTime?: GraphDateTimeTimeZone;
  completedDateTime?: GraphDateTimeTimeZone;
  reminderDateTime?: GraphDateTimeTimeZone;
  recurrence?: GraphPatternedRecurrence;
  checklistItems?: GraphChecklistItem[];
  linkedResources?: GraphLinkedResource[];
};

export type GraphTodoTaskList = {
  id: string;
  displayName: string;
  isOwner: boolean;
  isShared: boolean;
  wellknownListName: string;
};

export type GraphTaskFileAttachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  lastModifiedDateTime?: string;
};

/** 集合接口的单页响应 */
export type GraphCollection<T> = {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: T[];
};

/**
 * 读取到的全部原始数据，也是 JSON 备份中 `raw` 的结构（SPEC 7.1）。
 * 分页已合并；每个对象保持 Graph 返回的原样（只去掉 @odata.context 和 @microsoft.graph.tips）。
 */
export type RawData = {
  lists: GraphTodoTaskList[];
  tasksByListId: Record<string, GraphTodoTask[]>;
  attachmentsByTaskId: Record<string, GraphTaskFileAttachment[]>;
};
