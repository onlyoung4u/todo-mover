import { describe, expect, it } from "vitest";
import { cleanGraphObject } from "./clean";

describe("cleanGraphObject", () => {
  it("removes @odata.context at every level, including navigation-property annotations", () => {
    const input = {
      "@odata.context":
        "https://graph.microsoft.com/v1.0/$metadata#users('user%40example.com')/todo/lists",
      "@microsoft.graph.tips": "tip",
      value: [
        {
          "@odata.etag": 'W/"etag"',
          id: "TASK",
          "checklistItems@odata.context":
            "https://graph.microsoft.com/v1.0/$metadata#users('user%40example.com')/todo/lists('L')/tasks('TASK')/checklistItems",
          "linkedResources@microsoft.graph.tips": "tip",
          checklistItems: [{ id: "S", displayName: "step" }],
        },
      ],
    };
    const out = cleanGraphObject(input);
    expect(out).toEqual({
      value: [
        {
          "@odata.etag": 'W/"etag"',
          id: "TASK",
          checklistItems: [{ id: "S", displayName: "step" }],
        },
      ],
    });
    expect(JSON.stringify(out)).not.toContain("example.com");
    // 不修改输入
    expect(input.value[0]).toHaveProperty("checklistItems@odata.context");
  });

  it("keeps ordinary fields that merely mention odata", () => {
    expect(cleanGraphObject({ title: "@odata.context", note: "x@odata.contextual" })).toEqual({
      title: "@odata.context",
      note: "x@odata.contextual",
    });
  });
});
