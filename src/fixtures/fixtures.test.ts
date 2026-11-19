import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sampleLists, sampleTasksDefault, synthetic } from ".";

// happy-dom 会替换全局 URL，这里只用 node:path 处理文件路径
const dir = dirname(fileURLToPath(import.meta.url));

describe("fixtures", () => {
  it("contain no real e-mail addresses", () => {
    const emailLike = /[\w.+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)+/g;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const text = readFileSync(join(dir, file), "utf8");
      const emails = (text.match(emailLike) ?? []).filter((e) => !/(?:@|%40)example\.com$/.test(e));
      expect(emails, file).toEqual([]);
    }
  });

  it("keep the real sample as described in SPEC §12", () => {
    expect(sampleLists.value.map((l) => l.displayName)).toEqual(["任务", "🐶Baby购物清单"]);
    expect(sampleTasksDefault.value.map((t) => t.title)).toEqual(["AugBlog", "剩余页面"]);
  });

  it("synthetic fixture covers the required cases", () => {
    const lists = synthetic.lists.value;
    // 合成数据里各任务的字段不同，JSON 推断出的联合类型过于复杂，这里统一当作宽松对象检查
    type LooseTask = Record<string, unknown> & {
      title: string;
      recurrence?: { pattern: { type: string } };
    };
    const responses = Object.values(synthetic.tasksByListId) as unknown as {
      value: LooseTask[];
    }[];
    const tasks = responses.flatMap((r) => r.value);

    expect(lists.some((l) => l.wellknownListName === "flaggedEmails")).toBe(true);
    expect(lists.some((l) => l.isShared && !l.isOwner)).toBe(true);
    expect(tasks.some((t) => t.recurrence?.pattern.type === "weekly")).toBe(true);
    expect(tasks.some((t) => t.recurrence?.pattern.type === "relativeMonthly")).toBe(true);
    expect(tasks.some((t) => t.isReminderOn && t.reminderDateTime)).toBe(true);
    expect(tasks.some((t) => t.startDateTime)).toBe(true);
    expect(tasks.some((t) => (t.body as { contentType: string }).contentType === "html")).toBe(
      true,
    );
    expect(tasks.some((t) => t.importance === "low")).toBe(true);
    expect(tasks.some((t) => (t.categories as string[]).length >= 2)).toBe(true);
    expect(tasks.some((t) => t.hasAttachments)).toBe(true);
    expect(tasks.some((t) => t.title.startsWith("="))).toBe(true);
    expect(tasks.some((t) => /,/.test(t.title) && /"/.test(t.title) && /\n/.test(t.title))).toBe(
      true,
    );
    expect(Math.max(...Object.values(synthetic.tasksByListId).map((r) => r.value.length))).toBe(
      125,
    );
  });
});
