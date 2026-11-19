import en, { type MessageKey, type Messages } from "./en";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

export * from "./locales";
export type { MessageKey, Messages };

export const MESSAGES: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** 取某种语言的翻译函数。`{name}` 形式的占位符会被 params 替换。 */
export function getTranslator(locale: Locale): Translate {
  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  return (key, params) => {
    const template = messages[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}

/** 生成带语言前缀的站内路径，例如 localizedPath("zh-CN", "/app/") → "/zh-CN/app/"。 */
export function localizedPath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function getLocaleStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}
