import { LOCALE_STORAGE_KEY, isLocale } from "../i18n/locales";

/**
 * 用户点击语言链接时：
 * - 记住选择，下次访问根路径时直接跳转到该语言；
 * - 在导出工具页切换时保留查询参数（例如 ?mode=demo），切换后仍停留在同一模式。
 */
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest<HTMLAnchorElement>("a[data-locale]");
  const locale = link?.dataset.locale;
  if (!link || !locale || !isLocale(locale)) return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 忽略
  }
  const sameKindOfPage =
    new URL(link.href).pathname.endsWith("/app/") && location.pathname.endsWith("/app/");
  if (sameKindOfPage && location.search && !new URL(link.href).search) {
    link.href = `${link.href}${location.search}`;
  }
});
