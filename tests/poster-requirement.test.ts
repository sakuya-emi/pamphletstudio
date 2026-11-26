import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { createProject } from "../packages/core/model";
import { addEvent } from "../packages/core/registration";
import {
  interpretRows,
  planRow,
  sheets,
  type ImportSheet,
} from "../packages/core/excel-import";
import { mediaItems, mediaSummary } from "../apps/web/src/workspace/workflow";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";
import { writeSource } from "../packages/core/editing";
import fixture from "./fixtures/excel-template-v2.json";
it("imports the actual v2 workbook; opening and closing ceremonies need no poster", async () => {
  const p = createFestivalProject();
  for (const [sheet, rows] of Object.entries(fixture))
    if (Object.hasOwn(sheets, sheet))
      for (const row of interpretRows(sheet as ImportSheet, rows, true)) {
        const action = planRow(p, row);
        expect(action.error).toBeFalsy();
        action.apply(p, action.candidates[0]?.id);
      }
  const ceremonies = p.events.filter((e) =>
    ["開会式", "閉会式"].includes(e.name),
  );
  expect(ceremonies).toHaveLength(2);
  expect(ceremonies.every((e) => e.posterRequired === false)).toBe(true);
  expect(mediaItems(p).some((i) => ceremonies.some((e) => e.id === i.id))).toBe(
    false,
  );
  const pages = layoutProject(p, fallbackMeasure);
  expect(
    pages.issues.some((i) =>
      ceremonies.some((e) => i.message.includes("ポスター未登録：" + e.name)),
    ),
  ).toBe(false);
  const saved = (await webStorage.load(await webStorage.save(p))).project;
  expect(
    saved.events
      .filter((e) => ceremonies.some((c) => c.id === e.id))
      .every((e) => e.posterRequired === false),
  ).toBe(true);
});
it("old Excel defaults to required, including when reimporting an existing unnecessary record", () => {
  const p = createProject();
  p.events = [];
  const row = interpretRows(
    "ステージ企画",
    [
      ["企画名", "開始時刻", "終了時刻"],
      ["式典", "09:30", "10:00"],
    ],
    true,
  )[0];
  planRow(p, row).apply(p);
  expect(p.events[0].posterRequired).toBe(true);
  p.events[0].posterRequired = false;
  planRow(p, row).apply(p, p.events[0].id);
  expect(p.events[0].posterRequired).toBe(true);
  expect(
    interpretRows("ステージ企画", [["式典", "09:30", "10:00", "どちらでも"]])[0]
      .error,
  ).toContain("ポスター要否");
});
it("unnecessary posters have text layout and no placeholder, required missing posters retain placeholder and warning", () => {
  const p = createProject();
  p.events = [];
  p.blocks = [
    {
      ...p.blocks[0],
      template: "posters",
      posterMode: "single",
      eventCategory: "stage",
    },
  ];
  const no = addEvent(p, "stage"),
    yes = addEvent(p, "stage");
  no.name = "式典";
  no.posterRequired = false;
  yes.name = "ライブ";
  let result = layoutProject(p, fallbackMeasure);
  expect(
    result.pages
      .flatMap((pg) => pg.nodes)
      .filter((n) => n.kind === "text" && n.source?.id === no.id)
      .map((n) => (n.kind === "text" ? n.text : ""))
      .join(""),
  ).toContain("式典");
  expect(
    result.pages
      .flatMap((pg) => pg.nodes)
      .some((n) => n.source?.id === no.id && n.source.field === "assetId"),
  ).toBe(false);
  expect(
    result.issues.some((i) => i.message.includes("ポスター未登録：ライブ")),
  ).toBe(true);
  expect(
    result.pages.some(
      (pg) =>
        pg.template === "stage" &&
        pg.nodes.some((n) => n.source?.id === yes.id),
    ),
  ).toBe(true);
  expect(mediaSummary(p).missing).toBe(2); // cover + live
  writeSource(
    p,
    { type: "event", id: yes.id, field: "posterRequired" },
    "不要",
  );
  result = layoutProject(p);
  expect(mediaSummary(p).missing).toBe(1);
  expect(result.issues.some((i) => i.message.includes("ポスター未登録"))).toBe(
    false,
  );
});
it("external special events retain poster requirement in their text-page records", () => {
  const p = createProject();
  const row = interpretRows(
    "外部・特別企画",
    [
      [
        "企画名",
        "団体名",
        "場所",
        "開始時刻",
        "終了時刻",
        "備考",
        "ポスター要否",
      ],
      ["式典", "団体", "ホール", "09:30", "10:00", "本文", "不要"],
    ],
    true,
  )[0];
  planRow(p, row).apply(p);
  const b = p.blocks.find((b) => b.externalEvent)!;
  expect(b.posterRequired).toBe(false);
  expect(mediaItems(p).some((i) => i.id === b.id)).toBe(false);
  writeSource(p, { type: "block", id: b.id, field: "posterRequired" }, "要");
  expect(mediaItems(p).some((i) => i.id === b.id)).toBe(true);
});
