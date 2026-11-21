import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ConfigModule from "../../config";
import { runExport } from "../../core/export/run";
import { GraphError } from "../../core/graph/client";
import type { AttachmentFailure } from "../../core/graph/fetchAll";
import { syntheticRawData } from "../../fixtures";
import type * as BrowserModule from "./browser";
import type { MetadataResult, MicrosoftState, ReadResult } from "./useMicrosoft";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const downloadSpy = vi.fn<(name: string, data: string | Uint8Array, mime: string) => void>();

type MockMicrosoft = {
  state: MicrosoftState;
  signIn: ReturnType<typeof vi.fn<() => Promise<void>>>;
  signInRedirect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  signOut: ReturnType<typeof vi.fn<() => Promise<void>>>;
  requestReadWrite: ReturnType<typeof vi.fn<() => Promise<void>>>;
  read: ReturnType<typeof vi.fn<() => Promise<ReadResult>>>;
  readAttachmentMetadata: ReturnType<typeof vi.fn<() => Promise<MetadataResult>>>;
  grantAndReadAttachments: ReturnType<typeof vi.fn<() => Promise<MetadataResult>>>;
  retryLists: ReturnType<typeof vi.fn>;
  downloadAttachments: ReturnType<
    typeof vi.fn<
      (
        raw: unknown,
        store: Map<string, Uint8Array>,
        scope: unknown,
        confirmLarge: (bytes: number) => Promise<boolean>,
      ) => Promise<{ failures: AttachmentFailure[]; skipped: boolean }>
    >
  >;
};

let mockMs: MockMicrosoft;

vi.mock("./browser", async (importOriginal) => {
  const actual = await importOriginal<typeof BrowserModule>();
  return {
    ...actual,
    downloadFile: (...args: [string, string | Uint8Array, string]) => downloadSpy(...args),
  };
});

vi.mock("./useMicrosoft", () => ({
  useMicrosoft: () => mockMs,
}));

vi.mock("../../config", async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { ...actual, config: { ...actual.config, msalClientId: "test-client-id" } };
});

import ExportApp from "./ExportApp";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  downloadSpy.mockReset();
  history.replaceState(null, "", "/zh-CN/app/");
  window.scrollTo = vi.fn();
  mockMs = {
    state: { status: "ready" },
    signIn: vi.fn(async () => {}),
    signInRedirect: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    requestReadWrite: vi.fn(async () => {}),
    read: vi.fn(async () => ({
      raw: syntheticRawData(),
      profile: { displayName: "Test User", username: "user@example.com" },
      failures: [],
      attachmentFailures: [],
      attachmentsDenied: false,
    })),
    readAttachmentMetadata: vi.fn(async () => ({ attachmentFailures: [], denied: false })),
    grantAndReadAttachments: vi.fn(async () => ({ attachmentFailures: [], denied: false })),
    retryLists: vi.fn(async () => ({ failures: [], attachmentFailures: [], denied: false })),
    downloadAttachments: vi.fn(async () => ({ failures: [], skipped: false })),
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`Button "${text}" not found`);
  return btn;
}

function checkboxByLabel(text: string): HTMLInputElement {
  const byAria = container.querySelector<HTMLInputElement>(
    `input[type="checkbox"][aria-label="${text}"]`,
  );
  if (byAria) return byAria;
  const label = Array.from(container.querySelectorAll("label")).find((l) =>
    l.textContent?.includes(text),
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`Checkbox "${text}" not found`);
  return input;
}

async function mountAndSignIn() {
  act(() => {
    root!.render(createElement(ExportApp, { locale: "zh-CN" }));
  });
  await act(async () => {
    buttonByText("用微软账号登录").click();
  });
  await flush();
  expect(container.querySelector(".preview-screen")).not.toBeNull();
}

