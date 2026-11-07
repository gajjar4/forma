import { describe, expect, it } from "vitest";
import { canvasPixels, MOST_PIXELS, pageBoxes } from "./pdfPages";

const A4 = { w: 595, h: 842 };

describe("a lifted PDF's pages", () => {
  it("draws the first page over its still's box exactly", () => {
    const box = { w: 500, h: (500 * 842) / 595 };
    const [first] = pageBoxes(box, [A4]);
    expect(first.drawW).toBeCloseTo(box.w);
    expect(first.drawH).toBeCloseTo(box.h);
    expect(first.left).toBeCloseTo(0);
  });

  it("covers the box from the top like the still, whatever the page's shape", () => {
    // A long receipt runs on below the box; a wide banner is cut at its sides.
    const box = { w: 400, h: 800 };
    const [receipt] = pageBoxes(box, [{ w: 100, h: 400 }]);
    expect(receipt.drawW).toBeCloseTo(400);
    expect(receipt.h).toBeCloseTo(1600);
    const [banner] = pageBoxes({ w: 800, h: 400 }, [{ w: 300, h: 100 }]);
    expect(banner.drawH).toBeCloseTo(400);
    expect(banner.drawW).toBeCloseTo(1200);
    expect(banner.left).toBeCloseTo(-200);
  });

  it("sets every page after the first at the sheet's width", () => {
    const box = { w: 500, h: 700 };
    const [, wide, tall] = pageBoxes(box, [A4, { w: 842, h: 595 }, A4]);
    expect(wide.drawW).toBeCloseTo(500);
    expect(wide.h).toBeCloseTo((500 * 595) / 842);
    expect(tall.h).toBeCloseTo((500 * 842) / 595);
    expect(tall.left).toBe(0);
  });

  it("skips a page with no size", () => {
    expect(pageBoxes({ w: 500, h: 700 }, [{ w: 0, h: 0 }])[0].h).toBe(0);
  });

  it("draws at the screen's pixel ratio, never past what WebKit allows", () => {
    const [first] = pageBoxes({ w: 500, h: 707 }, [{ w: 500, h: 707 }]);
    expect(canvasPixels(first, 2)).toEqual({ w: 1000, h: 1414 });
    const huge = { h: 6000, drawW: 4000, drawH: 6000, left: 0 };
    const px = canvasPixels(huge, 2);
    expect(px.w * px.h).toBeLessThanOrEqual(MOST_PIXELS * 1.001);
    expect(px.w / px.h).toBeCloseTo(4000 / 6000, 2);
  });
});
