import { describe, expect, it } from "vitest";
import {
  continueList,
  insertLink,
  togglePrefix,
  toggleWrap,
  toPlainText,
} from "./markdown";

describe("toggleWrap", () => {
  it("wraps a selection", () => {
    const out = toggleWrap("hello world", { start: 0, end: 5 }, "**");
    expect(out.text).toBe("**hello** world");
    expect(out.text.slice(out.selection.start, out.selection.end)).toBe(
      "hello"
    );
  });

  it("unwraps when already wrapped, so the shortcut toggles", () => {
    const out = toggleWrap("**hello** world", { start: 2, end: 7 }, "**");
    expect(out.text).toBe("hello world");
  });

  it("inserts an empty pair and puts the caret inside", () => {
    const out = toggleWrap("ab", { start: 1, end: 1 }, "_");
    expect(out.text).toBe("a__b");
    expect(out.selection).toEqual({ start: 2, end: 2 });
  });
});

describe("togglePrefix", () => {
  it("adds a prefix to every selected line", () => {
    const out = togglePrefix("one\ntwo", { start: 0, end: 7 }, "- ");
    expect(out.text).toBe("- one\n- two");
  });

  it("removes it when every line already has it", () => {
    const out = togglePrefix("- one\n- two", { start: 0, end: 11 }, "- ");
    expect(out.text).toBe("one\ntwo");
  });

  it("replaces a heading rather than stacking one on another", () => {
    const out = togglePrefix("# Title", { start: 0, end: 7 }, "## ");
    expect(out.text).toBe("## Title");
  });
});

describe("continueList", () => {
  it("continues a bullet list on Enter", () => {
    const out = continueList("- one", 5);
    expect(out?.text).toBe("- one\n- ");
  });

  it("increments a numbered list", () => {
    const out = continueList("1. one", 6);
    expect(out?.text).toBe("1. one\n2. ");
  });

  it("ends the list when the item is empty", () => {
    const out = continueList("- one\n- ", 8);
    expect(out?.text).toBe("- one\n");
  });

  it("does nothing outside a list", () => {
    expect(continueList("just a line", 11)).toBeNull();
  });
});

describe("insertLink", () => {
  it("keeps the selection as the label and selects the url slot", () => {
    const out = insertLink("see docs", { start: 4, end: 8 });
    expect(out.text).toBe("see [docs](url)");
    expect(out.text.slice(out.selection.start, out.selection.end)).toBe("url");
  });
});

describe("toPlainText", () => {
  it("resolves markdown for pasting into Substack or an email", () => {
    const source = "# Title\n\nSome **bold** and _soft_ text with `code`.";
    const out = toPlainText(source);
    expect(out).toContain("Title");
    expect(out).toContain("Some bold and soft text with code.");
    expect(out).not.toContain("**");
    expect(out).not.toContain("#");
  });

  it("keeps a link's destination, since a bare label loses information", () => {
    expect(toPlainText("[docs](https://example.com)")).toBe(
      "docs (https://example.com)"
    );
  });
});
