import { describe, expect, it } from "vitest";
import { breakApart, changed, enter, hasBreak, insert, joinBack, joinForward, toFields, toText } from "./noteFields";

describe("toFields and toText", () => {
  it("splits the heading from each paragraph, the way the note reads", () => {
    expect(toFields("Founders call\n\nCalm.\n\n\nTrust.")).toEqual(["Founders call", "Calm.", "Trust."]);
    expect(toFields("")).toEqual([""]);
    expect(toFields("Just a heading")).toEqual(["Just a heading"]);
  });

  it("keeps a line break inside a paragraph", () => {
    expect(toFields("List\n\n- calm\n- trust")).toEqual(["List", "- calm\n- trust"]);
  });

  it("joins back with blank lines, dropping empty paragraphs", () => {
    expect(toText(["Head", "", " Body ", ""])).toBe("Head\n\nBody");
    expect(toText(["", ""])).toBe("");
  });

  it("makes the first paragraph the heading when there is none", () => {
    expect(toText(["", "Body"])).toBe("Body");
  });

  it("round-trips", () => {
    const text = "Who buys\n\nSmall brands.\n\nOn trust.";
    expect(toText(toFields(text))).toBe(text);
  });

  it("only counts a real change", () => {
    expect(changed(["Head", "Body", ""], "Head\n\nBody\n")).toBe(false);
    expect(changed(["Head", "Body!"], "Head\n\nBody")).toBe(true);
  });
});

describe("breakApart", () => {
  it("cuts a field at its blank lines, keeping the caret in place", () => {
    expect(breakApart(["H", "one\n\ntwo\n\n\nthree"], 1, 5)).toEqual({
      fields: ["H", "one", "two", "three"],
      caret: { field: 2, at: 0 },
    });
    expect(breakApart(["H", "one\n\ntwo"], 1, 2)).toEqual({ fields: ["H", "one", "two"], caret: { field: 1, at: 2 } });
    expect(breakApart(["H", "one\n\ntwo"], 1, 8)).toEqual({ fields: ["H", "one", "two"], caret: { field: 2, at: 3 } });
  });

  it("leaves a field with no blank line alone", () => {
    expect(breakApart(["H", "a\nb"], 1, 1)).toEqual({ fields: ["H", "a\nb"], caret: { field: 1, at: 1 } });
  });

  it("knows a blank line when it sees one", () => {
    expect(hasBreak("a\n\nb")).toBe(true);
    expect(hasBreak("a\n  \nb")).toBe(true);
    expect(hasBreak("a\nb")).toBe(false);
  });
});

describe("insert", () => {
  it("splits a paste into paragraphs, caret after it", () => {
    expect(insert(["Head", "ab"], 1, 1, 1, "X\n\nY")).toEqual({ fields: ["Head", "aX", "Yb"], caret: { field: 2, at: 1 } });
  });
});

describe("enter", () => {
  it("starts a new paragraph at the caret", () => {
    expect(enter(["H", "abcd"], 1, 2, 2)).toEqual({ fields: ["H", "ab", "cd"], caret: { field: 2, at: 0 } });
    expect(enter(["H", "ab"], 1, 2, 2)).toEqual({ fields: ["H", "ab", ""], caret: { field: 2, at: 0 } });
  });

  it("replaces a selection", () => {
    expect(enter(["H", "abcd"], 1, 1, 3)).toEqual({ fields: ["H", "a", "d"], caret: { field: 2, at: 0 } });
  });

  it("from the end of the heading goes to the start of the body", () => {
    expect(enter(["Head", "Body"], 0, 4, 4)).toEqual({ fields: ["Head", "Body"], caret: { field: 1, at: 0 } });
  });

  it("from the heading with no body starts one", () => {
    expect(enter(["Head"], 0, 4, 4)).toEqual({ fields: ["Head", ""], caret: { field: 1, at: 0 } });
  });

  it("in the middle of the heading moves the rest down", () => {
    expect(enter(["Head", "Body"], 0, 2, 2)).toEqual({ fields: ["He", "ad", "Body"], caret: { field: 1, at: 0 } });
  });
});

describe("joining", () => {
  it("Backspace at the start of an empty body goes back to the end of the heading", () => {
    expect(joinBack(["Head", ""], 1)).toEqual({ fields: ["Head"], caret: { field: 0, at: 4 } });
  });

  it("Backspace at the start of a paragraph joins it to the one before", () => {
    expect(joinBack(["H", "ab", "cd"], 2)).toEqual({ fields: ["H", "abcd"], caret: { field: 1, at: 2 } });
  });

  it("does nothing at the start of the heading", () => {
    expect(joinBack(["H", "a"], 0)).toBeNull();
  });

  it("Delete at the end of a field pulls the next one up", () => {
    expect(joinForward(["H", "ab", "cd"], 1)).toEqual({ fields: ["H", "abcd"], caret: { field: 1, at: 2 } });
    expect(joinForward(["H", "ab"], 1)).toBeNull();
  });
});
