import type { APIRoute, GetStaticPaths } from "astro";
import { config } from "../../config";
import { getLocaleStaticPaths, type Locale } from "../../i18n";
import { getFaqForLocale, getPublishedGuidesByLocale } from "../../lib/content";
import { renderLlmsFull } from "../../lib/llms";

/**
 * 构建时生成分语言的 /<lang>/llms-full.txt（只含该语言的已发布指南与 FAQ 全文）。
 * PUBLIC_NOINDEX=true 时返回空数组，不生成任何全文文件，避免预发内容外泄。
 */
export const getStaticPaths: GetStaticPaths = () => {
  if (config.noindex) return [];
  return getLocaleStaticPaths();
};

export const GET: APIRoute = async ({ params, site, url }) => {
  const lang = params.lang as Locale;
  const origin = (site ?? new URL(url.origin)).href;
  const [guides, faqEntry] = await Promise.all([
    getPublishedGuidesByLocale(lang),
    getFaqForLocale(lang),
  ]);

  const body = renderLlmsFull({
    siteUrl: origin,
    repoUrl: config.repoUrl,
    lang,
    guides,
    faq: faqEntry ? { updated: faqEntry.data.updated, items: faqEntry.data.items } : undefined,
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
