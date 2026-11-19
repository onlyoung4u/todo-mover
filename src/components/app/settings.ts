import { EXPORTERS, EXPORTER_ORDER } from "../../core/exporters";
import type { ExporterId } from "../../core/exporters/types";
import type { FormatRequest } from "../../core/export/run";
import type { RawData } from "../../core/graph/types";

export type FormatState = {
  [K in ExporterId]: { enabled: boolean; options: (typeof EXPORTERS)[K]["defaultOptions"] };
};

/** 预览页上用户可以调整的全部设置 */
export type Settings = {
  selectedListIds: string[];
  includeCompleted: boolean;
  timeZone: string;
  downloadAttachments: boolean;
  formats: FormatState;
};

export function initialSettings(raw: RawData, timeZone: string): Settings {
  const formats = Object.fromEntries(
    EXPORTER_ORDER.map((id) => [
      id,
      // JSON 完整备份默认勾选（SPEC 7.1 "必选推荐"）
      { enabled: id === "json", options: structuredClone(EXPORTERS[id].defaultOptions) },
    ]),
  ) as FormatState;
  return {
    selectedListIds: raw.lists.map((l) => l.id),
    includeCompleted: true,
    timeZone,
    downloadAttachments: false,
    formats,
  };
}

export function enabledFormats(formats: FormatState, allowThings: boolean): FormatRequest[] {
  return EXPORTER_ORDER.filter((id) => formats[id].enabled && (id !== "things" || allowThings)).map(
    (id) => ({ id, options: formats[id].options }) as FormatRequest,
  );
}
