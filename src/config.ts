import type { Locale } from "./i18n/locales";

/** 构建时注入的公开配置（都不是秘密）。 */
export const config = {
  msalClientId: import.meta.env.PUBLIC_MSAL_CLIENT_ID?.trim() || undefined,
  donateUrlCn: import.meta.env.PUBLIC_DONATE_URL_CN?.trim() || undefined,
  donateUrlGlobal: import.meta.env.PUBLIC_DONATE_URL_GLOBAL?.trim() || undefined,
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN?.trim() || undefined,
  repoUrl: "https://github.com/onlyoung4u/todo-mover",
  /** Microsoft To Do 停止服务日期（SPEC 第 1 节）。 */
  shutdownDate: "2027-06-30",
} as const;

/** 简体中文显示国内打赏链接，其他语言显示海外链接（SPEC 14.1）。 */
export function donateUrlFor(locale: Locale): string | undefined {
  return locale === "zh-CN" ? config.donateUrlCn : config.donateUrlGlobal;
}
