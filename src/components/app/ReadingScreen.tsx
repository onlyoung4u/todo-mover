import type { FetchProgress } from "../../core/graph/fetchAll";
import { useI18n } from "./i18n";
import { LockIcon } from "./icons";

/** 读取进度："清单 3/12，任务 240 条…"（SPEC 3.3） */
export function ReadingScreen({ progress }: { progress?: FetchProgress }) {
  const { t } = useI18n();
  const attachments = progress?.attachments;
  const ratio = attachments
    ? attachments.total
      ? attachments.done / attachments.total
      : 1
    : progress && progress.listsTotal
      ? progress.listsDone / progress.listsTotal
      : 0;
  return (
    <section className="start" aria-live="polite">
      <p className="eyebrow">
        <span className="dot" />
        {t("app.read.eyebrow")}
      </p>
      <h1>{t("app.read.heading")}</h1>
      <div className="window reading">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="chip">graph.microsoft.com</span>
          <span className="spacer" />
          <span className="local">
            <LockIcon />
            {t("landing.local")}
          </span>
        </div>
        <div className="reading-body">
          <progress max={1} value={progress ? ratio : undefined} />
          <p>
            {attachments
              ? t("app.attachments.metadata", { done: attachments.done, total: attachments.total })
              : progress
                ? t("app.read.progress", {
                    done: progress.listsDone,
                    total: progress.listsTotal,
                    tasks: progress.tasks,
                  })
                : t("app.read.starting")}
          </p>
        </div>
      </div>
    </section>
  );
}
