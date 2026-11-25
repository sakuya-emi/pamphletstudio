import { createFestivalProject } from "./festival-opening";
import {
  addAd,
  addEvent,
  addMenu,
  addStaff,
  setAdCompany,
} from "./registration";
import { writeSource } from "./editing";
import { insertBlock, type Project } from "./model";

function artwork(p: Project, title: string, color: string, w = 1800, h = 2520) {
  const id = "sample-" + Object.keys(p.assets).length;
  const mapLabels = title.includes("会場案内")
    ? `<text x="8%" y="24%" fill="#fff" font-size="${w * 0.044}">■ 立入禁止（搬入口）　 ● トイレ</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><circle cx="${w * 0.72}" cy="${h * 0.25}" r="${Math.min(w, h) * 0.2}" fill="#f2ca75"/><path d="M0 ${h * 0.6} L${w} ${h * 0.34} V${h * 0.72} L0 ${h * 0.91} Z" fill="#fff" opacity=".22"/><text x="8%" y="58%" fill="#fff" font-size="${Math.min(w, h) * 0.085}" font-weight="bold">${title}</text><text x="8%" y="76%" fill="#fff" font-size="${Math.min(w, h) * 0.07}">SAMPLE / 見本</text>${mapLabels}</svg>`;
  p.assets[id] = {
    id,
    name: title + "（見本）",
    width: w,
    height: h,
    mime: "image/svg+xml",
    data:
      "data:image/svg+xml;base64," +
      btoa(
        Array.from(new TextEncoder().encode(svg), (b) =>
          String.fromCharCode(b),
        ).join(""),
      ),
  };
  return id;
}
export function createFestivalSample() {
  const p = createFestivalProject();
  p.name = "完成見本・編集用コピー";
  p.festival = "見本祭";
  p.university = "架空の大学（見本）";
  p.tagline = "架空データによる制作見本";
  writeSource(p, { type: "project", id: p.id, field: "date" }, "2027-10-24");
  p.time = "09:30〜16:00";
  const survey = p.blocks.find((b) => b.openingKind === "survey")!;
  survey.surveyUrl = "https://example.org/";
  survey.body =
    "これは制作手順の見本です。QRコードは案内の配置例で、実際のアンケートは受け付けていません。";
  survey.assetId = artwork(p, "見本祭へようこそ", "#544d72", 1450, 1015);
  const leaders = p.blocks.find((b) => b.openingKind === "leaders")!;
  const committee = p.blocks.find((b) => b.openingKind === "committee")!;
  for (const [b, first, second] of [
    [leaders, "見本 学園長", "見本 学長"],
    [committee, "架空 委員長", "架空 副委員長"],
  ] as const) {
    Object.assign(b, {
      firstName: first,
      secondName: second,
      body: "ご来場ありがとうございます。学生の作品と企画をどうぞお楽しみください。",
      secondBody: "みなさんが安心して楽しめる一日になりますように。",
      assetId: artwork(p, "挨拶", "#665a76", 600, 900),
      secondAssetId: artwork(p, "挨拶", "#486472", 600, 900),
    });
  }
  const back = p.blocks.find((b) => b.template === "back")!;
  back.assetId = artwork(p, "またお会いしましょう", "#38506c");
  back.websiteUrl = "https://example.org/";
  back.backMapId = artwork(p, "会場案内（見本）", "#58736d", 1500, 900);
  insertBlock(p, {
    id: "sample-sponsors-list",
    template: "sponsors",
    title: "協賛企業一覧",
    chapterId: "ch5",
  });

  p.coverId = artwork(p, "見本祭", "#30496a");
  const cover = p.blocks.find((b) => b.template === "cover")!;
  cover.showNumber = false;
  for (const [i, name] of [
    "紙のアトリエ",
    "星空ミニ展示",
    "ゲームの研究室",
    "光と色の工房",
  ].entries()) {
    const e = addEvent(p, "student");
    Object.assign(e, {
      name,
      group: "見本サークル " + (i + 1),
      building: "本館",
      room: "A10" + (i + 1),
      assetId: artwork(
        p,
        name,
        ["#76557e", "#3d687d", "#8b5547", "#546b55"][i],
      ),
    });
  }
  Object.assign(addEvent(p, "food"), {
    name: "焼き菓子屋台（見本）",
    group: "架空の調理部",
    building: "屋外",
  });
  const kitchen = addEvent(p, "kitchen");
  kitchen.name = "月夜のワゴン（架空）";
  kitchen.assetId = artwork(p, "月夜のワゴン", "#6e654b", 1200, 760);
  addMenu(p, kitchen.id, "焼き野菜サンド");
  addMenu(p, kitchen.id, "レモネード");
  Object.assign(addEvent(p, "stage"), {
    name: "オープニング（見本）",
    startTime: "09:30",
    endTime: "10:00",
    assetId: artwork(p, "開会式", "#754d59"),
  });
  Object.assign(addEvent(p, "studentStage"), {
    name: "合奏発表（見本）",
    startTime: "10:30",
    endTime: "11:00",
    assetId: artwork(p, "合奏発表", "#415a77"),
  });
  for (const [i, name] of [
    "架空 委員長",
    "架空 副委員長",
    "見本 実行委員",
  ].entries()) {
    const s = addStaff(p, name);
    if (i < 2) s.role = i === 0 ? "実行委員長" : "副実行委員長";
    else s.grade = 2;
  }
  for (const [i, company] of [
    "星の見本商店（架空）",
    "見本デザイン工房（架空）",
    "架空メディア社",
    "架空の光文具店",
  ].entries()) {
    const ad = addAd(p);
    setAdCompany(p, ad.id, company);
    ad.size = i >= 2 ? "half" : "quarter";
    ad.assetId = artwork(p, company, "#425578", 1500, i >= 2 ? 1020 : 540);
  }
  const map = p.blocks.find((b) => b.openingKind === "map");
  if (map) map.assetId = artwork(p, "会場案内（見本）", "#58736d", 1500, 1175);
  p.manualChecks = { proof: true, map: true, rights: true, remarks: true };
  return p;
}
