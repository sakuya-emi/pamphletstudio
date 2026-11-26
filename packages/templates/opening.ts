import { normalizeSurveyUrl } from "../core/survey-url";
import { defaultRuleMark } from "../core/rule-marks";
import { festivalDate } from "../core/festival-date";
import qrCode from "qrcode-generator";
import { ellipsePath } from "../designer/geometry";
import {
  rect,
  text,
  wrap,
  verticalMark,
  type Context,
  type Node,
} from "../layout-engine/types";
import { isStage } from "../core/registration";

const qrPaths = new Map<string, string>();

export function surveyQr(
  url: string,
  x: number,
  y: number,
  side: number,
): Node[] {
  const parsed = new URL(normalizeSurveyUrl(url));
  const key = JSON.stringify([parsed.href, x, y, side]);
  let d = qrPaths.get(key);
  if (d === undefined) {
    const q = qrCode(0, "M");
    q.addData(parsed.href, "Byte");
    q.make();
    const count = q.getModuleCount(),
      unit = side / (count + 8);
    d = "";
    // Use the same grid boundary for every run, with no strokes between modules.
    const gx = (col: number) => x + (col + 4) * unit;
    const gy = (row: number) => y + (row + 4) * unit;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count;) {
        if (!q.isDark(row, col)) {
          col++;
          continue;
        }
        const start = col++;
        while (col < count && q.isDark(row, col)) col++;
        d += `M ${gx(start)} ${gy(row)} H ${gx(col)} V ${gy(row + 1)} H ${gx(start)} Z `;
      }
    }
    if (qrPaths.size >= 16) qrPaths.delete(qrPaths.keys().next().value!);
    qrPaths.set(key, d);
  }
  return [
    { ...rect(x, y, side, side, "#ffffff"), crisp: true },
    { kind: "path", x, y, w: side, h: side, d, fill: "#000000", crisp: true },
  ];
}

