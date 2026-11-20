import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import { normalize } from "../model/normalize";
import {
  THINGS_BATCH_SIZE,
  THINGS_MAX_URL_LENGTH,
  thingsExporter,
  type ThingsProject,
  type ThingsTodo,
} from "./things";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const sample = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const synthetic = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });

function decode(url: string): (ThingsProject | ThingsTodo)[] {
  const prefix = "things:///json?data=";
  expect(url.startsWith(prefix)).toBe(true);
  const data = url.slice(prefix.length);
  // URL 里不能有未编码的 JSON 字符
  expect(data).not.toMatch(/[{}"\s[\]]/);
  return JSON.parse(decodeURIComponent(data));
}

describe("things exporter", () => {
  it("builds the SPEC 7.6 structure for the sample", () => {
    const result = thingsExporter.run(sample, {}, { locale: "zh-CN" });
    expect(result.links!.map((l) => l.label)).toEqual(["任务", "🐶Baby购物清单"]);

    const [project] = decode(result.links![0]!.url) as ThingsProject[];
    expect(project!.type).toBe("project");
    expect(project!.attributes.title).toBe("任务");
    expect(project!.attributes.items[0]).toEqual({
      type: "to-do",
      attributes: {
        title: "AugBlog",
        deadline: "2019-11-30",
        completed: false,
        tags: [],
        "checklist-items": [
          { type: "checklist-item", attributes: { title: "Ant design pro", completed: false } },
          { type: "checklist-item", attributes: { title: "Golang api", completed: false } },
        ],
        "creation-date": "2019-10-28T05:51:53Z",
      },
    });
    expect(project!.attributes.items[1]!.attributes).toMatchObject({
      title: "剩余页面",
      completed: true,
      "completion-date": "2019-04-14T12:00:00Z",
    });
  });

  it("writes things-import.json with every project unbatched", () => {
    const result = thingsExporter.run(synthetic, {}, { locale: "en" });
    expect(result.files.map((f) => f.path)).toEqual(["things-import.json"]);
    const projects = JSON.parse(result.files[0]!.content as string) as ThingsProject[];
    expect(projects.map((p) => [p.attributes.title, p.attributes.items.length])).toEqual([
      ['工作 / 项目: "Q1"*?', 14],
      ["Flagged email", 1],
      ["家庭共享清单", 2],
      ["Bulk list 📦", 125],
    ]);
  });

  it("splits a list into batches of at most 50 to-dos", () => {
    const result = thingsExporter.run(synthetic, {}, { locale: "zh-CN" });
    const bulk = result.links!.filter((l) => l.label.startsWith("Bulk list"));
    expect(bulk.map((l) => l.label)).toEqual([
      "Bulk list 📦（1/3）",
      "Bulk list 📦（2/3）",
      "Bulk list 📦（3/3）",
    ]);

    const batches = bulk.map((l) => decode(l.url));
    // 第一批创建项目
    expect(batches[0]).toHaveLength(1);
    const project = batches[0]![0] as ThingsProject;
    expect(project.type).toBe("project");
    expect(project.attributes.items).toHaveLength(THINGS_BATCH_SIZE);
    // 之后的批次追加到同名项目
    expect(batches[1]).toHaveLength(50);
    expect(batches[2]).toHaveLength(25);
    for (const todo of [...batches[1]!, ...batches[2]!] as ThingsTodo[]) {
      expect(todo.type).toBe("to-do");
      expect(todo.attributes.list).toBe("Bulk list 📦");
    }
    const titles = [
      ...project.attributes.items,
      ...(batches[1] as ThingsTodo[]),
      ...(batches[2] as ThingsTodo[]),
    ].map((t) => t.attributes.title);
    expect(titles).toEqual(
      Array.from({ length: 125 }, (_, i) => `Bulk task ${String(i + 1).padStart(3, "0")}`),
    );
  });

  it("also splits by link length, keeping every task in order", () => {
    const list = synthetic.lists.find((l) => l.name.startsWith("Bulk list"))!;
    // 每条约 2,000 个中文字符，编码后约 18 KB：一个链接只放得下一条
    const tasks = list.tasks.slice(0, 6).map((task) => ({ ...task, notes: "长".repeat(2000) }));
    const data = { ...synthetic, lists: [{ ...list, tasks }] };
    const result = thingsExporter.run(data, {}, { locale: "en" });
    expect(result.links).toHaveLength(6);
    for (const link of result.links!)
      expect(link.url.length).toBeLessThanOrEqual(THINGS_MAX_URL_LENGTH);
    expect(result.warnings).toEqual([]);
    const titles = result.links!.flatMap((l) =>
      decode(l.url).flatMap((item) =>
        item.type === "project" ? item.attributes.items : [item as ThingsTodo],
      ),
    );
    expect(titles.map((t) => t.attributes.title)).toEqual(tasks.map((t) => t.title));
  });

  it("warns when a single task is too long for one link", () => {
    const list = synthetic.lists[0]!;
    const tasks = [{ ...list.tasks[0]!, notes: "长".repeat(9000) }];
    const result = thingsExporter.run(
      { ...synthetic, lists: [{ ...list, tasks }] },
      {},
      { locale: "en" },
    );
    expect(result.links).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(tasks[0]!.title);
  });

  it("writes repeat rules, reminders, start dates and links into notes", () => {
    const result = thingsExporter.run(synthetic, {}, { locale: "en" });
    const projects = JSON.parse(result.files[0]!.content as string) as ThingsProject[];
    const todo = (title: string) =>
      projects.flatMap((p) => p.attributes.items).find((t) => t.attributes.title === title)!;

    expect(todo("周会（每周一、三）").attributes.notes).toBe(
      "Repeat: Every week on Mon, Wed, until 2026-06-29",
    );
    expect(todo("Call the dentist").attributes.notes).toBe("Reminder: 2026-03-10 09:30");
    expect(todo("Plan the trip").attributes.notes).toBe("Start date: 2026-04-02");
    expect(todo("Two categories").attributes.tags).toEqual(["工作", "Home Errands"]);
    expect(todo("HTML notes").attributes.notes).toBe(
      "第一行\n第二行\n- 要点 A\n- 要点 B\n加粗 & 结尾",
    );
    expect(todo("Re: 季度报告").attributes.notes).toBe(
      "Re: 季度报告: https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem",
    );
    expect(result.warnings).toEqual([]);
  });
});
