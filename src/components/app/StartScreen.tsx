import { useId, useRef, useState, type ChangeEvent } from "react";
import { BackupError, parseBackup, type ParsedBackup } from "../../core/model/backup";
import type { MessageKey } from "../../i18n";
import { errorText, type UiError } from "./errors";
import { useI18n } from "./i18n";
import type { MicrosoftState } from "./useMicrosoft";

type Props = {
  microsoft: MicrosoftState["status"];
  account?: { name?: string; username?: string };
  error?: UiError;
  /** 从落地页点"导入 JSON" / "登录"进来时突出对应入口 */
  highlight?: "import" | "signin";
  onSignIn: () => void;
  onSignInRedirect: () => void;
  onReadAgain: () => void;
  onSignOut: () => void;
  onRequestReadWrite: () => void;
  onDemo: () => void;
  onImport: (backup: ParsedBackup, fileName: string) => void;
};

const IMPORT_ERRORS: Record<BackupError["code"], MessageKey> = {
  invalidJson: "app.import.error.invalidJson",
  notBackup: "app.import.error.notBackup",
  noRawData: "app.import.error.noRawData",
  newerSchema: "app.import.error.newerSchema",
};

function MicrosoftCard({
  microsoft,
  account,
  error,
  highlight,
  onSignIn,
  onSignInRedirect,
  onReadAgain,
  onSignOut,
  onRequestReadWrite,
}: Omit<Props, "onDemo" | "onImport">) {
  const { t } = useI18n();
  const name = account?.name || account?.username;

  return (
    <div className={`card${highlight === "signin" ? " card-highlight" : ""}`}>
      <h2>{t("app.start.signIn")}</h2>
      <p className="muted">{t("app.start.signInDesc")}</p>

      {microsoft === "unavailable" && (
        <>
          <button type="button" className="button primary" disabled>
            {t("landing.signIn")}
          </button>
          <p className="hint">{t("landing.noClientId")}</p>
        </>
      )}

      {microsoft === "initializing" && <p className="hint">{t("app.loading")}</p>}

      {microsoft === "ready" && !account && (
        <button type="button" className="button primary" onClick={onSignIn}>
          {t("landing.signIn")}
        </button>
      )}

      {microsoft === "ready" && account && (
        <>
          <p>{t("app.start.signedInAs", { name: name ?? "" })}</p>
          <div className="button-row">
            <button type="button" className="button primary" onClick={onReadAgain}>
              {t("app.start.readTasks")}
            </button>
            <button type="button" className="link-button" onClick={onSignOut}>
              {t("app.signOut")}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="error" role="alert">
          <p>{errorText(error, t)}</p>
          {error.kind === "popupBlocked" && (
            <button type="button" className="button" onClick={onSignInRedirect}>
              {t("app.start.signInRedirect")}
            </button>
          )}
          {error.kind === "forbidden" && (
            <button type="button" className="button" onClick={onRequestReadWrite}>
              {t("app.start.grantPermission")}
            </button>
          )}
        </div>
      )}
      <p className="hint">{t("app.start.permissions")}</p>
    </div>
  );
}

export function StartScreen(props: Props) {
  const { t } = useI18n();
  const { highlight, onDemo, onImport } = props;
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
        <MicrosoftCard {...props} />

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
