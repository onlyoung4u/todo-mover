import { describe, expect, it } from "vitest";
import { sanitizeFileName, uniqueFileNamer } from "./files";

describe("sanitizeFileName", () => {
  it("replaces illegal characters and keeps emoji and CJK", () => {
    expect(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
    expect(sanitizeFileName("🐶Baby购物清单")).toBe("🐶Baby购物清单");
  });

  it("handles empty, reserved and trailing-dot names", () => {
    expect(sanitizeFileName("   ")).toBe("untitled");
    expect(sanitizeFileName("CON")).toBe("CON_");
    expect(sanitizeFileName("notes. ")).toBe("notes");
  });

  it("limits very long names without splitting characters", () => {
    const name = sanitizeFileName("任务".repeat(200));
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(200);
    expect(name).toMatch(/^(任务)+任?$/);
  });
});

describe("uniqueFileNamer", () => {
  it("appends (2), (3) to duplicates, case-insensitively", () => {
    const name = uniqueFileNamer();
    expect(name("Tasks", ".md")).toBe("Tasks.md");
    expect(name("tasks", ".md")).toBe("tasks (2).md");
    expect(name("Tasks", ".md")).toBe("Tasks (3).md");
    expect(name("a/b", ".md")).toBe("a_b.md");
    expect(name("a:b", ".md")).toBe("a_b (2).md");
  });
});
