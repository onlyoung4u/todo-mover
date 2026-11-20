/** Markdown：Obsidian / Logseq / Notion / 任意笔记（SPEC 7.3）。 */
import { getTranslator, type Translate } from "../../i18n";
import { describe, hasEnd, toObsidianTasks } from "../model/recurrence";
import type { Task, TodoList } from "../model/types";
import { uniqueFileNamer } from "./files";
import type { ExportFile, Exporter } from "./types";
import type { Locale } from "../../i18n/locales";

export type MarkdownOptions = {
  /** obsidian：Obsidian Tasks 插件的 emoji 标记；plain：括号说明 */
  style: "obsidian" | "plain";
  /** 合并为单个 todo.md，每个清单一个 # 标题 */
  singleFile: boolean;
};

const MIME = "text/markdown;charset=utf-8";

/** 标题里的换行会打断列表项，替换为空格 */
const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, " ").trim();

/** 分类 → #标签：空格替换为 "-"，去掉会截断标签的标点 */
const toTag = (category: string) => `#${category.trim().replace(/\s+/g, "-").replace(/[#,]/g, "")}`;

function linkLine(title: string | undefined, url: string): string {
  const text = (title || url).replace(/([[\]\\])/g, "\\$1");
  const href = url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${oneLine(text)}](${href})`;
}

function taskLine(task: Task, style: MarkdownOptions["style"], t: Translate, locale: Locale) {
  const done = task.status === "completed";
  let line = `- [${done ? "x" : " "}] ${oneLine(task.title)}`;
  const tags = task.categories.filter((c) => c.trim()).map(toTag);
  if (tags.length) line += ` ${tags.join(" ")}`;

  if (style === "obsidian") {
    // 顺序与 Obsidian Tasks 插件的序列化顺序一致：优先级、重复、开始、截止、完成
    if (task.importance === "high") line += " ⏫";
    if (task.importance === "low") line += " 🔽";
    if (task.recurrence) line += ` 🔁 ${toObsidianTasks(task.recurrence)}`;
    if (task.startDate) line += ` 🛫 ${task.startDate}`;
    if (task.dueDate) line += ` 📅 ${task.dueDate}`;
    if (task.completedDate && done) line += ` ✅ ${task.completedDate}`;
  } else {
    if (task.importance === "high") line += t("markdown.plain.high");
    if (task.importance === "low") line += t("markdown.plain.low");
    if (task.recurrence) {
      line += t("markdown.plain.recurrence", { rule: describe(task.recurrence, locale) });
    }
    if (task.startDate) line += t("markdown.plain.start", { date: task.startDate });
    if (task.dueDate) line += t("markdown.plain.due", { date: task.dueDate });
    if (task.completedDate && done)
      line += t("markdown.plain.completed", { date: task.completedDate });
  }

  const lines = [line];
  // Obsidian Tasks 不支持 "until" / "for N times"：结束条件写在任务下方，提醒手动停止
  if (style === "obsidian" && task.recurrence && hasEnd(task.recurrence)) {
    lines.push(`  > ${t("markdown.recurrenceEnds", { rule: describe(task.recurrence, locale) })}`);
  }
  for (const step of task.steps) {
    lines.push(`  - [${step.checked ? "x" : " "}] ${oneLine(step.title)}`);
  }
  if (task.notes) {
    for (const noteLine of task.notes.split("\n")) {
      lines.push(noteLine ? `  > ${noteLine}` : "  >");
    }
  }
  for (const link of task.links) {
    if (link.url) lines.push(`  ${linkLine(link.title, link.url)}`);
  }
  return lines.join("\n");
}

function listSection(list: TodoList, opts: MarkdownOptions, t: Translate, locale: Locale): string {
  const heading = `# ${oneLine(list.name)}`;
  const body = list.tasks.map((task) => taskLine(task, opts.style, t, locale)).join("\n");
  return body ? `${heading}\n\n${body}\n` : `${heading}\n`;
}

export const markdownExporter: Exporter<MarkdownOptions> = {
  id: "markdown",
  label: "export.markdown.label",
  targets: "export.markdown.targets",
  losses: "export.markdown.losses",
  defaultOptions: { style: "obsidian", singleFile: false },
  run(data, opts, ctx) {
    const t = getTranslator(ctx.locale);
    const sections = data.lists.map((list) => listSection(list, opts, t, ctx.locale));

    let files: ExportFile[];
    if (opts.singleFile) {
      files = [{ path: "todo.md", content: sections.join("\n"), mime: MIME }];
    } else {
      const name = uniqueFileNamer();
      files = data.lists.map((list, i) => ({
        path: name(list.name, ".md"),
        content: sections[i]!,
        mime: MIME,
      }));
    }
    const warnings: string[] = [];
    if (opts.style === "obsidian") {
      const count = data.lists
        .flatMap((l) => l.tasks)
        .filter((task) => task.recurrence && hasEnd(task.recurrence)).length;
      if (count) warnings.push(t("warning.recurrenceEnd", { target: "Obsidian Tasks", count }));
    }
    return { files, warnings };
  },
};
