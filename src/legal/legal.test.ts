import { describe, expect, it } from "vitest";
import { LOCALES } from "../i18n/locales";
import { PRIVACY, TERMS, visibleSections, type LegalDocs } from ".";

const shape = (docs: LegalDocs, locale: (typeof LOCALES)[number]) =>
  docs[locale].sections.map((s) => ({
    when: s.when,
    contact: s.contact,
    blocks: s.blocks.map((b) =>
      "p" in b
        ? "p"
        : "list" in b
          ? `list:${b.list.length}`
          : `links:${b.links.map((l) => l.href).join(",")}`,
    ),
  }));

describe.each([
  ["privacy", PRIVACY],
  ["terms", TERMS],
] as const)("%s", (_, docs) => {
  it.each(LOCALES)("%s has the same structure and links as en", (locale) => {
    expect(shape(docs, locale)).toEqual(shape(docs, "en"));
  });

  it.each(LOCALES)("%s has no empty text", (locale) => {
    const doc = docs[locale];
    const texts = [doc.title, doc.description, doc.lead];
    for (const s of doc.sections) {
      texts.push(s.heading);
      for (const b of s.blocks) {
        if ("p" in b) texts.push(b.p);
        else if ("list" in b) texts.push(...b.list);
        else texts.push(...b.links.map((l) => l.label));
      }
    }
    for (const text of texts) expect(text.trim()).not.toBe("");
  });

  it("ends with exactly one contact section", () => {
    const sections = docs.en.sections;
    expect(sections.filter((s) => s.contact)).toHaveLength(1);
    expect(sections.at(-1)?.contact).toBe(true);
  });
});

describe("visibleSections", () => {
  it("hides conditional sections unless their feature is enabled", () => {
    const off = visibleSections(PRIVACY.en, { analytics: false, donate: false });
    const on = visibleSections(PRIVACY.en, { analytics: true, donate: false });
    expect(off.some((s) => s.when === "analytics")).toBe(false);
    expect(on.some((s) => s.when === "analytics")).toBe(true);
    expect(visibleSections(TERMS.en, { analytics: false, donate: false }).some((s) => s.when)).toBe(
      false,
    );
  });
});
