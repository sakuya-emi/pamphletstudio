import { ComponentChoices } from "../apps/web/src/workspace/ComponentChoices";
import { createProject } from "../packages/core/model";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFestivalProject } from "../packages/core/festival-opening";
import {
  interpretRows,
  planRow,
  inspectImportTarget,
  importDecision,
  surveyConflictRows,
} from "../packages/core/excel-import";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { ExcelImport } from "../apps/web/src/workspace/ExcelImport";
import { DataWorkspace } from "../apps/web/src/workspace/DataWorkspace";
import { addEvent } from "../packages/core/registration";
import { writeSource } from "../packages/core/editing";
it("first survey import defaults to update even with new heading and body; later replacement is explicit", () => {
  const p = createFestivalProject(),
    row = interpretRows("アンケート", [
      ["https://example.com/form", "来場者アンケート", "新しい案内本文"],
    ])[0],
    plan = planRow(p, row),
    id = plan.candidates[0].id;
  const info = () => inspectImportTarget(p, row, id, plan);
  expect(importDecision(row, plan, false, new Map([[id, info()]])).state).toBe(
    "update",
  );
  plan.apply(p, id);
  expect(importDecision(row, plan, false, new Map([[id, info()]])).state).toBe(
    "same",
  );
  p.blocks.find((b) => b.id === id)!.surveyUrl = "https://example.com/old";
  const html = renderToStaticMarkup(
    <ExcelImport
      inline
      project={p}
      update={() => {}}
      initialSheet="アンケート"
      initialText="https://example.com/form\t来場者アンケート\t新しい案内本文"
      close={() => {}}
      done={() => {}}
    />,
  );
  expect(html).toContain("アンケートが未確定");
  expect(html).toMatch(/disabled=""[^>]*>[0-9]+件を登録/);
});
it("survey sheet owns notice and page-text rows targeting its page; legacy workbooks are unchanged", () => {
  const p = createFestivalProject(),
    rows = [
      ...interpretRows("アンケート", [
        ["https://example.com/form", "来場者アンケート", "優先本文"],
      ]),
      ...interpretRows("お知らせ・注意事項", [
        ["案内", "アンケートのご案内", "上書きさせない"],
      ]),
      ...interpretRows("ページ用テキスト", [
        ["アンケート", "旧タイトル", "上書きさせない"],
      ]),
    ];
  expect([...surveyConflictRows(p, rows)]).toEqual([1, 2]);
  expect(surveyConflictRows(p, rows.slice(1)).size).toBe(0);
  for (const [i, row] of rows.entries())
    if (!surveyConflictRows(p, rows).has(i)) {
      const plan = planRow(p, row);
      plan.apply(p, plan.candidates[0]?.id);
    }
  const b = p.blocks.find((b) => b.openingKind === "survey")!;
  expect(b.body).toBe("優先本文");
  expect(b.title).toBe("来場者アンケート");
});
it("survey URL is printed and also editable from common-information rows", () => {
  const p = createFestivalProject(),
    b = p.blocks.find((b) => b.openingKind === "survey")!;
  b.surveyUrl = "https://example.com/survey";
  const page = layoutProject(p).pages.find((pg) => pg.blockId === b.id)!;
  expect(
    page.nodes.some(
      (n) =>
        n.kind === "text" &&
        n.text.includes("https://example.com/survey") &&
        !n.editorOnly,
    ),
  ).toBe(true);
  writeSource(
    p,
    { type: "block", id: b.id, field: "surveyUrl" },
    " https://example.com/updated ",
  );
  expect(b.surveyUrl).toBe("https://example.com/updated");
});
it("text-only ceremony events share a compact page and retain both start and end times", () => {
  const p = createFestivalProject();
  p.events = [];
  const b = p.blocks.find(
    (b) => b.template === "posters" && b.eventCategory === "stage",
  )!;
  for (const [name, start, end] of [
    ["開会式", "09:30", "10:00"],
    ["閉会式", "15:40", "16:00"],
  ]) {
    const e = addEvent(p, "stage");
    Object.assign(e, {
      name,
      startTime: start,
      endTime: end,
      posterRequired: false,
    });
  }
  const pages = layoutProject(p, fallbackMeasure).pages.filter(
    (pg) => pg.blockId === b.id,
  );
  expect(pages).toHaveLength(1);
  const text = pages
    .flatMap((p) => p.nodes)
    .filter((n) => n.kind === "text")
    .map((n) => (n.kind === "text" ? n.text : ""))
    .join(" ");
  expect(text).toContain("開会式");
  expect(text).toContain("閉会式");
  expect(text).toContain("09:30〜10:00");
});

it("unsupported bullet styles are disabled with an explanation instead of failing on click", () => {
  const p = createFestivalProject();
  const html = renderToStaticMarkup(
    <ComponentChoices
      project={p}
      measure={fallbackMeasure}
      fixedCategory="箇条書き"
      allowGlobal
      select={() => {}}
    />,
  );
  expect(html).toContain("適用先の本文ページがないため選択できません");
  expect(html).toContain('disabled=""');
});
it("unplaced ads explain missing capacity, and survey ownership works without an existing survey page", () => {
  const p = createProject();
  const rows = [
    ...interpretRows("アンケート", [["https://example.com/form"]]),
    ...interpretRows("お知らせ・注意事項", [
      ["案内", "アンケートのご案内", "重複本文"],
    ]),
  ];
  expect([...surveyConflictRows(p, rows)]).toEqual([1]);
  p.sponsors.push({ id: "s", name: "未配置企業", kana: "", sortKey: "" });
  p.ads.push({ id: "a", sponsorId: "s", size: "full" });
  const warning = layoutProject(p).issues.find((i) => i.adId === "a");
  expect(warning?.message).toContain("同じ規格の空き枠がありません");
});