export function openingPage(c: Context): Node[] {
  const b = c.block,
    p = c.project,
    n: Node[] = [];
  const ink = p.theme.ink,
    pink = "#d83d70";
  const source = (field: string) => ({
    type: "block" as const,
    id: b.id,
    field,
  });
  const caption = (
    x: number,
    y: number,
    w: number,
    value: string,
    size = 4,
    color = ink,
    bold = true,
  ) => n.push(text(x, y, w, value, size, color, bold));
  const paragraph = (
    x: number,
    y: number,
    w: number,
    value: string | undefined,
    field: string,
    maxH: number,
    size = 3.2,
    color = ink,
  ) => {
    if (!value?.trim()) {
      n.push({
        ...text(x, y, w, "文章を入力", size, "#777777"),
        source: source(field),
        editorOnly: true,
      });
      return;
    }
    const lines = wrap(value, w, size, c.measure),
      step = Math.min(size * 1.6, maxH / Math.max(1, lines.length));
    const font = Math.min(size, step / 1.3);
    lines.forEach((line, i) =>
      n.push({
        ...text(x, y + i * step, w, line, font, color),
        source: source(field),
      }),
    );
  };
  const asset = (
    field: "assetId" | "secondAssetId" | "thirdAssetId",
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ) => {
    const id = b[field];
    if (id)
      n.push({ kind: "asset", assetId: id, x, y, w, h, source: source(field) });
    else
      n.push(
        {
          ...rect(x, y, w, h, "#f7f5f4", "#b2a9aa", 2),
          source: source(field),
          editorOnly: true,
        },
        {
          ...text(x + 3, y + h / 2 - 2, w - 6, label, 2.7, "#777777"),
          source: source(field),
          editorOnly: true,
        },
      );
  };
  if (b.openingKind === "survey") {
    const date = festivalDate(p.date)?.label ?? p.date.trim();
    if (date && date !== "開催日を入力")
      n.push({
        ...text(22, 26, 110, date, 3.4, ink),
        source: { type: "project", id: p.id, field: "date" },
      });
    asset("assetId", 22, 34, 110, 77, "ぶんちゃん画像を登録");
    n.push(rect(22, 120, 58, 10, "#ffffff", pink, 5));
    caption(27, 122.5, 52, "アンケートのご案内", 4, pink);
    paragraph(25, 136, 62, b.body, "body", 36, 3.15);
    n.push(rect(25, 177, 59, 10, pink, undefined, 2));
    caption(28, 179.5, 55, "右のQRコードを読み取るだけ！", 2.9, "#ffffff");
    try {
      if (!b.surveyUrl) throw new Error();
      n.push(
        ...surveyQr(b.surveyUrl, 88, 139, 47).map((node) => ({
          ...node,
          source: source("surveyUrl"),
        })),
      );
      const urlLines = wrap(
        normalizeSurveyUrl(b.surveyUrl),
        110,
        2.3,
        c.measure,
      );
      const display =
        urlLines.length <= 3
          ? urlLines
          : [
              ...urlLines.slice(0, 2),
              "…（長いURLのため省略。QRコードをご利用ください）",
            ];
      display.forEach((line, i) =>
        n.push({
          ...text(25, 190 + i * 2.8, 110, line, 2.3, ink),
          source: source("surveyUrl"),
        }),
      );
    } catch {
      n.push({
        ...rect(88, 139, 47, 47, "#f7f5f4", "#b2a9aa", 2),
        source: source("surveyUrl"),
        editorOnly: true,
      });
      n.push({
        ...text(94, 155, 36, "QRダミー", 4, pink, true),
        source: source("surveyUrl"),
        editorOnly: true,
      });
      n.push({
        ...text(91, 164, 41, "クリックしてURLを入力", 2.7, pink),
        source: source("surveyUrl"),
        editorOnly: true,
      });
    }
  } else if (b.openingKind === "map") {
    asset(
      "assetId",
      14,
      31,
      120,
      b.body?.trim() ? 135 : 164,
      "学内マップ画像を登録",
    );
    if (b.body?.trim()) paragraph(14, 170, 120, b.body, "body", 24);
  } else if (b.openingKind === "leaders" || b.openingKind === "committee") {
    const committee = b.openingKind === "committee",
      split = committee && b.viceMode === "separate";
    const roles = committee
      ? split
        ? ["実行委員長", "副実行委員長", "副実行委員長"]
        : ["実行委員長", "副実行委員長"]
      : ["学園長", "学長"];
    const nameFields = ["firstName", "secondName", "thirdName"] as const;
    const bodyFields = ["body", "secondBody", "thirdBody"] as const;
    const photoFields = ["assetId", "secondAssetId", "thirdAssetId"] as const;
    roles.forEach((role, i) => {
      const alternate = i % 2 === 1,
        y = split ? 35 + i * 54 : 43 + i * 79,
        x = alternate ? 14 : 54;
      const name = nameFields[i],
        body = bodyFields[i];
      asset(
        photoFields[i],
        alternate ? 102 : 15,
        y,
        33,
        split ? 46 : 53,
        "写真を登録",
      );
      caption(x, y, 80, role, 4.5);
      const names =
        committee && !split && i === 1 ? [name, "thirdName" as const] : [name];
      names.forEach((field, j) =>
        n.push({
          ...text(
            x,
            y + 8 + j * 6,
            80,
            b[field] || "氏名を入力",
            3.8,
            ink,
            true,
          ),
          source: source(field),
          editorOnly: !b[field],
        }),
      );
      paragraph(
        x,
        y + (names.length === 2 ? 23 : 17),
        79,
        b[body],
        body,
        split ? 30 : 48,
      );
    });
  } else if (b.openingKind === "rules") {
    for (let i = 0; i < 2; i++) {
      const y = 50 + i * 75;
      const picture = i ? b.drinkingPicture : b.smokingPicture;
      const custom =
        (picture ? p.assets[picture] : undefined) ??
        (!picture ||
        picture === "default" ||
        !["illustrated", "symbol"].includes(picture)
          ? defaultRuleMark(i ? "drinking" : "smoking")
          : undefined);
      if (custom)
        n.push({ kind: "asset", assetId: custom.id, x: 16, y, w: 52, h: 50 });
      if (!custom && picture !== "symbol") {
        if (i === 0) {
          n.push(
            rect(24, y + 20, 36, 6, "#f1efeb", "#665b56", 1),
            rect(50, y + 20, 10, 6, "#e7a36e", "#665b56", 1),
          );
          n.push({
            kind: "path",
            x: 24,
            y: y + 5,
            w: 8,
            h: 14,
            d: `M 28 ${y + 18} C 21 ${y + 13} 34 ${y + 13} 27 ${y + 6}`,
            fill: "none",
            stroke: "#9eaaab",
            strokeWidth: 2,
          });
        } else {
          n.push(
            rect(29, y + 13, 26, 25, "#e6ba62", "#645651", 3),
            rect(53, y + 20, 8, 12, "#f0e2bd", "#645651", 3),
            rect(28, y + 10, 28, 8, "#fcf2d9", "#645651", 4),
          );
        }
      }
      if (!custom) {
        n.push({
          kind: "path",
          x: 20,
          y,
          w: 44,
          h: 44,
          d: ellipsePath(20, y, 44, 44),
          fill: "none",
          stroke: "#fa4834",
          strokeWidth: 4,
        });
        n.push({
          kind: "path",
          x: 26,
          y: y + 6,
          w: 32,
          h: 32,
          d: `M 26 ${y + 6} L 58 ${y + 38}`,
          fill: "none",
          stroke: "#fa4834",
          strokeWidth: 4,
        });
        if (picture === "symbol")
          caption(33, y + 16, 26, i ? "酒" : "煙", 5, "#fa4834");
      }
      caption(72, y + 2, 62, i ? "飲酒禁止" : "喫煙禁止", 5);
      paragraph(
        72,
        y + 14,
        61,
        i ? b.secondBody : b.body,
        i ? "secondBody" : "body",
        44,
      );
    }
  } else if (b.openingKind === "waste") {
    caption(19, 37, 111, "ゴミは２種類に分別してください。", 4);
    const x = 15,
      y = 53,
      w = 119,
      category = 43,
      head = 11;
    n.push(
      rect(x, y, category, head, "#3b75ac", "#ffffff"),
      rect(x + category, y, w - category, head, "#3b75ac", "#ffffff"),
    );
    caption(x + 3, y + 3, category - 5, "分別区分", 3.6, "#ffffff");
    caption(
      x + category + 3,
      y + 3,
      w - category - 5,
      "主な品目",
      3.6,
      "#ffffff",
    );
    const groups = [
      { name: "可燃ごみ・プラスチック類", field: "body" },
      { name: "その他", field: "secondBody" },
    ] as const;
    const rows = groups.map(({ field }) =>
      (b[field] || "").split(/\r?\n/).filter((v) => v.trim()),
    );
    const rowH = Math.min(
      13,
      125 / rows.reduce((a, v) => a + Math.max(1, v.length), 0),
    );
    let yy = y + head;
    groups.forEach(({ name, field }, i) => {
      const list = rows[i].length ? rows[i] : [""],
        h = list.length * rowH,
        fill = i ? "#eff5e8" : "#eaf3f7";
      n.push(rect(x, yy, category, h, fill, "#9baab4"));
      wrap(name, category - 6, 3.3, c.measure).forEach((line, j) =>
        caption(x + 3, yy + 2 + j * 4, category - 6, line, 3.3),
      );
      list.forEach((item, j) => {
        const ry = yy + j * rowH;
        n.push(
          rect(
            x + category,
            ry,
            w - category,
            rowH,
            j % 2 ? fill : "#ffffff",
            "#9baab4",
          ),
        );
        paragraph(
          x + category + 3,
          ry + Math.min(2, rowH / 5),
          w - category - 6,
          item,
          field,
          Math.max(0.1, rowH - 2),
          3.3,
        );
      });
      yy += h;
    });
  }
  return n;
}

