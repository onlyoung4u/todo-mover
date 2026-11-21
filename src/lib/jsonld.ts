import type { Locale } from "../i18n";
import { formatUtcDate } from "./dates";
import type { GuideSource, GuideStep, QaItem } from "./guides";

export type JsonLdObject = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * 序列化 JSON-LD：把 `<` 转义为 `\u003c`，防止文案中出现 `</script>` 或 `<!--` 提前闭合脚本标签。
 */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildBreadcrumbNode(items: readonly BreadcrumbItem[]): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    ...buildBreadcrumbNode(items),
  };
}

export interface LandingJsonLdInput {
  siteUrl: string;
  pageUrl: string;
  lang: Locale;
  siteName: string;
  description: string;
  repoUrl: string;
  faqUrl?: string;
}

/** 落地页 JSON-LD：WebSite + SoftwareApplication。 */
export function buildLandingJsonLd(input: LandingJsonLdInput): JsonLdObject {
  const origin = new URL("/", input.siteUrl).href;
  const websiteId = `${origin}#website`;

  const website: JsonLdObject = {
    "@type": "WebSite",
    "@id": websiteId,
    url: origin,
    name: input.siteName,
    description: input.description,
    inLanguage: input.lang,
  };

  const app: JsonLdObject = {
    "@type": "SoftwareApplication",
    name: input.siteName,
    description: input.description,
    url: input.pageUrl,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    inLanguage: input.lang,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    sameAs: [input.repoUrl],
    ...(input.faqUrl ? { softwareHelp: input.faqUrl } : {}),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [website, app],
  };
}

export interface GuideJsonLdInput {
  siteUrl: string;
  pageUrl: string;
  lang: Locale;
  siteName: string;
  title: string;
  description: string;
  answer: string;
  updated: Date;
  steps: readonly GuideStep[];
  faq: readonly QaItem[];
  sources: readonly GuideSource[];
  breadcrumbs: readonly BreadcrumbItem[];
}

/**
 * 指南详情页 JSON-LD：
 * - 必选：TechArticle、BreadcrumbList；
 * - 可选：steps 非空时输出 HowTo，faq 非空时输出 FAQPage；为空时不输出对应节点。
 */
export function buildGuideJsonLd(input: GuideJsonLdInput): JsonLdObject {
  const origin = new URL("/", input.siteUrl).href;
  const dateModified = formatUtcDate(input.updated);

  const article: JsonLdObject = {
    "@type": "TechArticle",
    headline: input.title,
    description: input.description,
    abstract: input.answer,
    url: input.pageUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.pageUrl,
    },
    inLanguage: input.lang,
    dateModified,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${origin}#website`,
      name: input.siteName,
      url: origin,
    },
    ...(input.sources.length > 0 ? { citation: input.sources.map((s) => s.url) } : {}),
  };

  const graph: JsonLdObject[] = [article, buildBreadcrumbNode(input.breadcrumbs)];

  if (input.steps.length > 0) {
    graph.push({
      "@type": "HowTo",
      name: input.title,
      description: input.description,
      inLanguage: input.lang,
      step: input.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    });
  }

  if (input.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      inLanguage: input.lang,
      mainEntity: input.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a.trim(),
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export interface FaqJsonLdInput {
  pageUrl: string;
  lang: Locale;
  title: string;
  description: string;
  updated: Date;
  items: readonly QaItem[];
  breadcrumbs?: readonly BreadcrumbItem[];
}

/** 常见问题页 JSON-LD：FAQPage（及可选 BreadcrumbList）。 */
export function buildFaqJsonLd(input: FaqJsonLdInput): JsonLdObject {
  const faqNode: JsonLdObject = {
    "@type": "FAQPage",
    name: input.title,
    description: input.description,
    url: input.pageUrl,
    inLanguage: input.lang,
    dateModified: formatUtcDate(input.updated),
    mainEntity: input.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a.trim(),
      },
    })),
  };

  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    return {
      "@context": "https://schema.org",
      "@graph": [faqNode, buildBreadcrumbNode(input.breadcrumbs)],
    };
  }

  return {
    "@context": "https://schema.org",
    ...faqNode,
  };
}
