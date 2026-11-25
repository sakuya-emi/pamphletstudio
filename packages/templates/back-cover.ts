import { rect, text, type Context, type Node } from "../layout-engine/types";
import { surveyQr } from "./opening";

export const universityWebsite = "https://www.nagoya-bunri.ac.jp/";
export const backCoverLayouts = {
  "map-left": "マップ左・QR右",
  "qr-left": "QR左・マップ右",
} as const;

export function backCover(c: Context): Node[] {
  const { block: b, project: p } = c;
  const qrLeft = b.backLayout === "qr-left";
  const source = (field: string) => ({
    type: "block" as const,
    id: b.id,
    field,
  });
  const nodes: Node[] = [rect(0, 0, 148, 210, p.theme.background)];
  const image = (
    field: "assetId" | "backMapId",
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ) => {
    const id = b[field];
    if (id && p.assets[id]) {
      nodes.push({
        kind: "asset",
        assetId: id,
        x,
        y,
        w,
        h,
        source: source(field),
      });
    } else {
      nodes.push({
        ...rect(x, y, w, h, "#f7f5f4", "#c1b7ba", 2),
        source: source(field),
        editorOnly: true,
      });
      nodes.push({
        ...text(x + 3, y + h / 2 - 2, w - 6, label, 3, "#777777"),
        source: source(field),
        editorOnly: true,
      });
    }
  };
  image("assetId", 0, 0, 148, qrLeft ? 174 : 154, "裏表紙の画像を登録");

  const y = qrLeft ? 180 : 169,
    mapX = qrLeft ? 77 : 6,
    cardX = qrLeft ? 5 : 84;
  const pink = "#d83d70";
  nodes.push(rect(mapX, y + 3, 18, 18, "#f8dce4", undefined, 9));
  const mapLabels = [p.university?.trim(), "周辺マップ"].filter(
    (x): x is string => !!x,
  );
  const labelSize = 1.9,
    lineStep = 3.6;
  const labelTop =
    y + 12.3 - ((mapLabels.length - 1) * lineStep + labelSize * 1.4) / 2;
  mapLabels.forEach((label, i) => {
    const size = Math.min(
      labelSize,
      (16 * labelSize) / Math.max(16, c.measure(label, labelSize, true)),
    );
    const width = c.measure(label, size, true);
    nodes.push(
      text(
        mapX + (18 - width) / 2,
        labelTop + i * lineStep,
        width + 0.1,
        label,
        size,
        pink,
        true,
      ),
    );
  });
  image(
    "backMapId",
    mapX + 20,
    y + 1,
    qrLeft ? 46 : 53,
    23,
    "周辺マップを登録",
  );

  const cardW = qrLeft ? 68 : 58,
    qrSize = 22,
    qrX = cardX + cardW - qrSize - 2;
  const labelW = qrX - cardX - 5;
  nodes.push(rect(cardX, y, cardW, 26, "#fbedf1", undefined, 2.4));
  nodes.push(
    text(cardX + 3, y + 4, labelW, "本学の詳しい情報は", 2.65, pink, true),
    text(cardX + 3, y + 8.8, labelW, "WEBサイトへ！", 2.8, pink, true),
  );
  const ax = cardX + 3,
    ay = y + 15,
    aw = labelW - 1;
  nodes.push({
    kind: "path",
    x: ax,
    y: ay,
    w: aw,
    h: 6,
    d: `M ${ax} ${ay} H ${ax + aw - 3} L ${ax + aw} ${ay + 3} L ${ax + aw - 3} ${ay + 6} H ${ax} Z`,
    fill: pink,
  });
  nodes.push(
    text(
      ax + 1.4,
      ay + 1.7,
      aw - 4,
      "QRコードを読み取る",
      1.95,
      "#ffffff",
      true,
    ),
  );
  try {
    nodes.push(
      ...surveyQr(b.websiteUrl ?? universityWebsite, qrX, y + 2, qrSize).map(
        (n) => ({ ...n, source: source("websiteUrl") }),
      ),
    );
  } catch {
    nodes.push({
      ...rect(qrX, y + 2, qrSize, qrSize, "#ffffff", "#c1b7ba", 2),
      source: source("websiteUrl"),
      editorOnly: true,
    });
    nodes.push({
      ...text(qrX + 2, y + 11, qrSize - 4, "URLを入力", 2.6, pink),
      source: source("websiteUrl"),
      editorOnly: true,
    });
  }
  return nodes;
}
