import { useId, useRef, useState, type ChangeEvent } from "react";
import { BackupError, parseBackup, type ParsedBackup } from "../../core/model/backup";
import type { MessageKey } from "../../i18n";
import { useI18n } from "./i18n";

type Props = {
  msalConfigured: boolean;
  /** 从落地页点"导入 JSON"进来时突出导入入口 */
  highlight?: "import" | "signin";
  onDemo: () => void;
  onImport: (backup: ParsedBackup, fileName: string) => void;
};

const IMPORT_ERRORS: Record<BackupError["code"], MessageKey> = {
  invalidJson: "app.import.error.invalidJson",
  notBackup: "app.import.error.notBackup",
  noRawData: "app.import.error.noRawData",
  newerSchema: "app.import.error.newerSchema",
};

export function StartScreen({ msalConfigured, highlight, onDemo, onImport }: Props) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(undefined);
    setBusy(true);
    try {
      onImport(parseBackup(await file.text()), file.name);
    } catch (e) {
      setError(
        t(e instanceof BackupError ? IMPORT_ERRORS[e.code] : "app.import.error.invalidJson"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="start">
      <h1>{t("app.start.heading")}</h1>
      <div className="start-options">
        <div className={`card${highlight === "signin" ? " card-highlight" : ""}`}>
          <h2>{t("app.start.signIn")}</h2>
          <p className="muted">{t("app.start.signInDesc")}</p>
          <button type="button" className="button primary" disabled>
            {t("landing.signIn")}
          </button>
          <p className="hint">
            {msalConfigured ? t("app.start.signInSoon") : t("landing.noClientId")}
          </p>
        </div>

        <div className="card">
          <h2>{t("app.start.demo")}</h2>
          <p className="muted">{t("app.start.demoDesc")}</p>
          <button type="button" className="button" onClick={onDemo}>
            {t("landing.demo")}
          </button>
        </div>

        <div className={`card${highlight === "import" ? " card-highlight" : ""}`}>
          <h2>{t("app.start.import")}</h2>
          <p className="muted">{t("app.start.importDesc")}</p>
          <label htmlFor={fileInputId} className="visually-hidden">
            {t("app.start.import")}
          </label>
          <input
            id={fileInputId}
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {t("app.start.chooseFile")}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
