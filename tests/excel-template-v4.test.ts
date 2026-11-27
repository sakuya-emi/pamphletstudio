import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { expect, it } from "vitest";
import {
  interpretRows,
  importRowOrder,
  planRow,
  sheets,
  type ImportSheet,
} from "../packages/core/excel-import";
import { adCompany } from "../packages/core/registration";
import { createFestivalProject } from "../packages/core/festival-opening";
import { layoutProject } from "../packages/layout-engine";

// These generated workbooks use inline strings, not a shared-string table.
// Browser acceptance also exercises readWorkbook with the actual XLSX files.
const decode = (s: string) =>
  s.replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (v) =>
      ({
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      })[v]!,
  );
async function workbook(version: string) {
  const zip = await JSZip.loadAsync(
    await readFile(
      `public/templates/Pamphlet-Studio-Excel-template-${version}.xlsx`,
    ),
  );
  expect(zip.file("xl/sharedStrings.xml")).toBeNull();
  const xml = await zip.file("xl/workbook.xml")!.async("string");
  const names = [...xml.matchAll(/<sheet\s[^>]*name="([^"]+)"/g)].map((m) =>
    decode(m[1]),
  );
  const result = [];
  for (const [i, name] of names.entries()) {
    const text = (
      await zip.file(`xl/worksheets/sheet${i + 1}.xml`)!.async("string")
    ).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
    const rows: string[][] = [];
    for (const row of text.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(
        /<c\b[^>]*r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs,
      )) {
        const col =
          [...c[1]].reduce((v, k) => v * 26 + k.charCodeAt(0) - 64, 0) - 1;
        while (cells.length < col) cells.push("");
        cells[col] = decode(
          c[2].match(/<t(?:\s[^>]*)?>(.*?)<\/t>/s)?.[1] ??
            c[2].match(/<v>(.*?)<\/v>/s)?.[1] ??
            "",
        );
      }
      rows.push(cells);
    }
    result.push({ name, text, rows });
  }
  return result;
}

it("v4は16シートの空欄版・架空記入例版を分離し、入力欄と見出しを保護する", async () => {
  for (const version of ["v4", "v4-example"]) {
    const book = await workbook(version);
    expect(book).toHaveLength(16);
    const guide = book[0];
    expect(guide.name).toBe("はじめに");
    for (const name of Object.keys(sheets)) expect(guide.text).toContain(name);
    expect(guide.text).toContain(version === "v4" ? "空欄版" : "記入例版");
    for (const s of book.slice(1)) {
      expect(s.text).toContain("<sheetProtection");
      expect(s.text).toContain('state="frozen"');
      expect(s.rows[3]).toEqual([...sheets[s.name as ImportSheet]]);
      expect(s.text).toContain('rgb="00548235"');
    }
    const poster = book.find((s) => s.name === "学生企画")!.text;
    expect(poster).toContain('sqref="G5:G204"');
    expect(poster).toContain('errorStyle="stop"');
    expect(poster).toContain('showErrorMessage="1"');
    expect(poster).toContain('"要,不要"');
    expect(book.find((s) => s.name === "広告")!.text).toContain(
      '"1ページ,1/2ページ,1/4ページ"',
    );
    expect(book.find((s) => s.name === "お知らせ・注意事項")!.text).toContain(
      '"お知らせ,注意事項"',
    );
    expect(book.find((s) => s.name === "ステージ企画")!.text).toContain(
      'type="time"',
    );
    expect(book.find((s) => s.name === "基本情報")!.text).toContain(
      'type="date"',
    );
    expect(book.find((s) => s.name === "アンケート")!.text).toContain(
      'sqref="A5"',
    );
    const styles = await JSZip.loadAsync(
      await readFile(
        `public/templates/Pamphlet-Studio-Excel-template-${version}.xlsx`,
      ),
    );
    expect(await styles.file("xl/styles.xml")!.async("string")).toContain(
      'locked="0"',
    );
    if (version === "v4")
      expect(
        book
          .slice(1)
          .flatMap((s) => interpretRows(s.name as ImportSheet, s.rows, true)),
      ).toEqual([]);
  }
});

it("実ファイルのv3とv4記入例で認識・登録・ページ構成が一致し、URLの新旧入力欄にも対応する", async () => {
  const base = createFestivalProject();
  const books = await Promise.all([workbook("v3"), workbook("v4-example")]);
  function summary(book: Awaited<ReturnType<typeof workbook>>, qr: boolean) {
    const p = structuredClone(base);
    const records = book
      .filter((s) => s.name !== "はじめに")
      .flatMap((s) => {
        const name = s.name;
        const rows = structuredClone(s.rows);
        if (qr && name === "アンケート") {
          const h = rows.findIndex((r) => r[0] === "アンケートURL");
          rows[h + 1] = [
            "https://example.com/survey",
            "アンケート",
            "ご協力ください",
          ];
        }
        return interpretRows(name as ImportSheet, rows, true);
      });
    for (const i of importRowOrder(records)) {
      const r = records[i];
      const action = planRow(p, r);
      expect(action.error).toBeUndefined();
      action.apply(p, action.candidates[0]?.id);
    }
    return {
      count: records.length,
      events: p.events.map((e) => [
        e.category,
        e.name,
        e.startTime,
        e.endTime,
        e.posterRequired,
        e.location,
      ]),
      ads: p.ads.map((a) => [adCompany(p, a.id), a.size]),
      staff: p.staff.map((s) => [s.name, s.role, s.grade]),
      pages: layoutProject(p).pages.map((pg) => ({
        template: pg.template,
        nodes: pg.nodes.map((n) => {
          const { id, source, ...rest } = n;
          return rest;
        }),
      })),
    };
  }
  for (const qr of [false, true]) {
    const old = summary(books[0], qr);
    expect(summary(books[1], qr)).toEqual(old);
    expect(old.count).toBe(qr ? 61 : 60);
  }
});
