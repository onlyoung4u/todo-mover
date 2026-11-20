import { describe, expect, it } from "vitest";
import { synthetic } from "../../fixtures";
import { GraphClient } from "./client";
import {
  attachmentBytes,
  downloadAttachments,
  fetchAttachmentMetadata,
  fetchProfile,
  fetchTasksForLists,
  fetchTodoData,
  isAccessDenied,
  type FetchProgress,
} from "./fetchAll";

type Options = {
  /** 不支持同时展开 checklistItems 和 linkedResources */
  noCombinedExpand?: boolean;
  /** 读取这些清单的任务时返回 500 */
  failingLists?: string[];
  /** 读取附件元数据时返回这个状态码（真实情况：个人账号只读权限下返回 401 accessDenied） */
  failingAttachments?: number;
  pageSize?: number;
  getToken?: (o?: { forceRefresh?: boolean }) => Promise<string>;
};

const CONTEXT = "https://graph.microsoft.com/v1.0/$metadata#users('user%40example.com')/todo/lists";

/** 用合成 fixture 模拟 Graph 的 To Do 接口 */
function fakeGraph(options: Options = {}) {
  const requests: string[] = [];
  const failing = new Set(options.failingLists);
  const lists = synthetic.lists.value;
  const tasksByList = synthetic.tasksByListId as Record<
    string,
    { value: Record<string, unknown>[] }
  >;
  const attachments = synthetic.attachmentsByTaskId as Record<string, { value: { id: string }[] }>;
  const pageSize = options.pageSize ?? 1000;

  const paged = (url: URL, items: unknown[]) => {
    const skip = Number(url.searchParams.get("$skip") ?? 0);
    const next = new URL(url);
    next.searchParams.set("$skip", String(skip + pageSize));
    return {
      "@odata.context": CONTEXT,
      "@microsoft.graph.tips": "Use $select to choose only the properties your app needs",
      value: items.slice(skip, skip + pageSize),
      ...(skip + pageSize < items.length ? { "@odata.nextLink": next.toString() } : {}),
    };
  };

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(decodeURIComponent(url.pathname + url.search));
    const path = url.pathname.replace("/v1.0", "");
    let m: RegExpMatchArray | null;

    if (path === "/me") {
      return respond({ displayName: "Demo User", userPrincipalName: "user@example.com" });
    }
    if (path === "/me/todo/lists") return respond(paged(url, lists));

    if ((m = path.match(/^\/me\/todo\/lists\/([^/]+)\/tasks$/))) {
      const listId = decodeURIComponent(m[1]!);
      if (failing.has(listId))
        return respond({ error: { code: "ServerError", message: "boom" } }, 500);
      const expand = url.searchParams.get("$expand") ?? "";
      if (options.noCombinedExpand && expand.includes("linkedResources")) {
        return respond({ error: { code: "BadRequest", message: "expand" } }, 400);
      }
      const tasks = (tasksByList[listId]?.value ?? []).map((t) => {
        const copy: Record<string, unknown> = { ...t };
        if (!expand.includes("linkedResources")) delete copy.linkedResources;
        // 真实响应：展开的导航属性带有自己的 @odata.context，其中含账号邮箱
        copy["checklistItems@odata.context"] =
          `${CONTEXT}('${listId}')/tasks('${String(t.id)}')/checklistItems`;
        // 展开的集合也可能分页：这个任务的步骤只在第一页返回 1 条
        const steps = t.checklistItems as unknown[];
        if (t.id === "SYN_COMPLETED" && steps.length > 1) {
          copy.checklistItems = steps.slice(0, 1);
          copy["checklistItems@odata.nextLink"] =
            `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${String(t.id)}/checklistItems?$skip=1`;
        }
        return copy;
      });
      return respond(paged(url, tasks));
    }
    if ((m = path.match(/^\/me\/todo\/lists\/([^/]+)\/tasks\/([^/]+)\/linkedResources$/))) {
      const task = tasksByList[decodeURIComponent(m[1]!)]?.value.find(
        (t) => t.id === decodeURIComponent(m![2]!),
      );
      return respond(paged(url, (task?.linkedResources as unknown[]) ?? []));
    }
    if ((m = path.match(/^\/me\/todo\/lists\/([^/]+)\/tasks\/([^/]+)\/checklistItems$/))) {
      const task = tasksByList[decodeURIComponent(m[1]!)]?.value.find(
        (t) => t.id === decodeURIComponent(m![2]!),
      );
      const skip = Number(url.searchParams.get("$skip") ?? 0);
      return respond({
        "@odata.context": CONTEXT,
        value: ((task?.checklistItems as unknown[]) ?? []).slice(skip),
      });
    }
    if ((m = path.match(/^\/me\/todo\/lists\/[^/]+\/tasks\/([^/]+)\/attachments$/))) {
      if (options.failingAttachments)
        return respond(
          { error: { code: "accessDenied", message: "Access denied" } },
          options.failingAttachments,
        );
      return respond(paged(url, attachments[decodeURIComponent(m[1]!)]?.value ?? []));
    }
    if ((m = path.match(/\/attachments\/([^/]+)\/\$value$/))) {
      if (m[1] === "SYN_ATT_2") return respond({ error: { code: "NotFound" } }, 404);
      return new Response(new TextEncoder().encode(`content of ${m[1]}`));
    }
    return respond({ error: { code: "NotFound", message: path } }, 404);
  }) as typeof globalThis.fetch;

  const client = new GraphClient({
    getToken: options.getToken ?? (async () => "token"),
    fetch,
    sleep: async () => {},
  });
  return { client, requests };
}

