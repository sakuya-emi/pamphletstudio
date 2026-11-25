import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";
import { universityWebsite } from "../packages/templates/back-cover";
import { surveyQr } from "../packages/templates/opening";
import { nextYear } from "../packages/core/model";

it("裏表紙の2構図で画像、マップ、大学QRを別の枠に保持する", async () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.template === "back")!;
  for (const id of ["main", "map"])
    p.assets[id] = {
      id,
      name: id,
      mime: "image/png",
      data: "data:image/png;base64,AA==",
      width: 1840,
      height: 846,
    };
  b.assetId = "main";
  b.backMapId = "map";
  expect(b.websiteUrl).toBe(universityWebsite);
  const page = () => layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  for (const variant of ["map-left", "qr-left"] as const) {
    b.backLayout = variant;
    const pg = page();
    const map = pg.nodes.find(
      (n) => n.kind === "asset" && n.assetId === "map",
    )!;
    const image = pg.nodes.find(
      (n) => n.kind === "asset" && n.assetId === "main",
    )!;
    const qr = pg.nodes.find(
      (n) => n.kind === "path" && n.source?.field === "websiteUrl",
    )!;
    expect(map.x < qr.x).toBe(variant === "map-left");
    expect(image.y + image.h).toBeLessThan(map.y);
    expect(qr).toMatchObject(surveyQr(universityWebsite, qr.x, qr.y, qr.w)[1]);
    expect(pg.number).toBeUndefined();
    expect(layoutProject(p).issues.filter((i) => i.level === "error")).toEqual(
      [],
    );
  }
  const q = (await webStorage.load(await webStorage.save(p))).project;
  expect(q.blocks.find((a) => a.id === b.id)).toMatchObject({
    backLayout: "qr-left",
    backMapId: "map",
    websiteUrl: universityWebsite,
  });
  expect(nextYear(q).assets.map).toEqual(q.assets.map);
});
