import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { nextYear } from "../packages/core/model";
import { defaultRuleMark, resolveAsset } from "../packages/core/rule-marks";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";

function marks(project: ReturnType<typeof createFestivalProject>) {
  const block = project.blocks.find((b) => b.openingKind === "rules")!;
  return layoutProject(project)
    .pages.find((p) => p.blockId === block.id)!
    .nodes.flatMap((n) => (n.kind === "asset" ? [n.assetId] : []));
}

it("uses the two bundled signs by default and keeps explicit legacy choices", () => {
  const p = createFestivalProject();
  const smoking = defaultRuleMark("smoking"),
    drinking = defaultRuleMark("drinking");
  expect(marks(p)).toEqual([smoking.id, drinking.id]);
  expect(resolveAsset(p, smoking.id)?.mime).toBe("image/png");
  expect(resolveAsset(p, drinking.id)?.mime).toBe("image/png");
  expect(p.assets[smoking.id]).toBeUndefined();
  p.blocks.find((b) => b.openingKind === "rules")!.smokingPicture = "symbol";
  expect(marks(p)).toEqual([drinking.id]);
});

it("preserves a chosen custom mark in a portable project and its next-year copy", async () => {
  const p = createFestivalProject();
  const custom = {
    ...defaultRuleMark("smoking"),
    id: "custom-test",
    rulePicture: "smoking" as const,
  };
  p.assets[custom.id] = custom;
  p.blocks.find((b) => b.openingKind === "rules")!.smokingPicture = custom.id;
  const reopened = (await webStorage.load(await webStorage.save(p))).project;
  for (const copy of [reopened, nextYear(reopened)]) {
    expect(marks(copy)[0]).toBe(custom.id);
    expect(copy.assets[custom.id]).toMatchObject(custom);
  }
});
