import { useId, useMemo, useState } from "react";
import type { ExporterId } from "../../core/exporters/types";
import type { RawData } from "../../core/graph/types";
import { normalize, selectRaw } from "../../core/model/normalize";
import { FormatCards } from "./FormatCards";
import { ListSidebar } from "./ListSidebar";
import { TaskDetail, TaskList } from "./TaskViews";
import { timeZoneOptions } from "./browser";
import { useI18n } from "./i18n";
import { DownloadIcon, LockIcon } from "./icons";
import type { FormatState, Settings } from "./settings";

/** 预览页底部的错误提示；登录过期时提供"重新登录" */
export type ExportError = { text: string; signInAgain?: boolean };

type Props = {
  raw: RawData;
  sourceLabel: string;
  settings: Settings;
  thingsAvailable: boolean;
  attachmentsAvailable: boolean;
  /** 读取失败的清单（可重试） */
  failedListIds: string[];
  /** 读取附件被拒（见 ExportApp 的 Loaded.attachmentsDenied） */
  attachmentsDenied?: "readOnly" | "readWrite";
  onGrantAttachments: () => void;
  /** 正在进行的操作说明（导出、下载附件、重试）；有值时禁用按钮 */
  busy?: string;
  onChange: (settings: Settings) => void;
  onExport: () => void;
  onBack: () => void;
  onSignOut?: () => void;
  onRetryFailed: () => void;
  error?: ExportError;
  onSignInAgain: () => void;
};

export function PreviewScreen({
  raw,
  sourceLabel,
  settings,
  thingsAvailable,
  attachmentsAvailable,
  failedListIds,
  attachmentsDenied,
  onGrantAttachments,
  busy,
  onChange,
  onExport,
  onBack,
  onSignOut,
  onRetryFailed,
  error,
  onSignInAgain,
}: Props) {
  const { t } = useI18n();
  const tzId = useId();
  const [focused, setFocused] = useState(raw.lists[0]?.id);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
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

  const focusedList = preview.lists.find((l) => l.id === focused);
  const selectedTask = focusedList?.tasks.find((x) => x.id === selectedTaskId);
  const totalTasks = preview.lists.reduce((n, l) => n + l.tasks.length, 0);

  const failedSet = new Set(failedListIds);
  const selected = new Set(settings.selectedListIds.filter((id) => !failedSet.has(id)));
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

  // 附件读取被拒时不能下载：只读权限要先授权（上方有按钮），授权后仍被拒则无法下载
  const canDownloadAttachments = attachmentsAvailable && !attachmentsDenied;
  const attachmentsHint = !attachmentsAvailable
    ? t("app.options.attachmentsUnavailable")
    : attachmentsDenied === "readOnly"
      ? t("app.options.attachmentsNeedGrant")
      : attachmentsDenied === "readWrite"
        ? t("app.options.attachmentsDenied")
        : undefined;

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const setFormat = <K extends ExporterId>(id: K, patch: Partial<FormatState[K]>) =>
    set({ formats: { ...settings.formats, [id]: { ...settings.formats[id], ...patch } } });

  return (
    <div className="preview-screen">
      <p className="eyebrow">
        <span className="dot" />
        {t("app.preview.eyebrow")}
      </p>
      <h1 className="screen-title">{t("app.preview.heading")}</h1>
      <div className="window viewer">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="chip accent">{sourceLabel}</span>
          <span>{t("app.window.stats", { lists: preview.lists.length, tasks: totalTasks })}</span>
          <span className="spacer" />
          <span className="local">
            <LockIcon />
            {t("landing.local")}
          </span>
          {onSignOut && (
            <button type="button" className="bar-button" onClick={onSignOut}>
              {t("app.signOut")}
            </button>
          )}
          <button type="button" className="bar-button" onClick={onBack}>
            {t("app.back")}
          </button>
        </div>

        {failedListIds.length > 0 && (
          <div className="viewer-alert" role="alert">
            <span>
              {t("app.read.someFailed", {
                names: raw.lists
                  .filter((l) => failedListIds.includes(l.id))
                  .map((l) => l.displayName)
                  .join(t("app.listSeparator")),
              })}
            </span>
            <button
              type="button"
              className="button small"
              disabled={Boolean(busy)}
              onClick={onRetryFailed}
            >
              {t("app.read.retry")}
            </button>
          </div>
        )}

        {attachmentsDenied === "readOnly" && (
          <div className="viewer-alert" role="alert">
            <span>{t("app.attachments.denied")}</span>
            <button
              type="button"
              className="button small"
              disabled={Boolean(busy)}
              onClick={onGrantAttachments}
            >
              {t("app.attachments.grant")}
            </button>
          </div>
        )}
        {attachmentsDenied === "readWrite" && (
          <div className="viewer-alert" role="alert">
            <span>{t("app.attachments.deniedReadWrite")}</span>
          </div>
        )}

        <div className="viewer-panes">
          <ListSidebar
            lists={preview.lists}
            counts={counts}
            failed={failedListIds}
            selected={settings.selectedListIds}
            focused={focused}
            onFocus={(id) => {
              setFocused(id);
              setSelectedTaskId(undefined);
            }}
            onToggle={(id, checked) => {
              // 读取失败的清单不能勾选：导出后会变成"空清单"，和本来就空的清单分不清
              if (checked && failedSet.has(id)) return;
              set({
                selectedListIds: checked
                  ? raw.lists.map((l) => l.id).filter((x) => x === id || selected.has(x))
                  : settings.selectedListIds.filter((x) => x !== id),
              });
            }}
            onSelectAll={(checked) =>
              set({
                selectedListIds: checked
                  ? raw.lists.map((l) => l.id).filter((id) => !failedSet.has(id))
                  : [],
              })
            }
          />
          <TaskList
            list={focusedList}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
          />
          <TaskDetail task={selectedTask} timeZone={settings.timeZone} />
        </div>

        <div className="window-foot">
          <span>
            {t("app.limits.heading")} {t("app.limits.text")}
          </span>
        </div>
      </div>

      <section className="export-panel" aria-labelledby="export-heading">
        <p className="eyebrow">{t("app.export.eyebrow")}</p>
        <h2 id="export-heading">{t("app.export.heading")}</h2>

        <div className="options-row">
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
          <div className="option-toggles">
            <label className="option">
              <input
                type="checkbox"
                checked={settings.includeCompleted}
                onChange={(e) => set({ includeCompleted: e.target.checked })}
              />
              {t("app.options.includeCompleted")}
            </label>
            <label className={`option${canDownloadAttachments ? "" : " disabled"}`}>
              <input
                type="checkbox"
                checked={canDownloadAttachments && settings.downloadAttachments}
                disabled={!canDownloadAttachments}
                onChange={(e) => set({ downloadAttachments: e.target.checked })}
              />
              <span>
                {t("app.options.attachments")}
                {attachmentsHint && <span className="hint block">{attachmentsHint}</span>}
              </span>
            </label>
          </div>
        </div>

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
      </section>

      <div className="export-bar">
        {error && (
          <div className="inline-error" role="alert">
            <p>{error.text}</p>
            {error.signInAgain && (
              <button
                type="button"
                className="button small"
                disabled={Boolean(busy)}
                onClick={onSignInAgain}
              >
                {t("app.error.signInAgain")}
              </button>
            )}
          </div>
        )}
        <div className="export-bar-inner">
          <p aria-live="polite">
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
            <DownloadIcon />
            {busy ? t("app.export.working") : t("app.export.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
