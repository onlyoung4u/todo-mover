/**
 * Todoist CSV（SPEC 7.5）。每个清单一个 CSV，在 Todoist 中导入为一个项目。
 * 格式依据 Todoist 帮助文档 "Import or export a project as a CSV file"（2026-11 查证）：
 * - PRIORITY 1 = p1（最高），4 = p4；空白会被当作 p1，所以必须显式填写
 * - 每个项目最多 300 个任务行，超出则整个导入失败，因此超出时拆成多个文件
 */
import { getTranslator, type Translate } from "../../i18n";
import { describe, hasEnd, toTodoist } from "../model/recurrence";
import type { Task } from "../model/types";
import { toCsv } from "./csvFormat";
import { uniqueFileNamer } from "./files";
import type { ExportFile, Exporter } from "./types";
import type { Locale } from "../../i18n/locales";

export type TodoistOptions = {
  /** Todoist 导入不支持"已完成"，开启后已完成任务作为未完成导入 */
  includeCompleted: boolean;
  /** 已勾选的步骤默认跳过 */
  includeCheckedSteps: boolean;
  /** 在标题后追加 " @分类" */
  categoriesAsLabels: boolean;
};

export const TODOIST_HEADER = [
  "TYPE",
  "CONTENT",
  "DESCRIPTION",
  "PRIORITY",
  "INDENT",
  "AUTHOR",
  "RESPONSIBLE",
  "DATE",
  "DATE_LANG",
  "TIMEZONE",
] as const;

/** Todoist 单个项目的任务行上限 */
export const TODOIST_MAX_TASKS_PER_PROJECT = 300;

const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, " ").trim();
const toLabel = (category: string) => `@${category.trim().replace(/\s+/g, "_")}`;

function description(task: Task, t: Translate, locale: Locale, todoistDate?: string): string {
  const parts: string[] = [];
  if (task.notes) parts.push(task.notes);
  const extra: string[] = [];
  if (task.recurrence) {
    // 重复任务的 DATE 列是重复规则，原截止日期写进描述；无法表达的规则写人读描述
    if (todoistDate && task.dueDate) extra.push(`${t("csv.col.due")}: ${task.dueDate}`);
    // Todoist 规则无法表达结束日期 / 次数：写出完整描述，避免有限重复变成无限重复
    if (!todoistDate || hasEnd(task.recurrence))
      extra.push(`${t("csv.col.recurrence")}: ${describe(task.recurrence, locale)}`);
  }
  if (task.isReminderOn && task.reminderAt) {
    extra.push(`${t("csv.col.reminder")}: ${task.reminderAt.replace("T", " ")}`);
  }
  for (const link of task.links) {
    if (link.url) extra.push(link.title ? `${link.title}: ${link.url}` : link.url);
  }
  if (extra.length) parts.push(extra.join("\n"));
  return parts.join("\n\n");
}

export const todoistExporter: Exporter<TodoistOptions> = {
  id: "todoist",
  label: "export.todoist.label",
  targets: "export.todoist.targets",
  losses: "export.todoist.losses",
  defaultOptions: { includeCompleted: false, includeCheckedSteps: false, categoriesAsLabels: true },
  run(data, opts, ctx) {
    const t = getTranslator(ctx.locale);
    const tz = data.meta.exportTimeZone;
    const warnings: string[] = [];
    const files: ExportFile[] = [];
    const name = uniqueFileNamer();
    let endedRepeats = 0;

    const row = (content: string, desc: string, priority: number, indent: number, date = "") => [
      "task",
      content,
      desc,
      String(priority),
      String(indent),
      "",
      "",
      date,
      "en",
      tz,
    ];

    for (const list of data.lists) {
      // 每个任务及其子任务作为一组，拆分文件时不会被分开
      const groups: string[][][] = [];
      for (const task of list.tasks) {
        if (task.status === "completed" && !opts.includeCompleted) continue;

        let content = oneLine(task.title);
        if (opts.categoriesAsLabels) {
          const labels = task.categories.filter((c) => c.trim()).map(toLabel);
          if (labels.length) content += ` ${labels.join(" ")}`;
        }
        const recurring = task.recurrence ? toTodoist(task.recurrence) : undefined;
        if (recurring && hasEnd(task.recurrence!)) endedRepeats++;
        const date = recurring ?? task.dueDate ?? "";
        const priority = task.importance === "high" ? 1 : 4;

        const group = [
          row(content, description(task, t, ctx.locale, recurring), priority, 1, date),
        ];
        for (const step of task.steps) {
          if (step.checked && !opts.includeCheckedSteps) continue;
          group.push(row(oneLine(step.title), "", 4, 2));
        }
        groups.push(group);
      }

      const chunks: string[][][] = [[]];
      for (const group of groups) {
        const current = chunks[chunks.length - 1]!;
        if (current.length && current.length + group.length > TODOIST_MAX_TASKS_PER_PROJECT) {
          chunks.push([]);
        }
        chunks[chunks.length - 1]!.push(...group);
      }

      if (chunks.length > 1) {
        warnings.push(
          t("warning.todoistSplit", {
            list: list.name,
            max: TODOIST_MAX_TASKS_PER_PROJECT,
            count: chunks.length,
          }),
        );
      }
      chunks.forEach((rows, i) => {
        const base =
          chunks.length > 1 ? `${list.name} (part ${i + 1} of ${chunks.length})` : list.name;
        files.push({
          path: name(base, ".csv"),
          content: toCsv([[...TODOIST_HEADER], ...rows]),
          mime: "text/csv;charset=utf-8",
        });
      });
    }
    if (endedRepeats) {
      warnings.push(t("warning.recurrenceEnd", { target: "Todoist", count: endedRepeats }));
    }
    return { files, warnings };
  },
};
