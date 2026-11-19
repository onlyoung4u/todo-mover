/** 导出器注册表（SPEC 7）。ICS、Todoist、Things 在 M2 加入。 */
import { csvExporter } from "./csv";
import { jsonExporter } from "./json";
import { markdownExporter } from "./markdown";
import type { Exporter, ExporterId } from "./types";

export const EXPORTERS = {
  json: jsonExporter,
  csv: csvExporter,
  markdown: markdownExporter,
} satisfies Partial<Record<ExporterId, Exporter<unknown>>>;

export type RegisteredExporterId = keyof typeof EXPORTERS;

/** 卡片在界面上的展示顺序 */
export const EXPORTER_ORDER: RegisteredExporterId[] = ["json", "csv", "markdown"];

export type * from "./types";
export { csvExporter, jsonExporter, markdownExporter };
