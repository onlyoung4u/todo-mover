// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "PUBLIC_");
const site = env.PUBLIC_SITE_URL || "http://localhost:4321";
const analyticsEnabled = Boolean(env.PUBLIC_CF_ANALYTICS_TOKEN);

// 与 src/i18n/locales.ts 保持一致（配置文件里不能直接 import TS）
const locales = { en: "en", "zh-CN": "zh-CN", "zh-TW": "zh-TW" };

// CSP 说明（见 SPEC 第 9 节）：
// Astro 会生成内联脚本 / 样式（island 激活等），由 Astro 计算哈希后写入每页的 <meta> CSP。
// 因此 script-src / style-src / default-src 只在这里声明，public/_headers 中的 CSP
// 只保留 <meta> 无法表达的 frame-ancestors 等指令，避免两条策略叠加后拦截内联脚本。
const cfAnalytics = analyticsEnabled ? ["https://static.cloudflareinsights.com"] : [];
const cfBeacon = analyticsEnabled ? " https://cloudflareinsights.com" : "";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
    inlineStylesheets: "never",
  },
  integrations: [
    react(),
    sitemap({
      i18n: { defaultLocale: "en", locales },
      // 只收录各语言落地页：根路径是跳转页，/app/ 与 /auth/ 不需要被搜索引擎收录
      filter: (page) => /^\/[^/]+\/$/.test(new URL(page).pathname),
    }),
  ],
  markdown: {
    // Shiki 依赖内联样式，与 CSP 冲突；本站没有代码高亮需求
    syntaxHighlight: false,
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        `connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com${cfBeacon}`,
        // 个人账号的静默续期 iframe 可能从 login.microsoftonline.com 跳转到 login.live.com，
        // 最后回到本站的 /auth/redirect/，所以也要允许同源
        "frame-src 'self' https://login.microsoftonline.com https://login.live.com",
        "img-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", ...cfAnalytics] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  vite: {
    build: {
      // 不把小脚本内联进 HTML，配合 CSP
      assetsInlineLimit: 0,
    },
  },
});
