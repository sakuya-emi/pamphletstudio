import { expect, it } from "vitest";
import {
  emptyLibrary,
  publishTemplate,
  restoreRelease,
  installedRelease,
  installRelease,
  validateLibrary,
} from "../packages/designer/library";
import { tablePreset, textPreset } from "../packages/designer/presets";
import { createFestivalProject } from "../packages/core/festival-opening";
import { applyComponent } from "../packages/designer/components";
import { layoutProject } from "../packages/layout-engine";
import {
  polygonObject,
  penGeometry,
  reverseAnchors,
  splitPath,
} from "../packages/designer/path-tools";
import { object } from "../packages/designer/model";

it("公開版は不変で、後の下書き編集と冊子の内容を分離する", () => {
  const lib = emptyLibrary(),
    t = tablePreset("stripe");
  lib.drafts.push(t);
  const originalName = t.name;
  const first = publishTemplate(lib, t.id);
  const p = createFestivalProject(),
    before = structuredClone(p);
  const added = installRelease(p, first.releases[0]);
  const block = p.blocks.find((b) => b.template === "events")!;
  applyComponent(p, block.id, added.id);
  first.drafts[0].name = "新版";
  first.drafts[0].objects[0].headerFill = "#123456";
  const second = publishTemplate(first, t.id);
  expect(second.releases.map((r) => r.version)).toEqual([1, 2]);
  expect(first.releases[0].templates.find((x) => x.id === t.id)?.name).toBe(
    originalName,
  );
  expect(
    p.templates.find((x) => x.id === added.id)?.objects[0].headerFill,
  ).not.toBe("#123456");
  expect(p.events).toEqual(before.events);
  expect(p.assets).toEqual(before.assets);
  const next = installRelease(p, second.releases[1]);
  expect(next.id).not.toBe(added.id);
  expect(
    p.blocks.find((b) => b.id === block.id)?.components?.[0].templateId,
  ).toBe(added.id);
  const restored = restoreRelease(second, t.id, 1);
  expect(restored.drafts.find((d) => d.id === t.id)?.name).toBe(originalName);
  expect(
    validateLibrary(JSON.parse(JSON.stringify(restored))).releases,
  ).toHaveLength(2);
});
it("依存テンプレートと素材をまとめ、冊子の画像と衝突しない", () => {
  const lib = emptyLibrary(),
    root = tablePreset("cards"),
    dep = textPreset("見出し");
  root.masterId = dep.id;
  dep.scope = "master";
  const img = object("image", dep.layers[0].id);
  img.assetId = "logo";
  dep.objects.push(img);
  lib.drafts.push(root, dep);
  lib.assets.logo = {
    id: "logo",
    name: "image",
    mime: "image/png",
    width: 100,
    height: 100,
    data: "data:image/png;base64,AA==",
  };
  const release = publishTemplate(lib, root.id).releases[0];
  const p = createFestivalProject();
  p.assets.logo = { ...lib.assets.logo, name: "既存" };
  const copy = installedRelease(release);
  expect(copy.template.masterId).not.toBe(dep.id);
  installRelease(p, release);
  expect(p.assets.logo.name).toBe("既存");
  expect(Object.keys(copy.assets)).toHaveLength(1);
  root.masterId = "missing";
  expect(() => publishTemplate(lib, root.id)).toThrow();
  dep.masterId = root.id;
  root.masterId = dep.id;
  expect(() => publishTemplate(lib, root.id)).toThrow("循環");
});
it("ペンの曲線ハンドル、パス分割・反転・星形は編集可能なアンカーになる", () => {
  const shape = penGeometry([
    { x: 10, y: 15, out: { x: 30, y: 5 } },
    { x: 50, y: 45, in: { x: 40, y: 60 } },
  ]);
  expect(shape.anchors[0].out).toBeDefined();
  const o = object("path", "layer");
  o.anchors = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.8 },
    { x: 1, y: 1 },
  ];
  const [a, b] = splitPath(o, 1);
  expect(a.anchors).toHaveLength(2);
  expect(b.id).not.toBe(a.id);
  expect(reverseAnchors(shape.anchors)[0].out).toEqual(shape.anchors[1].in);
  expect(polygonObject("layer", 5, true).anchors).toHaveLength(10);
});
it("非表示のオブジェクトは組版とPDF向け描画から除外する", () => {
  const p = createFestivalProject(),
    t = textPreset("見出し");
  t.objects[0].visible = false;
  p.templates.push(t);
  const block = p.blocks.find((b) => b.template === "events")!;
  applyComponent(p, block.id, t.id);
  expect(
    layoutProject(p)
      .pages.filter((pg) => pg.blockId === block.id)
      .flatMap((pg) => pg.nodes)
      .some(
        (n) =>
          n.objectId ===
          block.components?.find((c) => c.kind === "text")?.targetObjectId,
      ),
  ).toBe(false);
});

it("過去版の復元でほかの下書きや画像を上書きしない", () => {
  const lib = emptyLibrary(),
    root = tablePreset("stripe"),
    master = textPreset("見出し");
  master.scope = "master";
  root.masterId = master.id;
  lib.drafts = [root, master];
  const released = publishTemplate(lib, root.id);
  released.drafts.find((t) => t.id === master.id)!.name = "新しいマスター";
  const restored = restoreRelease(released, root.id, 1);
  expect(restored.drafts.find((t) => t.id === master.id)?.name).toBe(
    "新しいマスター",
  );
  expect(restored.drafts.find((t) => t.id === root.id)?.masterId).not.toBe(
    master.id,
  );
});

it("公開した配色を固定し、後のライブラリ配色変更で公開版を変えない", () => {
  const lib = emptyLibrary(),
    t = tablePreset("stripe");
  const old = t.objects[0].headerFill;
  lib.drafts = [t];
  lib.paletteId = "p";
  lib.palettes = [
    { id: "p", name: "共通配色", colors: { [old.toLowerCase()]: "#123456" } },
  ];
  const released = publishTemplate(lib, t.id);
  expect(
    released.releases[0].templates.find((t) => t.id === lib.drafts[0].id)
      ?.objects[0].headerFill,
  ).toBe("#123456");
  expect(lib.drafts[0].objects[0].headerFill).toBe(old);
});
