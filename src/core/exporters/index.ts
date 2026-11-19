/** 导出器注册表（SPEC 7）。 */
import { csvExporter } from "./csv";
import { icsExporter } from "./ics";
import { jsonExporter } from "./json";
import { markdownExporter } from "./markdown";
import { thingsExporter } from "./things";
import { todoistExporter } from "./todoist";
import type { Exporter, ExporterId } from "./types";

export const EXPORTERS = {
  json: jsonExporter,
  csv: csvExporter,
  markdown: markdownExporter,
  ics: icsExporter,
  todoist: todoistExporter,
  things: thingsExporter,
} satisfies Record<ExporterId, Exporter<unknown>>;

/** 卡片在界面上的展示顺序 */
export const EXPORTER_ORDER: ExporterId[] = ["json", "csv", "markdown", "ics", "todoist", "things"];

export type * from "./types";
export {
  csvExporter,
  icsExporter,
  jsonExporter,
  markdownExporter,
  thingsExporter,
  todoistExporter,
};
