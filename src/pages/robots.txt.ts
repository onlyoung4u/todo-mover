import type { APIRoute } from "astro";

/** 构建时生成 robots.txt，站点地图地址跟随 PUBLIC_SITE_URL。 */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap-index.xml", site).href;
  const body = ["User-agent: *", "Disallow: /auth/", "", `Sitemap: ${sitemap}`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
