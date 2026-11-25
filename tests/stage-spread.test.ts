import { it, expect } from "vitest";
import { createProject } from "../packages/core/model";
import { addEvent } from "../packages/core/registration";
import { stagePreset } from "../packages/designer/presets";
import { stageSpread } from "../packages/designer/stage-spread";
import { renderTemplate } from "../packages/designer/render";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";
import { exportPDF } from "../packages/pdf-export";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
function fixture(count = 6) {
  const p = createProject();
  p.theme.padding = 1;
  p.blocks = p.blocks.filter((b) =>
    ["cover", "contents", "back"].includes(b.template),
  );
  for (let i = 0; i < count; i++) {
    const e = addEvent(p, i % 2 ? "studentStage" : "stage");
    e.name = [
      "開会式",
      "学生バンド",
      "ダンス発表",
      "ゲスト企画",
      "コーラス",
      "閉会式",
    ][i % 6];
    e.startTime = String(9 + (i % 9)).padStart(2, "0") + ":00";
    e.endTime = String(10 + (i % 9)).padStart(2, "0") + ":00";
  }
  return p;
}
it("左右に分けても横時間軸は午後へ連続し、全要素がA5に収まる", () => {
  const p = fixture(),
    t = stagePreset(),
    pages = renderTemplate(p, t);
  expect(pages).toHaveLength(2);
  expect(pages[0].some((n) => n.kind === "text" && n.text === "9:00")).toBe(
    true,
  );
  expect(pages[1].some((n) => n.kind === "text" && n.text === "17:00")).toBe(
    true,
  );
  expect(pages[1].some((n) => n.kind === "text" && n.text === "9:00")).toBe(
    false,
  );
  for (const nodes of pages)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(148.01);
      expect(n.y + n.h).toBeLessThanOrEqual(210.01);
    }
});
it("綴じ目の文字を左右いずれかへ収める", () => {
  const p = fixture();
  const e = p.events[0];
  e.startTime = "13:10";
  e.endTime = "14:00";
  const pages = stageSpread(stagePreset().objects[0], p, fallbackMeasure);
  for (const nodes of pages)
    for (const n of nodes.filter((n) => n.kind === "text")) {
      if (n.spreadSide === "left")
        expect(n.x + n.w).toBeLessThanOrEqual(140.01);
      else if (n.spreadSide === "right") expect(n.x).toBeGreaterThanOrEqual(8);
    }
});
for (const binding of ["left", "right"] as const)
  it(`${binding}綴じでも見開きの物理的な左右と隣接を維持`, () => {
    const p = fixture();
    p.theme.binding = binding;
    const pages = layoutProject(p).pages;
    const pair = pages.filter((pg) => pg.spreadKey);
    expect(pair).toHaveLength(2);
    expect(pair[0].spreadSide).toBe(binding === "left" ? "left" : "right");
    for (const pg of pair) expect(pg.side).toBe(pg.spreadSide);
    expect(pages.indexOf(pair[1]) - pages.indexOf(pair[0])).toBe(1);
    const before = structuredClone(p.events);
    p.events[0].name = "修正した企画";
    const newPages = layoutProject(p).pages;
    expect(newPages.filter((pg) => pg.spreadKey).map((pg) => pg.id)).toEqual(
      pair.map((pg) => pg.id),
    );
    expect(p.events[1]).toEqual(before[1]);
  });
it("前回の手動ページ順があっても見開きが分離しない", () => {
  const p = fixture();
  const first = layoutProject(p);
  p.pageOrder = first.pages.map((pg) => pg.id).reverse();
  const pages = layoutProject(p).pages,
    pair = pages.filter((pg) => pg.spreadKey);
  expect(pages.indexOf(pair[1]) - pages.indexOf(pair[0])).toBe(1);
  expect(pair.map((pg) => pg.side)).toEqual(["left", "right"]);
});
it("件数が増えたら見開き単位で増え、各時間軸は同じ範囲を使う", () => {
  const p = fixture(12);
  const pages = stageSpread(stagePreset().objects[0], p, fallbackMeasure);
  expect(pages).toHaveLength(4);
  expect(pages.map((pg) => pg[0].spreadSide)).toEqual([
    "left",
    "right",
    "left",
    "right",
  ]);
  for (const e of p.events)
    expect(pages.flat().some((n) => n.source?.id === e.id)).toBe(true);
});
it("見開き設定の保存復元と単ページへの切替", async () => {
  const p = fixture(),
    t = stagePreset();
  p.templates.push(t);
  const saved = (await webStorage.load(await webStorage.save(p))).project;
  expect(saved.templates[0].objects[0].spread).toBe(true);
  t.objects[0].spread = false;
  expect(renderTemplate(p, t)).toHaveLength(1);
  t.objects[0].vertical = true;
  t.objects[0].spread = true;
  expect(renderTemplate(p, t)).toHaveLength(1);
});
it("見開きをA5のベクターPDF単ページに出力", async () => {
  const p = fixture(),
    medium = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    );
  const { bytes, layout } = await exportPDF(p, { medium, bold });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(layout.pages.length);
  for (const pg of pdf.getPages()) {
    expect((pg.getWidth() * 25.4) / 72).toBeCloseTo(148);
    expect((pg.getHeight() * 25.4) / 72).toBeCloseTo(210);
  }
  expect(layout.issues.filter((i) => i.level === "error")).toEqual([]);
  const pair = layout.pages.filter((pg) => pg.spreadKey);
  expect(pair.map((pg) => pg.side)).toEqual(["left", "right"]);
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/stage-spread-verification.pdf", bytes);
  await writeFile(
    "output/stage-spread-layout.json",
    JSON.stringify(
      {
        pages: layout.pages.map((pg) => ({
          physical: pg.physical,
          side: pg.side,
          title: pg.title,
          spreadKey: pg.spreadKey,
        })),
        issues: layout.issues,
      },
      null,
      2,
    ),
  );
}, 60000);
