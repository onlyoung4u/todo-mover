import { LOCALE_STORAGE_KEY, isLocale } from "../i18n/locales";

/** 用户点击语言链接时记住选择，下次访问根路径时直接跳转到该语言。 */
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest<HTMLAnchorElement>("a[data-locale]");
  const locale = link?.dataset.locale;
  if (!locale || !isLocale(locale)) return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 忽略
  }
});
