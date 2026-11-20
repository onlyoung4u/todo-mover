import type { ReactNode } from "react";
import { dateTimeInZone } from "../../core/model/dates";
import { describe } from "../../core/model/recurrence";
import type { Task, TodoList } from "../../core/model/types";
import { formatDisplayDate, formatDisplayDateTime, useI18n } from "./i18n";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  LinkIcon,
  NoteIcon,
  PaperclipIcon,
  RepeatIcon,
  StarIcon,
  StepsIcon,
} from "./icons";

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="meta-item">
      {icon}
      {children}
    </span>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, locale } = useI18n();
  const done = task.status === "completed";
  const checkedSteps = task.steps.filter((s) => s.checked).length;

  return (
    <li>
      <button
        type="button"
        className={`task-row${done ? " done" : ""}${selected ? " selected" : ""}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="task-check" aria-hidden="true">
          {done && <CheckIcon size={11} />}
        </span>
        <span className="task-main">
          <span className="task-title">
            <span className="visually-hidden">{t(`status.${task.status}`)}: </span>
            {task.title}
          </span>
          <span className="task-meta">
            {task.steps.length > 0 && (
              <Meta icon={<StepsIcon />}>
                {checkedSteps}/{task.steps.length}
              </Meta>
            )}
            {task.dueDate && (
              <Meta icon={<CalendarIcon />}>{formatDisplayDate(task.dueDate, locale)}</Meta>
            )}
            {task.recurrence && (
              <Meta icon={<RepeatIcon />}>{describe(task.recurrence, locale)}</Meta>
            )}
            {task.isReminderOn && task.reminderAt && (
              <Meta icon={<BellIcon />}>{formatDisplayDateTime(task.reminderAt, locale)}</Meta>
            )}
            {task.notes && <Meta icon={<NoteIcon />}>{null}</Meta>}
            {task.hasAttachments && (
              <Meta icon={<PaperclipIcon />}>{task.attachments.length || null}</Meta>
            )}
            {task.links.length > 0 && <Meta icon={<LinkIcon />}>{task.links.length}</Meta>}
            {task.categories.map((c) => (
              <span key={c} className="tag">
                {c}
              </span>
            ))}
          </span>
        </span>
        {task.importance === "high" && (
          <span className="task-star" title={t("app.preview.important")}>
            <StarIcon filled />
          </span>
        )}
      </button>
    </li>
  );
}

export function TaskList({
  list,
  selectedTaskId,
  onSelect,
}: {
  list?: TodoList;
  selectedTaskId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  if (!list) return <div className="pane-empty">{t("app.preview.noList")}</div>;
  return (
    <section className="pane tasks-pane" aria-label={list.name}>
      <div className="pane-head">
        <h2>{list.name}</h2>
        <span className="chip">{list.tasks.length}</span>
      </div>
      {list.tasks.length === 0 ? (
        <div className="pane-empty">{t("app.lists.empty")}</div>
      ) : (
        <ul className="task-rows">
          {list.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={task.id === selectedTaskId}
              onSelect={() => onSelect(task.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function TaskDetail({ task, timeZone }: { task?: Task; timeZone: string }) {
  const { t, locale } = useI18n();
  if (!task) return <div className="pane detail-pane pane-empty">{t("app.detail.empty")}</div>;

  const utc = (iso: string) => {
    const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
    return Number.isNaN(ms)
      ? iso
      : formatDisplayDateTime(dateTimeInZone(new Date(ms), timeZone), locale);
  };

  return (
    <section className="pane detail-pane" aria-label={task.title}>
      <div className="detail-status">
        <span className={`chip${task.status === "completed" ? " accent" : ""}`}>
          {t(`status.${task.status}`)}
        </span>
        {task.importance !== "normal" && (
          <span className="chip">{t(`importance.${task.importance}`)}</span>
        )}
      </div>
      <h3 className="detail-title">{task.title}</h3>

      <dl className="detail-fields">
        {task.dueDate && (
          <Field label={t("csv.col.due")}>{formatDisplayDate(task.dueDate, locale)}</Field>
        )}
        {task.startDate && (
          <Field label={t("csv.col.start")}>{formatDisplayDate(task.startDate, locale)}</Field>
        )}
        {task.isReminderOn && task.reminderAt && (
          <Field label={t("csv.col.reminder")}>
            {formatDisplayDateTime(task.reminderAt, locale)}
          </Field>
        )}
        {task.recurrence && (
          <Field label={t("csv.col.recurrence")}>{describe(task.recurrence, locale)}</Field>
        )}
        {task.completedDate && (
          <Field label={t("csv.col.completed")}>
            {formatDisplayDate(task.completedDate, locale)}
          </Field>
        )}
        <Field label={t("csv.col.created")}>{utc(task.createdAt)}</Field>
        <Field label={t("csv.col.modified")}>{utc(task.modifiedAt)}</Field>
        {task.categories.length > 0 && (
          <Field label={t("csv.col.categories")}>
            <span className="tags">
              {task.categories.map((c) => (
                <span key={c} className="tag">
                  {c}
                </span>
              ))}
            </span>
          </Field>
        )}
      </dl>

      {task.steps.length > 0 && (
        <div className="detail-block">
          <h4>{t("csv.col.steps")}</h4>
          <ul className="steps-list">
            {task.steps.map((s) => (
              <li key={s.id} className={s.checked ? "checked" : undefined}>
                <span className="step-check" aria-hidden="true">
                  {s.checked && <CheckIcon size={9} />}
                </span>
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.notes && (
        <div className="detail-block">
          <h4>{t("csv.col.notes")}</h4>
          <p className="detail-notes">{task.notes}</p>
        </div>
      )}

      {task.links.length > 0 && (
        <div className="detail-block">
          <h4>{t("csv.col.links")}</h4>
          <ul className="plain-list">
            {task.links.map((l, i) => (
              <li key={l.url ?? i}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.title || l.url}
                  </a>
                ) : (
                  l.title
                )}
                {l.app && <span className="chip">{l.app}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.hasAttachments && task.attachments.length === 0 && (
        <div className="detail-block">
          <h4>{t("app.detail.attachments")}</h4>
          <p className="muted">{t("app.detail.attachmentsUnknown")}</p>
        </div>
      )}

      {task.attachments.length > 0 && (
        <div className="detail-block">
          <h4>{t("app.detail.attachments")}</h4>
          <ul className="plain-list">
            {task.attachments.map((a) => (
              <li key={a.id}>
                <PaperclipIcon /> {a.name}{" "}
                <span className="muted mono">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
