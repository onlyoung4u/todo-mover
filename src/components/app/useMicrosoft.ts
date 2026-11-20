/**
 * 微软登录与 Graph 读取的界面状态。MSAL 和 Graph 代码按需加载（动态 import），
 * 只用演示模式或 JSON 备份的访问者不会下载它们。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type * as AuthModule from "../../core/auth/msal";
import type { AuthSession } from "../../core/auth/msal";
import type * as ClientModule from "../../core/graph/client";
import type { GraphClient } from "../../core/graph/client";
import type * as FetchModule from "../../core/graph/fetchAll";
import type {
  AttachmentFailure,
  AttachmentProgress,
  AttachmentScope,
  FetchProgress,
  ListFailure,
  Profile,
} from "../../core/graph/fetchAll";
import type { RawData } from "../../core/graph/types";

export type MicrosoftState =
  | { status: "unavailable" }
  | { status: "initializing" }
  | { status: "ready"; account?: { name?: string; username?: string } };

export type ReadResult = {
  raw: RawData;
  profile: Profile;
  failures: ListFailure[];
  /** 附件信息读取失败的任务（含权限不足以外的原因，例如 500） */
  attachmentFailures: AttachmentFailure[];
  /** 读取附件元数据时被微软以权限不足拒绝 */
  attachmentsDenied: boolean;
};

/** 附件信息读取的结果：哪些任务失败，以及是否因为权限不足 */
export type MetadataResult = { attachmentFailures: AttachmentFailure[]; denied: boolean };

type Modules = {
  auth: typeof AuthModule;
  client: typeof ClientModule;
  fetch: typeof FetchModule;
};

async function loadModules(): Promise<Modules> {
  const [auth, client, fetch] = await Promise.all([
    import("../../core/auth/msal"),
    import("../../core/graph/client"),
    import("../../core/graph/fetchAll"),
  ]);
  return { auth, client, fetch };
}

export function useMicrosoft(clientId: string | undefined, onRedirectSignIn: () => void) {
  const [state, setState] = useState<MicrosoftState>(
    clientId ? { status: "initializing" } : { status: "unavailable" },
  );
  const session = useRef<AuthSession>(undefined);
  const modules = useRef<Modules>(undefined);
  const graph = useRef<GraphClient>(undefined);
  const redirectCallback = useRef(onRedirectSignIn);
  useEffect(() => {
    redirectCallback.current = onRedirectSignIn;
  });

  const syncAccount = useCallback(() => {
    const account = session.current?.account;
    setState({
      status: "ready",
      account: account ? { name: account.name, username: account.username } : undefined,
    });
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await loadModules();
        const { session: s, signedInByRedirect } = await m.auth.AuthSession.create(clientId);
        if (cancelled) return;
        modules.current = m;
        session.current = s;
        graph.current = new m.client.GraphClient({ getToken: (o) => s.getToken(o) });
        syncAccount();
        if (signedInByRedirect) redirectCallback.current();
      } catch (e) {
        console.error(e);
        if (!cancelled) setState({ status: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, syncAccount]);

  const need = () => {
    if (!session.current || !modules.current || !graph.current) {
      throw new Error("Microsoft sign-in is not ready");
    }
    return { s: session.current, m: modules.current, g: graph.current };
  };

  /** 弹窗登录；失败时抛出 SignInError */
  const signIn = useCallback(async () => {
    await need().s.signInPopup();
    syncAccount();
  }, [syncAccount]);

  const signInRedirect = useCallback(async () => {
    await need().s.signInRedirect();
  }, []);

  const signOut = useCallback(async () => {
    await need().s.signOut();
    syncAccount();
  }, [syncAccount]);

  const requestReadWrite = useCallback(async () => {
    await need().s.requestReadWrite();
  }, []);

  /** 读取账号信息和全部清单、任务 */
  const read = useCallback(async (onProgress: (p: FetchProgress) => void): Promise<ReadResult> => {
    const { m, g } = need();
    const [profile, { raw, failures, attachmentFailures }] = await Promise.all([
      m.fetch.fetchProfile(g),
      m.fetch.fetchTodoData(g, onProgress),
    ]);
    const attachmentsDenied = attachmentFailures.some((f) => m.fetch.isAccessDenied(f.error));
    return { raw, profile, failures, attachmentFailures, attachmentsDenied };
  }, []);

  /**
   * 补读缺失的附件元数据（raw 原地更新）。已读到的任务不会重复请求。
   * 导出前调用：即使不下载附件内容，JSON 备份也需要附件名称和大小。
   */
  const readAttachmentMetadata = useCallback(
    async (
      raw: RawData,
      scope?: AttachmentScope,
      onProgress?: (p: AttachmentProgress) => void,
    ): Promise<MetadataResult> => {
      const { m, g } = need();
      const attachmentFailures = await m.fetch.fetchAttachmentMetadata(g, raw, scope, onProgress);
      return {
        attachmentFailures,
        denied: attachmentFailures.some((f) => m.fetch.isAccessDenied(f.error)),
      };
    },
    [],
  );

  /**
   * 只读权限读取附件被拒时：增量授权 Tasks.ReadWrite，再重新读取缺失的附件元数据（raw 原地更新）。
   * denied 表示授权后仍然被拒。
   */
  const grantAndReadAttachments = useCallback(
    async (raw: RawData): Promise<MetadataResult> => {
      await need().s.requestReadWrite();
      return readAttachmentMetadata(raw);
    },
    [readAttachmentMetadata],
  );

  /** 只重试读取失败的清单；raw 会被原地更新。同时补读这些清单的附件元数据。 */
  const retryLists = useCallback(
    async (
      raw: RawData,
      listIds: string[],
      onProgress: (p: FetchProgress) => void,
      { skipAttachments = false }: { skipAttachments?: boolean } = {},
    ): Promise<{ failures: ListFailure[] } & MetadataResult> => {
      const { m, g } = need();
      const lists = raw.lists.filter((l) => listIds.includes(l.id));
      const failures = await m.fetch.fetchTasksForLists(g, raw, lists, onProgress);
      // 已知附件读取被拒时不再请求，避免又一轮 401
      const metadata = skipAttachments
        ? { attachmentFailures: [], denied: false }
        : await readAttachmentMetadata(raw, { listIds });
      return { failures, ...metadata };
    },
    [readAttachmentMetadata],
  );

  /**
   * 下载附件内容（元数据需已读到）。总量超过 200MB 时先调用 confirmLarge，返回 false 则不下载。
   * scope 与导出的勾选一致：没勾选的清单、不导出的已完成任务，它们的附件不下载也不计入总量。
   */
  const downloadAttachments = useCallback(
    async (
      raw: RawData,
      store: Map<string, Uint8Array>,
      scope: AttachmentScope,
      confirmLarge: (bytes: number) => boolean,
      onProgress: (p: AttachmentProgress) => void,
    ): Promise<{ failures: AttachmentFailure[]; skipped: boolean }> => {
      const { m, g } = need();
      const bytes = m.fetch.attachmentBytes(raw, scope);
      if (bytes > m.fetch.ATTACHMENT_CONFIRM_BYTES && !confirmLarge(bytes)) {
        return { failures: [], skipped: true };
      }
      const failures = await m.fetch.downloadAttachments(g, raw, store, scope, onProgress);
      return { failures, skipped: false };
    },
    [],
  );

  return {
    state,
    signIn,
    signInRedirect,
    signOut,
    requestReadWrite,
    read,
    readAttachmentMetadata,
    grantAndReadAttachments,
    retryLists,
    downloadAttachments,
  };
}
