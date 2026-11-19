/**
 * Things 3（macOS / iOS）：生成 things:///json 链接（SPEC 7.6）。
 * 格式依据 Cultured Code "Things URL Scheme" 文档（2026-11 查证）：
 * - 创建数据不需要 auth-token
 * - to-do 支持 creation-date / completion-date（ISO 8601 date-time，未来时间会被忽略）
 * - notes 最长 10,000 字符；checklist-items 最多 100 项
 * - tags 必须已在 Things 中存在，否则会被静默忽略
 * - 要往已有项目里添加 to-do，需要用独立的 to-do 对象并指定 list（项目标题）
 */
import { getTranslator, type Translate } from "../../i18n";
import type { Locale } from "../../i18n/locales";
import { describe } from "../model/recurrence";
import type { Task, TodoList } from "../model/types";
import type { Exporter } from "./types";

export const THINGS_FILE = "things-import.json";
/** 每个链接最多包含的 to-do 数 */
export const THINGS_BATCH_SIZE = 50;
const MAX_NOTES = 10_000;
const MAX_CHECKLIST = 100;

type ThingsChecklistItem = {
  type: "checklist-item";
  attributes: { title: string; completed: boolean };
};

export type ThingsTodo = {
  type: "to-do";
  attributes: {
    title: string;
    notes?: string;
    deadline?: string;
    tags: string[];
    completed: boolean;
    "completion-date"?: string;
    "creation-date"?: string;
    "checklist-items"?: ThingsChecklistItem[];
    /** 只在追加到已有项目时使用 */
    list?: string;
  };
};

export type ThingsProject = {
  type: "project";
  attributes: { title: string; items: ThingsTodo[] };
};

const isoSeconds = (iso: string) => {
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
};

function notesFor(task: Task, t: Translate, locale: Locale): string {
  const extra: string[] = [];
  if (task.startDate) extra.push(`${t("csv.col.start")}: ${task.startDate}`);
  if (task.recurrence) {
    extra.push(`${t("csv.col.recurrence")}: ${describe(task.recurrence, locale)}`);
  }
  if (task.isReminderOn && task.reminderAt) {
    extra.push(`${t("csv.col.reminder")}: ${task.reminderAt.replace("T", " ")}`);
  }
  for (const link of task.links) {
    if (link.url) extra.push(link.title ? `${link.title}: ${link.url}` : link.url);
  }
  return [task.notes, extra.join("\n")].filter(Boolean).join("\n\n");
}

function toThingsTodo(task: Task, t: Translate, locale: Locale, warnings: string[]): ThingsTodo {
  const completed = task.status === "completed";
  let notes = notesFor(task, t, locale);
  if (notes.length > MAX_NOTES) {
    warnings.push(`Task "${task.title}": notes were cut to ${MAX_NOTES} characters for Things`);
    notes = notes.slice(0, MAX_NOTES);
  }
  if (task.steps.length > MAX_CHECKLIST) {
    warnings.push(`Task "${task.title}": only the first ${MAX_CHECKLIST} steps fit in Things`);
  }

  const attributes: ThingsTodo["attributes"] = {
    title: task.title,
    tags: task.categories.filter((c) => c.trim()),
    completed,
  };
  if (notes) attributes.notes = notes;
  if (task.dueDate) attributes.deadline = task.dueDate;
  if (task.steps.length) {
    attributes["checklist-items"] = task.steps.slice(0, MAX_CHECKLIST).map((s) => ({
      type: "checklist-item",
      attributes: { title: s.title, completed: s.checked },
    }));
  }
  const created = isoSeconds(task.createdAt);
  if (created) attributes["creation-date"] = created;
  if (completed && task.completedDate) {
    // To Do 只有完成日期；取 UTC 正午，在 UTC-11 到 UTC+11 的时区里都落在同一天
    attributes["completion-date"] = `${task.completedDate}T12:00:00Z`;
  }
  return { type: "to-do", attributes };
}

export function thingsUrl(items: (ThingsProject | ThingsTodo)[]): string {
  return `things:///json?data=${encodeURIComponent(JSON.stringify(items))}`;
}

function listBatches(list: TodoList, todos: ThingsTodo[], t: Translate) {
  const chunks: ThingsTodo[][] = [];
  for (let i = 0; i < todos.length; i += THINGS_BATCH_SIZE) {
    chunks.push(todos.slice(i, i + THINGS_BATCH_SIZE));
  }
  if (!chunks.length) chunks.push([]);

  return chunks.map((chunk, i) => {
    // 第一批创建项目；之后的批次作为独立 to-do 追加到同名项目中，避免出现多个同名项目
    const items: (ThingsProject | ThingsTodo)[] =
      i === 0
        ? [{ type: "project", attributes: { title: list.name, items: chunk } }]
        : chunk.map((todo) => ({ ...todo, attributes: { ...todo.attributes, list: list.name } }));
    const label =
      chunks.length > 1
        ? t("things.batch", { name: list.name, index: i + 1, total: chunks.length })
        : list.name;
    return { label, url: thingsUrl(items) };
  });
}

export const thingsExporter: Exporter<Record<string, never>> = {
  id: "things",
  label: "export.things.label",
  targets: "export.things.targets",
  losses: "export.things.losses",
  defaultOptions: {},
  run(data, _opts, ctx) {
    const t = getTranslator(ctx.locale);
    const warnings: string[] = [];
    const projects: ThingsProject[] = [];
    const links: { label: string; url: string }[] = [];

    for (const list of data.lists) {
      const todos = list.tasks.map((task) => toThingsTodo(task, t, ctx.locale, warnings));
      projects.push({ type: "project", attributes: { title: list.name, items: todos } });
      links.push(...listBatches(list, todos, t));
    }

    return {
      files: [
        {
          path: THINGS_FILE,
          content: JSON.stringify(projects, null, 2) + "\n",
          mime: "application/json",
        },
      ],
      links,
      warnings,
    };
  },
};
