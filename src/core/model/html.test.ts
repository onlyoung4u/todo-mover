import { describe, expect, it } from "vitest";
import { htmlToText, normalizeNotes } from "./html";

describe("htmlToText", () => {
  it("keeps line breaks and list markers from the synthetic fixture", () => {
    const html =
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><p>第一行<br>第二行</p><ul><li>要点 A</li><li>要点 B</li></ul><p><b>加粗</b> &amp; 结尾</p></body></html>';
    expect(htmlToText(html)).toBe("第一行\n第二行\n- 要点 A\n- 要点 B\n加粗 & 结尾");
  });

  it("numbers ordered lists and indents nested lists", () => {
    const html = "<ol><li>one<ul><li>a</li><li>b</li></ul></li><li>two</li></ol>";
    expect(htmlToText(html)).toBe("1. one\n  - a\n  - b\n2. two");
  });

  it("collapses whitespace and decodes entities", () => {
    expect(htmlToText("<div>  hello \n   world&nbsp;!</div><div>&lt;tag&gt;</div>")).toBe(
      "hello world !\n<tag>",
    );
  });

  it("drops scripts and styles", () => {
    expect(htmlToText("<style>p{}</style><script>alert(1)</script><p>ok</p>")).toBe("ok");
  });

  it("keeps paragraphs inside list items on the marker line", () => {
    expect(htmlToText("<ul><li><p>First</p></li><li><p>Second</p></li></ul>")).toBe(
      "- First\n- Second",
    );
    expect(htmlToText("<ol><li><div><b>One</b> item</div></li><li></li><li>Three</li></ol>")).toBe(
      "1. One item\n2.\n3. Three",
    );
    expect(htmlToText("<ul><li><ul><li>Nested</li></ul></li></ul>")).toBe("-\n  - Nested");
    expect(htmlToText('<ul><li><a href="https://example.com"></a><p>Next</p></li></ul>')).toBe(
      "- https://example.com\nNext",
    );
  });

  it("separates table cells", () => {
    expect(
      htmlToText(
        "<table><tr><th>Name</th><th>Qty</th></tr><tr><td>Milk</td><td>2</td></tr></table>",
      ),
    ).toBe("Name\tQty\nMilk\t2");
  });

  it("keeps link addresses when the text differs", () => {
    expect(htmlToText('<p>See <a href="https://example.com/a">the doc</a> now</p>')).toBe(
      "See the doc (https://example.com/a) now",
    );
    expect(htmlToText('<a href="https://example.com">https://example.com</a>')).toBe(
      "https://example.com",
    );
    expect(htmlToText('<a href="mailto:a@example.com">a@example.com</a>')).toBe("a@example.com");
    expect(htmlToText('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("keeps blank lines from consecutive <br>", () => {
    expect(htmlToText("a<br><br>b")).toBe("a\n\nb");
  });
});

describe("normalizeNotes", () => {
  it("uses text content as-is, trimmed, with LF line endings", () => {
    expect(normalizeNotes({ content: "  line 1\r\nline 2  ", contentType: "text" })).toEqual({
      notes: "line 1\nline 2",
    });
  });

  it("converts HTML and keeps the original", () => {
    const content = "<p>hi</p>";
    expect(normalizeNotes({ content, contentType: "html" })).toEqual({
      notes: "hi",
      notesHtml: content,
    });
  });

  it("handles a missing body", () => {
    expect(normalizeNotes(undefined)).toEqual({ notes: "" });
  });
});
