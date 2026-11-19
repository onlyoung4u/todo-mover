import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { demoRawData, sampleRawData } from "../../fixtures";
import { EXPORTERS, EXPORTER_ORDER } from "../exporters";
import { runExport, type FormatRequest } from "./run";
import { makeZip, packageFiles, zipFileName } from "./zip";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const fmt = (id: FormatRequest["id"]) =>
  ({ id, options: EXPORTERS[id].defaultOptions }) as FormatRequest;

describe("runExport", () => {
  it("applies the export time zone to every format", () => {
    const base = {
      raw: sampleRawData(),
      selection: { includeCompleted: true },
      locale: "zh-CN" as const,
      formats: [fmt("markdown")],
      exportedAt,
    };
    const shanghai = runExport({ ...base, timeZone: "Asia/Shanghai" }).files[0]!.content;
    const utc = runExport({ ...base, timeZone: "UTC" }).files[0]!.content;
    expect(shanghai).toContain("AugBlog 📅 2019-11-30");
    expect(utc).toContain("AugBlog 📅 2019-11-29");
  });

  it("only exports the selected lists and respects includeCompleted", () => {
    const out = runExport({
      raw: sampleRawData(),
      selection: { listIds: ["LIST_DEFAULT"], includeCompleted: false },
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
      formats: [fmt("markdown")],
      exportedAt,
    });
    expect(out.files.map((f) => f.path)).toEqual(["任务.md"]);
    expect(out.files[0]!.content).not.toContain("剩余页面");
  });

  it("keeps root paths for a single format and uses folders for several", () => {
    const one = runExport({
      raw: sampleRawData(),
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("csv")],
      exportedAt,
    });
    expect(one.files.map((f) => f.path)).toEqual(["todo-tasks.csv"]);

    const all = runExport({
      raw: demoRawData(),
      selection: { includeCompleted: true },
      timeZone: "Asia/Shanghai",
      locale: "en",
      formats: EXPORTER_ORDER.map(fmt),
      exportedAt,
    });
    const paths = all.files.map((f) => f.path);
    expect(paths).toContain("todo-backup.json");
    expect(paths).toContain("csv/todo-tasks.csv");
    expect(paths).toContain("markdown/任务.md");
    expect(paths).toContain("ics/任务.ics");
    expect(paths).toContain("todoist/任务.csv");
    expect(paths).toContain("things/things-import.json");
    expect(new Set(paths).size).toBe(paths.length);
    // Things 链接：演示数据的 125 条任务清单分 3 批，其余清单各 1 个
    expect(all.links.filter((l) => l.label.startsWith("Bulk list"))).toHaveLength(3);
  });
});

describe("zip", () => {
  it("names the archive after the local time", () => {
    expect(zipFileName(new Date(2026, 10, 19, 9, 5))).toBe("todo-export-20261119-0905.zip");
  });

  it("downloads a single file as-is", async () => {
    const pkg = await packageFiles([{ path: "a.csv", content: "x", mime: "text/csv" }]);
    expect(pkg).toEqual({ name: "a.csv", data: "x", mime: "text/csv" });
  });

  it("zips several files and keeps UTF-8 names and content", async () => {
    const files = [
      { path: "markdown/🐶Baby购物清单.md", content: "# 🐶Baby购物清单\n", mime: "text/markdown" },
      { path: "todo-backup.json", content: "{}", mime: "application/json" },
    ];
    const now = new Date(2026, 10, 19, 9, 5);
    const pkg = await packageFiles(files, now);
    expect(pkg.name).toBe("todo-export-20261119-0905.zip");
    expect(pkg.mime).toBe("application/zip");

    const zip = await JSZip.loadAsync(await makeZip(files, now));
    expect(
      Object.keys(zip.files)
        .filter((n) => !zip.files[n]!.dir)
        .sort(),
    ).toEqual(["markdown/🐶Baby购物清单.md", "todo-backup.json"]);
    expect(await zip.file("markdown/🐶Baby购物清单.md")!.async("string")).toBe(
      "# 🐶Baby购物清单\n",
    );
  });
});
