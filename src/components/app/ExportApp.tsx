import { useRef, useState } from "react";
import { config } from "../../config";
import { runExport } from "../../core/export/run";
import { packageFiles } from "../../core/export/zip";
import type { FetchProgress, ListFailure, Profile } from "../../core/graph/fetchAll";
import type { RawData } from "../../core/graph/types";
import type { ParsedBackup } from "../../core/model/backup";
import { defaultTimeZone, isValidTimeZone } from "../../core/model/dates";
import { demoRawData } from "../../fixtures";
import type { Locale } from "../../i18n";
import "./app.css";
import { DoneScreen, type DoneResult } from "./DoneScreen";
import { PreviewScreen } from "./PreviewScreen";
import { ReadingScreen } from "./ReadingScreen";
import { StartScreen } from "./StartScreen";
import { downloadFile, isAppleDevice } from "./browser";
import { errorText, failureReason, toUiError, type UiError } from "./errors";
import { I18nProvider, useI18n } from "./i18n";
import { enabledFormats, initialSettings, type Settings } from "./settings";
import { useMicrosoft } from "./useMicrosoft";

type Source =
  { kind: "demo" } | { kind: "import"; fileName: string } | { kind: "graph"; profile: Profile };

type Loaded = {
  source: Source;
  raw: RawData;
  failures: ListFailure[];
  /** 读取附件被拒："readOnly" 可以尝试授予读写权限；"readWrite" 授权后仍被拒 */
  attachmentsDenied?: "readOnly" | "readWrite";
};

type Download = { name: string; data: string | Uint8Array; mime: string };

type View = "start" | "reading" | "preview" | "done";

/** 演示数据跟随界面语言，日期按浏览器时区生成（与真实 To Do 的存储方式一致） */
const demo = (locale: Locale): Loaded => ({
  source: { kind: "demo" },
  raw: demoRawData(locale, defaultTimeZone()),
  failures: [],
});

const MB = 1024 * 1024;

