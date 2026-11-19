import { LOCALE_STORAGE_KEY, isLocale, matchLocale } from "../i18n/locales";

/** 根路径跳转（SPEC 14.3）：localStorage 中的手动选择 → navigator.languages → /en/。 */
function pickLocale(): string {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // 隐私模式等情况下 localStorage 不可用，忽略
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return matchLocale(languages);
}

location.replace(`/${pickLocale()}/${location.search}${location.hash}`);
