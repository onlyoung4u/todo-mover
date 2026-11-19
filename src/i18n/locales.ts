/** 首发语言。新增语言时：在这里加一项，再新增对应的文案文件并在 index.ts 注册。 */
export const LOCALES = ["en", "zh-CN", "zh-TW"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** 语言切换器里显示的名称（用各自语言书写）。 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

/** 记住用户手动选择的语言。这是全站唯一允许写入 localStorage 的数据（SPEC 14.3）。 */
export const LOCALE_STORAGE_KEY = "todo-mover:locale";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * 根据浏览器语言列表挑选最合适的界面语言。
 * 规则：精确匹配 → 中文按地区/书写体系归到简体或繁体 → 主语言匹配 → 默认语言。
 */
export function matchLocale(languages: readonly string[]): Locale {
  for (const raw of languages) {
    const tag = raw.toLowerCase();
    const exact = LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    if (tag === "zh" || tag.startsWith("zh-")) {
      return /^zh-(tw|hk|mo|hant)/.test(tag) ? "zh-TW" : "zh-CN";
    }
    const primary = tag.split("-")[0];
    const byPrimary = LOCALES.find((l) => l.toLowerCase().split("-")[0] === primary);
    if (byPrimary) return byPrimary;
  }
  return DEFAULT_LOCALE;
}
