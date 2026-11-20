import { describe, expect, it } from "vitest";
import { LOCALES, MESSAGES, getTranslator, localizedPath, matchLocale } from ".";

describe("messages", () => {
  const enKeys = Object.keys(MESSAGES.en).sort();

  it.each(LOCALES)("%s has exactly the same keys as en", (locale) => {
    expect(Object.keys(MESSAGES[locale]).sort()).toEqual(enKeys);
  });

  it.each(LOCALES)("%s has no empty strings", (locale) => {
    for (const [key, value] of Object.entries(MESSAGES[locale])) {
      expect(value.trim(), key).not.toBe("");
    }
  });
});

describe("getTranslator", () => {
  it("substitutes params", () => {
    expect(getTranslator("zh-CN")("app.window.stats", { lists: 2, tasks: 42 })).toBe(
      "2 个清单 · 42 个任务",
    );
    expect(getTranslator("en")("landing.stepLabel", { n: "01" })).toBe("Step 01");
  });
});

describe("matchLocale", () => {
  it.each([
    [["zh-CN"], "zh-CN"],
    [["zh"], "zh-CN"],
    [["zh-SG"], "zh-CN"],
    [["zh-Hans-CN"], "zh-CN"],
    [["zh-TW"], "zh-TW"],
    [["zh-HK"], "zh-TW"],
    [["zh-Hant"], "zh-TW"],
    [["en-GB"], "en"],
    [["fr-FR", "zh-TW"], "zh-TW"],
    [["fr-FR"], "en"],
    [[], "en"],
  ] as const)("%j → %s", (languages, expected) => {
    expect(matchLocale(languages)).toBe(expected);
  });
});

describe("localizedPath", () => {
  it("prefixes the locale", () => {
    expect(localizedPath("zh-TW")).toBe("/zh-TW/");
    expect(localizedPath("en", "/app/")).toBe("/en/app/");
    expect(localizedPath("en", "app/")).toBe("/en/app/");
  });
});