describe("ExportApp integration", () => {
  it("ignores late attachment download after clicking Sign out (0 downloads, stays on start)", async () => {
    const pending = deferred<{ failures: AttachmentFailure[]; skipped: boolean }>();
    mockMs.downloadAttachments.mockImplementationOnce(async (_raw, store) => {
      const result = await pending.promise;
      store.set("SYN_ATT_1", new Uint8Array([1, 2, 3]));
      return result;
    });

    await mountAndSignIn();
    act(() => checkboxByLabel("下载附件").click());
    act(() => buttonByText("导出").click());
    await flush();
    expect(mockMs.downloadAttachments).toHaveBeenCalledTimes(1);

    // 下载进行中点击退出登录
    await act(async () => {
      buttonByText("退出登录").click();
    });
    await flush();
    expect(container.querySelector(".start")).not.toBeNull();

    // 迟到的附件响应完成：不应触发下载，也不应切回完成页
    await act(async () => {
      pending.resolve({ failures: [], skipped: false });
      await pending.promise;
    });
    await flush();

    expect(downloadSpy).toHaveBeenCalledTimes(0);
    expect(container.querySelector(".done-screen")).toBeNull();
    expect(container.querySelector(".start")).not.toBeNull();
  });

  it("ignores late attachment download after clicking Start over", async () => {
    const pending = deferred<{ failures: AttachmentFailure[]; skipped: boolean }>();
    mockMs.downloadAttachments.mockReturnValueOnce(pending.promise);

    await mountAndSignIn();
    act(() => checkboxByLabel("下载附件").click());
    act(() => buttonByText("导出").click());
    await flush();

    await act(async () => {
      buttonByText("重新选择").click();
    });
    await flush();
    expect(container.querySelector(".start")).not.toBeNull();

    await act(async () => {
      pending.resolve({ failures: [], skipped: false });
      await pending.promise;
    });
    await flush();

    expect(downloadSpy).toHaveBeenCalledTimes(0);
    expect(container.querySelector(".done-screen")).toBeNull();
    expect(container.querySelector(".start")).not.toBeNull();
  });

  it("dismisses an open 200MB ConfirmDialog cleanly when signing out", async () => {
    mockMs.downloadAttachments.mockImplementationOnce(
      async (_raw, _store, _scope, confirmLarge) => {
        const ok = await confirmLarge(300 * 1024 * 1024);
        return { failures: [], skipped: !ok };
      },
    );

    await mountAndSignIn();
    act(() => checkboxByLabel("下载附件").click());
    act(() => buttonByText("导出").click());
    await flush();
    expect(container.querySelector("dialog")).not.toBeNull();

    await act(async () => {
      buttonByText("退出登录").click();
    });
    await flush();

    expect(container.querySelector("dialog")).toBeNull();
    expect(downloadSpy).toHaveBeenCalledTimes(0);
    expect(container.querySelector(".start")).not.toBeNull();
  });

  it("strips unselected tasks from meta.incomplete when re-exporting a partial backup offline", async () => {
    const raw = syntheticRawData();
    const initialBackup = runExport({
      raw,
      selection: { listIds: ["SYN_LIST_MAIN", "SYN_LIST_SHARED"], includeCompleted: true },
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
      formats: [{ id: "json", options: {} }],
      incomplete: {
        lists: [{ id: "L_UNREAD", name: "未读出的清单" }],
        attachmentMetadata: [
          { listId: "SYN_LIST_MAIN", taskId: "SYN_ATTACHMENT", taskTitle: "私密任务" },
          { listId: "SYN_LIST_SHARED", taskId: "SYN_SHARED_1", taskTitle: "牛奶" },
        ],
        attachmentContent: [
          { taskId: "SYN_ATTACHMENT", attachmentId: "SYN_ATT_1", name: "secret.pdf" },
          { taskId: "SYN_SHARED_1", attachmentId: "ATT_SHARED", name: "list.jpg" },
        ],
      },
    }).files[0]!.content as string;

    act(() => {
      root!.render(createElement(ExportApp, { locale: "zh-CN" }));
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([initialBackup], "todo-backup.json", { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(container.querySelector(".preview-screen")).not.toBeNull();

    // 取消勾选 SYN_LIST_MAIN，只重导 SYN_LIST_SHARED
    const mainListName = raw.lists.find((l) => l.id === "SYN_LIST_MAIN")!.displayName;
    const mainCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>(".list-rows input"),
    ).find((el) => el.getAttribute("aria-label") === mainListName)!;
    act(() => mainCheckbox.click());

    await act(async () => {
      buttonByText("导出").click();
    });
    await flush();

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [fileName, data] = downloadSpy.mock.calls[0]!;
    expect(fileName).toBe("todo-backup.json");
    const parsed = JSON.parse(data as string);
    expect(parsed.raw.lists.map((l: { id: string }) => l.id)).toEqual(["SYN_LIST_SHARED"]);
    expect(parsed.meta.incomplete).toEqual({
      lists: [{ id: "L_UNREAD", name: "未读出的清单" }],
      attachmentMetadata: [
        { listId: "SYN_LIST_SHARED", taskId: "SYN_SHARED_1", taskTitle: "牛奶" },
      ],
      attachmentContent: [{ taskId: "SYN_SHARED_1", attachmentId: "ATT_SHARED", name: "list.jpg" }],
    });
    expect(JSON.stringify(parsed)).not.toContain("私密任务");
    expect(JSON.stringify(parsed)).not.toContain("secret.pdf");
  });

  it("ignores late incremental consent after switching to Demo (0 extra reads)", async () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockMs.state = {
        status: "ready",
        account: { name: "Test User", username: "user@example.com" },
      };
      mockMs.read.mockRejectedValueOnce(new GraphError(403, "ErrorAccessDenied", "Forbidden"));
      const pendingConsent = deferred<void>();
      mockMs.requestReadWrite.mockReturnValueOnce(pendingConsent.promise);

      act(() => {
        root!.render(createElement(ExportApp, { locale: "zh-CN" }));
      });
      await act(async () => {
        buttonByText("读取我的任务").click();
      });
      await flush();
      expect(mockMs.read).toHaveBeenCalledTimes(1);

      // 403 后出现“授予额外权限”按钮；点击后立即切到演示
      act(() => buttonByText("授予额外权限").click());
      expect(mockMs.requestReadWrite).toHaveBeenCalledTimes(1);

      act(() => buttonByText("先看演示").click());
      await flush();
      expect(container.querySelector(".preview-screen")).not.toBeNull();
      expect(container.textContent).toContain("演示数据");

      // 增量授权迟到完成：不应再读一次微软清单，也不应覆盖演示预览
      await act(async () => {
        pendingConsent.resolve();
        await pendingConsent.promise;
      });
      await flush();

      expect(mockMs.read).toHaveBeenCalledTimes(1);
      expect(container.querySelector(".preview-screen")).not.toBeNull();
      expect(container.textContent).toContain("演示数据");
      expect(container.textContent).not.toContain("Test User");
    } finally {
      consoleErr.mockRestore();
    }
  });

  it("ignores late JSON file read after switching to Demo", async () => {
    const backup = runExport({
      raw: syntheticRawData(),
      selection: { listIds: ["SYN_LIST_MAIN"], includeCompleted: true },
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
      formats: [{ id: "json", options: {} }],
    }).files[0]!.content as string;

    const pendingText = deferred<string>();
    const slowFile = new File([backup], "slow-backup.json", { type: "application/json" });
    slowFile.text = vi.fn(() => pendingText.promise);

    act(() => {
      root!.render(createElement(ExportApp, { locale: "zh-CN" }));
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [slowFile], configurable: true });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // 在 file.text() 完成前切换到演示
    act(() => buttonByText("先看演示").click());
    await flush();
    expect(container.querySelector(".preview-screen")).not.toBeNull();
    expect(container.textContent).toContain("演示数据");

    // 迟到的文件读取完成后不应覆盖演示预览
    await act(async () => {
      pendingText.resolve(backup);
      await pendingText.promise;
    });
    await flush();

    expect(container.querySelector(".preview-screen")).not.toBeNull();
    expect(container.textContent).toContain("演示数据");
    expect(container.textContent).not.toContain("slow-backup.json");
  });

  it("ignores an older JSON file read if a newer file is dropped before it completes", async () => {
    const raw = syntheticRawData();
    const backupA = runExport({
      raw,
      selection: { listIds: ["SYN_LIST_MAIN"], includeCompleted: true },
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
      formats: [{ id: "json", options: {} }],
    }).files[0]!.content as string;
    const backupB = runExport({
      raw,
      selection: { listIds: ["SYN_LIST_SHARED"], includeCompleted: true },
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
      formats: [{ id: "json", options: {} }],
    }).files[0]!.content as string;

    const pendingA = deferred<string>();
    const fileA = new File([backupA], "older-backup.json", { type: "application/json" });
    fileA.text = vi.fn(() => pendingA.promise);
    const fileB = new File([backupB], "newer-backup.json", { type: "application/json" });

    act(() => {
      root!.render(createElement(ExportApp, { locale: "zh-CN" }));
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [fileA], configurable: true });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // 第一个文件尚未读完时，再选第二个文件
    Object.defineProperty(input, "files", { value: [fileB], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(container.textContent).toContain("newer-backup.json");

    // 较早的 fileA 迟到读完：不应覆盖 newer-backup.json
    await act(async () => {
      pendingA.resolve(backupA);
      await pendingA.promise;
    });
    await flush();

    expect(container.textContent).toContain("newer-backup.json");
    expect(container.textContent).not.toContain("older-backup.json");
  });

  it("does not render empty format-options for JSON and pre-selects the first task in preview", async () => {
    await mountAndSignIn();

    // 默认已勾选 JSON，但不应出现空的 .format-options 分割区
    expect(container.querySelectorAll(".format-options").length).toBe(0);

    // 勾选 Markdown 后应出现其子选项区
    act(() => checkboxByLabel("Markdown").click());
    expect(container.querySelectorAll(".format-options").length).toBe(1);

    // 默认应选中首条任务，右侧详情栏不为空
    expect(container.querySelector(".detail-pane.pane-empty")).toBeNull();
    expect(container.querySelector(".detail-title")?.textContent).toBeTruthy();

    // 取消勾选 Markdown 后导出单文件 JSON，登录态完成页应带有 revoke-card 样式类
    act(() => checkboxByLabel("Markdown").click());
    await act(async () => {
      buttonByText("导出").click();
    });
    await flush();
    expect(container.querySelector(".done-screen .revoke-card")).not.toBeNull();
  });

  it("renders a focused single-entry card for ?mode=import and can expand to all sources", async () => {
    history.replaceState(null, "", "/zh-CN/app/?mode=import");
    act(() => {
      root!.render(createElement(ExportApp, { locale: "zh-CN" }));
    });

    expect(container.querySelector(".entry-focused.dropzone")).not.toBeNull();
    expect(container.querySelector(".entry-grid")).toBeNull();

    act(() => buttonByText("或选择其他数据来源").click());
    expect(container.querySelector(".entry-grid")).not.toBeNull();
    expect(container.querySelector(".entry-focused")).toBeNull();
  });

  it("keeps sidebar task count and tooltip in sync when toggling includeCompleted", async () => {
    await mountAndSignIn();

    const firstRow = container.querySelector<HTMLLIElement>(".list-rows li")!;
    const countEl = firstRow.querySelector<HTMLElement>(".count")!;
    const nameBtn = firstRow.querySelector<HTMLButtonElement>(".list-name")!;
    const totalBefore = Number(countEl.textContent);
    expect(nameBtn.title).toContain(`${totalBefore} 个任务`);

    act(() => checkboxByLabel("包含已完成的任务").click());
    const shownAfter = Number(countEl.textContent);
    expect(shownAfter).toBeLessThan(totalBefore);
    expect(nameBtn.title).toContain(`将导出 ${shownAfter} / 共 ${totalBefore} 个任务`);
  });

  it("renders matching guide links on DoneScreen only when guideLinks has that target", async () => {
    act(() => {
      root!.render(
        createElement(ExportApp, {
          locale: "zh-CN",
          guideLinks: { backup: "/zh-CN/guides/backup-microsoft-to-do/" },
        }),
      );
    });
    await act(async () => {
      buttonByText("先看演示").click();
    });
    await flush();

    await act(async () => {
      buttonByText("导出").click();
    });
    await flush();

    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(".done-screen .guide a"),
    );
    const detailed = links.filter((a) => a.textContent?.trim() === "详细指南");
    expect(detailed).toHaveLength(1);
    expect(detailed[0]?.getAttribute("href")).toBe("/zh-CN/guides/backup-microsoft-to-do/");
  });
});
