import { describe, expect, it } from "vitest";
import { faceText, markdownWords, parseInline, parseMarkdown, plainInline, safeHref } from "./markdown";

const NOTES = `---
name: forma
---

# Interview notes

Talked to **three** owners
about answers.

## What they said

- From their phone.
- A wrong answer costs more,
  and slower is fine.

1. First
2. Second

\`\`\`
reply < 2 min
\`\`\`

> If it sounds like a robot

---
`;

describe("markdown", () => {
  it("reads headings, paragraphs, lists, code, quotes and rules, without front matter", () => {
    expect(parseMarkdown(NOTES)).toEqual([
      { kind: "heading", level: 1, text: "Interview notes" },
      { kind: "para", text: "Talked to **three** owners about answers." },
      { kind: "heading", level: 2, text: "What they said" },
      { kind: "list", ordered: false, items: ["From their phone.", "A wrong answer costs more, and slower is fine."] },
      { kind: "list", ordered: true, items: ["First", "Second"] },
      { kind: "code", text: "reply < 2 min" },
      { kind: "quote", text: "If it sounds like a robot" },
      { kind: "rule" },
    ]);
  });

  it("reads emphasis, code and links in a line", () => {
    expect(parseInline("A **bold** and *soft* `x` [guide](https://a.co/v) <https://b.co>")).toEqual([
      { kind: "text", text: "A " },
      { kind: "strong", text: "bold" },
      { kind: "text", text: " and " },
      { kind: "em", text: "soft" },
      { kind: "text", text: " " },
      { kind: "code", text: "x" },
      { kind: "text", text: " " },
      { kind: "link", text: "guide", href: "https://a.co/v" },
      { kind: "text", text: " " },
      { kind: "link", text: "https://b.co", href: "https://b.co" },
    ]);
  });

  it("never links anywhere but the web and mail, and leaves snake_case alone", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(parseInline("[x](javascript:void)")[0]).toEqual({ kind: "text", text: "x" });
    expect(plainInline("my_file_name and <b>tags</b>")).toBe("my_file_name and <b>tags</b>");
    expect(plainInline("![a logo](https://a.co/l.png) here")).toBe("a logo here");
  });

  it("reads a face's worth from the top, cut at the end of a line", () => {
    expect(faceText(NOTES)).toBe(NOTES);
    expect(faceText("One line\nTwo line\nThree", 12)).toBe("One line");
    expect(faceText("No breaks at all here", 8)).toBe("No break");
    // The face and the whole file read the same up to where the face stops.
    const long = "# Head\n\n" + "A line of words.\n".repeat(400);
    expect(long.startsWith(faceText(long))).toBe(true);
    expect(faceText(long).length).toBeLessThanOrEqual(4000);
    expect(parseMarkdown(faceText(long))[0]).toEqual(parseMarkdown(long)[0]);
  });

  it("gives search its plain words", () => {
    expect(markdownWords("# Calls\n\n- **Fast** [reply](https://a.co)\n\n---")).toBe("Calls Fast reply");
  });
});
