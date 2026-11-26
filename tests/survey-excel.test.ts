import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createFestivalProject } from "../packages/core/festival-opening";
import { createProject } from "../packages/core/model";
import {
  interpretRows,
  planRow,
  inspectImportTarget,
  importDecision,
} from "../packages/core/excel-import";
import { normalizeSurveyUrl } from "../packages/core/survey-url";
import { layoutProject } from "../packages/layout-engine";
import { exportPDF } from "../packages/pdf-export";
import { surveyQr } from "../packages/templates/opening";
import { webStorage } from "../packages/project-storage";
it("Excel survey URL creates a vector QR on the existing notice without duplicating pages", async () => {
  const p = createFestivalProject(),
    before = p.blocks.length,
    row = interpretRows(
      "アンケート",
      [
        ["アンケートURL", "見出し", "本文"],
        [
          " https://example.com/survey?festival=28&year=2027 ",
          "来場者アンケート",
          "QRコードからご回答ください。",
        ],
      ],
      true,
    )[0];
  const plan = planRow(p, row),
    id = plan.candidates[0].id;
  expect(row.error).toBeUndefined();
  plan.apply(p, id);
  expect(p.blocks.length).toBe(before);
  const block = p.blocks.find((b) => b.id === id)!;
  expect(block.surveyUrl).toBe(
    "https://example.com/survey?festival=28&year=2027",
  );
  const layout = layoutProject(p),
    pg = layout.pages.find((pg) => pg.blockId === id)!;
  const expected = surveyQr(block.surveyUrl!, 88, 139, 47).find(
    (n) => n.kind === "path",
  )!;
  expect(pg.nodes).toContainEqual(
    expect.objectContaining({
      kind: "path",
      d: expected.kind === "path" ? expected.d : "",
      source: { type: "block", id, field: "surveyUrl" },
    }),
  );
  expect(
    layout.issues.some((i) => i.message.includes("アンケートの有効なURL")),
  ).toBe(false);
  const [medium, bold] = await Promise.all([
    readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
  ]);
  const progress: number[] = [];
  const output = await exportPDF(p, { medium, bold }, (n) => progress.push(n));
  expect(progress).toContain(95);
  expect(progress.at(-1)).toBe(100);
  expect(progress.every((n, i) => i === 0 || n >= progress[i - 1])).toBe(true);
  expect((await PDFDocument.load(output.bytes)).getPageCount()).toBe(
    output.layout.pages.length,
  );
  expect(
    (await webStorage.load(await webStorage.save(p))).project.blocks.find(
      (b) => b.id === id,
    )?.surveyUrl,
  ).toBe(block.surveyUrl);
}, 60000);
it("new URL is selected automatically; replacing an existing URL requires review; reimport is unchanged", () => {
  const p = createFestivalProject(),
    row = interpretRows("アンケート", [["https://example.com/form"]])[0],
    plan = planRow(p, row),
    id = plan.candidates[0].id;
  const decide = () =>
    importDecision(
      row,
      plan,
      false,
      new Map([[id, inspectImportTarget(p, row, id, plan)]]),
    );
  expect(decide().state).toBe("update");
  plan.apply(p, id);
  expect(decide().state).toBe("same");
  p.blocks.find((b) => b.id === id)!.surveyUrl = "https://example.com/previous";
  expect(decide().state).toBe("review");
  expect(
    interpretRows(
      "アンケート",
      [["アンケートURL", "見出し", "本文"], ["", "", ""], ["※ 入力方法の説明"]],
      true,
    ),
  ).toEqual([]);
});
it("supports a single URL column, validates links, and creates a survey page for books without one", () => {
  const p = createProject(),
    row = interpretRows(
      "アンケート",
      [["URL"], ["https://example.com/回答"]],
      true,
    )[0];
  planRow(p, row).apply(p);
  expect(p.blocks.filter((b) => b.openingKind === "survey")).toHaveLength(1);
  expect(p.blocks.find((b) => b.openingKind === "survey")?.surveyUrl).toBe(
    normalizeSurveyUrl("https://example.com/回答"),
  );
  for (const url of [
    "javascript:alert(1)",
    "ftp://example.com",
    "example.com",
    "https://example.com/" + "a".repeat(2048),
  ])
    expect(interpretRows("アンケート", [[url]])[0].error).toBeTruthy();
});
