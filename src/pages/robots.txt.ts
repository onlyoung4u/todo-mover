import type { APIRoute } from "astro";
import { config } from "../config";

/**
 * 构建时生成 robots.txt：
 * - 无论是否开启 PUBLIC_NOINDEX，都保持允许抓取（仅 Disallow: /auth/），
 *   确保爬虫能读到页面上的 noindex 与 X-Robots-Tag；
 * - 开启 PUBLIC_NOINDEX=true 时省略 Sitemap 行（且构建期不生成 sitemap-*.xml）。
 */
export const GET: APIRoute = ({ site }) => {
  const lines = ["User-agent: *", "Disallow: /auth/"];
  if (!config.noindex) {
    const sitemap = new URL("/sitemap-index.xml", site).href;
    lines.push("", `Sitemap: ${sitemap}`);
  }
  lines.push("");
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
