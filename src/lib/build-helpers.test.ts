import { describe, expect, it } from "vitest";
import { injectNoindexHeader, isIndexableSitemapUrl, isNoindexEnv } from "./build-helpers.mjs";

describe("isNoindexEnv", () => {
  it("only returns true when explicitly set to true", () => {
    expect(isNoindexEnv("true")).toBe(true);
    expect(isNoindexEnv(" TRUE ")).toBe(true);
    expect(isNoindexEnv("false")).toBe(false);
    expect(isNoindexEnv("")).toBe(false);
    expect(isNoindexEnv(undefined)).toBe(false);
    expect(isNoindexEnv("1")).toBe(false);
  });
});

describe("isIndexableSitemapUrl", () => {
  const locales = ["en", "zh-CN", "zh-TW"];

  it.each([
    "https://example.com/en/",
    "https://example.com/zh-CN/",
    "https://example.com/zh-TW/",
    "https://example.com/en/guides/",
    "https://example.com/zh-CN/guides/backup-microsoft-to-do/",
    "https://example.com/zh-TW/faq/",
  ])("includes indexable page %s", (url) => {
    expect(isIndexableSitemapUrl(url, locales)).toBe(true);
  });

  it.each([
    "https://example.com/",
    "https://example.com/404/",
    "https://example.com/404.html",
    "https://example.com/en/app/",
    "https://example.com/zh-CN/app/",
    "https://example.com/auth/redirect/",
    "https://example.com/en/guides/a/b/",
    "https://example.com/fr/",
  ])("excludes non-indexable page %s", (url) => {
    expect(isIndexableSitemapUrl(url, locales)).toBe(false);
  });
});

describe("injectNoindexHeader", () => {
  it("appends X-Robots-Tag under the /* block without disturbing other blocks", () => {
    const source = [
      "# comment mentioning /*",
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "",
      "/_astro/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
    ].join("\n");

    const updated = injectNoindexHeader(source);
    expect(updated).toBe(
      [
        "# comment mentioning /*",
        "/*",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  X-Robots-Tag: noindex, nofollow",
        "",
        "/_astro/*",
        "  Cache-Control: public, max-age=31536000, immutable",
        "",
      ].join("\n"),
    );
    // 幂等：重复调用不会写入两行
    expect(injectNoindexHeader(updated)).toBe(updated);
  });

  it("throws when /* block is missing", () => {
    expect(() => injectNoindexHeader("/_astro/*\n  Cache-Control: public\n")).toThrow(
      "Could not find '/*' rule block",
    );
  });
});
