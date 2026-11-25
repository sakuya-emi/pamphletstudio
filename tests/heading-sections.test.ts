import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { addEvent } from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
import { headingEntries } from "../packages/templates/contents";

it("未登録でも12ページ目以降に指定された企画構成を用意する", () => {
  const p = createFestivalProject(),
    l = layoutProject(p);
  expect(l.pages.slice(11, 17).map((pg) => pg.heading)).toEqual([
    "キッチンカー",
    "学生企画一覧",
    "学生企画",
    "学生ステージ企画一覧",
    "学生ステージ企画",
    "自治会ステージ企画",
  ]);
  expect(l.pages[16].slots).toEqual([]);
});
it("同じ見出しの連続をまとめ、後で再登場した見出しは別の項目にする", () => {
  const p = createFestivalProject();
  const b = p.blocks.find((b) => b.openingKind === "waste")!;
  const i = p.blocks.indexOf(b);
  p.blocks.splice(
    i + 1,
    0,
    { ...b, id: "duplicate" },
    { ...b, id: "other", title: "別の見出し" },
    { ...b, id: "repeated" },
  );
  const l = layoutProject(p),
    items = headingEntries(l.pages);
  expect(
    items.filter((pg) => pg.heading === b.title).map((pg) => pg.blockId),
  ).toEqual([b.id, "repeated"]);
  const repeat = l.pages.find((pg) => pg.blockId === "duplicate")!;
  expect(repeat.nodes.some((n) => n.source?.field === "title")).toBe(false);
  const toc = l.pages
    .filter((pg) => pg.template === "contents")
    .flatMap((pg) => pg.nodes);
  expect(toc.some((n) => n.kind === "text" && n.text === "別の見出し")).toBe(
    true,
  );
  expect(toc.some((n) => n.source?.type === "chapter")).toBe(true); // tabs remain independent
  expect(
    toc.filter((n) => n.kind === "text" && n.text === b.title),
  ).toHaveLength(2);
});
it("多数の見出しでは目次を分割して最終ノンブルを載せる", () => {
  const p = createFestivalProject();
  const sample = p.blocks.find((b) => b.openingKind === "waste")!;
  for (let i = 0; i < 25; i++)
    p.blocks.splice(-1, 0, {
      ...sample,
      id: "section" + i,
      title: "追加見出し " + i,
    });
  const l = layoutProject(p),
    toc = l.pages.filter((pg) => pg.template === "contents");
  expect(toc.length).toBeGreaterThan(1);
  const last = l.pages.find((pg) => pg.blockId === "section24")!;
  const nodes = toc.flatMap((pg) => pg.nodes);
  const index = nodes.findIndex(
    (n) => n.kind === "text" && n.text === "追加見出し 24",
  );
  expect(index).toBeGreaterThan(-1);
  expect(nodes[index + 1]).toMatchObject({ text: String(last.number) });
});
it("企画種別を混ぜず学生ステージは4枠＋広告、自治会ステージは各1枚", () => {
  const p = createFestivalProject();
  for (const category of ["student", "studentStage", "stage"] as const)
    for (let i = 0; i < 5; i++) {
      const e = addEvent(p, category);
      e.name = category + i;
      e.startTime = "10:00";
      e.assetId = "sample";
    }
  p.assets.sample = {
    id: "sample",
    name: "sample",
    mime: "image/png",
    data: "data:image/png;base64,AA==",
    width: 1052,
    height: 1495,
  };
  const l = layoutProject(p);
  const posters = (heading: string) =>
    l.pages.filter((pg) => pg.heading === heading);
  const imageCount = (pg: (typeof l.pages)[number]) =>
    pg.nodes.filter((n) => n.kind === "asset").length;
  expect(posters("学生ステージ企画").map(imageCount)).toEqual([4, 1]);
  expect(posters("学生ステージ企画").every((pg) => pg.slots.length === 1)).toBe(
    true,
  );
  expect(posters("自治会ステージ企画").map(imageCount)).toEqual([
    1, 1, 1, 1, 1,
  ]);
  expect(posters("自治会ステージ企画").every((pg) => !pg.slots.length)).toBe(
    true,
  );
  expect(
    posters("学生企画一覧")[0].nodes.some(
      (n) => n.kind === "text" && n.text === "studentStage0",
    ),
  ).toBe(false);
  expect(
    posters("学生ステージ企画一覧")[0].nodes.some(
      (n) => n.kind === "text" && n.text === "studentStage0",
    ),
  ).toBe(true);
});
