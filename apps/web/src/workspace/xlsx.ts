import JSZip from "jszip";
export type SheetRows = { name: string; rows: string[][] };
export async function readWorkbook(file: Blob): Promise<SheetRows[]> {
  if (file.size > 20_000_000)
    throw new Error("Excelファイルは20MB以下にしてください。");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  let total = 0;
  const xml = async (path: string) => {
    const entry = zip.file(path);
    if (!entry) throw new Error("Excelの構成を読み取れません。");
    const data = await entry.async("string");
    total += data.length;
    if (total > 30_000_000 || /<!DOCTYPE/i.test(data))
      throw new Error("Excelの展開サイズまたは形式が対応範囲外です。");
    const doc = parser.parseFromString(data, "application/xml");
    if (doc.querySelector("parsererror"))
      throw new Error("ExcelのXMLが不正です。");
    return doc;
  };
  const els = (parent: Document | Element, tag: string) =>
    Array.from(parent.getElementsByTagNameNS("*", tag));
  const rich = (e: Element) =>
    els(e, "t")
      .filter((t) => t.parentElement?.localName !== "rPh")
      .map((t) => t.textContent)
      .join("");
  const workbook = await xml("xl/workbook.xml");
  const date1904 = ["1", "true"].includes(
    els(workbook, "workbookPr")[0]?.getAttribute("date1904") ?? "",
  );
  const relationships = new Map(
    els(await xml("xl/_rels/workbook.xml.rels"), "Relationship")
      .filter((r) => r.getAttribute("TargetMode") !== "External")
      .map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]),
  );
  const strings = zip.file("xl/sharedStrings.xml")
    ? els(await xml("xl/sharedStrings.xml"), "si").map(rich)
    : [];
  const result: SheetRows[] = [];
  for (const sheet of els(workbook, "sheet")) {
    const name = sheet.getAttribute("name") ?? "";
    if (name === "はじめに") continue;
    const id = Array.from(sheet.attributes).find(
      (a) => a.localName === "id",
    )?.value;
    const target = id && relationships.get(id);
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : "xl/" + target;
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) continue;
    const rows: string[][] = [];
    for (const row of els(await xml(path), "row")) {
      const n = Number(row.getAttribute("r") || rows.length + 1);
      if (!Number.isInteger(n) || n < 1 || n > 20000)
        throw new Error("1シート2万行まで取り込めます。");
      const cells: string[] = [];
      for (const c of els(row, "c")) {
        const col = c.getAttribute("r")?.match(/^[A-Z]+/)?.[0];
        const i = col
          ? [...col].reduce((v, k) => v * 26 + k.charCodeAt(0) - 64, 0) - 1
          : cells.length;
        if (i >= 100) continue;
        const v = els(c, "v")[0]?.textContent ?? "";
        const t = c.getAttribute("t");
        let value =
          t === "s"
            ? (strings[Number(v)] ?? "")
            : t === "inlineStr"
              ? rich(c)
              : v;
        if (
          date1904 &&
          name === "基本情報" &&
          cells[0] === "開催日" &&
          i === 1 &&
          /^\d+$/.test(value)
        )
          value = String(Number(value) + 1462);
        while (cells.length < i) cells.push("");
        cells[i] = value;
      }
      rows[n - 1] = cells;
    }
    result.push({ name, rows });
  }
  return result;
}
