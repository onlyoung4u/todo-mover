import { describe, expect, it } from "vitest";
import {
  buildGuideLinksByTarget,
  filterAndSortPublishedGuides,
  findGuideLinkForTargetKey,
  getAvailableLocalesForSlug,
  getDefaultLocaleForPage,
  guideGroupOf,
  parseGuideId,
  splitParagraphs,
  type GuideEntryLike,
} from "./guides";

function makeEntry(id: string, overrides: Partial<GuideEntryLike["data"]> = {}): GuideEntryLike {
  return {
    id,
    body: "Body text",
    data: {
      title: `Title ${id}`,
      description: `Description ${id}`,
      answer: `Answer ${id}`,
      updated: new Date("2026-11-20T00:00:00.000Z"),
      steps: [],
      faq: [],
      sources: [],
      order: 100,
      draft: false,
      ...overrides,
    },
  };
}

describe("parseGuideId", () => {
  it("parses valid locale/slug pairs and rejects invalid ones", () => {
    expect(parseGuideId("en/backup-microsoft-to-do")).toEqual({
      lang: "en",
      slug: "backup-microsoft-to-do",
    });
    expect(parseGuideId("zh-CN/migrate-todoist")).toEqual({
      lang: "zh-CN",
      slug: "migrate-todoist",
    });
    expect(parseGuideId("fr/backup")).toBeUndefined();
    expect(parseGuideId("en/nested/slug")).toBeUndefined();
    expect(parseGuideId("backup")).toBeUndefined();
  });
});

describe("filterAndSortPublishedGuides", () => {
  it("excludes drafts and unknown locales and sorts deterministically by order then slug", () => {
    const entries = [
      makeEntry("en/draft-guide", { draft: true, order: 1 }),
      makeEntry("ja/unsupported", { order: 2 }),
      makeEntry("en/z-guide", { order: 20 }),
      makeEntry("zh-CN/a-guide", { order: 20 }),
      makeEntry("en/a-guide", { order: 20 }),
      makeEntry("en/first", { order: 10 }),
    ];

    const published = filterAndSortPublishedGuides(entries);
    expect(published.map((g) => g.id)).toEqual([
      "en/first",
      "en/a-guide",
      "zh-CN/a-guide",
      "en/z-guide",
    ]);
  });
});

describe("available locales and default locale resolution", () => {
  it("returns only locales that have a published guide for the slug", () => {
    const published = filterAndSortPublishedGuides([
      makeEntry("zh-TW/backup"),
      makeEntry("en/backup"),
      makeEntry("zh-CN/backup", { draft: true }),
      makeEntry("zh-CN/cn-only"),
    ]);

    expect(getAvailableLocalesForSlug(published, "backup")).toEqual(["en", "zh-TW"]);
    expect(getAvailableLocalesForSlug(published, "cn-only")).toEqual(["zh-CN"]);
    expect(getAvailableLocalesForSlug(published, "missing")).toEqual([]);
  });

  it("picks English as default when available, otherwise the first available locale", () => {
    expect(getDefaultLocaleForPage(["en", "zh-CN"])).toBe("en");
    expect(getDefaultLocaleForPage(["zh-CN", "zh-TW"])).toBe("zh-CN");
    expect(getDefaultLocaleForPage(["zh-TW"])).toBe("zh-TW");
  });
});

describe("target link mapping", () => {
  it("maps target aliases cleanly and prefers lower order when targets collide", () => {
    const published = filterAndSortPublishedGuides([
      makeEntry("en/backup-first", { target: "backup", order: 10 }),
      makeEntry("en/backup-second", { target: "backup", order: 20 }),
      makeEntry("en/to-obsidian", { target: "Obsidian", order: 30 }),
      makeEntry("en/draft-todoist", { target: "todoist", draft: true, order: 5 }),
    ]);

    const map = buildGuideLinksByTarget(published);
    expect(map).toEqual({
      backup: "/en/guides/backup-first/",
      obsidian: "/en/guides/to-obsidian/",
    });

    expect(findGuideLinkForTargetKey(map, "json")).toBe("/en/guides/backup-first/");
    expect(findGuideLinkForTargetKey(map, "markdown")).toBe("/en/guides/to-obsidian/");
    expect(findGuideLinkForTargetKey(map, "todoist")).toBeUndefined();
    expect(findGuideLinkForTargetKey(map, "things")).toBeUndefined();
  });

  it("groups backup/untagged guides separately from app migration guides", () => {
    const [backup, untagged, todoist] = filterAndSortPublishedGuides([
      makeEntry("en/a", { target: "backup", order: 1 }),
      makeEntry("en/b", { order: 2 }),
      makeEntry("en/c", { target: "todoist", order: 3 }),
    ]);
    expect(guideGroupOf(backup!)).toBe("backup");
    expect(guideGroupOf(untagged!)).toBe("backup");
    expect(guideGroupOf(todoist!)).toBe("migrate");
  });
});

describe("splitParagraphs", () => {
  it("splits plain text on blank lines and trims paragraphs", () => {
    expect(splitParagraphs("  First paragraph.\n\nSecond paragraph.\r\n\r\nThird.  ")).toEqual([
      "First paragraph.",
      "Second paragraph.",
      "Third.",
    ]);
  });
});