function App() {
  const { t, locale } = useI18n();
  const [mode] = useState(() => new URLSearchParams(location.search).get("mode"));
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
  const [exportError, setExportError] = useState<string>();
  const [done, setDone] = useState<{ result: DoneResult; download: Download }>();
  const [thingsAvailable] = useState(isAppleDevice);
  /** 已下载的附件内容（按附件 ID），重复导出时不再下载 */
  const attachmentStore = useRef(new Map<string, Uint8Array>());

  const microsoft = useMicrosoft(config.msalClientId, () => void startReading());

  function load(next: Loaded, timeZone = defaultTimeZone()) {
    setLoaded(next);
    const failed = new Set(next.failures.map((f) => f.listId));
    setSettings(initialSettings(next.raw, timeZone, failed));
    setExportError(undefined);
    setView("preview");
    window.scrollTo(0, 0);
  }

  /** 统一处理登录 / 读取错误：用户取消登录时静默返回 */
  function handleError(error: unknown): UiError | undefined {
    const ui = toUiError(error);
    console.error(error);
    if (ui.kind === "cancelled") return undefined;
    return ui;
  }

  async function startReading() {
    setAuthError(undefined);
    setProgress(undefined);
    setView("reading");
    try {
      const { raw, profile, failures, attachmentsDenied } = await microsoft.read(setProgress);
      attachmentStore.current = new Map();
      load({
        source: { kind: "graph", profile },
        raw,
        failures,
        attachmentsDenied: attachmentsDenied ? "readOnly" : undefined,
      });
    } catch (e) {
      setAuthError(handleError(e));
      setView("start");
    }
  }

  async function signInAndRead() {
    setAuthError(undefined);
    try {
      await microsoft.signIn();
    } catch (e) {
      setAuthError(handleError(e));
      return;
    }
    await startReading();
  }

  async function signOut() {
    await microsoft.signOut();
    if (loaded?.source.kind === "graph") {
      setLoaded(undefined);
      setSettings(undefined);
      attachmentStore.current = new Map();
    }
    setView("start");
  }

  /** 只读权限读不到附件时，由用户主动授予读写权限，再补读附件信息 */
  async function grantForAttachments() {
    if (!loaded) return;
    setBusy(t("app.attachments.granting"));
    setExportError(undefined);
    try {
      const stillDenied = await microsoft.grantAndReadAttachments(loaded.raw);
      setLoaded({
        ...loaded,
        raw: { ...loaded.raw },
        attachmentsDenied: stillDenied ? "readWrite" : undefined,
      });
    } catch (e) {
      const ui = handleError(e);
      if (ui) setExportError(errorText(ui, t));
    } finally {
      setBusy(undefined);
    }
  }

  /** 只重试读取失败的清单，已读取的数据保留 */
  async function retryFailed() {
    if (!loaded || !settings) return;
    const ids = loaded.failures.map((f) => f.listId);
    setBusy(t("app.read.retrying"));
    setExportError(undefined);
    try {
      const failures = await microsoft.retryLists(loaded.raw, ids, () => {});
      const recovered = ids.filter((id) => !failures.some((f) => f.listId === id));
      setLoaded({ ...loaded, raw: { ...loaded.raw }, failures });
      setSettings({
        ...settings,
        selectedListIds: loaded.raw.lists
          .map((l) => l.id)
          .filter((id) => settings.selectedListIds.includes(id) || recovered.includes(id)),
      });
    } catch (e) {
      const ui = handleError(e);
      if (ui) setExportError(errorText(ui, t));
    } finally {
      setBusy(undefined);
    }
  }

  async function handleExport() {
    if (!loaded || !settings) return;
    setBusy(t("app.export.working"));
    setExportError(undefined);
    try {
      const warnings: string[] = [];
      const withAttachments = loaded.source.kind === "graph" && settings.downloadAttachments;
      if (withAttachments) {
        const { failures, skipped } = await microsoft.fetchAttachments(
          loaded.raw,
          attachmentStore.current,
          settings.selectedListIds,
          (bytes) => window.confirm(t("app.attachments.confirm", { size: Math.round(bytes / MB) })),
          (phase, p) =>
            setBusy(
              t(phase === "metadata" ? "app.attachments.metadata" : "app.attachments.downloading", {
                done: p.done,
                total: p.total,
              }),
            ),
        );
        if (skipped) warnings.push(t("app.attachments.skipped"));
        for (const f of failures) {
          const reason = failureReason(f.error);
          warnings.push(
            f.attachmentName === undefined
              ? t("app.attachments.metadataFailed", { task: f.taskTitle, reason })
              : t("app.attachments.failed", { task: f.taskTitle, name: f.attachmentName, reason }),
          );
        }
      }
      for (const f of loaded.failures)
        warnings.push(t("app.read.listFailed", { name: f.listName }));

      setBusy(t("app.export.working"));
      const formats = enabledFormats(settings.formats, thingsAvailable);
      const output = runExport({
        raw: loaded.raw,
        selection: {
          listIds: settings.selectedListIds,
          includeCompleted: settings.includeCompleted,
        },
        timeZone: settings.timeZone,
        locale,
        formats,
        account: loaded.source.kind === "graph" ? loaded.source.profile : undefined,
        attachmentData: withAttachments ? attachmentStore.current : undefined,
      });
      const download = await packageFiles(output.files);
      downloadFile(download.name, download.data, download.mime);
      setDone({
        download,
        result: {
          fileName: download.name,
          formats: formats.map((f) => f.id),
          links: output.links,
          warnings: [...warnings, ...output.warnings],
        },
      });
      setView("done");
      window.scrollTo(0, 0);
    } catch (e) {
      const ui = handleError(e);
      setExportError(ui && ui.kind !== "other" ? errorText(ui, t) : t("app.export.failed"));
    } finally {
      setBusy(undefined);
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
          onBack={() => setView("start")}
          onSignOut={source.kind === "graph" ? signOut : undefined}
          onRetryFailed={retryFailed}
        />
        {exportError && (
          <p className="error" role="alert">
            {exportError}
          </p>
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
      onSignIn={signInAndRead}
      onSignInRedirect={() => void microsoft.signInRedirect()}
      onReadAgain={startReading}
      onSignOut={signOut}
      onRequestReadWrite={async () => {
        try {
          await microsoft.requestReadWrite();
          await startReading();
        } catch (e) {
          setAuthError(handleError(e));
        }
      }}
      onDemo={() => load(demo(locale))}
      onImport={(backup: ParsedBackup, fileName) =>
        // 默认沿用备份导出时选择的时区
        load(
          { source: { kind: "import", fileName }, raw: backup.raw, failures: [] },
          isValidTimeZone(backup.meta.exportTimeZone)
            ? backup.meta.exportTimeZone
            : defaultTimeZone(),
        )
      }
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