/** Equal-width positions show event order rather than elapsed-time intervals. */
export function orderedSchedule(c: Context): Node[][] {
  const p = c.project;
  const lineStyle = p.theme.scheduleStyle === "line";
  const items = p.events
    .filter((e) => isStage(e) && e.published !== false)
    .sort((a, b) =>
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99", "en", {
        numeric: true,
      }),
    );
  const pages: Node[][] = [];
  for (let at = 0; at < Math.max(1, items.length); at += 12) {
    const batch = items.slice(at, at + 12);
    const middle = Math.ceil(batch.length / 2);
    const sides = (["left", "right"] as const).map((side) => {
      const list =
          side === "left" ? batch.slice(0, middle) : batch.slice(middle),
        x = side === "left" ? 13 : 0,
        w = 135 / Math.max(1, list.length),
        y = 49;
      const light = side === "left" ? "#bfe7ed" : "#cde6dc",
        dark = side === "left" ? "#2ba6c5" : "#65aa94";
      const ns: Node[] = [];
      if (lineStyle) {
        ns.push(rect(x, y + 7, 135, 0.3, p.theme.ink));
        ns.push(
          rect(
            side === "left" ? x : 129,
            y + 3,
            6,
            6,
            p.theme.ink,
            undefined,
            3,
          ),
        );
      } else ns.push(rect(x, y, 135, 8, light));
      list.forEach((e, j) => {
        const cellWidth = lineStyle ? 129 / Math.max(1, list.length) : w;
        const xx = x + (lineStyle && side === "left" ? 6 : 0) + j * cellWidth,
          mid = xx + cellWidth / 2;
        const fill = j % 2 ? light : dark;
        if (!lineStyle)
          ns.push({
            ...rect(xx, y, w, 8, fill),
            source: { type: "event", id: e.id, field: "startTime" },
          });
        ns.push({
          ...text(
            lineStyle
              ? mid - c.measure(e.startTime || "—", 3.1, false) / 2
              : xx + 2,
            y + 2,
            cellWidth - 3,
            e.startTime || "—",
            lineStyle ? 3.1 : 3.8,
            lineStyle ? p.theme.ink : j % 2 ? "#24343b" : "#ffffff",
            !lineStyle,
          ),
          source: { type: "event", id: e.id, field: "startTime" },
        });
        if (!lineStyle)
          ns.push(
            rect(mid - 0.16, y + 8, 0.32, 10, dark),
            rect(mid - 0.85, y + 17.5, 1.7, 1.7, dark, undefined, 0.85),
          );
        const chars = Array.from(e.name || "").filter((ch) => ch !== "\n");
        const font = Math.min(
          5.1,
          Math.sqrt(((w - 4) * 104) / Math.max(1, chars.length)) * 0.84,
        );
        const maxRows = Math.max(1, Math.floor(113 / (font * 1.18)));
        chars.forEach((ch, k) =>
          ns.push({
            ...text(
              mid - font / 2 - Math.floor(k / maxRows) * font,
              y + (lineStyle ? 10 : 22) + (k % maxRows) * font * 1.18,
              font * 1.25,
              ch,
              font,
              lineStyle ? p.theme.ink : "#263945",
              true,
            ),
            ...verticalMark(
              ch,
              mid - font / 2 - Math.floor(k / maxRows) * font,
              y + (lineStyle ? 10 : 22) + (k % maxRows) * font * 1.18,
              font,
            ),
            source: { type: "event", id: e.id, field: "name" },
          }),
        );
      });
      if (side === "right" && !lineStyle) {
        ns.push(
          rect(15, 179, 114, 17, "#e4f1f4", undefined, 2),
          rect(15, 179, 114, 5, "#66a8c5", undefined, 2),
        );
        ns.push(
          text(18, 180, 104, "備考", 2.7, "#ffffff", true),
          text(
            18,
            187,
            105,
            "※当日の状況によりタイムスケジュールを変更する場合があります。",
            2.5,
            "#263945",
          ),
        );
      }
      if (side === "right" && lineStyle)
        ns.push(
          text(
            18,
            187,
            108,
            "※当日の状況によりタイムスケジュールを変更する場合があります。",
            2.5,
            p.theme.ink,
          ),
        );
      return ns.map((n) => ({ ...n, spreadSide: side, spreadIndex: at / 12 }));
    });
    pages.push(...(p.theme.binding === "right" ? sides.reverse() : sides));
  }
  return pages;
}
