/**
 * 一次导出的完整流程：按勾选裁剪原始数据 → 按导出时区归一化 → 运行选中的导出器 → 汇总文件。
 * 纯函数，界面只负责把结果下载下来。
 */
import type { Locale } from "../../i18n/locales";
import { EXPORTERS } from "../exporters";
import { uniqueFileNamer } from "../exporters/files";
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
  /** 读取不完整的部分，写入 meta.incomplete（JSON 备份里可以查到） */
  incomplete?: ExportData["meta"]["incomplete"];
  exportedAt?: Date;
  /** 已下载的附件内容，按附件 ID 索引（只有登录读取并开启"下载附件"时才有） */
  attachmentData?: ReadonlyMap<string, Uint8Array>;
  /** 从 JSON 备份重导时：附件在原 zip 包中的路径，按附件 ID 索引 */
  previousAttachmentPaths?: ReadonlyMap<string, string>;
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

/**
 * 拆出文件扩展名。扩展名只接受字母、数字、下划线和连字符，
 * 其余（含路径分隔符、换行等）都留在主名里，由 sanitizeFileName 清洗。
 */
export function splitExtension(name: string): { stem: string; extension: string } {
  const m = /\.[A-Za-z0-9_-]{1,10}$/.exec(name);
  if (!m || m.index === 0) return { stem: name, extension: "" };
  return { stem: name.slice(0, m.index), extension: m[0] };
}

/**
 * 附件放在 zip 包的 attachments/<清单名>/<任务标题>-<附件名>（SPEC 7.1），
 * 同时把路径写入归一化数据的 fileName，JSON 备份里就能找到对应文件。
 */
function attachmentFiles(data: ExportData, store: ReadonlyMap<string, Uint8Array>): ExportFile[] {
  const files: ExportFile[] = [];
  const folderName = uniqueFileNamer();
  for (const list of data.lists) {
    const withData = list.tasks.flatMap((task) =>
      task.attachments.filter((a) => store.has(a.id)).map((a) => ({ task, a })),
    );
    if (!withData.length) continue;
    const folder = folderName(list.name, "");
    const fileName = uniqueFileNamer();
    for (const { task, a } of withData) {
      // 扩展名单独保留，重名序号加在扩展名之前
      const { stem, extension } = splitExtension(a.name);
      const path = `attachments/${folder}/${fileName(`${task.title}-${stem}`, extension)}`;
      a.fileName = path;
      files.push({
        path,
        content: store.get(a.id)!,
        mime: a.contentType || "application/octet-stream",
      });
    }
  }
  return files;
}

export function runExport(request: ExportRequest): ExportOutput {
  const raw = selectRaw(request.raw, request.selection);
  const data = normalize(raw, {
    timeZone: request.timeZone,
    exportedAt: request.exportedAt,
    account: request.account,
    incomplete: request.incomplete,
    locale: request.locale,
  });

  const attachments = request.attachmentData ? attachmentFiles(data, request.attachmentData) : [];
  if (request.previousAttachmentPaths?.size) {
    for (const a of data.lists.flatMap((l) => l.tasks.flatMap((t) => t.attachments))) {
      const previous = request.previousAttachmentPaths.get(a.id);
      if (previous) a.previousFileName = previous;
    }
  }
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
  files.push(...attachments);
  return { files, links, warnings: [...new Set(warnings)] };
}
