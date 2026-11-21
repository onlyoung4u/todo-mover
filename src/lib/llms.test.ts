import { describe, expect, it } from "vitest";
import { filterAndSortPublishedGuides, type GuideEntryLike } from "./guides";
import { renderLlmsFull, renderLlmsIndex } from "./llms";

function sampleEntries(): GuideEntryLike[] {
  return [
    {
      id: "en/backup",
      body: "## Details\n\nEnglish guide body.",
      data: {
        title: "Back up Microsoft To Do",
        description: "Save a JSON backup.",
        answer: "Export todo-backup.json locally.",
        updated: new Date("2026-11-20T00:00:00.000Z"),
        target: "backup",
        steps: [{ name: "Sign in", text: "Sign in with Microsoft." }],
        faq: [{ q: "Offline?", a: "Yes, works offline." }],
        sources: [
          {
            title: "Microsoft",
            url: "https://support.microsoft.com/en-us/planner/to-do-to-planner",
          },
        ],
        order: 10,
        draft: false,
      },
    },
    {
      id: "zh-CN/backup",
      body: "## 详情\n\n简体中文正文。",
      data: {
        title: "备份 Microsoft To Do",
        description: "保存 JSON 备份。",
        answer: "在浏览器本地导出 todo-backup.json。",
        updated: new Date("2026-11-20T00:00:00.000Z"),
        target: "backup",
        steps: [],
        faq: [],
        sources: [],
        order: 10,
        draft: false,
      },
    },
    {
      id: "en/secret-draft",
      body: "Top secret draft body",
      data: {
        title: "Secret Draft",
        description: "Should never appear.",
        answer: "Draft answer.",
        updated: new Date("2026-11-20T00:00:00.000Z"),
        steps: [],
        faq: [],
        sources: [],
        order: 1,
        draft: true,
      },
    },
  ];
}

describe("renderLlmsIndex", () => {
  it("lists all locales, entry links, and published guides without drafts or body text", () => {
    const guides = filterAndSortPublishedGuides(sampleEntries());
    const txt = renderLlmsIndex({
      siteUrl: "https://todomover.example.com",
      repoUrl: "https://github.com/onlyoung4u/todo-mover",
      shutdownDate: "2027-06-30",
      guides,
      faqLocales: ["en", "zh-CN", "zh-TW"],
    });

    expect(txt).toContain("# To Do Mover");
    expect(txt).toContain("https://todomover.example.com/en/llms-full.txt");
    expect(txt).toContain("https://todomover.example.com/zh-CN/llms-full.txt");
    expect(txt).toContain("https://todomover.example.com/zh-TW/llms-full.txt");
    expect(txt).toContain(
      "- [Back up Microsoft To Do](https://todomover.example.com/en/guides/backup/): Save a JSON backup.",
    );
    expect(txt).toContain(
      "- [备份 Microsoft To Do](https://todomover.example.com/zh-CN/guides/backup/): 保存 JSON 备份。",
    );
    expect(txt).not.toContain("Secret Draft");
    expect(txt).not.toContain("English guide body.");
  });
});

describe("renderLlmsFull", () => {
  it("only includes content for the requested locale and excludes drafts", () => {
    const guides = filterAndSortPublishedGuides(sampleEntries());
    const enFull = renderLlmsFull({
      siteUrl: "https://todomover.example.com",
      repoUrl: "https://github.com/onlyoung4u/todo-mover",
      lang: "en",
      guides,
      faq: {
        updated: new Date("2026-11-20T00:00:00.000Z"),
        items: [{ q: "Is it free?", a: "Yes, completely free." }],
      },
    });

    expect(enFull).toContain("## Back up Microsoft To Do");
    expect(enFull).toContain("Updated: 2026-11-20");
    expect(enFull).toContain("English guide body.");
    expect(enFull).toContain("1. **Sign in**: Sign in with Microsoft.");
    expect(enFull).toContain("### Is it free?");
    expect(enFull).toContain("Yes, completely free.");

    // 不能混入其他语言或草稿
    expect(enFull).not.toContain("简体中文正文");
    expect(enFull).not.toContain("备份 Microsoft To Do");
    expect(enFull).not.toContain("Secret Draft");
    expect(enFull).not.toContain("Top secret draft body");
  });
});
