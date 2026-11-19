/**
 * 一次导出的完整流程：按勾选裁剪原始数据 → 按导出时区归一化 → 运行选中的导出器 → 汇总文件。
 * 纯函数，界面只负责把结果下载下来。
 */
import type { Locale } from "../../i18n/locales";
import { EXPORTERS } from "../exporters";
import type { ExportFile, ExporterId } from "../exporters/types";
import type { RawData } from "../graph/types";
import { normalize, selectRaw, type Selection } from "../model/normalize";
import type { ExportData } from "../model/types";

export type FormatRequest = {
  [K in ExporterId]: { id: K; options: (typeof EXPORTERS)[K]["defaultOptions"] };
}[ExporterId];

export type ExportRequest = {
  raw: RawData;
  selection: Selection;
  timeZone: string;
  locale: Locale;
  formats: FormatRequest[];
  account?: ExportData["meta"]["account"];
  exportedAt?: Date;
};

export type ExportOutput = {
  files: ExportFile[];
  links: { label: string; url: string }[];
  warnings: string[];
};

/** 按导出器分组的文件夹名；JSON 备份放在根目录，方便找到 */
const FOLDER: Record<ExporterId, string> = {
  json: "",
  csv: "csv/",
  markdown: "markdown/",
  ics: "ics/",
  todoist: "todoist/",
  things: "things/",
};

export function runExport(request: ExportRequest): ExportOutput {
  const raw = selectRaw(request.raw, request.selection);
  const data = normalize(raw, {
    timeZone: request.timeZone,
    exportedAt: request.exportedAt,
    account: request.account,
  });

  const files: ExportFile[] = [];
  const links: ExportOutput["links"] = [];
  const warnings = [...data.warnings];
  const multiple = request.formats.length > 1;

  for (const format of request.formats) {
    const exporter = EXPORTERS[format.id] as (typeof EXPORTERS)[ExporterId];
    const result = exporter.run(data, format.options as never, { locale: request.locale, raw });
    const prefix = multiple ? FOLDER[format.id] : "";
    for (const file of result.files) files.push({ ...file, path: prefix + file.path });
    links.push(...(result.links ?? []));
    warnings.push(...result.warnings);
  }
  return { files, links, warnings: [...new Set(warnings)] };
}
