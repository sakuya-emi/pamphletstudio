import { expect, it } from "vitest";
import {
  starter,
  designKinds,
  copyStarter,
  sampleScenario,
} from "../apps/web/src/editor/shared-start";
import { createFestivalSample } from "../packages/core/festival-sample";
import { validateDesign } from "../packages/designer/model";
import {
  emptyLibrary,
  installRelease,
  publishTemplate,
  validateLibrary,
} from "../packages/designer/library";
import { renderTemplate } from "../packages/designer/render";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";

it("keeps the blank and example designs usable and copies existing designs independently", () => {
  for (const [kind] of designKinds) {
    const example = validateDesign(starter(kind));
    const blank = validateDesign(starter(kind, true));
    const copy = copyStarter(example);
    expect(copy.id).not.toBe(example.id);
    expect(copy.objects).toEqual(example.objects);
    expect(blank.category).toBe(kind);
  }
});

it("does not publish sample records; a selected release updates only the destination table", () => {
  const project = createFestivalSample(),
    original = JSON.stringify(project);
  const t = starter("表", true);
  const table = t.objects[0];
  table.columns![0].weight = 54;
  table.tableStyle!.base.size = 3.8;
  table.tableStyle!.columns[0] = { align: "center" };
  const normal = renderTemplate(project, t).flat();
  expect(
    normal.some(
      (n) => n.kind === "text" && n.source?.field === "name" && n.size === 3.8,
    ),
  ).toBe(true);
  expect(
    renderTemplate(sampleScenario(project, "many"), t).length,
  ).toBeGreaterThan(1);
  expect(JSON.stringify(project)).toBe(original);
  const lib = publishTemplate({ ...emptyLibrary(), drafts: [t] }, t.id);
  const release = lib.releases[0];
  expect(JSON.stringify(release)).not.toContain(project.events[0].name);
  const installed = installRelease(project, release);
  expect(installed.objects[0].columns![0].weight).toBe(54);
  t.objects[0].columns![0].weight = 20;
  expect(installed.objects[0].columns![0].weight).toBe(54);
});

it("repeats real staff and kitchen entries with the applied design and round-trips the release and project", async () => {
  for (const [kind, key, source] of [
    ["スタッフ紹介", "staff", "staff"],
    ["キッチンカー紹介", "kitchen", "kitchenMenu"],
  ] as const) {
    const sample = createFestivalSample();
    const design = starter(kind, true);
    const lib = validateLibrary(
      JSON.parse(
        JSON.stringify(
          publishTemplate({ ...emptyLibrary(), drafts: [design] }, design.id),
        ),
      ),
    );
    const p = sampleScenario(sample, "many");
    const t = installRelease(p, lib.releases[0]);
    const block = p.blocks.find((b) => b.template === key)!;
    block.templateId = t.id;
    const roundTrip = (await webStorage.load(await webStorage.save(p))).project;
    const pages = layoutProject(roundTrip).pages.filter(
      (page) => page.blockId === block.id,
    );
    expect(pages.length).toBeGreaterThan(1);
    const placed = new Set(
      pages.flatMap((pg) =>
        pg.nodes.flatMap((n) =>
          n.source?.type === source ? [n.source.id] : [],
        ),
      ),
    );
    const expected = key === "staff" ? p.staff : p.kitchenMenus!;
    expect(expected.every((item) => placed.has(item.id))).toBe(true);
    if (key === "kitchen") {
      const missing = renderTemplate(sampleScenario(p, "noImages"), t).flat();
      expect(missing.some((n) => n.kind === "asset")).toBe(false);
      expect(
        missing.some((n) => n.kind === "text" && n.source?.type === source),
      ).toBe(true);
    }
  }
});
