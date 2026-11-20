/** ICS（iCalendar VTODO）：Thunderbird / Nextcloud / CalDAV 客户端（SPEC 7.4）。每个清单一个文件。 */
import { getTranslator, type Translate } from "../../i18n";
import { resolveRecurrenceStart, toRRule } from "../model/recurrence";
import type { Task, TodoList, Warning } from "../model/types";
import { TOOL_VERSION } from "../version";
import { uniqueFileNamer } from "./files";
import { escapeText, icsDate, icsUtc, joinLines } from "./icsFormat";
import type { Exporter } from "./types";

const STATUS: Record<Task["status"], string> = {
  notStarted: "NEEDS-ACTION",
  inProgress: "IN-PROCESS",
  completed: "COMPLETED",
  waitingOnOthers: "NEEDS-ACTION",
  deferred: "NEEDS-ACTION",
};

const PRIORITY: Record<Task["importance"], number> = { high: 1, normal: 5, low: 9 };

type NoteDates = { start?: string; due?: string };

/** DESCRIPTION：备注 + 步骤清单 + 关联链接 + （必要时）被调整的原始日期，各部分之间空一行。 */
export function taskDescription(task: Task, t: Translate, noteDates?: NoteDates): string {
  const parts: string[] = [];
  if (task.notes) parts.push(task.notes);
  if (task.steps.length) {
    parts.push(task.steps.map((s) => `[${s.checked ? "x" : " "}] ${s.title}`).join("\n"));
  }
  const links = task.links
    .filter((l) => l.url)
    .map((l) => (l.title ? `${l.title}: ${l.url}` : l.url!));
  if (links.length) parts.push(`${t("csv.col.links")}:\n${links.join("\n")}`);
  const dates: string[] = [];
  if (noteDates?.start) dates.push(`${t("csv.col.start")}: ${noteDates.start}`);
  if (noteDates?.due) dates.push(`${t("csv.col.due")}: ${noteDates.due}`);
  if (dates.length) parts.push(dates.join("\n"));
  return parts.join("\n\n");
}

export type TaskSchedule = {
  /** "YYYY-MM-DD" */
  dtstart?: string;
  /** "YYYY-MM-DD" */
  due?: string;
  /**
   * 为 true 时以同日浮动本地时间输出（DTSTART:YYYYMMDDT000000、DUE:YYYYMMDDT235959），
   * 同时满足 RFC 5545 §3.8.2.3（DUE 必须严格晚于 DTSTART 且同类型）与保留原始截止日语义
   * （不因 +1 天导致客户端将截止日显示晚一天）。
   */
  floatingDay: boolean;
  rrule?: string;
  noteDates: NoteDates;
  warning?: Warning;
};

function nonRecurringSchedule(task: Task, warning?: Warning): TaskSchedule {
  if (task.startDate && task.dueDate) {
    if (task.startDate < task.dueDate) {
      return {
        dtstart: task.startDate,
        due: task.dueDate,
        floatingDay: false,
        noteDates: {},
        warning,
      };
    }
    if (task.startDate === task.dueDate) {
      return {
        dtstart: task.startDate,
        due: task.dueDate,
        floatingDay: true,
        noteDates: {},
        warning,
      };
    }
    // 起始日晚于截止日无法同时写入 VTODO（违反 §3.8.2.3）：保留 DUE，起始日写入描述
    return {
      due: task.dueDate,
      floatingDay: false,
      noteDates: { start: task.startDate },
      warning,
    };
  }
  return { dtstart: task.startDate, due: task.dueDate, floatingDay: false, noteDates: {}, warning };
}

/**
 * 计算 VTODO 的 DTSTART、DUE 与 RRULE，满足 RFC 5545 两项约束：
 * 1. §3.8.5.3：带 RRULE 时必须有 DTSTART，且 DTSTART 必须落在重复规则的首期；
 * 2. §3.8.2.3：同时存在 DTSTART 和 DUE 时两者类型一致，且 DUE 严格晚于 DTSTART。
 */
