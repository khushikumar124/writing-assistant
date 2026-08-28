import { describe, expect, it } from "vitest";
import { parseNote } from "@/components/ImportNotes";

describe("parseNote", () => {
  it("takes the title from Obsidian front matter", () => {
    const note = parseNote(
      "whatever.md",
      "---\ntitle: Real Title\ntags: [a]\n---\n\nBody here."
    );
    expect(note.title).toBe("Real Title");
    expect(note.body).toBe("Body here.");
  });

  it("takes the title from a leading heading, as Bear writes", () => {
    const note = parseNote("note.md", "# On indexes\n\nSome prose.");
    expect(note.title).toBe("On indexes");
    expect(note.body).toBe("Some prose.");
  });

  it("falls back to a tidied filename", () => {
    const note = parseNote("my-old_note.txt", "Just text, no heading.");
    expect(note.title).toBe("my old note");
    expect(note.body).toBe("Just text, no heading.");
  });

  it("counts words so short notes can be told from long ones", () => {
    expect(parseNote("a.md", "# T\n\none two three").words).toBe(3);
    expect(parseNote("empty.md", "   ").words).toBe(0);
  });

  it("handles Windows line endings", () => {
    const note = parseNote("w.md", "# Title\r\n\r\nBody.");
    expect(note.title).toBe("Title");
    expect(note.body).toBe("Body.");
  });
});
