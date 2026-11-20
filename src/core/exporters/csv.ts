/** CSV：Excel / 表格（SPEC 7.2）。所有清单合并为一个文件，UTF-8 带 BOM，CRLF。 */
import { getTranslator } from "../../i18n";
import type { MessageKey } from "../../i18n/en";
import { formatUtcInZone } from "../model/dates";
import { describe } from "../model/recurrence";
import type { Task, TodoList } from "../model/types";
import { guardFormula, toCsv } from "./csvFormat";
import type { Exporter } from "./types";

export const CSV_FILE = "todo-tasks.csv";

export type CsvOptions = {
  /** Excel 公式注入防护（默认开） */
  formulaGuard: boolean;
};

type Column = {
  header: MessageKey;
  /** 用户输入的文本列才需要公式注入防护；日期和 ID 不加 */
  userText?: boolean;
  value: (task: Task, list: TodoList) => string;
};

export const csvExporter: Exporter<CsvOptions> = {
  id: "csv",
  label: "export.csv.label",
  targets: "export.csv.targets",
  losses: "export.csv.losses",
  defaultOptions: { formulaGuard: true },
  run(data, opts, ctx) {
    const t = getTranslator(ctx.locale);
    const tz = data.meta.exportTimeZone;

    const columns: Column[] = [
      { header: "csv.col.list", userText: true, value: (_, l) => l.name },
      { header: "csv.col.title", userText: true, value: (task) => task.title },
      { header: "csv.col.status", value: (task) => t(`status.${task.status}`) },
      { header: "csv.col.importance", value: (task) => t(`importance.${task.importance}`) },
      { header: "csv.col.due", value: (task) => task.dueDate ?? "" },
      { header: "csv.col.start", value: (task) => task.startDate ?? "" },
      {
        header: "csv.col.reminder",
        value: (task) =>
          task.isReminderOn && task.reminderAt ? task.reminderAt.replace("T", " ") : "",
      },
      {
        header: "csv.col.recurrence",
        value: (task) => (task.recurrence ? describe(task.recurrence, ctx.locale) : ""),
      },
      { header: "csv.col.completed", value: (task) => task.completedDate ?? "" },
      { header: "csv.col.created", value: (task) => formatUtcInZone(task.createdAt, tz) },
      { header: "csv.col.modified", value: (task) => formatUtcInZone(task.modifiedAt, tz) },
      { header: "csv.col.categories", userText: true, value: (task) => task.categories.join("; ") },
      { header: "csv.col.notes", userText: true, value: (task) => task.notes },
      {
        header: "csv.col.steps",
        userText: true,
        value: (task) => task.steps.map((s) => `[${s.checked ? "x" : " "}] ${s.title}`).join(" | "),
      },
      {
        header: "csv.col.stepProgress",
        value: (task) =>
          task.steps.length
            ? `${task.steps.filter((s) => s.checked).length}/${task.steps.length}`
            : "",
      },
      {
        header: "csv.col.links",
        userText: true,
        value: (task) =>
          task.links
            .map((l) => (l.title && l.url ? `${l.title} (${l.url})` : (l.url ?? l.title ?? "")))
            .filter(Boolean)
            .join(" | "),
      },
      {
        header: "csv.col.hasAttachments",
        value: (task) => (task.hasAttachments ? t("common.yes") : t("common.no")),
      },
      { header: "csv.col.taskId", value: (task) => task.id },
      { header: "csv.col.listId", value: (_, l) => l.id },
    ];

    const rows: string[][] = [columns.map((c) => t(c.header))];
    for (const list of data.lists) {
      for (const task of list.tasks) {
        rows.push(
          columns.map((c) => {
            const v = c.value(task, list);
            return opts.formulaGuard && c.userText ? guardFormula(v) : v;
          }),
        );
      }
    }

    return {
      files: [
        { path: CSV_FILE, content: toCsv(rows, { bom: true }), mime: "text/csv;charset=utf-8" },
      ],
      warnings: [],
    };
  },
};
