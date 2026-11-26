import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFestivalProject } from "../packages/core/festival-opening";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import {
  interpretRows,
  planRow,
  sheets,
  inspectImportTarget,
  importDecision,
  type ImportSheet,
} from "../packages/core/excel-import";
import {
  mediaItems,
  mediaSummary,
  editTargets,
  sourcePage,
} from "../apps/web/src/workspace/workflow";
import { inputGuides } from "../apps/web/src/workspace/inputGuides";
import { MediaIntake } from "../apps/web/src/workspace/MediaIntake";
import { DataWorkspace } from "../apps/web/src/workspace/DataWorkspace";
import fixture from "./fixtures/excel-template-v2.json";
function imported() {
  const p = createFestivalProject();
  for (const [name, rows] of Object.entries(fixture))
    if (Object.hasOwn(sheets, name))
      for (const row of interpretRows(name as ImportSheet, rows, true)) {
        const a = planRow(p, row);
        a.apply(p, a.candidates[0]?.id);
      }
  return p;
}
it("ceremony pages have no poster guides or frames covering their names and times", () => {
  const p = imported(),
    l = layoutProject(p, fallbackMeasure);
  for (const name of ["開会式", "閉会式"]) {
    const e = p.events.find((e) => e.name === name)!;
    const pg = l.pages.find(
      (pg) =>
        pg.template === "stage" && pg.nodes.some((n) => n.source?.id === e.id),
    )!;
    expect(e.posterRequired).toBe(false);
    expect(inputGuides(p, pg).some((g) => g.target.action === "poster")).toBe(
      false,
    );
    expect(
      pg.nodes.some(
        (n) => n.source?.id === e.id && n.source.field === "assetId",
      ),
    ).toBe(false);
    expect(
      pg.nodes
        .filter((n) => n.kind === "text" && n.source?.id === e.id)
        .map((n) => (n.kind === "text" ? n.text : ""))
        .join(""),
    ).toContain(name);
    expect(
      l.pages.some(
        (pg) =>
          pg.template === "posters" &&
          pg.nodes.some((n) => n.source?.id === e.id),
      ),
    ).toBe(false);
  }
  expect(
    l.issues.some((i) =>
      i.message.startsWith("文字が枠を超えています：ポスター未登録"),
    ),
  ).toBe(false);
});
it("external event appears exactly once in ordered image intake and has a visible table tab", () => {
  const p = imported(),
    b = p.blocks.find((b) => b.externalEvent)!;
  const items = mediaItems(p);
  expect(items.filter((i) => i.id === b.id)).toHaveLength(1);
  expect(items.length).toBe(mediaSummary(p).total);
  const labels = items.map((i) => i.label);
  expect(labels.lastIndexOf("ポスター")).toBeLessThan(
    labels.indexOf("店舗画像"),
  );
  const html = renderToStaticMarkup(
    <MediaIntake project={p} update={() => {}} onFinish={() => {}} />,
  );
  expect(html).toContain(b.title);
  const table = renderToStaticMarkup(
    <DataWorkspace
      project={p}
      layout={layoutProject(p)}
      update={() => {}}
      selectedId=""
      onSelect={() => {}}
      onImport={() => {}}
      onHistory={() => {}}
      historyVersion={0}
    />,
  );
  expect(table).toContain("外部・特別企画");
  const page = layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  const poster = page.nodes.find(
    (n) => n.editorOnly && n.source?.field === "assetId",
  )!;
  expect(
    page.nodes
      .filter((n) => n.source?.field === "body")
      .every((n) => n.y >= poster.y + poster.h),
  ).toBe(true);
});
it("ad reveal follows assigned slots even when missing-image placeholders have no ad source node", () => {
  const p = imported(),
    l = layoutProject(p),
    pg = l.pages.find((pg) => pg.slots.some((s) => s.adId))!;
  const adId = pg.slots.find((s) => s.adId)!.adId!;
  expect(sourcePage(l, { type: "ad", id: adId, field: "assetId" })?.id).toBe(
    pg.id,
  );
});
it("wrapped text and placeholder components produce one edit target per logical field", () => {
  const p = imported(),
    b = p.blocks.find((b) => b.externalEvent)!,
    pg = layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  const targets = editTargets(pg.nodes);
  for (const field of ["body", "assetId"])
    expect(
      targets.filter((n) => n.source?.id === b.id && n.source.field === field),
    ).toHaveLength(1);
});
it("identical kitchen rows with empty middle menu cells remain unchanged on repeated import", () => {
  const p = imported();
  for (const row of interpretRows(
    "キッチンカー",
    fixture["キッチンカー"],
    true,
  )) {
    const a = planRow(p, row),
      id = a.candidates[0].id;
    const count = p.kitchenMenus!.length;
    for (let repeat = 0; repeat < 3; repeat++) {
      const info = inspectImportTarget(p, row, id, a);
      expect(info.differences).toEqual([]);
      expect(importDecision(row, a, false, new Map([[id, info]])).state).toBe(
        "same",
      );
      a.apply(p, id);
    }
    expect(p.kitchenMenus!.length).toBe(count);
  }
});