describe("fetchTodoData", () => {
  it("reads every list and task, following pagination", async () => {
    const { client, requests } = fakeGraph({ pageSize: 50 });
    const progress: FetchProgress[] = [];
    const { raw, failures } = await fetchTodoData(client, (p) => progress.push(p));

    expect(failures).toEqual([]);
    expect(raw.lists.map((l) => l.id)).toEqual(synthetic.lists.value.map((l) => l.id));
    expect(raw.tasksByListId.SYN_LIST_BULK).toHaveLength(125);
    expect(raw.tasksByListId.SYN_LIST_MAIN).toHaveLength(14);
    // 125 条任务按每页 50 条分 3 页读取
    expect(requests.filter((r) => r.includes("SYN_LIST_BULK/tasks"))).toHaveLength(3);
    expect(progress.at(-1)).toMatchObject({ listsDone: 4, listsTotal: 4, tasks: 142 });
  });

  it("keeps raw objects but strips @odata.context (including nested ones) and graph tips", async () => {
    const { client } = fakeGraph();
    const { raw } = await fetchTodoData(client);
    const text = JSON.stringify(raw);
    expect(text).not.toContain("@odata.context");
    expect(text).not.toContain("@odata.nextLink");
    expect(text).not.toContain("@microsoft.graph.tips");
    expect(text).not.toContain("user%40example.com");
    expect(raw.tasksByListId.SYN_LIST_MAIN![0]).toHaveProperty("@odata.etag");
  });

  it("follows nextLinks inside expanded collections", async () => {
    const { client, requests } = fakeGraph();
    const { raw } = await fetchTodoData(client);
    const task = raw.tasksByListId.SYN_LIST_MAIN!.find((t) => t.id === "SYN_COMPLETED")!;
    expect(task.checklistItems!.map((s) => s.id)).toEqual([
      "SYN_COMPLETED_STEP_1",
      "SYN_COMPLETED_STEP_2",
    ]);
    expect(requests).toContain(
      "/v1.0/me/todo/lists/SYN_LIST_MAIN/tasks/SYN_COMPLETED/checklistItems?$skip=1",
    );
  });

  it("falls back when checklistItems and linkedResources cannot be expanded together", async () => {
    const { client, requests } = fakeGraph({ noCombinedExpand: true });
    const { raw, failures } = await fetchTodoData(client);
    expect(failures).toEqual([]);
    const flagged = raw.tasksByListId.SYN_LIST_FLAGGED![0]!;
    expect(flagged.linkedResources?.[0]?.applicationName).toBe("Outlook");
    expect(requests.some((r) => r.endsWith("/linkedResources"))).toBe(true);
  });

  it("continues past failed lists and can retry only those", async () => {
    const graph = fakeGraph({ failingLists: ["SYN_LIST_SHARED"] });
    const { raw, failures } = await fetchTodoData(graph.client);
    expect(failures.map((f) => [f.listId, f.listName])).toEqual([
      ["SYN_LIST_SHARED", "家庭共享清单"],
    ]);
    expect(raw.tasksByListId.SYN_LIST_SHARED).toBeUndefined();
    expect(raw.tasksByListId.SYN_LIST_BULK).toHaveLength(125);

    const healthy = fakeGraph();
    const retry = await fetchTasksForLists(
      healthy.client,
      raw,
      raw.lists.filter((l) => l.id === "SYN_LIST_SHARED"),
    );
    expect(retry).toEqual([]);
    expect(raw.tasksByListId.SYN_LIST_SHARED).toHaveLength(2);
    // 重试只请求失败的清单
    expect(healthy.requests.filter((r) => r.includes("/tasks"))).toEqual([
      "/v1.0/me/todo/lists/SYN_LIST_SHARED/tasks?$expand=checklistItems,linkedResources",
    ]);
  });

  it("reads the profile fields used for display", async () => {
    const { client, requests } = fakeGraph();
    expect(await fetchProfile(client)).toEqual({
      displayName: "Demo User",
      username: "user@example.com",
    });
    expect(requests).toEqual(["/v1.0/me?$select=displayName,mail,userPrincipalName"]);
  });
});

