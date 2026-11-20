/**
 * 附件处理范围（纯函数，不依赖 GraphClient，界面可以直接引用而不把 Graph 代码打进首屏）。
 */
import type { GraphTodoTask, RawData } from "./types";

/**
 * 处理附件的范围，与导出时裁剪任务的规则一致（见 selectRaw）：
 * 只看勾选的清单；includeCompleted 为 false 时跳过已完成任务。不传表示全部。
 */
export type AttachmentScope = { listIds?: readonly string[]; includeCompleted?: boolean };

export type TaskRef = { listId: string; task: GraphTodoTask };

/** 范围内 Graph 标记为有附件的任务 */
export function tasksWithAttachments(raw: RawData, scope: AttachmentScope = {}): TaskRef[] {
  const wanted = scope.listIds ? new Set(scope.listIds) : undefined;
  const includeCompleted = scope.includeCompleted ?? true;
  return raw.lists
    .filter((l) => !wanted || wanted.has(l.id))
    .flatMap((l) =>
      (raw.tasksByListId[l.id] ?? [])
        .filter((t) => t.hasAttachments && (includeCompleted || t.status !== "completed"))
        .map((task) => ({ listId: l.id, task })),
    );
}

/** 范围内有附件、但附件信息（名称、大小）还没读到的任务 */
export function tasksMissingAttachmentMetadata(
  raw: RawData,
  scope?: AttachmentScope,
): { listId: string; taskId: string; taskTitle: string }[] {
  return tasksWithAttachments(raw, scope)
    .filter(({ task }) => !raw.attachmentsByTaskId[task.id])
    .map(({ listId, task }) => ({ listId, taskId: task.id, taskTitle: task.title }));
}
