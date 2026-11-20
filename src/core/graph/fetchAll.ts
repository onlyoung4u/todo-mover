/**
 * 读取全部清单 / 任务 / 附件（SPEC 6.1、3.3）。
 * 部分失败时继续读取其余部分，最后汇总哪些清单或附件失败，可以只重试失败的部分。
 */
import { cleanGraphObject } from "./clean";
import { GraphError, type GraphClient } from "./client";
import { tasksWithAttachments, type AttachmentScope, type TaskRef } from "./scope";
import type {
  GraphChecklistItem,
  GraphLinkedResource,
  GraphTaskFileAttachment,
  GraphTodoTask,
  GraphTodoTaskList,
  RawData,
} from "./types";

export type FetchProgress = {
  listsDone: number;
  listsTotal: number;
  tasks: number;
  /** 清单读完后检查附件信息的进度 */
  attachments?: AttachmentProgress;
};

export type ListFailure = { listId: string; listName: string; error: unknown };

export type FetchResult = {
  raw: RawData;
  failures: ListFailure[];
  attachmentFailures: AttachmentFailure[];
};

export type Profile = { displayName?: string; username?: string };

const enc = encodeURIComponent;

export async function fetchProfile(client: GraphClient): Promise<Profile> {
  const me = await client.getJson<{
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  }>("/me?$select=displayName,mail,userPrincipalName");
  return { displayName: me.displayName, username: me.mail || me.userPrincipalName };
}

/** 记录 $expand 能否合并展开（SPEC 13 #2 待验证），同一次会话内只探测一次 */
type ExpandState = { combined: boolean };

/**
 * 展开的集合也可能被分页：Graph 会在任务上附带 `checklistItems@odata.nextLink` 这样的注解。
 * 跟随这些链接把剩余项补齐，再去掉注解本身。
 */
async function completeExpandedPages(client: GraphClient, tasks: GraphTodoTask[]) {
  const take = (task: GraphTodoTask, field: "checklistItems" | "linkedResources") => {
    const record = task as Record<string, unknown>;
    const next = record[`${field}@odata.nextLink`];
    delete record[`${field}@odata.nextLink`];
    return typeof next === "string" ? next : undefined;
  };
  await Promise.all(
    tasks.map(async (task) => {
      const steps = take(task, "checklistItems");
      if (steps) {
        task.checklistItems = [
          ...(task.checklistItems ?? []),
          ...(await client.getAll<GraphChecklistItem>(steps)),
        ];
      }
      const links = take(task, "linkedResources");
      if (links) {
        task.linkedResources = [
          ...(task.linkedResources ?? []),
          ...(await client.getAll<GraphLinkedResource>(links)),
        ];
      }
    }),
  );
  return tasks;
}

async function fetchListTasks(
  client: GraphClient,
  listId: string,
  expand: ExpandState,
): Promise<GraphTodoTask[]> {
  const base = `/me/todo/lists/${enc(listId)}/tasks`;
  if (expand.combined) {
    try {
      return await completeExpandedPages(
        client,
        await client.getAll<GraphTodoTask>(`${base}?$expand=checklistItems,linkedResources`),
      );
    } catch (e) {
      if (!(e instanceof GraphError && e.status === 400)) throw e;
      // 不能同时展开：退化为只展开 checklistItems，再逐个任务读取 linkedResources
      expand.combined = false;
    }
  }
  const tasks = await completeExpandedPages(
    client,
    await client.getAll<GraphTodoTask>(`${base}?$expand=checklistItems`),
  );
  await Promise.all(
    tasks.map(async (task) => {
      task.linkedResources = await client.getAll<GraphLinkedResource>(
        `${base}/${enc(task.id)}/linkedResources`,
      );
    }),
  );
  return tasks;
}

/**
 * 读取指定清单的任务。已有的 raw 会被更新（用于重试），失败的清单记录在 failures 中。
 */
export async function fetchTasksForLists(
  client: GraphClient,
  raw: RawData,
  lists: GraphTodoTaskList[],
  onProgress?: (p: FetchProgress) => void,
  expand: ExpandState = { combined: true },
): Promise<ListFailure[]> {
  const failures: ListFailure[] = [];
  let listsDone = 0;
  const countTasks = () => Object.values(raw.tasksByListId).reduce((n, t) => n + t.length, 0);
  const report = () => onProgress?.({ listsDone, listsTotal: lists.length, tasks: countTasks() });
  report();

  await Promise.all(
    lists.map(async (list) => {
      try {
        raw.tasksByListId[list.id] = cleanGraphObject(
          await fetchListTasks(client, list.id, expand),
        );
      } catch (error) {
        delete raw.tasksByListId[list.id];
        failures.push({ listId: list.id, listName: list.displayName, error });
      } finally {
        listsDone++;
        report();
      }
    }),
  );
  // 保持 Graph 返回的清单顺序
  const order = new Map(raw.lists.map((l, i) => [l.id, i]));
  return failures.sort((a, b) => (order.get(a.listId) ?? 0) - (order.get(b.listId) ?? 0));
}

/**
 * 读取全部清单、任务和附件元数据。读取清单本身失败（例如 403）会直接抛出。
 * 附件元数据（名称、大小）很小，读取时一并获取，预览里才能显示附件；
 * 它的失败不影响清单本身，单独返回（例如只读权限下被拒，界面可以提示授予读写权限）。
 */
