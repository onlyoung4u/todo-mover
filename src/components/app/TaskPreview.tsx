import { describe } from "../../core/model/recurrence";
import type { Task, TodoList } from "../../core/model/types";
import { formatDisplayDate, formatDisplayDateTime, useI18n } from "./i18n";

function TaskItem({ task }: { task: Task }) {
  const { t, locale } = useI18n();
  const done = task.status === "completed";
  const checkedSteps = task.steps.filter((s) => s.checked).length;

  const meta: string[] = [];
  if (task.steps.length) {
    meta.push(t("app.preview.steps", { done: checkedSteps, total: task.steps.length }));
  }
  if (task.dueDate)
    meta.push(t("app.preview.due", { date: formatDisplayDate(task.dueDate, locale) }));
  if (task.recurrence) meta.push(describe(task.recurrence, locale));
  if (task.isReminderOn && task.reminderAt) {
    meta.push(t("app.preview.reminder", { time: formatDisplayDateTime(task.reminderAt, locale) }));
  }
  if (task.attachments.length) {
    meta.push(t("app.preview.attachments", { count: task.attachments.length }));
  }
  if (task.links.length) meta.push(t("app.preview.links", { count: task.links.length }));

  return (
    <li className={`task${done ? " done" : ""}`}>
      <span className="task-check" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <div className="task-body">
        <div className="task-title">
          <span className="visually-hidden">
            {done ? t("status.completed") : t("status.notStarted")}:{" "}
          </span>
          {task.title}
        </div>
        {meta.length > 0 && <div className="task-meta">{meta.join(" · ")}</div>}
        {task.categories.length > 0 && (
          <div className="task-tags">
            {task.categories.map((c) => (
              <span key={c} className="badge">
                {c}
              </span>
            ))}
          </div>
        )}
        {task.notes && <p className="task-notes">{task.notes}</p>}
      </div>
      {task.importance === "high" && (
        <span className="task-star" title={t("app.preview.important")}>
          ★<span className="visually-hidden">{t("app.preview.important")}</span>
        </span>
      )}
    </li>
  );
}

export function TaskPreview({ list }: { list?: TodoList }) {
  const { t } = useI18n();
  if (!list) return <p className="muted preview-empty">{t("app.preview.noList")}</p>;
  return (
    <section className="preview" aria-label={list.name}>
      <h2>{list.name}</h2>
      {list.tasks.length === 0 ? (
        <p className="muted">{t("app.lists.empty")}</p>
      ) : (
        <ul className="tasks">
          {list.tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}
