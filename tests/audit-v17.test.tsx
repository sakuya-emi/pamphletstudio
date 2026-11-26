import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFestivalProject } from "../packages/core/festival-opening";
import { addEvent } from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
import { PdfProgress } from "../apps/web/src/workspace/PdfProgress";
it("four stage events occupy one schedule page and missing posters do not create empty introduction pages", () => {
  const p = createFestivalProject();
  p.events = [];
  for (let i = 0; i < 4; i++) {
    const e = addEvent(p, i % 2 ? "studentStage" : "stage");
    e.name = "企画" + i;
    e.startTime = `${10 + i}:00`;
    e.endTime = `${10 + i}:30`;
  }
  const l = layoutProject(p);
  const timetable = l.pages.filter(
    (pg) =>
      p.blocks.find((b) => b.id === pg.blockId)?.openingKind === "schedule",
  );
  expect(timetable).toHaveLength(1);
  for (const e of p.events)
    expect(
      timetable[0].nodes.some(
        (n) => n.source?.id === e.id && n.source.field === "name",
      ),
    ).toBe(true);
  expect(
    Math.max(
      ...timetable[0].nodes
        .filter((n) => n.source?.type === "event")
        .map((n) => n.y + n.h),
    ),
  ).toBeGreaterThan(150);
  expect(
    l.pages.some(
      (pg) =>
        pg.template === "posters" &&
        ["stage", "studentStage"].includes(
          p.blocks.find((b) => b.id === pg.blockId)?.eventCategory ?? "",
        ),
    ),
  ).toBe(false);
  expect(
    l.issues.filter((i) => i.message.startsWith("ポスター未登録：")),
  ).toHaveLength(4);
});
it.each([
  [5, 32, 16],
  [32, 32, 100],
])(
  "page counters and progress bar agree at %s/%s",
  (completed, total, percent) => {
    const html = renderToStaticMarkup(
      <PdfProgress
        state={{
          completed,
          total,
          phase: "ページ描画中",
          startedAt: Date.now(),
        }}
        message="処理中"
      />,
    );
    expect(html).toContain(`ページ描画進捗 ${percent}%`);
    expect(html).toContain(`value="${percent}" max="100"`);
    expect(html).not.toContain("95%");
  },
);
