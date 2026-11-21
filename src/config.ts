import type { Locale } from "./i18n/locales";

/** 构建时注入的公开配置（都不是秘密）。 */
export const config = {
  msalClientId: import.meta.env.PUBLIC_MSAL_CLIENT_ID?.trim() || undefined,
  donateUrlCn: import.meta.env.PUBLIC_DONATE_URL_CN?.trim() || undefined,
  donateUrlGlobal: import.meta.env.PUBLIC_DONATE_URL_GLOBAL?.trim() || undefined,
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN?.trim() || undefined,
  /** 隐私政策与服务条款中的联系邮箱；未配置时只显示 GitHub Issues。 */
  contactEmail: import.meta.env.PUBLIC_CONTACT_EMAIL?.trim() || undefined,
  /** 预发 / PR 预览站防收录开关：为 true 时全站 noindex，跳过 sitemap 与 llms*.txt，响应头追加 X-Robots-Tag。 */
  noindex: import.meta.env.PUBLIC_NOINDEX?.trim().toLowerCase() === "true",
  repoUrl: "https://github.com/onlyoung4u/todo-mover",
  /** 作者主站（Alchemew），页脚署名、隐私声明与完成页"后续工具"入口指向这里。 */
  authorUrl: "https://alchemew.com",
  /** Microsoft To Do 停止服务日期（SPEC 第 1 节）。 */
  shutdownDate: "2027-06-30",
} as const;

/**
 * 作者主站上的对应语言页面。主站英文页不带语言前缀（`/`、`/privacy/`），
 * 中文页为 `/zh-CN/...`、`/zh-TW/...`。`path` 以 `/` 开头，可带 `#` 锚点。
 */
export function authorUrlFor(locale: Locale, path = "/"): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${config.authorUrl}${prefix}${path}`;
}

/** 简体中文显示国内打赏链接，其他语言显示海外链接（SPEC 14.1）。 */
export function donateUrlFor(locale: Locale): string | undefined {
  return locale === "zh-CN" ? config.donateUrlCn : config.donateUrlGlobal;
}
