/**
 * 读取之前导出的 todo-backup.json（SPEC 7.1 离线重导）。
 * 只使用其中的 raw 部分：归一化结果依赖导出时区，重新计算才能让时区设置生效。
 */
import { cleanGraphObject } from "../graph/clean";
import type { RawData } from "../graph/types";
import type { ExportData } from "./types";

export type BackupErrorCode = "invalidJson" | "notBackup" | "noRawData" | "newerSchema";

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode) {
    super(`Invalid backup: ${code}`);
    this.name = "BackupError";
  }
}

export type ParsedBackup = {
  raw: RawData;
  meta: ExportData["meta"];
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isRawData(v: unknown): v is RawData {
  if (!isObject(v) || !Array.isArray(v.lists) || !isObject(v.tasksByListId)) return false;
  const listsOk = v.lists.every(
    (l) => isObject(l) && typeof l.id === "string" && typeof l.displayName === "string",
  );
  const tasksOk = Object.values(v.tasksByListId).every(
    (tasks) => Array.isArray(tasks) && tasks.every((t) => isObject(t) && typeof t.id === "string"),
  );
  const attachmentsOk =
    v.attachmentsByTaskId === undefined ||
    (isObject(v.attachmentsByTaskId) && Object.values(v.attachmentsByTaskId).every(Array.isArray));
  return listsOk && tasksOk && attachmentsOk;
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    // 去掉可能存在的 BOM
    json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new BackupError("invalidJson");
  }
  if (!isObject(json) || !isObject(json.meta) || json.meta.tool !== "todo-mover") {
    throw new BackupError("notBackup");
  }
  const meta = json.meta as ExportData["meta"];
  if (typeof meta.schemaVersion === "number" && meta.schemaVersion > 1) {
    throw new BackupError("newerSchema");
  }
  if (!isRawData(json.raw)) throw new BackupError("noRawData");
  return {
    // 旧备份可能没有 attachmentsByTaskId；早期版本的备份可能残留含邮箱的 @odata.context 注解，重新导出时一并清除
    raw: cleanGraphObject({ ...json.raw, attachmentsByTaskId: json.raw.attachmentsByTaskId ?? {} }),
    meta,
  };
}
