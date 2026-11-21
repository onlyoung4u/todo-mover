import { describe, expect, it } from "vitest";
import { buildFaqJsonLd, buildGuideJsonLd, buildLandingJsonLd, serializeJsonLd } from "./jsonld";

describe("serializeJsonLd", () => {
  it("escapes < as \\u003c to prevent closing script tags", () => {
    const out = serializeJsonLd({
      headline: "</script><script>alert(1)</script><!-- test -->",
    });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out)).toEqual({
      headline: "</script><script>alert(1)</script><!-- test -->",
    });
  });
});

describe("buildLandingJsonLd", () => {
  it("outputs WebSite and SoftwareApplication in @graph", () => {
    const ld = buildLandingJsonLd({
      siteUrl: "https://todomover.example.com",
      pageUrl: "https://todomover.example.com/en/",
      lang: "en",
      siteName: "To Do Mover",
      description: "Export Microsoft To Do tasks in your browser.",
      repoUrl: "https://github.com/onlyoung4u/todo-mover",
      faqUrl: "https://todomover.example.com/en/faq/",
    });

    const graph = ld["@graph"] as Record<string, unknown>[];
    expect(ld["@context"]).toBe("https://schema.org");
    expect(graph.map((n) => n["@type"])).toEqual(["WebSite", "SoftwareApplication"]);
    expect(graph[0]).toMatchObject({
      "@type": "WebSite",
      url: "https://todomover.example.com/",
      inLanguage: "en",
    });
    expect(graph[1]).toMatchObject({
      "@type": "SoftwareApplication",
      url: "https://todomover.example.com/en/",
      isAccessibleForFree: true,
      softwareHelp: "https://todomover.example.com/en/faq/",
    });
  });
});

describe("buildGuideJsonLd", () => {
  const baseInput = {
    siteUrl: "https://todomover.example.com",
    pageUrl: "https://todomover.example.com/zh-CN/guides/backup-microsoft-to-do/",
    lang: "zh-CN" as const,
    siteName: "To Do 搬家",
    title: "备份 Microsoft To Do",
    description: "导出完整 JSON 备份",
    answer: "登录后选择 JSON 格式导出。",
    updated: new Date("2026-11-20T00:00:00.000Z"),
    sources: [
      { title: "Microsoft", url: "https://support.microsoft.com/en-us/planner/to-do-to-planner" },
    ],
    breadcrumbs: [
      { name: "首页", url: "https://todomover.example.com/zh-CN/" },
      { name: "指南", url: "https://todomover.example.com/zh-CN/guides/" },
      {
        name: "备份 Microsoft To Do",
        url: "https://todomover.example.com/zh-CN/guides/backup-microsoft-to-do/",
      },
    ],
  };

  it("includes TechArticle, BreadcrumbList, HowTo, and FAQPage when steps and faq are non-empty", () => {
    const ld = buildGuideJsonLd({
      ...baseInput,
      steps: [
        { name: "登录", text: "用微软账号登录" },
        { name: "导出", text: "下载 JSON 备份" },
      ],
      faq: [{ q: "安全吗？", a: "纯前端运行。\n\n不经过服务器。" }],
    });

    const graph = ld["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual([
      "TechArticle",
      "BreadcrumbList",
      "HowTo",
      "FAQPage",
    ]);
    expect(graph[0]).toMatchObject({
      "@type": "TechArticle",
      dateModified: "2026-11-20",
      inLanguage: "zh-CN",
    });
    expect(graph[2]).toMatchObject({
      "@type": "HowTo",
      step: [
        { "@type": "HowToStep", position: 1, name: "登录", text: "用微软账号登录" },
        { "@type": "HowToStep", position: 2, name: "导出", text: "下载 JSON 备份" },
      ],
    });
    expect(graph[3]).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "安全吗？",
          acceptedAnswer: { "@type": "Answer", text: "纯前端运行。\n\n不经过服务器。" },
        },
      ],
    });
  });

  it("omits HowTo and FAQPage nodes when steps and faq arrays are empty", () => {
    const ld = buildGuideJsonLd({
      ...baseInput,
      steps: [],
      faq: [],
    });

    const graph = ld["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual(["TechArticle", "BreadcrumbList"]);
  });

  it("uses UTC date for dateModified regardless of hour near midnight", () => {
    const ld = buildGuideJsonLd({
      ...baseInput,
      updated: new Date("2026-11-20T00:30:00.000Z"),
      steps: [],
      faq: [],
    });
    const graph = ld["@graph"] as Record<string, unknown>[];
    expect(graph[0]?.["dateModified"]).toBe("2026-11-20");
  });
});

describe("buildFaqJsonLd", () => {
  it("builds FAQPage with UTC dateModified and BreadcrumbList", () => {
    const ld = buildFaqJsonLd({
      pageUrl: "https://todomover.example.com/en/faq/",
      lang: "en",
      title: "FAQ",
      description: "Common questions",
      updated: new Date("2026-11-20T00:00:00.000Z"),
      items: [{ q: "Q1?", a: "A1.\n" }],
      breadcrumbs: [
        { name: "Home", url: "https://todomover.example.com/en/" },
        { name: "FAQ", url: "https://todomover.example.com/en/faq/" },
      ],
    });

    const graph = ld["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual(["FAQPage", "BreadcrumbList"]);
    expect(graph[0]).toMatchObject({
      "@type": "FAQPage",
      dateModified: "2026-11-20",
      mainEntity: [
        {
          "@type": "Question",
          name: "Q1?",
          acceptedAnswer: { "@type": "Answer", text: "A1." },
        },
      ],
    });
  });
});
