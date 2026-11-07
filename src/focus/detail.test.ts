import { describe, expect, it } from "vitest";
import { detailLayout, EDGE, GAP, NOTE_ROOM, SIDE_ROOM } from "./detail";

const view = { w: 1440, h: 900 };

describe("lifted image layout", () => {
  it("keeps the image centred across, raised to leave its note room underneath", () => {
    const { image, dy, note } = detailLayout(view, 1);
    expect(image.x + image.w / 2).toBeCloseTo(view.w / 2);
    expect(image.y + image.h / 2).toBeCloseTo(view.h / 2 + dy);
    expect(note.y).toBeCloseTo(image.y + image.h + GAP);
    expect(note.y + NOTE_ROOM - GAP).toBeLessThanOrEqual(view.h - EDGE + 1);
    expect(image.y).toBeGreaterThanOrEqual(EDGE - 1);
  });

  it("leaves both sides free for the palette and the source", () => {
    const { image, swatches, info } = detailLayout(view, 3);
    expect(image.x).toBeGreaterThanOrEqual(SIDE_ROOM - 1);
    expect(view.w - swatches.right).toBeCloseTo(image.x - GAP);
    expect(info.x).toBeCloseTo(image.x + image.w + GAP);
    expect(info.x + info.w).toBeLessThanOrEqual(view.w - EDGE);
  });

  it("keeps the image's proportions, and a note wide enough to write in under a tall one", () => {
    const { image, note } = detailLayout(view, 0.5);
    expect(image.w / image.h).toBeCloseTo(0.5);
    expect(note.w).toBeGreaterThanOrEqual(360);
    expect(note.x + note.w / 2).toBeCloseTo(view.w / 2);
  });

  it("copes with a shape it can't use", () => {
    const { image } = detailLayout(view, 0);
    expect(image.w).toBeCloseTo(image.h);
  });
});