describe("attachments", () => {
  it("reads metadata while reading tasks, only for tasks that have attachments", async () => {
    const graph = fakeGraph();
    const { raw } = await fetchTodoData(graph.client);
    expect(graph.requests.filter((r) => r.includes("/attachments"))).toEqual([
      "/v1.0/me/todo/lists/SYN_LIST_MAIN/tasks/SYN_ATTACHMENT/attachments",
    ]);
    expect(raw.attachmentsByTaskId.SYN_ATTACHMENT!.map((a) => a.name)).toEqual([
      "receipt.pdf",
      "photo: 1/2.jpg",
    ]);
    expect(attachmentBytes(raw)).toBe(12345 + 204800);
    expect(attachmentBytes(raw, { listIds: ["SYN_LIST_BULK"] })).toBe(0);

    // 导出时再次调用不会重复请求
    graph.requests.length = 0;
    expect(await fetchAttachmentMetadata(graph.client, raw)).toEqual([]);
    expect(graph.requests).toEqual([]);
  });

  it("keeps the list when attachment metadata is denied, and reports why", async () => {
    const { raw, failures, attachmentFailures } = await fetchTodoData(
      fakeGraph({ failingAttachments: 401 }).client,
    );
    expect(failures).toEqual([]);
    expect(raw.tasksByListId.SYN_LIST_MAIN).toHaveLength(14);
    expect(raw.attachmentsByTaskId).toEqual({});
    expect(attachmentFailures.map((f) => f.taskId)).toEqual(["SYN_ATTACHMENT"]);
    expect(isAccessDenied(attachmentFailures[0]!.error)).toBe(true);
    const { attachmentFailures: serverErrors } = await fetchTodoData(
      fakeGraph({ failingAttachments: 500 }).client,
    );
    expect(isAccessDenied(serverErrors[0]!.error)).toBe(false);

    const healthy = fakeGraph();
    expect(await fetchAttachmentMetadata(healthy.client, raw)).toEqual([]);
    expect(raw.attachmentsByTaskId.SYN_ATTACHMENT).toHaveLength(2);
  });

  it("stops after the first access-denied answer instead of asking for every task", async () => {
    const { raw } = await fetchTodoData(fakeGraph().client);
    raw.attachmentsByTaskId = {};
    for (const task of raw.tasksByListId.SYN_LIST_MAIN!) task.hasAttachments = true;

    let refreshes = 0;
    const denied = fakeGraph({
      failingAttachments: 401,
      getToken: async ({ forceRefresh } = {}) => {
        if (forceRefresh) refreshes++;
        return "token";
      },
    });
    const client = denied.client;
    const progress: { done: number; total: number }[] = [];
    const failures = await fetchAttachmentMetadata(client, raw, undefined, (p) => progress.push(p));
    // 只请求了第一个任务：一次原始请求 + 刷新 token 后的一次重试
    expect(denied.requests.filter((r) => r.endsWith("/attachments"))).toHaveLength(2);
    expect(refreshes).toBe(1);
    expect(failures).toHaveLength(14);
    expect(failures.every((f) => isAccessDenied(f.error))).toBe(true);
    expect(progress.at(-1)).toEqual({ done: 14, total: 14 });
  });

  it("skips completed tasks and unselected lists when told to", async () => {
    const graph = fakeGraph();
    const { raw } = await fetchTodoData(graph.client);
    raw.attachmentsByTaskId = {};
    const completed = raw.tasksByListId.SYN_LIST_MAIN!.find((t) => t.id === "SYN_COMPLETED")!;
    completed.hasAttachments = true;

    graph.requests.length = 0;
    await fetchAttachmentMetadata(graph.client, raw, { includeCompleted: false });
    expect(graph.requests).toEqual([
      "/v1.0/me/todo/lists/SYN_LIST_MAIN/tasks/SYN_ATTACHMENT/attachments",
    ]);
    graph.requests.length = 0;
    await fetchAttachmentMetadata(graph.client, raw, { listIds: ["SYN_LIST_BULK"] });
    expect(graph.requests).toEqual([]);

    raw.attachmentsByTaskId.SYN_COMPLETED = [
      { id: "DONE_ATT", name: "done.txt", size: 999, contentType: "text/plain" },
    ] as never;
    const store = new Map<string, Uint8Array>();
    graph.requests.length = 0;
    await downloadAttachments(graph.client, raw, store, { includeCompleted: false });
    expect(store.has("DONE_ATT")).toBe(false);
    expect(graph.requests.some((r) => r.includes("DONE_ATT"))).toBe(false);
    expect(attachmentBytes(raw, { includeCompleted: false })).toBe(12345 + 204800);
    expect(attachmentBytes(raw)).toBe(12345 + 204800 + 999);
  });

  it("reports attachment progress after the lists are read", async () => {
    const progress: FetchProgress[] = [];
    await fetchTodoData(fakeGraph().client, (p) => progress.push(p));
    expect(progress.at(-1)).toMatchObject({ attachments: { done: 1, total: 1 } });
  });

  it("downloads contents, records failures and skips what is already stored", async () => {
    const graph = fakeGraph();
    const { raw } = await fetchTodoData(graph.client);
    await fetchAttachmentMetadata(graph.client, raw);

    const store = new Map<string, Uint8Array>();
    const failures = await downloadAttachments(graph.client, raw, store);
    expect(new TextDecoder().decode(store.get("SYN_ATT_1"))).toBe("content of SYN_ATT_1");
    expect(failures.map((f) => [f.taskTitle, f.attachmentName])).toEqual([
      ["Has attachments", "photo: 1/2.jpg"],
    ]);

    graph.requests.length = 0;
    await downloadAttachments(graph.client, raw, store);
    expect(graph.requests).toEqual([
      "/v1.0/me/todo/lists/SYN_LIST_MAIN/tasks/SYN_ATTACHMENT/attachments/SYN_ATT_2/$value",
    ]);
  });
});
