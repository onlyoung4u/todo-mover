import { EXPORTERS, EXPORTER_ORDER } from "../../core/exporters";
import type { ExporterId } from "../../core/exporters/types";
import type { MessageKey } from "../../i18n";
import { useI18n } from "./i18n";
import type { FormatState } from "./settings";

type Props = {
  formats: FormatState;
  thingsAvailable: boolean;
  onToggle: (id: ExporterId, enabled: boolean) => void;
  onOptions: <K extends ExporterId>(id: K, patch: Partial<FormatState[K]["options"]>) => void;
};

function Check({
  label,
  checked,
  onChange,
}: {
  label: MessageKey;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="option">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {t(label)}
    </label>
  );
}

function FormatOptions({
  id,
  formats,
  onOptions,
}: Omit<Props, "onToggle" | "thingsAvailable"> & { id: ExporterId }) {
  const { t } = useI18n();
  switch (id) {
    case "csv": {
      const o = formats.csv.options;
      return (
        <Check
          label="opt.csv.formulaGuard"
          checked={o.formulaGuard}
          onChange={(v) => onOptions("csv", { formulaGuard: v })}
        />
      );
    }
    case "markdown": {
      const o = formats.markdown.options;
      return (
        <>
          <fieldset className="option-group">
            <legend>{t("opt.markdown.style")}</legend>
            {(["obsidian", "plain"] as const).map((style) => (
              <label key={style} className="option">
                <input
                  type="radio"
                  name="markdown-style"
                  checked={o.style === style}
                  onChange={() => onOptions("markdown", { style })}
                />
                {t(style === "obsidian" ? "opt.markdown.styleObsidian" : "opt.markdown.stylePlain")}
              </label>
            ))}
          </fieldset>
          <Check
            label="opt.markdown.singleFile"
            checked={o.singleFile}
            onChange={(v) => onOptions("markdown", { singleFile: v })}
          />
        </>
      );
    }
    case "todoist": {
      const o = formats.todoist.options;
      return (
        <>
          <Check
            label="opt.todoist.includeCompleted"
            checked={o.includeCompleted}
            onChange={(v) => onOptions("todoist", { includeCompleted: v })}
          />
          <Check
            label="opt.todoist.includeCheckedSteps"
            checked={o.includeCheckedSteps}
            onChange={(v) => onOptions("todoist", { includeCheckedSteps: v })}
          />
          <Check
            label="opt.todoist.categoriesAsLabels"
            checked={o.categoriesAsLabels}
            onChange={(v) => onOptions("todoist", { categoriesAsLabels: v })}
          />
        </>
      );
    }
    default:
      return null;
  }
}

export function FormatCards({ formats, thingsAvailable, onToggle, onOptions }: Props) {
  const { t, locale } = useI18n();
  const ticktickHelp =
    locale === "zh-CN"
      ? "https://help.dida365.com/"
      : "https://help.ticktick.com/articles/7055781405648748544";

  return (
    <section className="formats" aria-labelledby="formats-heading">
      <h2 id="formats-heading">{t("app.formats.heading")}</h2>
      <p className="notice">
        {t("app.formats.ticktick")}{" "}
        <a href={ticktickHelp} target="_blank" rel="noopener noreferrer">
          {t("app.formats.ticktickLink")}
        </a>
      </p>
      <div className="format-grid">
        {EXPORTER_ORDER.map((id) => {
          const exporter = EXPORTERS[id];
          const disabled = id === "things" && !thingsAvailable;
          const enabled = formats[id].enabled && !disabled;
          return (
            <div
              key={id}
              className={`card format${enabled ? " selected" : ""}${disabled ? " disabled" : ""}`}
            >
              <label className="format-title">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={disabled}
                  onChange={(e) => onToggle(id, e.target.checked)}
                />
                <span>{t(exporter.label)}</span>
                {id === "json" && (
                  <span className="badge accent">{t("app.formats.recommended")}</span>
                )}
              </label>
              {disabled && <p className="hint">{t("app.formats.appleOnly")}</p>}
              <dl>
                <dt>{t("app.formats.targets")}</dt>
                <dd>{t(exporter.targets)}</dd>
                <dt>{t("app.formats.losses")}</dt>
                <dd>{t(exporter.losses)}</dd>
              </dl>
              {enabled && (
                <div className="format-options">
                  <FormatOptions id={id} formats={formats} onOptions={onOptions} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
