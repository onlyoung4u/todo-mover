import type { APIRoute, GetStaticPaths } from "astro";
import { config } from "../config";
import { getFaqEntries, getPublishedGuides } from "../lib/content";
import { renderLlmsIndex } from "../lib/llms";

/**
 * 构建时生成根目录 /llms.txt 总索引。
 * 使用动态段配合 getStaticPaths，在 PUBLIC_NOINDEX=true 时返回空数组，直接不产出 dist/llms.txt。
 */
export const getStaticPaths: GetStaticPaths = () => {
  if (config.noindex) return [];
  return [{ params: { llms: "llms" } }];
};

export const GET: APIRoute = async ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).href;
  const [guides, faqEntries] = await Promise.all([getPublishedGuides(), getFaqEntries()]);

  const body = renderLlmsIndex({
    siteUrl: origin,
    repoUrl: config.repoUrl,
    shutdownDate: config.shutdownDate,
    guides,
    faqLocales: faqEntries.map((e) => e.lang),
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
