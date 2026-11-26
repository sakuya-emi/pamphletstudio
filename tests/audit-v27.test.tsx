import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFestivalProject } from "../packages/core/festival-opening";
import { createProject } from "../packages/core/model";
import {
  interpretRows,
  planRow,
  inspectImportTarget,
  importDecision,
  importAdd,
} from "../packages/core/excel-import";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import {
  automaticBlankCounts,
  outputPages,
  sourceEditLabel,
} from "../apps/web/src/workspace/workflow";
import { Preview } from "../apps/web/src/Preview";
it("similar smoking notices require comparing and updating existing pages rather than duplicating them", () => {
  const p = createFestivalProject(),
    row = interpretRows("お知らせ・注意事項", [
      ["案内", "禁煙・禁酒について", "会場内は禁煙です。"],
    ])[0];
  const plan = planRow(p, row);
  expect(plan.candidates.length).toBeGreaterThan(0);
  expect(plan.requiresTarget).toBe(true);
  const inspected = new Map(
    plan.candidates.map((c) => [c.id, inspectImportTarget(p, row, c.id, plan)]),
  );
  expect(importDecision(row, plan, false, inspected).state).toBe("review");
  expect(importDecision(row, plan, false, inspected, importAdd).state).toBe(
    "review",
  );
  expect(
    inspected
      .get(plan.candidates[0].id)
      ?.differences.some((d) => d.field === "本文"),
  ).toBe(true);
  const count = p.blocks.length;
  plan.apply(p, plan.candidates[0].id);
  expect(p.blocks.length).toBe(count);
  expect(p.blocks.find((b) => b.id === plan.candidates[0].id)?.body).toBe(
    "会場内は禁煙です。",
  );
});
it("automatic blank total includes start-side and final padding pages", () => {
  const p = createFestivalProject();
  p.theme.padding = 4;
  p.chapters.forEach((c) => (c.startSide = "right"));
  const layout = layoutProject(p, fallbackMeasure),
    counts = automaticBlankCounts(layout.pages);
  expect(counts.start).toBeGreaterThan(0);
  expect(counts.total).toBe(
    layout.pages.filter((pg) => pg.template === "blank" && pg.automatic).length,
  );
  expect(counts.total).toBe(counts.start + counts.padding);
  expect(outputPages(layout.pages.length, counts.total)).toContain(
    `誌面${layout.pages.length - counts.total}ページ`,
  );
});
it("preview edit controls describe chapter names and targeted record names instead of raw fields", () => {
  const p = createProject(),
    chapter = p.chapters[0];
  expect(
    sourceEditLabel(p, { type: "chapter", id: chapter.id, field: "name" }),
  ).toBe("章名を編集：" + chapter.name);
  const page = layoutProject(p, fallbackMeasure).pages.find((pg) =>
    pg.nodes.some((n) => n.source?.type === "chapter"),
  )!;
  const html = renderToStaticMarkup(
    <Preview project={p} page={page} onInput={() => {}} onEdit={() => {}} />,
  );
  expect(html).not.toContain('aria-label="編集 name"');
  expect(html).toContain("章名を編集");
});
