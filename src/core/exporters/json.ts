/** JSON 完整备份（SPEC 7.1）：{ meta, normalized, raw }，无损，可离线重导。 */
import type { RawData } from "../graph/types";
import type { ExportData } from "../model/types";
import type { Exporter } from "./types";

export const JSON_BACKUP_FILE = "todo-backup.json";

export type JsonBackup = {
  meta: ExportData["meta"];
  normalized: ExportData;
  raw: RawData | null;
};

export const jsonExporter: Exporter<Record<string, never>> = {
  id: "json",
  label: "export.json.label",
  targets: "export.json.targets",
  losses: "export.json.losses",
  defaultOptions: {},
  run(data, _opts, ctx) {
    const warnings: string[] = [];
    if (!ctx.raw)
      warnings.push("Raw Graph data is not available; the backup only contains normalized data");
    const backup: JsonBackup = { meta: data.meta, normalized: data, raw: ctx.raw ?? null };
    return {
      files: [
        {
          path: JSON_BACKUP_FILE,
          content: JSON.stringify(backup, null, 2) + "\n",
          mime: "application/json",
        },
      ],
      warnings,
    };
  },
};
