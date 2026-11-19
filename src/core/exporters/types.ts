import type { Locale } from "../../i18n/locales";
import type { MessageKey } from "../../i18n/en";
import type { RawData } from "../graph/types";
import type { ExportData } from "../model/types";

export type ExporterId = "json" | "csv" | "markdown" | "ics" | "todoist" | "things";

/**
 * 导出时的上下文。SPEC 7 的接口只有 run(data, opts)，这里多传一个 ctx：
 * - locale：CSV 列名、人读描述等跟随界面语言
 * - raw：JSON 备份需要原始数据（与 data 是同一批经过筛选的数据）
 */
export type ExportContext = {
  locale: Locale;
  raw?: RawData;
};

export type ExportFile = {
  path: string;
  content: string | Uint8Array;
  mime: string;
};

export type ExportResult = {
  files: ExportFile[];
  /** 目前只有 Things 使用 */
  links?: { label: string; url: string }[];
  warnings: string[];
};

/** 导出器都是纯函数：不访问网络或 DOM。 */
export interface Exporter<Opts = unknown> {
  id: ExporterId;
  label: MessageKey;
  /** 适用于哪些应用 */
  targets: MessageKey;
  /** 会丢失哪些信息 */
  losses: MessageKey;
  defaultOptions: Opts;
  run(data: ExportData, opts: Opts, ctx: ExportContext): ExportResult;
}
