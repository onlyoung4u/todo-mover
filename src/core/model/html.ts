/**
 * 备注 HTML → 纯文本（SPEC 6.2）：保留换行和列表符号，去掉其余标签。
 * 使用浏览器 DOMParser（测试环境由 happy-dom 提供），不会执行脚本或加载资源。
 */
import type { GraphItemBody } from "../graph/types";

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

const SKIP_TAGS = new Set(["HEAD", "SCRIPT", "STYLE", "TEMPLATE", "TITLE", "NOSCRIPT"]);

// 节点类型常量（不依赖全局 Node，方便在不同 DOM 实现中使用）
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

class TextBuilder {
  private lines: string[] = [""];
  /** 当前行目前只有列表符号（"- " / "1. "），还没有正文 */
  private atMarker = false;

  text(s: string) {
    const collapsed = s.replace(/[ \t\r\n\f]+/g, " ");
    const last = this.lines.length - 1;
    const current = this.lines[last]!;
    // 行首（或列表符号后）不保留空格
    const atStart = current.trim() === "" || this.atMarker;
    const added = atStart ? collapsed.trimStart() : collapsed;
    this.lines[last] = current + added;
    if (added) this.atMarker = false;
  }

  /** 原样追加（用于缩进和分隔符） */
  raw(s: string) {
    this.lines[this.lines.length - 1] += s;
  }

  /** 列表符号：之后紧跟的块元素（如 <li><p>…</p></li>）不再另起一行 */
  marker(s: string) {
    this.raw(s);
    this.atMarker = true;
  }

  /** 列表项结束：即使是空的列表项，下一项也要另起一行 */
  endItem() {
    this.atMarker = false;
    this.ensureNewLine();
  }

  /** 如果当前行已有内容，换到新行 */
  ensureNewLine() {
    if (this.atMarker) return;
    if (this.lines[this.lines.length - 1]!.trim() !== "") this.lines.push("");
  }

  newLine() {
    this.atMarker = false;
    this.lines.push("");
  }

  toString(): string {
    return this.lines
      .map((l) => l.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}

type ListContext = { ordered: boolean; counter: number };

function walk(node: Node, out: TextBuilder, lists: ListContext[]) {
  if (node.nodeType === TEXT_NODE) {
    out.text(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return;

  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (SKIP_TAGS.has(tag)) return;

  if (tag === "BR") {
    out.newLine();
    return;
  }

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) out.ensureNewLine();

  if (tag === "UL" || tag === "OL") {
    lists.push({ ordered: tag === "OL", counter: 0 });
    for (const child of Array.from(el.childNodes)) walk(child, out, lists);
    lists.pop();
    out.ensureNewLine();
    return;
  }

  if (tag === "LI") {
    const list = lists[lists.length - 1];
    const depth = Math.max(0, lists.length - 1);
    let marker = "- ";
    if (list?.ordered) {
      list.counter += 1;
      marker = `${list.counter}. `;
    }
    out.marker("  ".repeat(depth) + marker);
  }

  // 同一行的单元格之间用制表符隔开，避免 <td>A</td><td>B</td> 粘成 "AB"
  if ((tag === "TD" || tag === "TH") && el.previousElementSibling) out.raw("\t");

  for (const child of Array.from(el.childNodes)) walk(child, out, lists);

  // 链接保留地址：文字和地址不同时写成 "文字 (地址)"
  if (tag === "A") {
    const href = el.getAttribute("href")?.trim() ?? "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const bare = href.replace(/^mailto:/i, "");
    if (/^(https?:|mailto:)/i.test(href) && text !== href && text !== bare) {
      out.raw(text ? ` (${bare})` : bare);
    }
  }

  if (tag === "LI") out.endItem();
  else if (isBlock) out.ensureNewLine();
}

/** 没有 DOMParser 时的简易退化实现：只处理常见标签和实体。 */
function fallbackHtmlToText(html: string): string {
  return html
    .replace(/<(head|script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/t[dh]>\s*(?=<t[dh][\s>])/gi, "\t")
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return fallbackHtmlToText(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = new TextBuilder();
  walk(doc.body, out, []);
  // &nbsp; 解析后是 U+00A0，统一换成普通空格
  return out.toString().replace(/\xa0/g, " ");
}

/** 备注字段的归一化：text 直接使用，html 转为纯文本并保留原文；都去掉首尾空白。 */
export function normalizeNotes(body: GraphItemBody | undefined): {
  notes: string;
  notesHtml?: string;
} {
  if (!body) return { notes: "" };
  if (body.contentType === "html") {
    return { notes: htmlToText(body.content ?? ""), notesHtml: body.content };
  }
  return { notes: (body.content ?? "").replace(/\r\n?/g, "\n").trim() };
}
