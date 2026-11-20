import { useEffect, useRef, useState } from "react";
import { config } from "../../config";
import { runExport } from "../../core/export/run";
import { packageFiles } from "../../core/export/zip";
import type {
  AttachmentFailure,
  FetchProgress,
  ListFailure,
  Profile,
} from "../../core/graph/fetchAll";
import { tasksMissingAttachmentMetadata, type AttachmentScope } from "../../core/graph/scope";
import type { RawData } from "../../core/graph/types";
import { parseBackup } from "../../core/model/backup";
import { defaultTimeZone, isValidTimeZone } from "../../core/model/dates";
import type { Incomplete } from "../../core/model/types";
import { demoRawData } from "../../fixtures";
import type { Locale } from "../../i18n";
import "./app.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { DoneScreen, type DoneResult } from "./DoneScreen";
import { PreviewScreen, type ExportError } from "./PreviewScreen";
import { ReadingScreen } from "./ReadingScreen";
import { StartScreen } from "./StartScreen";
import { downloadFile, isAppleDevice } from "./browser";
import { errorText, failureReason, toUiError, type UiError } from "./errors";
import { I18nProvider, useI18n } from "./i18n";
import { enabledFormats, initialSettings, type Settings } from "./settings";
import { useMicrosoft } from "./useMicrosoft";

type Source =
  | { kind: "demo" }
  | {
      kind: "import";
      fileName: string;
      /** 备份记录的来源账号，重新导出时沿用 */
      account?: Profile;
      attachmentPaths: Map<string, string>;
    }
  | { kind: "graph"; profile: Profile };

type Loaded = {
  source: Source;
  raw: RawData;
  failures: ListFailure[];
  /** 附件信息读取失败的任务（只保留仍然缺失的，用于提示原因） */
  attachmentFailures: AttachmentFailure[];
  /** 读取附件被拒："readOnly" 可以尝试授予读写权限；"readWrite" 授权后仍被拒 */
  attachmentsDenied?: "readOnly" | "readWrite";
  /** 打开的 JSON 备份本身就不完整（导出时记录在 meta.incomplete） */
  importedIncomplete?: Incomplete;
};

/** 合并附件信息的失败记录：新结果覆盖旧的，已经读到的任务去掉 */
function mergeAttachmentFailures(
  raw: RawData,
  previous: AttachmentFailure[],
  next: AttachmentFailure[],
): AttachmentFailure[] {
  const byTask = new Map(previous.map((f) => [f.taskId, f]));
  for (const f of next) byTask.set(f.taskId, f);
  return [...byTask.values()].filter((f) => !raw.attachmentsByTaskId[f.taskId]);
}

type Download = { name: string; data: string | Uint8Array; mime: string };

type View = "start" | "reading" | "preview" | "done";

/** 演示数据跟随界面语言，日期按浏览器时区生成（与真实 To Do 的存储方式一致） */
const demo = (locale: Locale): Loaded => ({
  source: { kind: "demo" },
  raw: demoRawData(locale, defaultTimeZone()),
  failures: [],
  attachmentFailures: [],
});

const MB = 1024 * 1024;

