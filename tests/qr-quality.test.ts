import { expect, it } from "vitest";
import qrCode from "qrcode-generator";
import { surveyQr } from "../packages/templates/opening";
import { recolorNodes } from "../packages/core/color-palette";
import { createFestivalProject } from "../packages/core/festival-opening";

it("黒の連続区間は元のQRと一致し、四方向に4モジュールの白余白を残す", () => {
  const url = "https://www.nagoya-bunri.ac.jp/";
  const q = qrCode(0, "M");
  q.addData(url, "Byte");
  q.make();
  const count = q.getModuleCount(),
    side = 22,
    unit = side / (count + 8);
  const nodes = surveyQr(url, 0, 0, side),
    [background, path] = nodes;
  expect(background).toMatchObject({
    fill: "#ffffff",
    w: 22,
    h: 22,
    crisp: true,
  });
  expect(path).toMatchObject({ fill: "#000000", crisp: true });
  if (path.kind !== "path") throw new Error("QRのパスがない");
  const grid = Array.from({ length: count }, () =>
    Array<boolean>(count).fill(false),
  );
  for (const m of path.d.matchAll(
    /M ([\d.]+) ([\d.]+) H ([\d.]+) V ([\d.]+) H [\d.]+ Z/g,
  )) {
    const [x, y, right, bottom] = m.slice(1).map(Number);
    const col = Math.round(x / unit) - 4,
      row = Math.round(y / unit) - 4,
      end = Math.round(right / unit) - 4;
    expect(col).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(count);
    expect(bottom / unit).toBeCloseTo(row + 5);
    for (let c = col; c < end; c++) grid[row][c] = true;
  }
  expect(grid).toEqual(
    Array.from({ length: count }, (_, r) =>
      Array.from({ length: count }, (_, c) => q.isDark(r, c)),
    ),
  );
  const p = createFestivalProject();
  p.colorPaletteId = "test";
  p.colorPalettes = [
    {
      id: "test",
      name: "test",
      colors: { "#ffffff": "#000000", "#000000": "#ff0000" },
    },
  ];
  expect(recolorNodes(p, nodes)).toEqual(nodes);
});
