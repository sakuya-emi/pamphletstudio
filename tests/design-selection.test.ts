import { it, expect } from "vitest";
import { createFestivalSample } from "../packages/core/festival-sample";
import { applyComponent } from "../packages/designer/components";
import { tablePreset } from "../packages/designer/presets";
import {
  applyPageVariant,
  applyThemeVariant,
  currentPartId,
} from "../apps/web/src/workspace/design-selection";

it("distinguishes a preview on a copy from a design applied to the book", () => {
  const p = createFestivalSample();
  const b = p.blocks.find((b) => b.template === "events")!;
  const table = tablePreset("stripe");
  const before = currentPartId(p, b, table);
  const copy = structuredClone(p);
  copy.templates.push(table);
  applyComponent(copy, b.id, table.id);
  expect(currentPartId(p, b, table)).toBe(before);
  expect(before).not.toBe(table.id);
  expect(
    currentPartId(
      copy,
      copy.blocks.find((a) => a.id === b.id),
      table,
    ),
  ).toBe(table.id);
  expect(copy.events).toEqual(p.events);
  expect(copy.ads).toEqual(p.ads);
  expect(copy.kitchenMenus).toEqual(p.kitchenMenus);
  expect(copy.staff).toEqual(p.staff);
});

it("applies a page variant to its stated scope without replacing custom pages", () => {
  const p = createFestivalSample();
  const b = p.blocks.find((b) => b.template === "posters")!;
  const other = { ...b, id: "other" };
  const custom = { ...b, id: "custom", templateId: "saved" };
  p.blocks.push(other, custom);
  applyPageVariant(p, b.id, { posterSpacing: "compact" }, false);
  expect(b.posterSpacing).toBe("compact");
  expect(other.posterSpacing).not.toBe("compact");
  applyPageVariant(p, b.id, { posterSpacing: "compact" }, true);
  expect(other.posterSpacing).toBe("compact");
  expect(custom.posterSpacing).not.toBe("compact");
  applyPageVariant(p, custom.id, { templateId: undefined }, false);
  expect(custom.templateId).toBeUndefined();
  const blocks = structuredClone(p.blocks);
  applyThemeVariant(p, "indexShape", "square");
  expect(p.theme.indexShape).toBe("square");
  expect(p.blocks).toEqual(blocks);
});
