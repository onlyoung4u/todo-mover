import type { FetchProgress } from "../../core/graph/fetchAll";
import { useI18n } from "./i18n";

/** 读取进度："清单 3/12，任务 240 条…"（SPEC 3.3） */
export function ReadingScreen({ progress }: { progress?: FetchProgress }) {
  const { t } = useI18n();
  const ratio = progress && progress.listsTotal ? progress.listsDone / progress.listsTotal : 0;
  return (
    <section className="reading" aria-live="polite">
      <h1>{t("app.read.heading")}</h1>
      <progress max={1} value={progress ? ratio : undefined} />
      <p className="muted">
        {progress
          ? t("app.read.progress", {
              done: progress.listsDone,
              total: progress.listsTotal,
              tasks: progress.tasks,
            })
          : t("app.read.starting")}
      </p>
    </section>
  );
}
