import { LOCALES, LOCALE_NAMES, getTranslator, localizedPath, type Locale } from "../i18n";
import { formatUtcDate } from "./dates";
import type { PublishedGuide, QaItem } from "./guides";

export interface LlmsIndexInput {
  siteUrl: string;
  repoUrl: string;
  shutdownDate: string;
  guides: readonly PublishedGuide[];
  faqLocales: readonly Locale[];
}

/**
 * 生成站点根目录 `/llms.txt` 总索引（llmstxt.org 约定）：
 * 包含站点概要、关键事实、各语言入口（首页、导出工具、指南列表、FAQ、分语言 llms-full.txt）
 * 以及已发布指南索引。全文放在 `/<lang>/llms-full.txt`，不在这里混入多语正文。
 */
export function renderLlmsIndex(input: LlmsIndexInput): string {
  const abs = (p: string) => new URL(p, input.siteUrl).href;
  const faqSet = new Set(input.faqLocales);

  const lines: string[] = [
    "# To Do Mover",
    "",
    `> Free, open-source, browser-only tool to back up and migrate Microsoft To Do lists and tasks to JSON, CSV, Markdown, ICS, Todoist, and Things 3 before the Microsoft To Do apps retire on ${input.shutdownDate}.`,
    "",
    "## Key Facts",
    "",
    `- **Retirement date**: Microsoft To Do apps (Windows, Mac, iOS, Android, Web) retire on ${input.shutdownDate}; underlying To Do services and APIs retire on separate, later dates.`,
    "- **Privacy**: Static site with no backend. Tasks are read in the browser, kept only in memory, and communicate directly with `login.microsoftonline.com` and `graph.microsoft.com`. Sign-in tokens stay in `sessionStorage` and are cleared when the tab closes.",
    "- **Export formats**: Lossless JSON backup (`todo-backup.json`, reusable offline without signing in), CSV spreadsheet, Markdown (Obsidian Tasks or plain text), ICS calendar tasks (Thunderbird, Nextcloud Tasks, CalDAV), Todoist CSV, and Things 3 (`things:///` links + JSON).",
    "- **Known Graph API limits**: Microsoft Graph does not expose My Day (temporary view) or list groups (folders); all lists are exported flat.",
    `- **License & source**: AGPL-3.0 · ${input.repoUrl}`,
    "",
    "## Languages & Entry Points",
    "",
  ];

  for (const lang of LOCALES) {
    const name = LOCALE_NAMES[lang];
    lines.push(`### ${name} (${lang})`);
    lines.push("");
    lines.push(`- [Home](${abs(localizedPath(lang))})`);
    lines.push(`- [Export tool](${abs(localizedPath(lang, "/app/"))})`);
    lines.push(`- [Guides](${abs(localizedPath(lang, "/guides/"))})`);
    if (faqSet.has(lang)) {
      lines.push(`- [FAQ](${abs(localizedPath(lang, "/faq/"))})`);
    }
    lines.push(`- [Full text for LLMs (${lang})](${abs(localizedPath(lang, "/llms-full.txt"))})`);
    lines.push("");
  }

  lines.push("## Guides");
  lines.push("");

  let hasAnyGuide = false;
  for (const lang of LOCALES) {
    const langGuides = input.guides.filter((g) => g.lang === lang);
    if (langGuides.length === 0) continue;
    hasAnyGuide = true;
    lines.push(`### ${LOCALE_NAMES[lang]} (${lang})`);
    lines.push("");
    for (const guide of langGuides) {
      const url = abs(localizedPath(lang, `/guides/${guide.slug}/`));
      lines.push(`- [${guide.data.title}](${url}): ${guide.data.description}`);
    }
    lines.push("");
  }

  if (!hasAnyGuide) {
    lines.push("No published guides available.");
    lines.push("");
  }

  return lines.join("\n");
}

export interface LlmsFullFaq {
  updated: Date;
  items: readonly QaItem[];
}

export interface LlmsFullInput {
  siteUrl: string;
  repoUrl: string;
  lang: Locale;
  guides: readonly PublishedGuide[];
  faq?: LlmsFullFaq;
}

/**
 * 生成单语言的 `/<lang>/llms-full.txt` 全文：
 * 只包含该语言的已发布指南全文和该语言 FAQ，绝不混入其他语言或草稿。
 */
export function renderLlmsFull(input: LlmsFullInput): string {
  const abs = (p: string) => new URL(p, input.siteUrl).href;
  const t = getTranslator(input.lang);
  const langGuides = input.guides.filter((g) => g.lang === input.lang);

  const lines: string[] = [
    `# ${t("site.name")} (${input.lang})`,
    "",
    `> ${t("site.description")}`,
    "",
    `- Home: ${abs(localizedPath(input.lang))}`,
    `- Tool: ${abs(localizedPath(input.lang, "/app/"))}`,
    `- Guides: ${abs(localizedPath(input.lang, "/guides/"))}`,
    ...(input.faq ? [`- FAQ: ${abs(localizedPath(input.lang, "/faq/"))}`] : []),
    `- Source: ${input.repoUrl}`,
    "",
  ];

  for (const guide of langGuides) {
    const url = abs(localizedPath(input.lang, `/guides/${guide.slug}/`));
    const updated = formatUtcDate(guide.data.updated);

    lines.push("---");
    lines.push("");
    lines.push(`## ${guide.data.title}`);
    lines.push("");
    lines.push(`- URL: ${url}`);
    lines.push(`- Updated: ${updated}`);
    if (guide.data.target) {
      lines.push(`- Target: ${guide.data.target}`);
    }
    lines.push("");
    lines.push(`> ${guide.data.answer}`);
    lines.push("");

    if (guide.data.steps.length > 0) {
      lines.push(`### ${t("guides.stepsHeading")}`);
      lines.push("");
      guide.data.steps.forEach((step, idx) => {
        lines.push(`${idx + 1}. **${step.name}**: ${step.text}`);
      });
      lines.push("");
    }

    const body = guide.body.trim();
    if (body) {
      lines.push(body);
      lines.push("");
    }

    if (guide.data.faq.length > 0) {
      lines.push(`### ${t("guides.faqHeading")}`);
      lines.push("");
      for (const item of guide.data.faq) {
        lines.push(`#### ${item.q}`);
        lines.push("");
        lines.push(item.a.trim());
        lines.push("");
      }
    }

    if (guide.data.sources.length > 0) {
      lines.push(`### ${t("guides.sourcesHeading")}`);
      lines.push("");
      for (const source of guide.data.sources) {
        lines.push(`- [${source.title}](${source.url})`);
      }
      lines.push("");
    }
  }

  if (input.faq && input.faq.items.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${t("faq.heading")}`);
    lines.push("");
    lines.push(`- URL: ${abs(localizedPath(input.lang, "/faq/"))}`);
    lines.push(`- Updated: ${formatUtcDate(input.faq.updated)}`);
    lines.push("");
    for (const item of input.faq.items) {
      lines.push(`### ${item.q}`);
      lines.push("");
      lines.push(item.a.trim());
      lines.push("");
    }
  }

  return lines.join("\n");
}
