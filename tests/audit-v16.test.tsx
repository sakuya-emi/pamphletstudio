import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFestivalProject } from "../packages/core/festival-opening";
import { ExcelImport } from "../apps/web/src/workspace/ExcelImport";
import { PdfProgress } from "../apps/web/src/workspace/PdfProgress";
import { layoutProject } from "../packages/layout-engine";
it("unresolved non-survey rows block submission and offer explicit skipping", () => {
  const p = createFestivalProject();
  const html = renderToStaticMarkup(
    <ExcelImport
      inline
      project={p}
      update={() => {}}
      initialSheet="お知らせ・注意事項"
      initialText={"案内\t禁煙・禁酒について\t新しい禁煙案内"}
      close={() => {}}
      done={() => {}}
    />,
  );
  expect(html).toContain("要確認1件が未確定");
  expect(html).toContain("要確認1件をすべて登録しない");
  expect(html).toMatch(/disabled=""[^>]*>[0-9]+件を登録/);
});
it("numeric page progress and elapsed time are visible even while fonts are loading", () => {
  const html = renderToStaticMarkup(
    <PdfProgress
      state={{
        completed: 0,
        total: 32,
        phase: "フォント読込中",
        startedAt: Date.now(),
      }}
      message="PDF準備中"
    />,
  );
  expect(html).toContain("0 / 32");
  expect(html).toContain("経過 0 秒");
  expect(html).toContain('role="status"');
  expect(html).toContain("<progress");
});
it("printed URL is horizontally aligned directly below its QR", () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.openingKind === "survey")!;
  b.surveyUrl = "https://example.com/form";
  const page = layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  const qr = page.nodes.find(
    (n) => n.kind === "path" && n.source?.field === "surveyUrl",
  )!;
  const label = page.nodes.find(
    (n) =>
      n.kind === "text" && n.source?.field === "surveyUrl" && !n.editorOnly,
  )!;
  expect(label.x).toBe(88);
  expect(label.w).toBe(47);
  expect(label.y).toBeGreaterThanOrEqual(qr.y + qr.h);
});
it("ceremony text remains when no schedule or matching list exists", () => {
  const p = createFestivalProject();
  p.events = [];
  const block = p.blocks.find(
    (b) => b.template === "posters" && b.eventCategory === "stage",
  )!;
  p.blocks = p.blocks.filter((b) => b.id === block.id);
  p.events.push({
    id: "ceremony",
    name: "式典",
    category: "stage",
    posterRequired: false,
    startTime: "09:30",
    endTime: "10:00",
    group: "",
    building: "",
    room: "",
    location: "",
  });
  const l = layoutProject(p);
  expect(
    l.pages.some(
      (pg) =>
        pg.blockId === block.id &&
        pg.nodes.some((n) => n.kind === "text" && n.text === "式典"),
    ),
  ).toBe(true);
});
