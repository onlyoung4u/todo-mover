import { describe, expect, it } from "vitest";
import { sampleRawData } from "../../fixtures";
import { normalize, selectRaw } from "../model/normalize";
import { jsonExporter, type JsonBackup } from "./json";

const exportedAt = new Date("2026-11-19T08:00:00Z");

describe("json exporter", () => {
  const raw = selectRaw(sampleRawData(), { includeCompleted: true });
  const data = normalize(raw, { timeZone: "Asia/Shanghai", exportedAt });
  const result = jsonExporter.run(data, {}, { locale: "en", raw });
  const file = result.files[0]!;
  const backup = JSON.parse(file.content as string) as JsonBackup;

  it("writes todo-backup.json with meta, normalized and raw", () => {
    expect(result.files).toHaveLength(1);
    expect(file.path).toBe("todo-backup.json");
    expect(file.mime).toBe("application/json");
    expect(backup.meta).toEqual(data.meta);
    expect(backup.normalized).toEqual(data);
    expect(backup.raw).toEqual(raw);
    expect(result.warnings).toEqual([]);
  });

  it("keeps raw Graph fields such as etags", () => {
    expect(backup.raw!.tasksByListId.LIST_DEFAULT![0]).toHaveProperty(
      "@odata.etag",
      'W/"etag-task-1"',
    );
  });

  it("does not contain @odata.context (it includes the account e-mail)", () => {
    expect(file.content).not.toContain("@odata.context");
  });

  it("can rebuild the same normalized data from raw (offline re-import)", () => {
    expect(normalize(backup.raw!, { timeZone: "Asia/Shanghai", exportedAt })).toEqual(
      backup.normalized,
    );
  });

  it("warns when raw data is missing", () => {
    const noRaw = jsonExporter.run(data, {}, { locale: "en" });
    expect(noRaw.warnings).toHaveLength(1);
    expect(JSON.parse(noRaw.files[0]!.content as string).raw).toBeNull();
  });
});
