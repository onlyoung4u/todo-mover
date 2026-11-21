import { describe, expect, it } from "vitest";
import { authorUrlFor } from "./config";

describe("authorUrlFor", () => {
  it("uses no prefix for English, matching the main site's routes", () => {
    expect(authorUrlFor("en")).toBe("https://alchemew.com/");
    expect(authorUrlFor("en", "/privacy/")).toBe("https://alchemew.com/privacy/");
  });

  it("prefixes Chinese locales and keeps anchors", () => {
    expect(authorUrlFor("zh-CN", "/privacy/")).toBe("https://alchemew.com/zh-CN/privacy/");
    expect(authorUrlFor("zh-TW", "/#contact")).toBe("https://alchemew.com/zh-TW/#contact");
  });
});
