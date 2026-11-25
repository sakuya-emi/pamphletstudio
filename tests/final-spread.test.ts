import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { addEvent } from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
it("未入力アンケートのQRダミーは印刷対象外、URL確定後はパスになる", () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.openingKind === "survey")!;
  const nodes = () =>
    layoutProject(p).pages.find((pg) => pg.blockId === b.id)!.nodes;
  expect(
    nodes().find((n) => n.kind === "text" && n.text === "QRダミー"),
  ).toMatchObject({ editorOnly: true });
  b.surveyUrl = "https://example.com/";
  expect(
    nodes().some(
      (n) =>
        n.kind === "path" && n.source?.field === "surveyUrl" && !n.editorOnly,
    ),
  ).toBe(true);
});
it("キッチンカーの開催場所を屋外・マップに記載として描く", () => {
  const p = createFestivalProject(),
    e = addEvent(p, "kitchen");
  e.name = "テスト店舗";
  e.building = "本館";
  e.room = "C101";
  const nodes = layoutProject(p).pages.find(
    (pg) => pg.heading === "企画一覧",
  )!.nodes;
  expect(nodes.some((n) => n.kind === "text" && n.text === "屋外")).toBe(true);
  expect(
    nodes.some((n) => n.kind === "text" && n.text === "マップに記載"),
  ).toBe(true);
  expect(nodes.some((n) => n.kind === "text" && n.text.includes("C101"))).toBe(
    false,
  );
});
it("中綴じでスタッフ見開きを保ち、調整用白紙を裏表紙の直前に置く", () => {
  const p = createFestivalProject();
  p.theme.padding = 4;
  for (const binding of ["left", "right"] as const) {
    p.theme.binding = binding;
    const { pages } = layoutProject(p);
    expect(pages.length % 4).toBe(0);
    expect(
      pages
        .filter((pg) => pg.automatic?.kind !== "padding")
        .slice(-3)
        .map((pg) => pg.template),
    ).toEqual(["staff", "staff", "back"]);
    expect(
      pages.filter((pg) => pg.template === "staff").map((pg) => pg.side),
    ).toEqual(binding === "left" ? ["left", "right"] : ["right", "left"]);
  }
});
