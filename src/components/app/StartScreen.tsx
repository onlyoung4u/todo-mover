import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { BackupError } from "../../core/model/backup";
import type { MessageKey } from "../../i18n";
import { errorText, type UiError } from "./errors";
import { useI18n } from "./i18n";
import { LockIcon } from "./icons";
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
  onImportFile: (file: File) => Promise<void>;
};

const IMPORT_ERRORS: Record<BackupError["code"], MessageKey> = {
  invalidJson: "app.import.error.invalidJson",
  notBackup: "app.import.error.notBackup",
  noRawData: "app.import.error.noRawData",
  newerSchema: "app.import.error.newerSchema",
};

function MicrosoftEntry({
  microsoft,
  account,
  error,
  highlight,
  onSignIn,
  onSignInRedirect,
  onReadAgain,
  onSignOut,
  onRequestReadWrite,
}: Omit<Props, "onDemo" | "onImportFile">) {
  const { t } = useI18n();
  const name = account?.name || account?.username;

  return (
    <div className={`entry primary${highlight === "signin" ? " highlight" : ""}`}>
      <h2>{t("app.start.signIn")}</h2>
      <p className="muted">
        {microsoft === "ready" && account
          ? t("app.start.signedInAs", { name: name ?? "" })
          : t("app.start.signInDesc")}
      </p>

      {microsoft === "unavailable" && (
        <>
          <button type="button" className="button primary" disabled>
            {t("landing.signIn")}
          </button>
          <p className="hint">{t("landing.noClientId")}</p>
        </>
      )}

      {microsoft === "initializing" && (
        <button type="button" className="button primary" disabled>
          {t("app.loading")}
        </button>
      )}

      {microsoft === "ready" && !account && (
        <button type="button" className="button primary" onClick={onSignIn}>
          {t("landing.signIn")}
        </button>
      )}

      {microsoft === "ready" && account && (
        <span className="button-row">
          <button type="button" className="button primary" onClick={onReadAgain}>
            {t("app.start.readTasks")}
          </button>
          <button type="button" className="link-button" onClick={onSignOut}>
            {t("app.signOut")}
          </button>
        </span>
      )}

      {error && (
        <div className="inline-error" role="alert">
          <p>{errorText(error, t)}</p>
          {error.kind === "popupBlocked" && (
            <button type="button" className="button small" onClick={onSignInRedirect}>
              {t("app.start.signInRedirect")}
            </button>
          )}
          {error.kind === "forbidden" && (
            <button type="button" className="button small" onClick={onRequestReadWrite}>
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
  const { highlight, onDemo, onImportFile } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const mounted = useRef(true);
  const readSeq = useRef(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function readFile(file: File | undefined) {
    if (!file) return;
    const seq = ++readSeq.current;
    const isCurrent = () => mounted.current && readSeq.current === seq;
    setError(undefined);
    setBusy(true);
    try {
      await onImportFile(file);
    } catch (e) {
      if (isCurrent()) {
        setError(
          t(e instanceof BackupError ? IMPORT_ERRORS[e.code] : "app.import.error.invalidJson"),
        );
      }
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void readFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  }

  return (
    <section className="start">
      <p className="eyebrow">
        <span className="dot" />
        {t("app.start.eyebrow")}
      </p>
      <h1>{t("app.start.heading")}</h1>
      <div className="window">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="chip">todo-mover</span>
          <span className="spacer" />
          <span className="local">
            <LockIcon />
            {t("landing.local")}
          </span>
        </div>
        <div className="entry-grid">
          <MicrosoftEntry {...props} />

          <div className="entry">
            <h2>{t("app.start.demo")}</h2>
            <p className="muted">{t("app.start.demoDesc")}</p>
            <button type="button" className="button" onClick={onDemo}>
              {t("landing.demo")}
            </button>
          </div>

          <div
            className={`entry dropzone${highlight === "import" ? " highlight" : ""}${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
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
            <p className="hint">{t("app.start.dropHint")}</p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="window-foot">
          <span>{t("landing.windowFoot")}</span>
        </div>
      </div>
    </section>
  );
}
