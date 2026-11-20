/**
 * 读取之前导出的 todo-backup.json（SPEC 7.1 离线重导）。
 * 只使用其中的 raw 部分：归一化结果依赖导出时区，重新计算才能让时区设置生效。
 */
import { cleanGraphObject } from "../graph/clean";
import type { RawData } from "../graph/types";
import type { ExportData, Incomplete } from "./types";

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
  /** 附件 ID → 当初 zip 包中的路径（重新导出时写入 previousFileName） */
  attachmentPaths: Map<string, string>;
};

/** 从备份的 normalized 部分收集附件路径；连续多次重导时沿用最早的路径 */
function attachmentPaths(normalized: unknown): Map<string, string> {
  const paths = new Map<string, string>();
  if (!isObject(normalized) || !Array.isArray(normalized.lists)) return paths;
  for (const list of normalized.lists) {
    if (!isObject(list) || !Array.isArray(list.tasks)) continue;
    for (const task of list.tasks) {
      if (!isObject(task) || !Array.isArray(task.attachments)) continue;
      for (const a of task.attachments) {
        if (!isObject(a) || typeof a.id !== "string") continue;
        const path = a.fileName ?? a.previousFileName;
        if (typeof path === "string" && path) paths.set(a.id, path);
      }
    }
  }
  return paths;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function cleanIncomplete(value: unknown): Incomplete | undefined {
  if (!isObject(value)) return undefined;
  const out: Incomplete = {};
  if (Array.isArray(value.lists)) {
    const lists = value.lists
      .filter(
        (l): l is { id: string; name: string } =>
          isObject(l) && typeof l.id === "string" && typeof l.name === "string",
      )
      .map(({ id, name }) => ({ id, name }));
    if (lists.length) out.lists = lists;
  }
  if (Array.isArray(value.attachmentMetadata)) {
    const meta = value.attachmentMetadata
      .filter(
        (m): m is { listId: string; taskId: string; taskTitle: string } =>
          isObject(m) &&
          typeof m.listId === "string" &&
          typeof m.taskId === "string" &&
          typeof m.taskTitle === "string",
      )
      .map(({ listId, taskId, taskTitle }) => ({ listId, taskId, taskTitle }));
    if (meta.length) out.attachmentMetadata = meta;
  }
  if (Array.isArray(value.attachmentContent)) {
    const content = value.attachmentContent
      .filter(
        (c): c is { taskId: string; attachmentId: string; name: string } =>
          isObject(c) &&
          typeof c.taskId === "string" &&
          typeof c.attachmentId === "string" &&
          typeof c.name === "string",
      )
      .map(({ taskId, attachmentId, name }) => ({ taskId, attachmentId, name }));
    if (content.length) out.attachmentContent = content;
  }
  return Object.keys(out).length ? out : undefined;
}

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
  const meta = { ...(json.meta as ExportData["meta"]) };
  // 来源账号会写进重新导出的备份：只保留两个字符串字段
  const account = isObject(meta.account) ? meta.account : undefined;
  delete meta.account;
  if (account) {
    const clean: NonNullable<ExportData["meta"]["account"]> = {};
    if (typeof account.displayName === "string") clean.displayName = account.displayName;
    if (typeof account.username === "string") clean.username = account.username;
    if (clean.displayName || clean.username) meta.account = clean;
  }
  const incomplete = cleanIncomplete(meta.incomplete);
  delete meta.incomplete;
  if (incomplete) meta.incomplete = incomplete;
  if (typeof meta.schemaVersion === "number" && meta.schemaVersion > 1) {
    throw new BackupError("newerSchema");
  }
  if (!isRawData(json.raw)) throw new BackupError("noRawData");
  return {
    // 旧备份可能没有 attachmentsByTaskId；早期版本的备份可能残留含邮箱的 @odata.context 注解，重新导出时一并清除
    raw: cleanGraphObject({ ...json.raw, attachmentsByTaskId: json.raw.attachmentsByTaskId ?? {} }),
    meta,
    attachmentPaths: attachmentPaths(json.normalized),
  };
}
