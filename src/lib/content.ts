import { getCollection, type CollectionEntry } from "astro:content";
import { LOCALES, isLocale, type Locale } from "../i18n";
import { filterAndSortPublishedGuides, type PublishedGuide } from "./guides";

export type GuideCollectionEntry = CollectionEntry<"guides">;
export type FaqCollectionEntry = CollectionEntry<"faq">;

/**
 * 所有消费指南的页面和端点（列表页、详情页、hreflang、llms.txt、llms-full.txt、
 * 落地页与完成页入口）必须统一经过这里，确保 `draft: true` 不会出现在任何公开产物中。
 */
export async function getPublishedGuides(): Promise<PublishedGuide<GuideCollectionEntry>[]> {
  const entries = await getCollection("guides");
  return filterAndSortPublishedGuides(entries);
}

/** 取指定语言的已发布指南（已排序且排除草稿）。 */
export async function getPublishedGuidesByLocale(
  locale: Locale,
): Promise<PublishedGuide<GuideCollectionEntry>[]> {
  const all = await getPublishedGuides();
  return all.filter((g) => g.lang === locale);
}

export interface LocalizedFaqEntry {
  lang: Locale;
  entry: FaqCollectionEntry;
}

/** 取所有已配置语言的 FAQ（按 LOCALES 顺序）。 */
export async function getFaqEntries(): Promise<LocalizedFaqEntry[]> {
  const entries = await getCollection("faq");
  const byLang = new Map<Locale, FaqCollectionEntry>();
  for (const entry of entries) {
    if (isLocale(entry.id)) byLang.set(entry.id, entry);
  }
  const result: LocalizedFaqEntry[] = [];
  for (const lang of LOCALES) {
    const entry = byLang.get(lang);
    if (entry) result.push({ lang, entry });
  }
  return result;
}

/** 取指定语言的 FAQ；该语言缺少 FAQ 文件时返回 undefined。 */
export async function getFaqForLocale(locale: Locale): Promise<FaqCollectionEntry | undefined> {
  const entries = await getFaqEntries();
  return entries.find((e) => e.lang === locale)?.entry;
}
