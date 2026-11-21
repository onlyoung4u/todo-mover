import type { ExporterId } from "../core/exporters/types";
import { DEFAULT_LOCALE, LOCALES, isLocale, localizedPath, type Locale } from "../i18n";

export interface QaItem {
  q: string;
  a: string;
}

export interface GuideStep {
  name: string;
  text: string;
}

export interface GuideSource {
  title: string;
  url: string;
}

export interface GuideData {
  title: string;
  description: string;
  answer: string;
  updated: Date;
  target?: string;
  steps: GuideStep[];
  faq: QaItem[];
  sources: GuideSource[];
  order: number;
  draft: boolean;
}

export interface GuideEntryLike {
  id: string;
  body?: string;
  data: GuideData;
}

export interface PublishedGuide<T extends GuideEntryLike = GuideEntryLike> {
  id: string;
  lang: Locale;
  slug: string;
  entry: T;
  data: GuideData;
  body: string;
}

/** 解析 `<语言>/<slug>` 形式的指南 ID；不合法或语言不在 LOCALES 中时返回 undefined。 */
export function parseGuideId(id: string): { lang: Locale; slug: string } | undefined {
  const parts = id.split("/");
  if (parts.length !== 2) return undefined;
  const [lang, slug] = parts;
  if (!lang || !slug || !isLocale(lang)) return undefined;
  return { lang, slug };
}

/**
 * 统一的草稿过滤与排序逻辑：
 * - 排除 `draft: true`；
 * - 排除语言不在 LOCALES 中或路径格式异常的条目；
 * - 按 `order` 升序排列，同序按 `slug` 字典序稳定排序。
 */
export function filterAndSortPublishedGuides<T extends GuideEntryLike>(
  entries: readonly T[],
): PublishedGuide<T>[] {
  const result: PublishedGuide<T>[] = [];
  for (const entry of entries) {
    if (entry.data.draft) continue;
    const parsed = parseGuideId(entry.id);
    if (!parsed) continue;
    result.push({
      id: entry.id,
      lang: parsed.lang,
      slug: parsed.slug,
      entry,
      data: entry.data,
      body: entry.body ?? "",
    });
  }
  return result.sort((a, b) => {
    const orderDiff = a.data.order - b.data.order;
    if (orderDiff !== 0) return orderDiff;
    const slugDiff = a.slug.localeCompare(b.slug, "en");
    if (slugDiff !== 0) return slugDiff;
    return LOCALES.indexOf(a.lang) - LOCALES.indexOf(b.lang);
  });
}

/** 返回同一 slug 在已发布指南中实际拥有的语言列表（按 LOCALES 顺序）。 */
export function getAvailableLocalesForSlug(
  guides: readonly PublishedGuide[],
  slug: string,
): Locale[] {
  const available = new Set(guides.filter((g) => g.slug === slug).map((g) => g.lang));
  return LOCALES.filter((l) => available.has(l));
}

/**
 * 计算某个页面的默认语言（用于非落地页的 hreflang="x-default"）：
 * 有英文版用英文版，否则取第一个可用语言。
 */
export function getDefaultLocaleForPage(availableLocales: readonly Locale[]): Locale {
  if (availableLocales.includes(DEFAULT_LOCALE)) return DEFAULT_LOCALE;
  return availableLocales[0] ?? DEFAULT_LOCALE;
}

/** 归一化 target 字符串，便于大小写无关匹配 */
export function normalizeTarget(target: string | undefined): string | undefined {
  const trimmed = target?.trim().toLowerCase();
  return trimmed || undefined;
}

/** 导出格式 / 目标卡片到指南 `target` 字段的匹配别名（按优先级排列）。 */
export const FORMAT_TARGET_ALIASES: Record<ExporterId | "ticktick", readonly string[]> = {
  json: ["backup", "json"],
  csv: ["csv", "excel"],
  markdown: ["obsidian", "markdown"],
  ics: ["ics", "thunderbird", "nextcloud"],
  todoist: ["todoist"],
  things: ["things"],
  ticktick: ["ticktick"],
};

/** 从某个语言的已发布指南里，按 target 建立 `target -> 指南路径` 映射（同 target 取 order 最前的）。 */
export function buildGuideLinksByTarget(guides: readonly PublishedGuide[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const guide of guides) {
    const target = normalizeTarget(guide.data.target);
    if (!target || target in map) continue;
    map[target] = localizedPath(guide.lang, `/guides/${guide.slug}/`);
  }
  return map;
}

/** 根据导出格式或目标应用 ID 查找对应的站内指南链接（没有时返回 undefined）。 */
export function findGuideLinkForTargetKey(
  guideLinks: Readonly<Record<string, string>> | undefined,
  key: ExporterId | "ticktick",
): string | undefined {
  if (!guideLinks) return undefined;
  for (const alias of FORMAT_TARGET_ALIASES[key]) {
    if (guideLinks[alias]) return guideLinks[alias];
  }
  return undefined;
}

/** 将 FAQ 纯文本答案按空行切分为段落。 */
export function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** 判断一篇指南属于"备份与基础"还是"迁移到特定应用"分组。 */
export function guideGroupOf(guide: PublishedGuide): "backup" | "migrate" {
  const target = normalizeTarget(guide.data.target);
  return !target || target === "backup" || target === "json" ? "backup" : "migrate";
}
