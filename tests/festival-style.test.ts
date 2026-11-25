import { addEvent } from "../packages/core/registration";
import { createPresetTemplate } from "../apps/web/src/editor/commands";
import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { nextYear } from "../packages/core/model";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";
import { inputGuides } from "../apps/web/src/workspace/inputGuides";

it("副委員長を二人まとめる・別々にする表示を切り替えても元情報を保持", () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.openingKind === "committee")!;
  b.secondName = "副委員長A";
  b.thirdName = "副委員長B";
  b.thirdBody = "個別挨拶";
  const page = () => layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  const values = () =>
    page().nodes.flatMap((n) => (n.kind === "text" ? [n.text] : []));
  expect(values()).toContain("副委員長B");
  expect(values()).not.toContain("個別挨拶");
  expect(inputGuides(p, page()).some((g) => g.label === "項目を追加")).toBe(
    false,
  );
  b.viceMode = "separate";
  expect(values()).toContain("個別挨拶");
  b.viceMode = "together";
  expect(b.thirdBody).toBe("個別挨拶");
});
it("選択した配色は全ページの描画に反映しQRと元設定を保つ", async () => {
  const p = createFestivalProject();
  p.blocks.find((b) => b.openingKind === "survey")!.surveyUrl =
    "https://example.com/survey";
  p.colorPalettes = [
    {
      id: "p",
      name: "試験配色",
      colors: {
        "#ffffff": "#fff4dd",
        "#111111": "#ff0000",
        "#231815": "#242855",
      },
    },
  ];
  p.colorPaletteId = "p";
  const page = layoutProject(p).pages[1];
  expect(page.nodes[0]).toMatchObject({ fill: "#fff4dd" });
  expect(
    page.nodes.find(
      (n) => n.kind === "path" && n.source?.field === "surveyUrl",
    ),
  ).toMatchObject({ fill: "#000000" });
  expect(p.theme.background).toBe("#ffffff");
  expect(
    (await webStorage.load(await webStorage.save(p))).project.colorPalettes,
  ).toEqual(p.colorPalettes);
});
it("分別表と標準見出しのマップ、縦積み1/4広告なしで作成", () => {
  const p = createFestivalProject(),
    l = layoutProject(p);
  expect(l.pages[9].title).toBe("マップ");
  expect(
    createPresetTemplate("ads")
      .objects.filter((o) => o.binding === "advertisement")
      .map((o) => [o.adSize, o.h]),
  ).toEqual([
    ["half", 85],
    ["half", 85],
  ]);
  expect(
    createPresetTemplate("posters")
      .objects.filter((o) => o.binding === "advertisement")
      .map((o) => o.adSize),
  ).toEqual(["quarter"]);
  expect(
    l.pages[6].nodes.some((n) => n.kind === "text" && n.text === "分別区分"),
  ).toBe(true);
  expect(
    p.blocks
      .filter((b) => b.template === "ads")
      .every((b) => b.adSize !== "quarter"),
  ).toBe(true);
});
it("禁煙・禁酒素材を置き換えても前の画像を保存し年度更新にも引き継ぐ", async () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.openingKind === "rules")!;
  for (const id of ["old", "new"])
    p.assets[id] = {
      id,
      name: id,
      mime: "image/png",
      data: "data:image/png;base64,AA==",
      width: 300,
      height: 300,
      rulePicture: "smoking",
    };
  b.smokingPicture = "new";
  const q = (await webStorage.load(await webStorage.save(p))).project;
  expect(q.assets.old.rulePicture).toBe("smoking");
  expect(nextYear(q).assets.old).toEqual(q.assets.old);
  expect(
    layoutProject(q)
      .pages.find((pg) => pg.blockId === b.id)
      ?.nodes.some((n) => n.kind === "asset" && n.assetId === "new"),
  ).toBe(true);
});

it("ポスター4枚の配置と広告枠を維持し、背景とノンブルは標準設定を使う", () => {
  const p = createFestivalProject();
  p.theme.background = "#f1f2f3";
  p.assets.poster = {
    id: "poster",
    name: "ポスター",
    mime: "image/png",
    data: "data:image/png;base64,AA==",
    width: 1052,
    height: 1495,
  };
  for (let i = 0; i < 4; i++) {
    const e = addEvent(p, "student");
    e.name = "企画" + i;
    e.assetId = "poster";
  }
  const page = layoutProject(p).pages.find((p) => p.template === "posters")!;
  expect(
    page.nodes.filter((n) => n.kind === "asset" && n.source?.type === "event"),
  ).toHaveLength(4);
  expect(page.nodes[0]).toMatchObject({ fill: "#f1f2f3" });
  expect(page.nodes.find((n) => n.source?.type === "pageNumber")).toMatchObject(
    { size: 3.2, color: p.theme.ink, y: 203 },
  );
  expect(page.slots.map((s) => s.size)).toEqual(["quarter"]);
});
