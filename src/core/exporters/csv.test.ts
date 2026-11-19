import { describe, expect, it } from "vitest";
import { sampleRawData, syntheticRawData } from "../../fixtures";
import { normalize } from "../model/normalize";
import { csvExporter } from "./csv";
import { csvField, guardFormula, toCsv } from "./csvFormat";

const exportedAt = new Date("2026-11-19T08:00:00Z");
const sample = normalize(sampleRawData(), { timeZone: "Asia/Shanghai", exportedAt });
const synthetic = normalize(syntheticRawData(), { timeZone: "Asia/Shanghai", exportedAt });

/** 最小的 RFC 4180 解析器，用来核对输出能被正确读回 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  return rows;
}

function run(data = sample, locale: "en" | "zh-CN" | "zh-TW" = "zh-CN", formulaGuard = true) {
  const { files } = csvExporter.run(data, { formulaGuard }, { locale });
  expect(files).toHaveLength(1);
  expect(files[0]!.path).toBe("todo-tasks.csv");
  return files[0]!.content as string;
}

describe("csv exporter", () => {
  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const text = run();
    expect(text.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/\r(?!\n)/);
  });

  it("uses the SPEC column order with localized headers", () => {
    const [header] = parseCsv(run().slice(1));
    expect(header).toEqual(
      "清单, 标题, 状态, 重要, 截止日期, 开始日期, 提醒时间, 重复, 完成日期, 创建时间, 修改时间, 分类, 备注, 步骤, 步骤进度, 关联链接, 有附件, 任务ID, 清单ID".split(
        ", ",
      ),
    );
    const [enHeader] = parseCsv(run(sample, "en").slice(1));
    expect(enHeader![0]).toBe("List");
  });

  it("formats the sample rows", () => {
    const rows = parseCsv(run().slice(1));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      "任务",
      "AugBlog",
      "未开始",
      "普通",
      "2019-11-30",
      "",
      "",
      "",
      "",
      "2019-10-28 13:51",
      "2020-03-02 17:33",
      "",
      "",
      "[ ] Ant design pro | [ ] Golang api",
      "0/2",
      "",
      "否",
      "TASK_1",
      "LIST_DEFAULT",
    ]);
    expect(rows[2]!.slice(0, 9)).toEqual([
      "任务",
      "剩余页面",
      "已完成",
      "高",
      "2019-04-14",
      "",
      "",
      "",
      "2019-04-14",
    ]);
    expect(rows[2]![14]).toBe("3/3");
  });

  it("round-trips commas, quotes, newlines and emoji", () => {
    const rows = parseCsv(run(synthetic).slice(1));
    const escaped = rows.find((r) => r[17] === "SYN_ESCAPE")!;
    expect(escaped[1]).toBe('买菜, "牛奶"\n🥛 & 鸡蛋; a\\b');
    expect(escaped[12]).toBe("备注第一行\n备注, 第二行; 含分号");
  });

  it("guards formulas in user text by default, and only there", () => {
    const rows = parseCsv(run(synthetic).slice(1));
    expect(rows.find((r) => r[17] === "SYN_FORMULA")![1]).toBe("'=SUM(A1:A2)");
    const html = rows.find((r) => r[17] === "SYN_HTML_NOTES")!;
    expect(html[12]).toBe("第一行\n第二行\n- 要点 A\n- 要点 B\n加粗 & 结尾");

    const unguarded = parseCsv(run(synthetic, "zh-CN", false).slice(1));
    expect(unguarded.find((r) => r[17] === "SYN_FORMULA")![1]).toBe("=SUM(A1:A2)");
  });

  it("fills recurrence, reminder, categories, links and attachments", () => {
    const rows = parseCsv(run(synthetic).slice(1));
    const byId = (id: string) => rows.find((r) => r[17] === id)!;
    expect(byId("SYN_WEEKLY")[7]).toBe("每周（周一、周三），直到 2026-06-29");
    expect(byId("SYN_REMINDER")[6]).toBe("2026-03-10 09:30");
    expect(byId("SYN_CATEGORIES")[11]).toBe("工作; Home Errands");
    expect(byId("SYN_FLAGGED_1")[15]).toBe(
      "Re: 季度报告 (https://outlook.live.com/owa/?ItemID=AAMkAGSYNTHETIC&exvsurl=1&viewmodel=ReadMessageItem)",
    );
    expect(byId("SYN_ATTACHMENT")[16]).toBe("是");
    expect(byId("SYN_COMPLETED")[13]).toBe("[x] Done step | [ ] Open step");
    expect(byId("SYN_COMPLETED")[14]).toBe("1/2");
  });
});

describe("csvFormat", () => {
  it("quotes only when needed", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(toCsv([["a", "b"]])).toBe("a,b\r\n");
  });

  it("guards formula prefixes", () => {
    for (const s of ["=1", "+1", "-1", "@x", "\tx"]) expect(guardFormula(s)).toBe(`'${s}`);
    expect(guardFormula("ok=1")).toBe("ok=1");
  });
});
