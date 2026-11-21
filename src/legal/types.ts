import type { Locale } from "../i18n/locales";

/** 正文块：段落、列表，或一组外部链接（链接只用于官方页面地址，正文里不嵌入链接）。 */
export type LegalBlock =
  | { p: string }
  | { list: readonly string[] }
  | { links: readonly { label: string; href: string }[] };

export type LegalSection = {
  heading: string;
  blocks: readonly LegalBlock[];
  /** 只在对应配置存在时输出：analytics = PUBLIC_CF_ANALYTICS_TOKEN，donate = 任一打赏链接。 */
  when?: "analytics" | "donate";
  /** 联系方式小节：正文之后由页面追加联系邮箱（PUBLIC_CONTACT_EMAIL）与 GitHub Issues 链接。 */
  contact?: true;
};

export type LegalDoc = {
  title: string;
  description: string;
  lead: string;
  sections: readonly LegalSection[];
};

export type LegalDocs = Record<Locale, LegalDoc>;

/** 隐私声明与服务条款的最后更新日期（UTC，YYYY-MM-DD）。修改正文时同步更新。 */
export const LEGAL_UPDATED = "2026-11-21";
