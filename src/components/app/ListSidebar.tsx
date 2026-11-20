import type { TodoList } from "../../core/model/types";
import { useI18n } from "./i18n";

type Props = {
  lists: TodoList[];
  /** 未按"包含已完成"筛选前的统计（显示清单原本有多少任务） */
  counts: Record<string, { total: number; completed: number }>;
  /** 读取失败的清单 */
  failed: string[];
  selected: string[];
  focused?: string;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onFocus: (id: string) => void;
};

export function ListSidebar({
  lists,
  counts,
  failed,
  selected,
  focused,
  onToggle,
  onSelectAll,
  onFocus,
}: Props) {
  const { t } = useI18n();
  const selectedSet = new Set(selected);

  return (
    <nav className="pane lists-pane" aria-label={t("app.lists.heading")}>
      <div className="pane-head">
        <span className="pane-label">{t("app.lists.heading")}</span>
        <span className="lists-actions">
          <button type="button" className="link-button" onClick={() => onSelectAll(true)}>
            {t("app.lists.selectAll")}
          </button>
          <button type="button" className="link-button" onClick={() => onSelectAll(false)}>
            {t("app.lists.selectNone")}
          </button>
        </span>
      </div>
      <ul className="list-rows">
        {lists.map((list) => {
          const count = counts[list.id] ?? { total: 0, completed: 0 };
          const isFailed = failed.includes(list.id);
          return (
            <li key={list.id} className={list.id === focused ? "focused" : undefined}>
              <input
                type="checkbox"
                checked={!isFailed && selectedSet.has(list.id)}
                disabled={isFailed}
                onChange={(e) => onToggle(list.id, e.target.checked)}
                aria-label={list.name}
              />
              <button
                type="button"
                className="list-name"
                aria-current={list.id === focused ? "true" : undefined}
                onClick={() => onFocus(list.id)}
                title={t("app.lists.count", { tasks: count.total, completed: count.completed })}
              >
                <span className="name">{list.name}</span>
                {(list.wellknown === "flaggedEmails" || list.isShared || isFailed) && (
                  <span className="badges">
                    {isFailed && <span className="badge danger">{t("app.lists.failed")}</span>}
                    {list.wellknown === "flaggedEmails" && (
                      <span className="badge">{t("app.lists.flagged")}</span>
                    )}
                    {list.isShared && <span className="badge">{t("app.lists.shared")}</span>}
                  </span>
                )}
              </button>
              <span className="count mono">{list.tasks.length}</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
