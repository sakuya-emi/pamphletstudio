import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import {
  excelTime,
  interpretRows,
  parseExcelText,
  planRow,
  sheets,
  type ImportSheet,
} from "../packages/core/excel-import";
import {
  addAd,
  addEvent,
  menus,
  setAdCompany,
} from "../packages/core/registration";
import { webStorage } from "../packages/project-storage";
import { layoutProject } from "../packages/layout-engine";

it("Excelの15種類の見出しを認識し、説明行を取り込まない", () => {
  for (const [sheet, headers] of Object.entries(sheets))
    expect(
      interpretRows(
        sheet as ImportSheet,
        [[sheet], ["入力方法の説明"], [], [...headers]],
        true,
      ),
    ).toEqual([]);
  expect(Object.keys(sheets)).toHaveLength(15);
});
it("列順・空欄・改行を維持し、表示と同じ企画データへ登録する", () => {
  const p = createFestivalProject();
  const [r] = interpretRows(
    "学生企画",
    parseExcelText(
      '主催団体\tイベント名\t教室\t階数\t詳細な場所\t建物\r\n団体A\t企画A\tA12\t\t"入口\n奥"\t本館',
    ),
  );
  expect(r.line).toBe(2);
  planRow(p, r).apply(p);
  expect(p.events[0].floor).toBeUndefined();
  expect(p.events[0]).toMatchObject({
    name: "企画A",
    group: "団体A",
    building: "本館",
    room: "A12",
    location: "入口\n奥",
  });
  expect(
    layoutProject(p).pages.some((pg) =>
      pg.nodes.some((n) => n.source?.id === p.events[0].id),
    ),
  ).toBe(true);
});
it("時刻セル・全角の時刻を正規化し、逆転は行番号付きのエラーにする", () => {
  expect(excelTime("0.3958333333333333")).toBe("09:30");
  expect(excelTime("９：３０")).toBe("09:30");
  expect(excelTime("09:75")).toBeUndefined();
  const [r] = interpretRows("学生ステージ企画", [
    ["企画名", "開始時間", "終了時間"],
    ["企画", "10:00", "9:30"],
  ]);
  expect(r).toMatchObject({
    line: 2,
    error: "終了時刻は開始時刻より後にしてください。",
  });
});
it("スタッフの分類を引き継ぎ、名前は入力どおり保持する", () => {
  const p = createFestivalProject();
  const rows = interpretRows(
    "スタッフ",
    [
      ["分類", "氏名"],
      ["副実行委員長", "見本　太郎"],
      ["", "見本 花子"],
      ["三年", "仮名　次郎"],
      ["", "仮名 三郎"],
    ],
    true,
  );
  expect(rows.every((r) => !r.sample)).toBe(true);
  expect(
    interpretRows(
      "スタッフ",
      [["スタッフ編成"], ["分類", "氏名"], ["3年", "見本氏名"]],
      true,
    )[0].sample,
  ).toBe(true);
  for (const r of rows) planRow(p, r).apply(p);
  expect(p.staff.map((s) => [s.name, s.role, s.grade])).toEqual([
    ["見本　太郎", "副実行委員長", 0],
    ["見本 花子", "副実行委員長", 0],
    ["仮名　次郎", "", 3],
    ["仮名 三郎", "", 3],
  ]);
});
it("同名候補を別IDで示し、選んだ更新先だけのデータを変更する", () => {
  const p = createFestivalProject();
  const a = addEvent(p, "kitchen"),
    b = addEvent(p, "kitchen");
  a.name = b.name = "架空の会社";
  a.assetId = "素材A";
  b.assetId = "素材B";
  const [r] = interpretRows("キッチンカー", [[a.name, "カレー", "", "飲み物"]]);
  const action = planRow(p, r);
  expect(action.candidates.map((x) => x.id)).toEqual([a.id, b.id]);
  action.apply(p, b.id);
  expect(menus(p, b.id).map((m) => m.name)).toEqual(["カレー", "飲み物"]);
  expect(menus(p, a.id)).toEqual([]);
  expect([a.assetId, b.assetId]).toEqual(["素材A", "素材B"]);
  const ad = addAd(p);
  setAdCompany(p, ad.id, a.name);
  ad.assetId = "広告素材";
  planRow(p, interpretRows("広告", [[a.name, "１／２ページ"]])[0]).apply(
    p,
    ad.id,
  );
  expect(ad).toMatchObject({ size: "half", assetId: "広告素材" });
});
it("紙面テキストの掲載先が曖昧なら候補を出し、無い場合はエラーにする", () => {
  const p = createFestivalProject();
  const notice = p.blocks.find((b) => b.openingKind === "survey")!;
  p.blocks.push({ ...notice, id: "別のお知らせ" });
  const [a, b] = interpretRows("ページ用テキスト", [
    ["お知らせ", "", "本文"],
    ["不明な場所", "見出し", "本文"],
  ]);
  expect(planRow(p, a).candidates).toHaveLength(2);
  expect(planRow(p, b).error).toContain("特定できません");
  expect(notice.body).not.toBe("本文");
});
it("開催日が未登録なら組版せず、入力後はお知らせを更新し保存できる", async () => {
  const p = createFestivalProject();
  const dateNodes = () =>
    layoutProject(p).pages.flatMap((pg) =>
      pg.nodes.filter((n) => n.kind === "text" && n.source?.field === "date"),
    );
  expect(dateNodes()).toHaveLength(0);
  const r = interpretRows("基本情報", [
    ["項目", "内容"],
    ["開催日", "2027-10-25"],
  ])[0];
  planRow(p, r).apply(p, p.id);
  expect(dateNodes().map((n) => (n.kind === "text" ? n.text : ""))).toEqual([
    "2027年10月25日（月）",
  ]);
  const reopened = await webStorage.load(await webStorage.save(p));
  expect(reopened.project.date).toBe("2027年10月25日（月）");
});