function App() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).get("mode"));
  // 从落地页点"先看演示"进来时直接打开演示数据
  const [loaded, setLoaded] = useState<Loaded | undefined>(() =>
    mode === "demo" ? demo(locale) : undefined,
  );
  const [settings, setSettings] = useState<Settings | undefined>(() =>
    loaded ? initialSettings(loaded.raw, defaultTimeZone()) : undefined,
  );
  const [view, setView] = useState<View>(loaded ? "preview" : "start");
  const [progress, setProgress] = useState<FetchProgress>();
  const [authError, setAuthError] = useState<UiError>();
  const [busy, setBusy] = useState<string>();
  const [exportError, setExportError] = useState<ExportError>();
  const [done, setDone] = useState<{ result: DoneResult; download: Download }>();
  /** 等待用户回答的确认框（目前只用于附件总量超过 200MB 时） */
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (confirmed: boolean) => void;
  }>();
  const [thingsAvailable] = useState(isAppleDevice);
  /** 已下载的附件内容（按附件 ID），重复导出时不再下载 */
  const attachmentStore = useRef(new Map<string, Uint8Array>());
  /**
   * 当前会话 / 数据源的版本号。离开预览、切换数据源、退出登录或组件卸载时递增，
   * 让在途的读取 / 导出 / 重试 / 授权在迟到返回时静默失效，不触发下载也不覆盖界面。
   */
  const sessionGen = useRef(0);
  const pendingConfirm = useRef<((confirmed: boolean) => void) | undefined>(undefined);

  useEffect(
    () => () => {
      sessionGen.current++;
      const resolve = pendingConfirm.current;
      pendingConfirm.current = undefined;
      resolve?.(false);
    },
    [],
  );

  const microsoft = useMicrosoft(config.msalClientId, () => {
    if (sessionGen.current === 0 && view === "start") void startReading();
  });

  function invalidate() {
    sessionGen.current++;
    setAuthError(undefined);
    setBusy(undefined);
    setExportError(undefined);
    const resolve = pendingConfirm.current;
    pendingConfirm.current = undefined;
    setConfirmation(undefined);
    resolve?.(false);
  }

  function load(next: Loaded, timeZone = defaultTimeZone()) {
    invalidate();
    setLoaded(next);
    const failed = new Set(next.failures.map((f) => f.listId));
    setSettings(initialSettings(next.raw, timeZone, failed));
    setDone(undefined);
    setView("preview");
    window.scrollTo(0, 0);
  }

  function backToStart() {
    invalidate();
    setMode(null);
    setView("start");
  }

  function askConfirmation(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      pendingConfirm.current = resolve;
      setConfirmation({
        message,
        resolve: (confirmed) => {
          pendingConfirm.current = undefined;
          setConfirmation(undefined);
          resolve(confirmed);
        },
      });
    });
  }

  /** 统一处理登录 / 读取错误：用户取消登录时静默返回 */
  function handleError(error: unknown): UiError | undefined {
    const ui = toUiError(error);
    console.error(error);
    if (ui.kind === "cancelled") return undefined;
    return ui;
  }

  /** 预览页上的操作出错：登录过期时提供就地重新登录，已读取的数据保留 */
  function showError(error: unknown, fallback?: string) {
    const ui = handleError(error);
    if (!ui) return;
    setExportError({
      text: ui.kind === "other" && fallback ? fallback : errorText(ui, t),
      signInAgain: ui.kind === "sessionExpired" && loaded?.source.kind === "graph",
    });
  }

  async function signInAgain() {
    const gen = sessionGen.current;
    setExportError(undefined);
    try {
      await microsoft.signIn();
    } catch (e) {
      if (sessionGen.current === gen) showError(e);
    }
  }

  async function startReading() {
    invalidate();
    const gen = sessionGen.current;
    const isCurrent = () => sessionGen.current === gen;
    setAuthError(undefined);
    setProgress(undefined);
    setView("reading");
    try {
      const { raw, profile, failures, attachmentFailures, attachmentsDenied } =
        await microsoft.read((p) => {
          if (isCurrent()) setProgress(p);
        });
      if (!isCurrent()) return;
      attachmentStore.current = new Map();
      load({
        source: { kind: "graph", profile },
        raw,
        failures,
        attachmentFailures,
        attachmentsDenied: attachmentsDenied ? "readOnly" : undefined,
      });
    } catch (e) {
      if (!isCurrent()) return;
      setAuthError(handleError(e));
      setView("start");
    }
  }

  async function signInAndRead() {
    const gen = ++sessionGen.current;
    setAuthError(undefined);
    try {
      await microsoft.signIn();
    } catch (e) {
      if (sessionGen.current === gen) setAuthError(handleError(e));
      return;
    }
    if (sessionGen.current !== gen) return;
    await startReading();
  }

  async function signInWithRedirect() {
    const gen = ++sessionGen.current;
    setAuthError(undefined);
    try {
      await microsoft.signInRedirect();
    } catch (e) {
      if (sessionGen.current === gen) setAuthError(handleError(e));
    }
  }

  async function requestReadWriteAndRead() {
    const gen = ++sessionGen.current;
    setAuthError(undefined);
    try {
      await microsoft.requestReadWrite();
    } catch (e) {
      if (sessionGen.current === gen) setAuthError(handleError(e));
      return;
    }
    if (sessionGen.current !== gen) return;
    await startReading();
  }

  async function importFile(file: File): Promise<void> {
    const gen = ++sessionGen.current;
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      if (sessionGen.current !== gen) return;
      throw e;
    }
    if (sessionGen.current !== gen) return;
    const backup = parseBackup(text);
    // 默认沿用备份导出时选择的时区
    load(
      {
        source: {
          kind: "import",
          fileName: file.name,
          account: backup.meta.account,
          attachmentPaths: backup.attachmentPaths,
        },
        raw: backup.raw,
        failures: [],
        attachmentFailures: [],
        importedIncomplete: backup.meta.incomplete,
      },
      isValidTimeZone(backup.meta.exportTimeZone) ? backup.meta.exportTimeZone : defaultTimeZone(),
    );
  }

  async function signOut() {
    invalidate();
    if (loaded?.source.kind === "graph") {
      setLoaded(undefined);
      setSettings(undefined);
      setDone(undefined);
      attachmentStore.current = new Map();
    }
    setView("start");
    await microsoft.signOut();
  }

  /** 只读权限读不到附件时，由用户主动授予读写权限，再补读附件信息 */
  async function grantForAttachments() {
    if (!loaded) return;
    const gen = sessionGen.current;
    const isCurrent = () => sessionGen.current === gen;
    const base = loaded;
    setBusy(t("app.attachments.granting"));
    setExportError(undefined);
    try {
      const { attachmentFailures, denied } = await microsoft.grantAndReadAttachments(base.raw);
      if (!isCurrent()) return;
      setLoaded({
        ...base,
        raw: { ...base.raw },
        attachmentFailures: mergeAttachmentFailures(
          base.raw,
          base.attachmentFailures,
          attachmentFailures,
        ),
        attachmentsDenied: denied ? "readWrite" : undefined,
      });
    } catch (e) {
      if (isCurrent()) showError(e);
    } finally {
      if (isCurrent()) setBusy(undefined);
    }
  }

  /** 只重试读取失败的清单，已读取的数据保留 */
  async function retryFailed() {
    if (!loaded || !settings) return;
    const gen = sessionGen.current;
    const isCurrent = () => sessionGen.current === gen;
    const base = loaded;
    const ids = base.failures.map((f) => f.listId);
    setBusy(t("app.read.retrying"));
    setExportError(undefined);
    try {
      const { failures, attachmentFailures, denied } = await microsoft.retryLists(
        base.raw,
        ids,
        () => {},
        { skipAttachments: Boolean(base.attachmentsDenied) },
      );
      if (!isCurrent()) return;
      const recovered = ids.filter((id) => !failures.some((f) => f.listId === id));
      setLoaded({
        ...base,
        raw: { ...base.raw },
        failures,
        attachmentFailures: mergeAttachmentFailures(
          base.raw,
          base.attachmentFailures,
          attachmentFailures,
        ),
        attachmentsDenied: base.attachmentsDenied ?? (denied ? "readOnly" : undefined),
      });
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              selectedListIds: base.raw.lists
                .map((l) => l.id)
                .filter((id) => prev.selectedListIds.includes(id) || recovered.includes(id)),
            }
          : prev,
      );
    } catch (e) {
      if (isCurrent()) showError(e);
    } finally {
      if (isCurrent()) setBusy(undefined);
    }
  }

  async function handleExport() {
    if (!loaded || !settings) return;
    const gen = sessionGen.current;
    const isCurrent = () => sessionGen.current === gen;
    setBusy(t("app.export.working"));
    setExportError(undefined);
    let current = loaded;
    const store = attachmentStore.current;
    try {
      const warnings: string[] = [];
      const graph = current.source.kind === "graph";
      const failedIds = new Set(current.failures.map((f) => f.listId));
      // 读取失败的清单不能被勾选；这里再兜底一次，避免把它们当成空清单写进备份
      const listIds = settings.selectedListIds.filter((id) => !failedIds.has(id));
      const scope: AttachmentScope = { listIds, includeCompleted: settings.includeCompleted };
      const progress =
        (key: "app.attachments.metadata" | "app.attachments.downloading") =>
        (p: { done: number; total: number }) => {
          if (isCurrent()) setBusy(t(key, { done: p.done, total: p.total }));
        };

      // 即使不下载附件内容，JSON 备份也需要附件名称和大小：先补读缺失的附件信息。
      // 已知被拒时不再请求（会再触发一轮 401），直接记为缺失。
      if (
        graph &&
        !current.attachmentsDenied &&
        tasksMissingAttachmentMetadata(current.raw, scope).length
      ) {
        const { attachmentFailures, denied } = await microsoft.readAttachmentMetadata(
          current.raw,
          scope,
          progress("app.attachments.metadata"),
        );
        if (!isCurrent()) return;
        current = {
          ...current,
          raw: { ...current.raw },
          attachmentFailures: mergeAttachmentFailures(
            current.raw,
            current.attachmentFailures,
            attachmentFailures,
          ),
          attachmentsDenied: denied ? "readOnly" : undefined,
        };
        setLoaded(current);
      }

      const withAttachments = graph && settings.downloadAttachments && !current.attachmentsDenied;
      let contentFailures: AttachmentFailure[] = [];
      if (withAttachments) {
        const { failures, skipped } = await microsoft.downloadAttachments(
          current.raw,
          store,
          scope,
          (bytes) =>
            askConfirmation(t("app.attachments.confirm", { size: Math.round(bytes / MB) })),
          progress("app.attachments.downloading"),
        );
        if (!isCurrent()) return;
        contentFailures = failures;
        if (skipped) warnings.push(t("app.attachments.skipped"));
      }

      const missingMetadata = graph ? tasksMissingAttachmentMetadata(current.raw, scope) : [];
      const reasons = new Map(current.attachmentFailures.map((f) => [f.taskId, f.error]));
      for (const m of missingMetadata) {
        const error = reasons.get(m.taskId);
        warnings.push(
          t("app.attachments.metadataFailed", {
            task: m.taskTitle,
            reason: error === undefined ? "—" : failureReason(error),
          }),
        );
      }
      for (const f of contentFailures) {
        warnings.push(
          t("app.attachments.failed", {
            task: f.taskTitle,
            name: f.attachmentName ?? "",
            reason: failureReason(f.error),
          }),
        );
      }
      for (const f of current.failures)
        warnings.push(t("app.read.listFailed", { name: f.listName }));

      const incomplete: Incomplete | undefined = graph
        ? {
            lists: current.failures.map((f) => ({ id: f.listId, name: f.listName })),
            attachmentMetadata: missingMetadata,
            attachmentContent: contentFailures.map((f) => ({
              taskId: f.taskId,
              attachmentId: f.attachmentId ?? "",
              name: f.attachmentName ?? "",
            })),
          }
        : current.importedIncomplete;

      setBusy(t("app.export.working"));
      const formats = enabledFormats(settings.formats, thingsAvailable);
      const output = runExport({
        raw: current.raw,
        selection: { listIds, includeCompleted: settings.includeCompleted },
        timeZone: settings.timeZone,
        locale,
        formats,
        account:
          current.source.kind === "graph"
            ? current.source.profile
            : current.source.kind === "import"
              ? current.source.account
              : undefined,
        incomplete,
        previousAttachmentPaths:
          current.source.kind === "import" ? current.source.attachmentPaths : undefined,
        attachmentData: withAttachments ? store : undefined,
      });
      const download = await packageFiles(output.files);
      if (!isCurrent()) return;
      downloadFile(download.name, download.data, download.mime);
      setDone({
        download,
        result: {
          fileName: download.name,
          formats: formats.map((f) => f.id),
          links: output.links,
          warnings: [...new Set([...warnings, ...output.warnings])],
        },
      });
      setView("done");
      window.scrollTo(0, 0);
    } catch (e) {
      if (isCurrent()) showError(e, t("app.export.failed"));
    } finally {
      if (isCurrent()) setBusy(undefined);
    }
  }

  const account = microsoft.state.status === "ready" ? microsoft.state.account : undefined;

  if (view === "reading") return <ReadingScreen progress={progress} />;

  if (view === "done" && done) {
    return (
      <DoneScreen
        result={done.result}
        signedIn={loaded?.source.kind === "graph"}
        onDownloadAgain={() =>
          downloadFile(done.download.name, done.download.data, done.download.mime)
        }
        onBack={() => setView("preview")}
      />
    );
  }

  if (view === "preview" && loaded && settings) {
    const { source } = loaded;
    const sourceLabel =
      source.kind === "demo"
        ? t("app.source.demo")
        : source.kind === "import"
          ? t("app.source.import", { file: source.fileName })
          : t("app.source.graph", {
              name: source.profile.displayName || source.profile.username || "",
            });
    return (
      <>
        <PreviewScreen
          raw={loaded.raw}
          sourceLabel={sourceLabel}
          settings={settings}
          thingsAvailable={thingsAvailable}
          attachmentsAvailable={source.kind === "graph"}
          failedListIds={loaded.failures.map((f) => f.listId)}
          attachmentsDenied={loaded.attachmentsDenied}
          onGrantAttachments={grantForAttachments}
          busy={busy}
          onChange={setSettings}
          onExport={handleExport}
          onBack={backToStart}
          onSignOut={source.kind === "graph" ? signOut : undefined}
          onRetryFailed={retryFailed}
          error={exportError}
          onSignInAgain={signInAgain}
        />
        {confirmation && (
          <ConfirmDialog
            message={confirmation.message}
            confirmLabel={t("app.attachments.confirmYes")}
            cancelLabel={t("app.attachments.confirmNo")}
            onAnswer={confirmation.resolve}
          />
        )}
      </>
    );
  }

  return (
    <StartScreen
      microsoft={microsoft.state.status}
      account={account}
      error={authError}
      highlight={mode === "import" || mode === "signin" ? mode : undefined}
      onClearHighlight={() => setMode(null)}
      onSignIn={signInAndRead}
      onSignInRedirect={signInWithRedirect}
      onReadAgain={startReading}
      onSignOut={signOut}
      onRequestReadWrite={requestReadWriteAndRead}
      onDemo={() => load(demo(locale))}
      onImportFile={importFile}
    />
  );
}

/** 导出工具入口。只在浏览器中渲染（client:only），因为 MSAL 依赖浏览器环境。 */
export default function ExportApp({ locale }: { locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <App />
    </I18nProvider>
  );
}
