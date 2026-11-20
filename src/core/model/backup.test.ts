import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import { runExport } from "../export/run";
import { jsonExporter } from "../exporters/json";
import { BackupError, parseBackup } from "./backup";
import { normalize } from "./normalize";

const raw = sampleRawData();
const data = normalize(raw, {
  timeZone: "Asia/Shanghai",
  exportedAt: new Date("2026-11-19T08:00:00Z"),
});
const backupText = jsonExporter.run(data, {}, { locale: "en", raw }).files[0]!.content as string;

function code(text: string) {
  try {
    parseBackup(text);
  } catch (e) {
    return e instanceof BackupError ? e.code : "other";
  }
  return "ok";
}

describe("parseBackup", () => {
  it("reads a backup produced by the JSON exporter", () => {
    const parsed = parseBackup(backupText);
    expect(parsed.raw).toEqual(raw);
    expect(parsed.meta.exportTimeZone).toBe("Asia/Shanghai");
  });

  it("accepts a leading BOM", () => {
    expect(parseBackup(String.fromCharCode(0xfeff) + backupText).raw).toEqual(raw);
  });

  it("re-normalizes in a different time zone (offline re-import)", () => {
    const again = normalize(parseBackup(backupText).raw, { timeZone: "UTC" });
    expect(again.lists[0]!.tasks[0]!.dueDate).toBe("2019-11-29");
  });

  it("removes nested @odata.context annotations left in older backups", () => {
    const backup = JSON.parse(backupText);
    backup.raw.tasksByListId.LIST_DEFAULT[0]["checklistItems@odata.context"] =
      "https://graph.microsoft.com/v1.0/$metadata#users('user%40example.com')/x";
    const parsed = parseBackup(JSON.stringify(backup));
    expect(JSON.stringify(parsed.raw)).not.toContain("@odata.context");
    expect(parsed.raw).toEqual(raw);
  });

  it("fills a missing attachmentsByTaskId", () => {
    const backup = JSON.parse(backupText);
    delete backup.raw.attachmentsByTaskId;
    expect(parseBackup(JSON.stringify(backup)).raw.attachmentsByTaskId).toEqual({});
  });

  it("keeps the account and the original attachment paths when exported again", () => {
    const first = runExport({
      raw: syntheticRawData(),
      selection: { includeCompleted: true },
      timeZone: "UTC",
      locale: "en",
      formats: [{ id: "json", options: {} }],
      account: { displayName: "Demo User", username: "user@example.com" },
      attachmentData: new Map([["SYN_ATT_1", new Uint8Array([1])]]),
    });
    const parsed = parseBackup(first.files[0]!.content as string);
    expect(parsed.meta.account).toEqual({ displayName: "Demo User", username: "user@example.com" });

    const again = (previousAttachmentPaths: Map<string, string>) => {
      const out = runExport({
        raw: parsed.raw,
        selection: { includeCompleted: true },
        timeZone: "UTC",
        locale: "en",
        formats: [{ id: "json", options: {} }],
        account: parsed.meta.account,
        previousAttachmentPaths,
      });
      return JSON.parse(out.files[0]!.content as string);
    };
    const second = again(parsed.attachmentPaths);
    expect(second.meta.account).toEqual(parsed.meta.account);
    const attachments = second.normalized.lists
      .flatMap((l: { tasks: { attachments: unknown[] }[] }) => l.tasks)
      .flatMap((t: { attachments: unknown[] }) => t.attachments);
    const att1 = attachments.find((a: { id: string }) => a.id === "SYN_ATT_1");
    // 本次没有附件内容：fileName 为空，原路径保留在 previousFileName
    expect(att1.fileName).toBeUndefined();
    expect(att1.previousFileName).toMatch(/^attachments\/.+receipt\.pdf$/);
    expect(attachments.find((a: { id: string }) => a.id === "SYN_ATT_2").previousFileName).toBe(
      undefined,
    );

    // 再导入一次，路径仍然指向最早的 zip
    const third = parseBackup(JSON.stringify(second));
    expect(third.attachmentPaths.get("SYN_ATT_1")).toBe(att1.previousFileName);
  });

  it("only keeps the expected account fields", () => {
    const backup = JSON.parse(backupText);
    backup.meta.account = { displayName: "A", username: 42, extra: "x" };
    expect(parseBackup(JSON.stringify(backup)).meta.account).toEqual({ displayName: "A" });
  });

  it("rejects invalid input with a specific code", () => {
    expect(code("{not json")).toBe("invalidJson");
    expect(code("[]")).toBe("notBackup");
    expect(code(JSON.stringify({ meta: { tool: "other" } }))).toBe("notBackup");

    const noRaw = JSON.parse(backupText);
    noRaw.raw = null;
    expect(code(JSON.stringify(noRaw))).toBe("noRawData");

    const badRaw = JSON.parse(backupText);
    badRaw.raw.lists = [{ id: 1 }];
    expect(code(JSON.stringify(badRaw))).toBe("noRawData");

    const newer = JSON.parse(backupText);
    newer.meta.schemaVersion = 2;
    expect(code(JSON.stringify(newer))).toBe("newerSchema");
  });
});
