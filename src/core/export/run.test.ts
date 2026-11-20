import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { sampleAndSyntheticRawData, sampleRawData, syntheticRawData } from "../../fixtures";
import { EXPORTERS, EXPORTER_ORDER } from "../exporters";
import { runExport, splitExtension, type FormatRequest } from "./run";
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
      raw: sampleAndSyntheticRawData(),
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

describe("runExport with attachments", () => {
  it("adds downloaded attachments under attachments/<list>/ and records the path", () => {
    const store = new Map([
      ["SYN_ATT_1", new Uint8Array([1, 2, 3])],
      ["SYN_ATT_2", new Uint8Array([4])],
    ]);
    const out = runExport({
      raw: syntheticRawData(),
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("json")],
      exportedAt,
      attachmentData: store,
    });
    const paths = out.files.map((f) => f.path);
    expect(paths).toEqual([
      "todo-backup.json",
      "attachments/工作 _ 项目_ _Q1___/Has attachments-receipt.pdf",
      "attachments/工作 _ 项目_ _Q1___/Has attachments-photo_ 1_2.jpg",
    ]);
    expect(out.files[1]!.content).toEqual(new Uint8Array([1, 2, 3]));
    expect(out.files[1]!.mime).toBe("application/pdf");

    const backup = JSON.parse(out.files[0]!.content as string);
    const task = backup.normalized.lists[0].tasks.find(
      (t: { id: string }) => t.id === "SYN_ATTACHMENT",
    );
    expect(task.attachments.map((a: { fileName: string }) => a.fileName)).toEqual(paths.slice(1));
  });

  it("skips attachments of lists that are not selected", () => {
    const out = runExport({
      raw: syntheticRawData(),
      selection: { listIds: ["SYN_LIST_BULK"], includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("csv")],
      exportedAt,
      attachmentData: new Map([["SYN_ATT_1", new Uint8Array([1])]]),
    });
    expect(out.files.map((f) => f.path)).toEqual(["todo-tasks.csv"]);
  });
});

describe("attachment file names", () => {
  it("splits safe extensions only", () => {
    expect(splitExtension("receipt.pdf")).toEqual({ stem: "receipt", extension: ".pdf" });
    expect(splitExtension("archive.tar.gz")).toEqual({ stem: "archive.tar", extension: ".gz" });
    expect(splitExtension("no extension")).toEqual({ stem: "no extension", extension: "" });
    expect(splitExtension(".env")).toEqual({ stem: ".env", extension: "" });
    // 换行和路径分隔符不会被当成扩展名，也不会抛异常
    expect(splitExtension("line\nbreak.txt")).toEqual({ stem: "line\nbreak", extension: ".txt" });
    expect(splitExtension("foo.a/b")).toEqual({ stem: "foo.a/b", extension: "" });
  });

  it("never writes outside the attachment folder", () => {
    const raw = syntheticRawData();
    raw.attachmentsByTaskId.SYN_ATTACHMENT![0]!.name = "evil\n.a/../../b";
    const out = runExport({
      raw,
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("csv")],
      exportedAt,
      attachmentData: new Map([["SYN_ATT_1", new Uint8Array([1])]]),
    });
    const path = out.files.find((f) => f.path.startsWith("attachments/"))!.path;
    const segments = path.split("/");
    expect(segments).toHaveLength(3);
    expect(segments).not.toContain("..");
  });
});

describe("incomplete exports", () => {
  it("records what could not be read in the JSON backup and prunes empty arrays", () => {
    const out = runExport({
      raw: syntheticRawData(),
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("json")],
      exportedAt,
      incomplete: {
        lists: [{ id: "L_FAILED", name: "Failed list" }],
        attachmentMetadata: [],
        attachmentContent: [],
      },
    });
    const backup = JSON.parse(out.files[0]!.content as string);
    expect(backup.meta.incomplete).toEqual({
      lists: [{ id: "L_FAILED", name: "Failed list" }],
    });
  });

  it("filters task-level incomplete records to the selected tasks while keeping failed lists", () => {
    const out = runExport({
      raw: syntheticRawData(),
      selection: { listIds: ["SYN_LIST_SHARED"], includeCompleted: false },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("json")],
      exportedAt,
      incomplete: {
        lists: [{ id: "L_FAILED", name: "Failed list" }],
        attachmentMetadata: [
          { listId: "SYN_LIST_MAIN", taskId: "SYN_ATTACHMENT", taskTitle: "Secret task" },
          { listId: "SYN_LIST_SHARED", taskId: "SYN_SHARED_1", taskTitle: "牛奶" },
        ],
        attachmentContent: [
          { taskId: "SYN_ATTACHMENT", attachmentId: "SYN_ATT_1", name: "secret.pdf" },
          { taskId: "SYN_SHARED_1", attachmentId: "ATT_OK", name: "shared.jpg" },
        ],
      },
    });
    const backup = JSON.parse(out.files[0]!.content as string);
    expect(backup.meta.incomplete).toEqual({
      lists: [{ id: "L_FAILED", name: "Failed list" }],
      attachmentMetadata: [{ listId: "SYN_LIST_SHARED", taskId: "SYN_SHARED_1", taskTitle: "牛奶" }],
      attachmentContent: [{ taskId: "SYN_SHARED_1", attachmentId: "ATT_OK", name: "shared.jpg" }],
    });

    // 若筛选后任务级失败全被排除且无失败清单，则完全不写 meta.incomplete
    const clean = runExport({
      raw: syntheticRawData(),
      selection: { listIds: ["SYN_LIST_FLAGGED"], includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("json")],
      exportedAt,
      incomplete: {
        attachmentMetadata: [
          { listId: "SYN_LIST_MAIN", taskId: "SYN_ATTACHMENT", taskTitle: "Secret task" },
        ],
        attachmentContent: [
          { taskId: "SYN_ATTACHMENT", attachmentId: "SYN_ATT_1", name: "secret.pdf" },
        ],
      },
    });
    expect(JSON.parse(clean.files[0]!.content as string).meta).not.toHaveProperty("incomplete");
  });

  it("leaves meta.incomplete out when nothing is missing", () => {
    const out = runExport({
      raw: syntheticRawData(),
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [fmt("json")],
      exportedAt,
      incomplete: { lists: [], attachmentMetadata: [], attachmentContent: [] },
    });
    expect(JSON.parse(out.files[0]!.content as string).meta).not.toHaveProperty("incomplete");
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
