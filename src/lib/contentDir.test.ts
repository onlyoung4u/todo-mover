import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hasCollectionFiles, resolveContentBase } from "./contentDir";

const tempDirs: string[] = [];

function makeTempWorkspace(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "todo-mover-content-"));
  tempDirs.push(dir);
  mkdirSync(path.join(dir, "src/content/guides/en"), { recursive: true });
  mkdirSync(path.join(dir, "src/content/faq"), { recursive: true });
  writeFileSync(path.join(dir, "src/content/guides/en/sample.md"), "# sample\n");
  writeFileSync(path.join(dir, "src/content/faq/en.yaml"), "updated: 2026-11-20\nitems: []\n");
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("hasCollectionFiles", () => {
  it("returns false for missing or empty directories", () => {
    const dir = makeTempWorkspace();
    expect(hasCollectionFiles(path.join(dir, "private-content/guides"), "guides")).toBe(false);
    expect(hasCollectionFiles(path.join(dir, "private-content/faq"), "faq")).toBe(false);

    mkdirSync(path.join(dir, "private-content/guides/en"), { recursive: true });
    writeFileSync(path.join(dir, "private-content/guides/.gitkeep"), "");
    writeFileSync(path.join(dir, "private-content/guides/en/.gitkeep"), "");
    expect(hasCollectionFiles(path.join(dir, "private-content/guides"), "guides")).toBe(false);

    mkdirSync(path.join(dir, "private-content/faq"), { recursive: true });
    writeFileSync(path.join(dir, "private-content/faq/.gitkeep"), "");
    expect(hasCollectionFiles(path.join(dir, "private-content/faq"), "faq")).toBe(false);
  });

  it("returns true when at least one valid content file exists", () => {
    const dir = makeTempWorkspace();
    mkdirSync(path.join(dir, "private-content/guides/zh-CN"), { recursive: true });
    writeFileSync(path.join(dir, "private-content/guides/zh-CN/todoist.md"), "# guide\n");
    expect(hasCollectionFiles(path.join(dir, "private-content/guides"), "guides")).toBe(true);

    mkdirSync(path.join(dir, "private-content/faq"), { recursive: true });
    writeFileSync(path.join(dir, "private-content/faq/en.yml"), "updated: 2026-11-20\n");
    expect(hasCollectionFiles(path.join(dir, "private-content/faq"), "faq")).toBe(true);
  });
});

describe("resolveContentBase", () => {
  it("falls back to src/content when private-content is absent or empty", () => {
    const dir = makeTempWorkspace();
    expect(resolveContentBase("guides", { cwd: dir, contentDir: "" })).toBe(
      path.join(dir, "src/content/guides"),
    );
    expect(resolveContentBase("faq", { cwd: dir, contentDir: "" })).toBe(
      path.join(dir, "src/content/faq"),
    );

    // 仅创建空目录时仍应回退到公开示例
    mkdirSync(path.join(dir, "private-content/guides/en"), { recursive: true });
    expect(resolveContentBase("guides", { cwd: dir, contentDir: "" })).toBe(
      path.join(dir, "src/content/guides"),
    );
  });

  it("replaces each collection independently when private content files exist", () => {
    const dir = makeTempWorkspace();
    mkdirSync(path.join(dir, "private-content/guides/en"), { recursive: true });
    writeFileSync(path.join(dir, "private-content/guides/en/private.md"), "# private\n");

    expect(resolveContentBase("guides", { cwd: dir, contentDir: "" })).toBe(
      path.join(dir, "private-content/guides"),
    );
    // faq 仍无私有文件，单独回退到公开示例
    expect(resolveContentBase("faq", { cwd: dir, contentDir: "" })).toBe(
      path.join(dir, "src/content/faq"),
    );
  });

  it("supports custom CONTENT_DIR paths", () => {
    const dir = makeTempWorkspace();
    const external = mkdtempSync(path.join(os.tmpdir(), "todo-mover-external-"));
    tempDirs.push(external);
    mkdirSync(path.join(external, "faq"), { recursive: true });
    writeFileSync(path.join(external, "faq/en.yaml"), "updated: 2026-11-20\n");

    expect(resolveContentBase("faq", { cwd: dir, contentDir: external })).toBe(
      path.join(external, "faq"),
    );
    expect(resolveContentBase("guides", { cwd: dir, contentDir: external })).toBe(
      path.join(dir, "src/content/guides"),
    );
  });
});
