import { describe, expect, it } from "vitest";
import { addWorkingFile, cleanWorkingFiles, workingFileName } from "./workfiles";

describe("workingFileName", () => {
  it("names a Figma file by its file name", () => {
    expect(workingFileName("https://www.figma.com/design/AbC123/Forma-UI?node-id=1-2")).toBe("Forma UI");
    expect(workingFileName("https://www.figma.com/file/AbC123/Brand%20Book")).toBe("Brand Book");
    expect(workingFileName("https://www.figma.com/design/AbC123")).toBe("Figma file");
  });

  it("names a repo by owner and name", () => {
    expect(workingFileName("https://github.com/Pukhaan/forma")).toBe("Pukhaan/forma");
    expect(workingFileName("https://github.com/Pukhaan/forma.git")).toBe("Pukhaan/forma");
    expect(workingFileName("https://github.com/Pukhaan")).toBe("Pukhaan");
  });

  it("names anything else by its site", () => {
    expect(workingFileName("https://www.pukha.world/work")).toBe("pukha.world");
  });
});

describe("addWorkingFile", () => {
  it("adds a link once, and ignores what isn't one", () => {
    const one = addWorkingFile([], " www.pukha.world ");
    expect(one).toEqual(["https://www.pukha.world/"]);
    expect(addWorkingFile(one, "https://www.pukha.world/")).toBe(one);
    expect(addWorkingFile(one, "not a link")).toBe(one);
  });
});

describe("cleanWorkingFiles", () => {
  it("keeps only web addresses, each once", () => {
    expect(cleanWorkingFiles(["https://a.com/", 3, "https://a.com/", "nope", "https://b.com/"])).toEqual([
      "https://a.com/",
      "https://b.com/",
    ]);
    expect(cleanWorkingFiles("https://a.com")).toEqual([]);
  });
});
