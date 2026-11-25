import { expect, it } from "vitest";
import { createProject, nextYear } from "../packages/core/model";
import { pdfCompletion } from "../packages/core/pdf-completion";
import { webStorage } from "../packages/project-storage";
import { layoutProject } from "../packages/layout-engine";
import { cover } from "../packages/templates/cover";
import { fallbackMeasure } from "../packages/layout-engine/types";

it("keeps PDF completion and output metadata on reopening but marks subsequent changes as stale", async () => {
  const p = createProject();
  p.contentVersion = "output-version";
  p.lastPdf = {
    at: "2026-11-13T02:00:00.000Z",
    pages: 28,
    contentVersion: p.contentVersion,
  };
  const copy = (await webStorage.load(await webStorage.save(p))).project;
  expect(copy.lastPdf).toEqual(p.lastPdf);
  expect(
    pdfCompletion(
      copy.contentVersion!,
      copy.lastPdf!.contentVersion,
      false,
      true,
    ),
  ).toBe("PDF生成済み");
  expect(pdfCompletion("next", copy.lastPdf!.contentVersion, false, true)).toBe(
    "出力後に変更あり",
  );
  expect(nextYear(copy).lastPdf).toBeUndefined();
});

it("adds 2 print-empty pages immediately before the back cover after chapter positioning", () => {
  const p = createProject(),
    chapterId = p.chapters[0].id;
  p.blocks = Array.from({ length: 26 }, (_, i) => ({
    id: "b" + i,
    chapterId,
    title: "ページ " + i,
    template: i === 25 ? "back" : i === 0 ? "cover" : "notice",
  }));
  expect(p.theme.padding).toBe(4);
  const layout = layoutProject(p);
  expect(layout.pages.length).toBe(28);
  expect(
    layout.pages.slice(-3).map((pg) => pg.automatic?.kind ?? pg.template),
  ).toEqual(["padding", "padding", "back"]);
  expect(
    layout.pages
      .filter((pg) => pg.automatic)
      .every((pg) => pg.nodes.every((n) => n.editorOnly)),
  ).toBe(true);
  p.theme.padding = 1;
  expect(layoutProject(p).pages.length).toBe(26);
  p.blocks[1].startSide = "right";
  p.theme.padding = 4;
  const adjusted = layoutProject(p).pages;
  expect(adjusted[1].automatic).toMatchObject({
    kind: "start",
    targetBlockId: "b1",
  });
  expect(
    adjusted.slice(-2).map((pg) => pg.automatic?.kind ?? pg.template),
  ).toEqual(["padding", "back"]);
});

it("does not print festival text on the standard cover or count manual checks as warnings", () => {
  const p = createProject();
  p.festival = "祭名の検証";
  p.date = "2027-10-24";
  const block = p.blocks.find((b) => b.template === "cover")!;
  expect(
    cover({
      project: p,
      block,
      measure: fallbackMeasure,
      left: 12,
      width: 125,
    }).some((n) => n.kind === "text"),
  ).toBe(false);
  const before = layoutProject(p).issues;
  expect(before.some((i) => i.message.includes("学園祭名・開催日入り"))).toBe(
    true,
  );
  const checks = before.filter((i) => i.level === "check");
  expect(checks).toHaveLength(4);
  for (const i of checks) p.manualChecks[i.checkId!] = true;
  expect(layoutProject(p).issues.filter((i) => i.level === "warning")).toEqual(
    before.filter((i) => i.level === "warning"),
  );
});
