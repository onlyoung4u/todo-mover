// @ts-check
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { loadEnv } from "vite";
import {
  identityAssociationJson,
  injectNoindexHeader,
  isIndexableSitemapUrl,
  isNoindexEnv,
} from "./src/lib/build-helpers.mjs";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "PUBLIC_");
const site = env.PUBLIC_SITE_URL || "http://localhost:4321";
const analyticsEnabled = Boolean(env.PUBLIC_CF_ANALYTICS_TOKEN);
const noindex = isNoindexEnv(env.PUBLIC_NOINDEX);
const identityAssociation = identityAssociationJson(env.PUBLIC_MSAL_CLIENT_ID);

// 与 src/i18n/locales.ts 保持一致（配置文件里不能直接 import TS）
const locales = { en: "en", "zh-CN": "zh-CN", "zh-TW": "zh-TW" };
const localeKeys = Object.keys(locales);

// CSP 说明（见 SPEC 第 9 节）：
// Astro 会生成内联脚本 / 样式（island 激活等），由 Astro 计算哈希后写入每页的 <meta> CSP。
// 因此 script-src / style-src / default-src 只在这里声明，public/_headers 中的 CSP
// 只保留 <meta> 无法表达的 frame-ancestors 等指令，避免两条策略叠加后拦截内联脚本。
const cfAnalytics = analyticsEnabled ? ["https://static.cloudflareinsights.com"] : [];
const cfBeacon = analyticsEnabled ? " https://cloudflareinsights.com" : "";

/**
 * 当 PUBLIC_NOINDEX=true 时，在构建产物 dist/_headers 的 /* 规则下追加
 * `X-Robots-Tag: noindex, nofollow`，兜底覆盖所有静态资源；不改动源码中的 public/_headers。
 *
 * @returns {import("astro").AstroIntegration}
 */
function noindexHeadersIntegration() {
  return {
    name: "todo-mover-noindex-headers",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const headersPath = path.join(fileURLToPath(dir), "_headers");
        const content = await readFile(headersPath, "utf8");
        await writeFile(headersPath, injectNoindexHeader(content), "utf8");
      },
    },
  };
}

/**
 * 配置了 PUBLIC_MSAL_CLIENT_ID 时，生成 Microsoft Entra 发布者域名验证文件
 * dist/.well-known/microsoft-identity-association.json（Azure → Branding → Publisher domain）。
 * 放在构建钩子里而不是 public/，这样每个环境和自部署站点只声明自己的应用 ID。
 *
 * @param {string} json
 * @returns {import("astro").AstroIntegration}
 */
function identityAssociationIntegration(json) {
  return {
    name: "todo-mover-identity-association",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const wellKnown = path.join(fileURLToPath(dir), ".well-known");
        await mkdir(wellKnown, { recursive: true });
        await writeFile(path.join(wellKnown, "microsoft-identity-association.json"), json, "utf8");
      },
    },
  };
}

// 本地通过 CONTENT_DIR=../todo-mover-content 预览私有内容时，允许 Vite 读取外部目录中的配图
const customContentDir = process.env.CONTENT_DIR?.trim();
const fsAllow = customContentDir
  ? [process.cwd(), path.resolve(process.cwd(), customContentDir)]
  : undefined;

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
    ...(!noindex
      ? [
          sitemap({
            i18n: { defaultLocale: "en", locales },
            // 收录各语言落地页、指南页与 FAQ 页；排除 /、/404/、/app/、/auth/
            filter: (page) => isIndexableSitemapUrl(page, localeKeys),
          }),
        ]
      : [noindexHeadersIntegration()]),
    ...(identityAssociation ? [identityAssociationIntegration(identityAssociation)] : []),
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
    ...(fsAllow ? { server: { fs: { allow: fsAllow } } } : {}),
    build: {
      // 不把小脚本内联进 HTML，配合 CSP
      assetsInlineLimit: 0,
    },
  },
});