export async function fetchTodoData(
  client: GraphClient,
  onProgress?: (p: FetchProgress) => void,
): Promise<FetchResult> {
  const lists = cleanGraphObject(await client.getAll<GraphTodoTaskList>("/me/todo/lists"));
  const raw: RawData = { lists, tasksByListId: {}, attachmentsByTaskId: {} };
  const failures = await fetchTasksForLists(client, raw, lists, onProgress);
  const tasks = Object.values(raw.tasksByListId).reduce((n, t) => n + t.length, 0);
  const attachmentFailures = await fetchAttachmentMetadata(client, raw, undefined, (p) =>
    onProgress?.({ listsDone: lists.length, listsTotal: lists.length, tasks, attachments: p }),
  );
  return { raw, failures, attachmentFailures };
}

/** 附件请求是否因为权限被拒（client 已对 401 刷新过一次 token，仍然 401 / 403 就是权限问题） */
export function isAccessDenied(error: unknown): boolean {
  return error instanceof GraphError && (error.status === 401 || error.status === 403);
}

// ───────────────────────────── 附件 ─────────────────────────────

/** 单个附件最大约 25MB；总量超过 200MB 时先请用户确认（SPEC 6.1） */
export const ATTACHMENT_CONFIRM_BYTES = 200 * 1024 * 1024;

export type AttachmentProgress = { done: number; total: number };

export type AttachmentFailure = {
  listId: string;
  taskId: string;
  taskTitle: string;
  /** 下载内容失败时才有：失败的是哪个附件 */
  attachmentId?: string;
  attachmentName?: string;
  error: unknown;
};

export type { AttachmentScope } from "./scope";

/**
 * 读取附件元数据，写入 raw.attachmentsByTaskId。只请求 hasAttachments 为真且尚未读到的任务。
 * 先单独请求第一个任务探测权限：被拒（只读权限下个人账号必然 401）时其余任务不再请求，
 * 直接以同一个错误记为失败，避免 N 个任务各自触发一轮 401 和 token 刷新。
 */
export async function fetchAttachmentMetadata(
  client: GraphClient,
  raw: RawData,
  scope?: AttachmentScope,
  onProgress?: (p: AttachmentProgress) => void,
): Promise<AttachmentFailure[]> {
  const refs = tasksWithAttachments(raw, scope).filter(
    ({ task }) => !raw.attachmentsByTaskId[task.id],
  );
  const failures: AttachmentFailure[] = [];
  let done = 0;
  const report = () => onProgress?.({ done, total: refs.length });
  report();

  const read = async ({ listId, task }: TaskRef) => {
    try {
      raw.attachmentsByTaskId[task.id] = cleanGraphObject(
        await client.getAll<GraphTaskFileAttachment>(
          `/me/todo/lists/${enc(listId)}/tasks/${enc(task.id)}/attachments`,
        ),
      );
    } catch (error) {
      failures.push({ listId, taskId: task.id, taskTitle: task.title, error });
      return error;
    } finally {
      done++;
      report();
    }
  };

  const [first, ...rest] = refs;
  if (!first) return failures;
  const probeError = await read(first);
  if (isAccessDenied(probeError)) {
    for (const { listId, task } of rest) {
      failures.push({ listId, taskId: task.id, taskTitle: task.title, error: probeError });
    }
    done = refs.length;
    report();
    return failures;
  }
  await Promise.all(rest.map(read));
  return failures;
}

export function attachmentBytes(raw: RawData, scope?: AttachmentScope): number {
  return tasksWithAttachments(raw, scope)
    .flatMap(({ task }) => raw.attachmentsByTaskId[task.id] ?? [])
    .reduce((n, a) => n + (a.size ?? 0), 0);
}

/**
 * 下载附件内容，按附件 ID 存入 store（已下载过的跳过）。
 * 元数据需先由 fetchAttachmentMetadata 读取。
 */
export async function downloadAttachments(
  client: GraphClient,
  raw: RawData,
  store: Map<string, Uint8Array>,
  scope?: AttachmentScope,
  onProgress?: (p: AttachmentProgress) => void,
): Promise<AttachmentFailure[]> {
  const items = tasksWithAttachments(raw, scope).flatMap(({ listId, task }) =>
    (raw.attachmentsByTaskId[task.id] ?? [])
      .filter((a) => !store.has(a.id))
      .map((attachment) => ({ listId, task, attachment })),
  );
  const failures: AttachmentFailure[] = [];
  let done = 0;
  onProgress?.({ done, total: items.length });
  await Promise.all(
    items.map(async ({ listId, task, attachment }) => {
      try {
        store.set(
          attachment.id,
          await client.getBinary(
            `/me/todo/lists/${enc(listId)}/tasks/${enc(task.id)}/attachments/${enc(attachment.id)}/$value`,
          ),
        );
      } catch (error) {
        failures.push({
          listId,
          taskId: task.id,
          taskTitle: task.title,
          attachmentId: attachment.id,
          attachmentName: attachment.name,
          error,
        });
      } finally {
        onProgress?.({ done: ++done, total: items.length });
      }
    }),
  );
  return failures;
}
