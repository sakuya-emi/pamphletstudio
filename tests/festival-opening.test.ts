import { expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  createFestivalProject,
  surveyDefaultUrl,
} from "../packages/core/festival-opening";
import { addEvent } from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
import { exportPDF } from "../packages/pdf-export";
import { webStorage } from "../packages/project-storage";
import { surveyQr } from "../packages/templates/opening";

it("新規冊子の冒頭11ページに目次と左右のタイムテーブルを配置", () => {
  const p = createFestivalProject(),
    layout = layoutProject(p);
  expect(layout.pages.slice(0, 11).map((pg) => pg.template)).toEqual([
    "cover",
    "notice",
    "contents",
    "notice",
    "notice",
    "notice",
    "notice",
    "stage",
    "stage",
    "notice",
    "events",
  ]);
  expect(layout.pages.slice(7, 9).map((pg) => pg.side)).toEqual([
    "left",
    "right",
  ]);
  expect(layout.issues.filter((i) => i.level === "error")).toEqual([]);
  const index = layout.pages[1].nodes.find(
    (n) => n.kind === "rect" && n.source?.type === "chapter",
  );
  expect(index).toMatchObject({
    corners: { topLeft: 0, topRight: 3, bottomLeft: 0, bottomRight: 3 },
  });
});
it("開始時刻順の均等枠を使い、終了時刻で位置を変更しない", () => {
  const p = createFestivalProject();
  p.theme.scheduleStyle = "bands";
  for (const time of ["15:00", "09:30", "10:00", "14:00", "11:30"]) {
    const e = addEvent(p, "stage");
    e.name = time;
    e.startTime = time;
    e.endTime = "17:00";
  }
  const { pages } = layoutProject(p);
  const [left, right] = pages
    .slice(7, 9)
    .map((page) =>
      page.nodes.filter(
        (n) => n.kind === "rect" && n.source?.field === "startTime",
      ),
    );
  expect([left.length, right.length]).toEqual([3, 2]);
  expect(
    [...left, ...right].map(
      (n) => p.events.find((e) => e.id === n.source?.id)?.startTime,
    ),
  ).toEqual(["09:30", "10:00", "11:30", "14:00", "15:00"]);
  expect(left[1].x - left[0].x).toBeCloseTo(left[2].x - left[1].x);
  expect(right[1].x - right[0].x).toBeCloseTo(67.5);
});
it("QRはURLのみで再生成でき、保存後も復元される", async () => {
  const p = createFestivalProject(),
    b = p.blocks[1];
  const initial = surveyQr(surveyDefaultUrl, 0, 0, 47);
  b.surveyUrl = "https://example.com/survey";
  expect(surveyQr(b.surveyUrl, 0, 0, 47)).not.toEqual(initial);
  expect(() => surveyQr("javascript:alert(1)", 0, 0, 47)).toThrow();
  const q = (await webStorage.load(await webStorage.save(p))).project;
  expect(q.blocks[1].surveyUrl).toBe(b.surveyUrl);
});
it("お知らせと順番重視タイムテーブルの確認用PDFを生成", async () => {
  const p = createFestivalProject();
  const data = await readFile("public/defaults/bunchan.jpg");
  p.assets.bunchan = {
    id: "bunchan",
    name: "ぶんちゃん.jpg",
    mime: "image/jpeg",
    data: "data:image/jpeg;base64," + data.toString("base64"),
    width: 1500,
    height: 1056,
  };
  p.blocks[1].assetId = "bunchan";
  for (let i = 0; i < 12; i++) {
    const e = addEvent(p, "stage");
    e.name = [
      "開場",
      "開会式",
      "ミニゲーム",
      "軽音ライブ",
      "コーラス",
      "展示紹介",
      "ゲスト企画",
      "ビンゴ大会",
      "学生ステージ",
      "クイズ大会",
      "抽選会",
      "閉会式",
    ][i];
    e.startTime = `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  }
  const { bytes } = await exportPDF(p, {
    medium: new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold: new Uint8Array(await readFile("public/fonts/NotoSansCJKjp-Bold.ttf")),
  });
  const pdf = await PDFDocument.load(bytes);
  const rulesId = p.blocks.find((b) => b.openingKind === "rules")!.id;
  const rulesIndex = layoutProject(p).pages.findIndex(
    (page) => page.blockId === rulesId,
  );
  const images = pdf
    .getPage(rulesIndex)
    .node.Resources()
    ?.lookup(PDFName.of("XObject"), PDFDict);
  expect(images?.keys()).toHaveLength(2);
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/festival-opening-verification.pdf", bytes);
}, 60000);