export function scheduleFor(task: Task): TaskSchedule {
  if (!task.recurrence) return nonRecurringSchedule(task);

  const baseRRule = toRRule(task.recurrence);
  if (!baseRRule) {
    return nonRecurringSchedule(task, {
      key: "warning.icsNoRRule",
      params: { task: task.title },
    });
  }

  const rangeStart = task.recurrence.range.startDate;
  const validRangeStart = rangeStart && !rangeStart.startsWith("0001-") ? rangeStart : undefined;
  const anchor = task.startDate ?? task.dueDate ?? validRangeStart;
  const resolved = anchor ? resolveRecurrenceStart(anchor, task.recurrence) : undefined;
  if (!anchor || !resolved) {
    return nonRecurringSchedule(task, {
      key: "warning.icsNoStart",
      params: { task: task.title },
    });
  }

  const { date: synced, remainingCount } = resolved;
  const rruleFor = (untilTime?: string) =>
    toRRule(task.recurrence!, { untilTime, count: remainingCount });

  const noteDates: NoteDates = {};
  const warning: Warning | undefined =
    synced !== anchor
      ? { key: "warning.icsStartAdjusted", params: { task: task.title, from: anchor, to: synced } }
      : undefined;

  if (task.startDate && task.startDate !== synced) noteDates.start = task.startDate;

  if (!task.dueDate) {
    return { dtstart: synced, floatingDay: false, rrule: rruleFor(), noteDates, warning };
  }
  if (synced < task.dueDate) {
    return {
      dtstart: synced,
      due: task.dueDate,
      floatingDay: false,
      rrule: rruleFor(),
      noteDates,
      warning,
    };
  }
  // synced >= task.dueDate（常见于无 startDate 的重复任务，或时区/改期导致原 dueDate 早于规则首期）：
  // 使用同日浮动 DATE-TIME 让 DUE > DTSTART；若原 dueDate 早于 synced，将其原值写入描述
  if (task.dueDate < synced) noteDates.due = task.dueDate;
  return {
    dtstart: synced,
    due: synced,
    floatingDay: true,
    rrule: rruleFor("235959"),
    noteDates,
    warning,
  };
}

function vtodo(task: Task, dtstamp: string, t: Translate): { lines: string[]; warning?: Warning } {
  const schedule = scheduleFor(task);
  const lines = [
    "BEGIN:VTODO",
    `UID:${task.id}@todo-mover`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeText(task.title)}`,
  ];
  const description = taskDescription(task, t, schedule.noteDates);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (schedule.dtstart) {
    lines.push(
      schedule.floatingDay
        ? `DTSTART:${icsDate(schedule.dtstart)}T000000`
        : `DTSTART;VALUE=DATE:${icsDate(schedule.dtstart)}`,
    );
  }
  if (schedule.due) {
    lines.push(
      schedule.floatingDay
        ? `DUE:${icsDate(schedule.due)}T235959`
        : `DUE;VALUE=DATE:${icsDate(schedule.due)}`,
    );
  }
  lines.push(`STATUS:${STATUS[task.status]}`);
  if (task.completedDate && task.status === "completed") {
    lines.push(`COMPLETED:${icsDate(task.completedDate)}T000000Z`);
  }
  lines.push(`PRIORITY:${PRIORITY[task.importance]}`);
  const categories = task.categories.filter((c) => c.trim());
  if (categories.length) lines.push(`CATEGORIES:${categories.map(escapeText).join(",")}`);
  if (schedule.rrule) lines.push(`RRULE:${schedule.rrule}`);
  const created = icsUtc(task.createdAt);
  const modified = icsUtc(task.modifiedAt);
  if (created) lines.push(`CREATED:${created}`);
  if (modified) lines.push(`LAST-MODIFIED:${modified}`);
  if (task.isReminderOn && task.reminderAtUtc) {
    const trigger = icsUtc(task.reminderAtUtc);
    if (trigger) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        // DISPLAY 类型的 VALARM 必须有 DESCRIPTION
        `DESCRIPTION:${escapeText(task.title)}`,
        `TRIGGER;VALUE=DATE-TIME:${trigger}`,
        "END:VALARM",
      );
    }
  }
  lines.push("END:VTODO");
  return { lines, warning: schedule.warning };
}

export function listToIcs(
  list: TodoList,
  exportedAt: string,
  t: Translate,
  warnings?: string[],
): string {
  const dtstamp = icsUtc(exportedAt) ?? icsUtc(new Date())!;
  const taskLines: string[] = [];
  for (const task of list.tasks) {
    const { lines, warning } = vtodo(task, dtstamp, t);
    taskLines.push(...lines);
    if (warning) warnings?.push(t(warning.key, warning.params));
  }
  return joinLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//todo-mover//todo-mover ${TOOL_VERSION}//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(list.name)}`,
    ...taskLines,
    "END:VCALENDAR",
  ]);
}

export const icsExporter: Exporter<Record<string, never>> = {
  id: "ics",
  label: "export.ics.label",
  targets: "export.ics.targets",
  losses: "export.ics.losses",
  defaultOptions: {},
  run(data, _opts, ctx) {
    const t = getTranslator(ctx.locale);
    const warnings: string[] = [];
    const name = uniqueFileNamer();
    const files = data.lists.map((list) => ({
      path: name(list.name, ".ics"),
      content: listToIcs(list, data.meta.exportedAt, t, warnings),
      mime: "text/calendar;charset=utf-8",
    }));
    return { files, warnings };
  },
};
