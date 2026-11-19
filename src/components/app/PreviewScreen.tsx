import { useId, useMemo, useState } from "react";
import type { ExporterId } from "../../core/exporters/types";
import type { RawData } from "../../core/graph/types";
import { normalize, selectRaw } from "../../core/model/normalize";
import { FormatCards } from "./FormatCards";
import { ListSidebar } from "./ListSidebar";
import { TaskPreview } from "./TaskPreview";
import { timeZoneOptions } from "./browser";
import { useI18n } from "./i18n";
import type { FormatState, Settings } from "./settings";

type Props = {
  raw: RawData;
  sourceLabel: string;
  settings: Settings;
  thingsAvailable: boolean;
  attachmentsAvailable: boolean;
  /** 读取失败的清单（可重试） */
  failedListIds: string[];
  /** 正在进行的操作说明（导出、下载附件、重试）；有值时禁用按钮 */
  busy?: string;
  onChange: (settings: Settings) => void;
  onExport: () => void;
  onBack: () => void;
  onSignOut?: () => void;
  onRetryFailed: () => void;
};

export function PreviewScreen({
  raw,
  sourceLabel,
  settings,
  thingsAvailable,
  attachmentsAvailable,
  failedListIds,
  busy,
  onChange,
  onExport,
  onBack,
  onSignOut,
  onRetryFailed,
}: Props) {
  const { t } = useI18n();
  const tzId = useId();
  const [focused, setFocused] = useState(raw.lists[0]?.id);
  const zones = useMemo(() => timeZoneOptions(settings.timeZone), [settings.timeZone]);

  // 预览显示所有清单（不受勾选影响），但遵循"包含已完成"和导出时区
  const preview = useMemo(
    () =>
      normalize(selectRaw(raw, { includeCompleted: settings.includeCompleted }), {
        timeZone: settings.timeZone,
      }),
    [raw, settings.includeCompleted, settings.timeZone],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        raw.lists.map((l) => {
          const tasks = raw.tasksByListId[l.id] ?? [];
          return [
            l.id,
            {
              total: tasks.length,
              completed: tasks.filter((x) => x.status === "completed").length,
            },
          ];
        }),
      ),
    [raw],
  );

  const selected = new Set(settings.selectedListIds);
  const selectedTasks = preview.lists
    .filter((l) => selected.has(l.id))
    .reduce((n, l) => n + l.tasks.length, 0);
  const formatCount = Object.entries(settings.formats).filter(
    ([id, f]) => f.enabled && (id !== "things" || thingsAvailable),
  ).length;
  const blocker = !selected.size
    ? t("app.export.noList")
    : !formatCount
      ? t("app.export.noFormat")
      : undefined;

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const setFormat = <K extends ExporterId>(id: K, patch: Partial<FormatState[K]>) =>
    set({ formats: { ...settings.formats, [id]: { ...settings.formats[id], ...patch } } });

  return (
    <div className="preview-screen">
      <div className="source-bar">
        <span>{sourceLabel}</span>
        <span className="button-row">
          {onSignOut && (
            <button type="button" className="link-button" onClick={onSignOut}>
              {t("app.signOut")}
            </button>
          )}
          <button type="button" className="link-button" onClick={onBack}>
            {t("app.back")}
          </button>
        </span>
      </div>

      {failedListIds.length > 0 && (
        <div className="notice warning" role="alert">
          <p>
            {t("app.read.someFailed", {
              names: raw.lists
                .filter((l) => failedListIds.includes(l.id))
                .map((l) => l.displayName)
                .join(t("app.listSeparator")),
            })}
          </p>
          <button type="button" className="button" disabled={Boolean(busy)} onClick={onRetryFailed}>
            {t("app.read.retry")}
          </button>
        </div>
      )}

      <div className="workspace">
        <ListSidebar
          lists={preview.lists}
          counts={counts}
          failed={failedListIds}
          selected={settings.selectedListIds}
          focused={focused}
          onFocus={setFocused}
          onToggle={(id, checked) =>
            set({
              selectedListIds: checked
                ? raw.lists.map((l) => l.id).filter((x) => x === id || selected.has(x))
                : settings.selectedListIds.filter((x) => x !== id),
            })
          }
          onSelectAll={(checked) =>
            set({ selectedListIds: checked ? raw.lists.map((l) => l.id) : [] })
          }
        />
        <TaskPreview list={preview.lists.find((l) => l.id === focused)} />
      </div>

      <section className="options" aria-labelledby="options-heading">
        <h2 id="options-heading">{t("app.options.heading")}</h2>
        <label className="option">
          <input
            type="checkbox"
            checked={settings.includeCompleted}
            onChange={(e) => set({ includeCompleted: e.target.checked })}
          />
          {t("app.options.includeCompleted")}
        </label>

        <div className="option-tz">
          <label htmlFor={tzId}>{t("app.options.timeZone")}</label>
          <select
            id={tzId}
            value={settings.timeZone}
            onChange={(e) => set({ timeZone: e.target.value })}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <p className="hint">{t("app.options.timeZoneHelp")}</p>
        </div>

        <label className="option">
          <input
            type="checkbox"
            checked={attachmentsAvailable && settings.downloadAttachments}
            disabled={!attachmentsAvailable}
            onChange={(e) => set({ downloadAttachments: e.target.checked })}
          />
          {t("app.options.attachments")}
        </label>
        {!attachmentsAvailable && <p className="hint">{t("app.options.attachmentsUnavailable")}</p>}

        <p className="notice">
          <strong>{t("app.limits.heading")}</strong> {t("app.limits.text")}
        </p>
      </section>

      <FormatCards
        formats={settings.formats}
        thingsAvailable={thingsAvailable}
        onToggle={(id, enabled) => setFormat(id, { enabled })}
        onOptions={(id, patch) =>
          setFormat(id, {
            options: { ...settings.formats[id].options, ...patch },
          } as Partial<FormatState[typeof id]>)
        }
      />

      <div className="export-bar">
        <p className="muted" aria-live="polite">
          {busy ??
            blocker ??
            t("app.export.summary", {
              lists: selected.size,
              tasks: selectedTasks,
              formats: formatCount,
            })}
        </p>
        <button
          type="button"
          className="button primary"
          disabled={Boolean(blocker) || Boolean(busy)}
          onClick={onExport}
        >
          {busy ? t("app.export.working") : t("app.export.button")}
        </button>
      </div>
    </div>
  );
}
