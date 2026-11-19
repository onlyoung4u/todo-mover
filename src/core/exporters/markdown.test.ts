import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import { normalize } from "../model/normalize";
import { markdownExporter } from "./markdown";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const sample = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const synthetic = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const defaults = markdownExporter.defaultOptions;

describe("markdown exporter", () => {
  it("matches the SPEC 7.3 expected output exactly", () => {
    const { files } = markdownExporter.run(sample, defaults, { locale: "zh-CN" });
    expect(files.map((f) => f.path)).toEqual(["任务.md", "🐶Baby购物清单.md"]);
    expect(files[0]!.content).toBe(
      [
        "# 任务",
        "",
        "- [ ] AugBlog 📅 2019-11-30",
        "  - [ ] Ant design pro",
        "  - [ ] Golang api",
        "- [x] 剩余页面 ⏫ 📅 2019-04-14 ✅ 2019-04-14",
        "  - [x] 信息发布4.12",
        "  - [x] 我的信息4.12",
        "  - [x] 商家详情4.6",
        "",
      ].join("\n"),
    );
    expect(files[1]!.content).toBe("# 🐶Baby购物清单\n");
  });

  it("writes a single todo.md when asked", () => {
    const { files } = markdownExporter.run(
      sample,
      { ...defaults, singleFile: true },
      { locale: "zh-CN" },
    );
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("todo.md");
    expect(files[0]!.content).toMatch(/^# 任务\n[\s\S]*\n\n# 🐶Baby购物清单\n$/);
  });

  it("uses bracketed text in plain style, following the UI language", () => {
    const zh = markdownExporter.run(sample, { ...defaults, style: "plain" }, { locale: "zh-CN" });
    expect(zh.files[0]!.content).toContain("- [ ] AugBlog（截止 2019-11-30）\n");
    expect(zh.files[0]!.content).toContain(
      "- [x] 剩余页面（重要）（截止 2019-04-14）（完成 2019-04-14）\n",
    );
    const en = markdownExporter.run(sample, { ...defaults, style: "plain" }, { locale: "en" });
    expect(en.files[0]!.content).toContain("- [ ] AugBlog (due 2019-11-30)\n");
    expect(en.files[0]!.content).not.toMatch(/[📅⏫✅]/u);
  });

  it("renders recurrence, tags, notes and links", () => {
    const { files } = markdownExporter.run(synthetic, defaults, { locale: "zh-CN" });
    const main = files[0]!.content as string;
    expect(main).toContain(
      "- [ ] 周会（每周一、三） 🔁 every week on Monday, Wednesday 📅 2026-01-05\n",
    );
    expect(main).toContain("- [ ] Two categories #工作 #Home-Errands\n");
    expect(main).toContain("- [ ] Low priority someday 🔽\n");
    expect(main).toContain("- [ ] Plan the trip 🛫 2026-04-02 📅 2026-04-10\n");
    expect(main).toContain(
      "- [ ] HTML notes\n  > 第一行\n  > 第二行\n  > - 要点 A\n  > - 要点 B\n  > 加粗 & 结尾\n",
    );
    // 标题中的换行替换为空格
    expect(main).toContain('- [ ] 买菜, "牛奶" 🥛 & 鸡蛋; a\\b\n');

    const flagged = files.find((f) => f.path === "Flagged email.md")!.content as string;
    expect(flagged).toContain(
      "  [Re: 季度报告](https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem)\n",
    );
  });

  it("sanitizes file names from list names", () => {
    const { files } = markdownExporter.run(synthetic, defaults, { locale: "en" });
    expect(files.map((f) => f.path)).toEqual([
      // 原名 `工作 / 项目: "Q1"*?`
      "工作 _ 项目_ _Q1___.md",
      "Flagged email.md",
      "家庭共享清单.md",
      "Bulk list 📦.md",
    ]);
  });
});
