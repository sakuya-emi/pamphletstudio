import { it, expect } from "vitest";
import { createFestivalSample } from "../packages/core/festival-sample";
import { layoutProject } from "../packages/layout-engine";
it("完成見本には警告がなく校正用RGBの共通注意を情報として残す", () => {
  const p = createFestivalSample();
  for (const a of Object.values(p.assets)) a.mime = "image/png"; // Browser converts artwork at its original pixel dimensions.
  const issues = layoutProject(p).issues;
  expect(
    issues.filter((i) => i.level === "warning" || i.level === "error"),
  ).toEqual([]);
  expect(
    issues.filter((i) => i.level === "info").map((i) => i.message),
  ).toEqual([
    "標準PDFはRGB校正用です。CMYK・ICC・PDF/X・塗り足しは未実装です。",
  ]);
});
