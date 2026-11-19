import { useState } from "react";
import { runExport } from "../../core/export/run";
import { packageFiles } from "../../core/export/zip";
import type { RawData } from "../../core/graph/types";
import { defaultTimeZone, isValidTimeZone } from "../../core/model/dates";
import type { ParsedBackup } from "../../core/model/backup";
import type { Locale } from "../../i18n";
import { demoRawData } from "../../fixtures";
import "./app.css";
import { DoneScreen, type DoneResult } from "./DoneScreen";
import { PreviewScreen } from "./PreviewScreen";
import { StartScreen } from "./StartScreen";
import { downloadFile, isAppleDevice } from "./browser";
import { I18nProvider, useI18n } from "./i18n";
import { enabledFormats, initialSettings, type Settings } from "./settings";

type Props = {
  locale: Locale;
  msalConfigured: boolean;
};

type Source = { kind: "demo" } | { kind: "import"; fileName: string };

type Loaded = { source: Source; raw: RawData };

type Download = { name: string; data: string | Uint8Array; mime: string };

const demo = (): Loaded => ({ source: { kind: "demo" }, raw: demoRawData() });

function App({ msalConfigured }: { msalConfigured: boolean }) {
  const { t, locale } = useI18n();
  const [mode] = useState(() => new URLSearchParams(location.search).get("mode"));
  // 从落地页点"先看演示"进来时直接打开演示数据
  const [loaded, setLoaded] = useState<Loaded | undefined>(() =>
    mode === "demo" ? demo() : undefined,
  );
  const [settings, setSettings] = useState<Settings | undefined>(() =>
    loaded ? initialSettings(loaded.raw, defaultTimeZone()) : undefined,
  );
  const [view, setView] = useState<"start" | "preview" | "done">(loaded ? "preview" : "start");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [done, setDone] = useState<{ result: DoneResult; download: Download }>();
  const [thingsAvailable] = useState(isAppleDevice);

  function load(next: Loaded, timeZone = defaultTimeZone()) {
    setLoaded(next);
    setSettings(initialSettings(next.raw, timeZone));
    setExportError(undefined);
    setView("preview");
    window.scrollTo(0, 0);
  }

  async function handleExport() {
    if (!loaded || !settings) return;
    setExporting(true);
    setExportError(undefined);
    try {
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
      });
      const download = await packageFiles(output.files);
      downloadFile(download.name, download.data, download.mime);
      setDone({
        download,
        result: {
          fileName: download.name,
          formats: formats.map((f) => f.id),
          links: output.links,
          warnings: output.warnings,
        },
      });
      setView("done");
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      setExportError(t("app.export.failed"));
    } finally {
      setExporting(false);
    }
  }

  if (view === "done" && done) {
    return (
      <DoneScreen
        result={done.result}
        signedIn={false}
        onDownloadAgain={() =>
          downloadFile(done.download.name, done.download.data, done.download.mime)
        }
        onBack={() => setView("preview")}
      />
    );
  }

  if (view === "preview" && loaded && settings) {
    const sourceLabel =
      loaded.source.kind === "demo"
        ? t("app.source.demo")
        : t("app.source.import", { file: loaded.source.fileName });
    return (
      <>
        <PreviewScreen
          raw={loaded.raw}
          sourceLabel={sourceLabel}
          settings={settings}
          thingsAvailable={thingsAvailable}
          attachmentsAvailable={false}
          exporting={exporting}
          onChange={setSettings}
          onExport={handleExport}
          onBack={() => setView("start")}
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
      msalConfigured={msalConfigured}
      highlight={mode === "import" || mode === "signin" ? mode : undefined}
      onDemo={() => load(demo())}
      onImport={(backup: ParsedBackup, fileName) =>
        // 默认沿用备份导出时选择的时区
        load(
          { source: { kind: "import", fileName }, raw: backup.raw },
          isValidTimeZone(backup.meta.exportTimeZone)
            ? backup.meta.exportTimeZone
            : defaultTimeZone(),
        )
      }
    />
  );
}

/** 导出工具入口。只在浏览器中渲染（client:only），因为 MSAL 依赖浏览器环境。 */
export default function ExportApp({ locale, msalConfigured }: Props) {
  return (
    <I18nProvider locale={locale}>
      <App msalConfigured={msalConfigured} />
    </I18nProvider>
  );
}
