import { describe, expect, it } from "vitest";
import type { Item } from "../../model/types";
import { countLabel, stackKind } from "./stackKind";

const of = (...kinds: Item["kind"][]) => kinds.map((kind, i) => ({ id: `i${i}`, kind }));

describe("stackKind", () => {
  it("names the one kind a stack holds", () => {
    expect(stackKind(of("image", "image"))).toBe("image");
    expect(stackKind(of("note"))).toBe("note");
    expect(stackKind(of("link", "link", "link"))).toBe("link");
  });

  it("calls a stack with more than one kind mixed", () => {
    expect(stackKind(of("image", "note"))).toBe("mixed");
  });

  it("has nothing to say about an empty stack", () => {
    expect(stackKind([])).toBeNull();
  });
});

describe("countLabel", () => {
  it("says how many, and of what", () => {
    expect(countLabel(of("image", "image", "image"))).toBe("3 images");
    expect(countLabel(of("doc"))).toBe("1 document");
    expect(countLabel(of("note"))).toBe("1 note");
    expect(countLabel(of("link", "link"))).toBe("2 links");
    expect(countLabel(of("image", "link", "note"))).toBe("3 mixed");
    expect(countLabel([])).toBe("0");
  });
});
