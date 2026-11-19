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
  FetchProgress,
  ListFailure,
  Profile,
} from "../../core/graph/fetchAll";
import type { RawData } from "../../core/graph/types";

export type MicrosoftState =
  | { status: "unavailable" }
  | { status: "initializing" }
  | { status: "ready"; account?: { name?: string; username?: string } };

export type ReadResult = { raw: RawData; profile: Profile; failures: ListFailure[] };

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
    const [profile, { raw, failures }] = await Promise.all([
      m.fetch.fetchProfile(g),
      m.fetch.fetchTodoData(g, onProgress),
    ]);
    return { raw, profile, failures };
  }, []);

  /** 只重试读取失败的清单；raw 会被原地更新 */
  const retryLists = useCallback(
    async (raw: RawData, listIds: string[], onProgress: (p: FetchProgress) => void) => {
      const { m, g } = need();
      const lists = raw.lists.filter((l) => listIds.includes(l.id));
      return m.fetch.fetchTasksForLists(g, raw, lists, onProgress);
    },
    [],
  );

  /**
   * 读取附件元数据和内容。总量超过 200MB 时先调用 confirmLarge，返回 false 则不下载内容。
   */
  const fetchAttachments = useCallback(
    async (
      raw: RawData,
      store: Map<string, Uint8Array>,
      listIds: readonly string[],
      confirmLarge: (bytes: number) => boolean,
      onProgress: (phase: "metadata" | "content", p: AttachmentProgress) => void,
    ): Promise<{ failures: AttachmentFailure[]; skipped: boolean }> => {
      const { m, g } = need();
      const failures = await m.fetch.fetchAttachmentMetadata(g, raw, listIds, (p) =>
        onProgress("metadata", p),
      );
      const bytes = m.fetch.attachmentBytes(raw, listIds);
      if (bytes > m.fetch.ATTACHMENT_CONFIRM_BYTES && !confirmLarge(bytes)) {
        return { failures, skipped: true };
      }
      failures.push(
        ...(await m.fetch.downloadAttachments(g, raw, store, listIds, (p) =>
          onProgress("content", p),
        )),
      );
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
    retryLists,
    fetchAttachments,
  };
}
