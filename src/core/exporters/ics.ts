/** ICS（iCalendar VTODO）：Thunderbird / Nextcloud / CalDAV 客户端（SPEC 7.4）。每个清单一个文件。 */
import { getTranslator, type Translate } from "../../i18n";
import { toRRule } from "../model/recurrence";
import type { Task, TodoList } from "../model/types";
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

/** DESCRIPTION：备注 + 步骤清单 + 关联链接，各部分之间空一行。 */
export function taskDescription(task: Task, t: Translate): string {
  const parts: string[] = [];
  if (task.notes) parts.push(task.notes);
  if (task.steps.length) {
    parts.push(task.steps.map((s) => `[${s.checked ? "x" : " "}] ${s.title}`).join("\n"));
  }
  const links = task.links
    .filter((l) => l.url)
    .map((l) => (l.title ? `${l.title}: ${l.url}` : l.url!));
  if (links.length) parts.push(`${t("csv.col.links")}:\n${links.join("\n")}`);
  return parts.join("\n\n");
}

/**
 * 重复规则和它的起点。RFC 5545 要求带 RRULE 的组件必须有 DTSTART（重复从它开始展开），
 * 而 To Do 的重复任务通常只有截止日期：To Do 以截止日期作为当前这一次，所以用它作为起点；
 * 没有截止日期时退回到重复规则自身的开始日期。两者都没有则无法输出 RRULE。
 */
export function recurrenceStart(task: Task): { rrule: string; dtstart: string } | undefined {
  const rrule = task.recurrence && toRRule(task.recurrence);
  if (!rrule) return undefined;
  const rangeStart = task.recurrence?.range.startDate;
  const dtstart =
    task.startDate ??
    task.dueDate ??
    (rangeStart && !rangeStart.startsWith("0001-") ? rangeStart : undefined);
  return dtstart ? { rrule, dtstart } : undefined;
}

function vtodo(task: Task, dtstamp: string, t: Translate): string[] {
  const lines = [
    "BEGIN:VTODO",
    `UID:${task.id}@todo-mover`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeText(task.title)}`,
  ];
  const description = taskDescription(task, t);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  const recurring = recurrenceStart(task);
  const dtstart = task.startDate ?? recurring?.dtstart;
  if (dtstart) lines.push(`DTSTART;VALUE=DATE:${icsDate(dtstart)}`);
  if (task.dueDate) lines.push(`DUE;VALUE=DATE:${icsDate(task.dueDate)}`);
  lines.push(`STATUS:${STATUS[task.status]}`);
  if (task.completedDate && task.status === "completed") {
    lines.push(`COMPLETED:${icsDate(task.completedDate)}T000000Z`);
  }
  lines.push(`PRIORITY:${PRIORITY[task.importance]}`);
  const categories = task.categories.filter((c) => c.trim());
  if (categories.length) lines.push(`CATEGORIES:${categories.map(escapeText).join(",")}`);
  if (recurring) lines.push(`RRULE:${recurring.rrule}`);
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
  return lines;
}

export function listToIcs(list: TodoList, exportedAt: string, t: Translate): string {
  const dtstamp = icsUtc(exportedAt) ?? icsUtc(new Date())!;
  return joinLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//todo-mover//todo-mover ${TOOL_VERSION}//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(list.name)}`,
    ...list.tasks.flatMap((task) => vtodo(task, dtstamp, t)),
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
    const files = data.lists.map((list) => {
      for (const task of list.tasks) {
        if (task.recurrence && !toRRule(task.recurrence)) {
          warnings.push(`Task "${task.title}": repeat rule could not be converted to RRULE`);
        } else if (task.recurrence && !recurrenceStart(task)) {
          warnings.push(`Task "${task.title}": repeat rule has no start date and was left out`);
        }
      }
      return {
        path: name(list.name, ".ics"),
        content: listToIcs(list, data.meta.exportedAt, t),
        mime: "text/calendar;charset=utf-8",
      };
    });
    return { files, warnings };
  },
};
