import { resolveAsset } from "../core/rule-marks";
import { roundedPath } from "../designer/corners";
import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  setDashPattern,
  setLineCap,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { layoutProject, fit, type Layout } from "../layout-engine";
import type { Project } from "../core/model";
import { dataBytes } from "../project-storage";
export const mm = 72 / 25.4;
import { fontMeasure, PDF_FONT_FEATURES, type FontBytes } from "./font-measure";
export { fontMeasure, PDF_FONT_FEATURES, type FontBytes } from "./font-measure";
function color(hex: string) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}
function roundPath(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}
export async function exportPDF(
  p: Project,
  bytes: FontBytes,
  onProgress?: (n: number) => void,
): Promise<{ bytes: Uint8Array; layout: Layout }> {
  const measure = fontMeasure(bytes),
    layout = layoutProject(p, measure);
  if (layout.issues.some((i) => i.level === "error"))
    throw new Error(
      "印刷範囲・素材参照などのエラーを解消してから出力してください。",
    );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(p.name);
  pdf.setCreator("稲友祭 Pamphlet Studio - RGB proof");
  const normal = await pdf.embedFont(bytes.medium, {
      subset: false,
      features: PDF_FONT_FEATURES,
    }),
    bold = await pdf.embedFont(bytes.bold, {
      subset: false,
      features: PDF_FONT_FEATURES,
    });
  const charset = new Set(normal.getCharacterSet());
  const embedded = new Map<string, Awaited<ReturnType<typeof embedAsset>>>();
  async function embedAsset(id: string) {
    const a = resolveAsset(p, id);
    if (!a) throw new Error("素材が見つかりません。");
    if (a.mime === "application/pdf" || a.mime === "image/svg+xml") {
      if (a.mime === "image/svg+xml" && !a.vectorPdf)
        throw new Error(`SVGのベクター変換がありません：${a.name}`);
      const source = await PDFDocument.load(dataBytes(a.vectorPdf || a.data));
      if (a.pdfPage && a.pdfPage >= source.getPageCount())
        throw new Error("PDF素材のページ指定が不正です。");
      const src = source.getPage(a.pdfPage || 0);
      if (src.getRotation().angle % 360 !== 0)
        throw new Error(
          `回転指定のあるPDFは未対応です。回転を適用して保存し直してください：${a.name}`,
        );
      const crop = src.getCropBox();
      const page = await pdf.embedPage(src, {
        left: crop.x,
        bottom: crop.y,
        right: crop.x + crop.width,
        top: crop.y + crop.height,
      });
      return { type: "pdf" as const, obj: page };
    }
    if (a.mime === "image/jpeg")
      return {
        type: "image" as const,
        obj: await pdf.embedJpg(dataBytes(a.data)),
      };
    return {
      type: "image" as const,
      obj: await pdf.embedPng(
        dataBytes(a.mime === "image/webp" ? a.preview! : a.data),
      ),
    };
  }
  for (let i = 0; i < layout.pages.length; i++) {
    const page = pdf.addPage([148 * mm, 210 * mm]);
    for (const n of layout.pages[i].nodes) {
      if (n.editorOnly) continue;
      page.pushOperators(pushGraphicsState());
      if (n.dash)
        page.pushOperators(
          setDashPattern(
            n.dash.map((a) => (n.kind === "path" ? a : a * mm)),
            0,
          ),
        );
      if (n.lineCap)
        page.pushOperators(
          setLineCap(
            n.lineCap === "round" ? 1 : n.lineCap === "square" ? 2 : 0,
          ),
        );
      if (n.rotation) {
        const o = n.transformOrigin || { x: n.x + n.w / 2, y: n.y + n.h / 2 },
          cx = o.x * mm,
          cy = (210 - o.y) * mm,
          a = (n.rotation * Math.PI) / 180,
          c = Math.cos(a),
          s = Math.sin(a);
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(
            c,
            -s,
            s,
            c,
            cx - c * cx - s * cy,
            cy + s * cx - c * cy,
          ),
        );
      }
      if (n.kind === "path") {
        if (n.fill !== "none" || (n.stroke && n.stroke !== "none"))
          page.drawSvgPath(n.d, {
            x: 0,
            y: 210 * mm,
            scale: mm,
            color: n.fill === "none" ? undefined : color(n.fill),
            borderColor:
              n.stroke && n.stroke !== "none" ? color(n.stroke) : undefined,
            borderWidth: n.crisp ? 0 : (n.strokeWidth ?? 0.3),
            borderDashArray: n.dash,
            borderLineCap:
              n.lineCap === "round" ? 1 : n.lineCap === "square" ? 2 : 0,
            opacity: n.opacity ?? 1,
            borderOpacity: n.opacity ?? 1,
          });
      } else if (n.kind === "rect") {
        if (n.fill === "none" && !n.stroke) {
        } else if (n.radius || n.corners) {
          page.drawSvgPath(
            roundedPath(
              0,
              0,
              n.w * mm,
              n.h * mm,
              Object.fromEntries(
                Object.entries(
                  n.corners || {
                    topLeft: n.radius || 0,
                    topRight: n.radius || 0,
                    bottomRight: n.radius || 0,
                    bottomLeft: n.radius || 0,
                  },
                ).map(([k, v]) => [k, v * mm]),
              ) as unknown as import("../designer/corners").CornerRadius,
            ),
            {
              x: n.x * mm,
              y: (210 - n.y) * mm,
              color: n.fill === "none" ? undefined : color(n.fill),
              opacity: n.opacity ?? 1,
              borderOpacity: n.opacity ?? 1,
              borderColor: n.stroke ? color(n.stroke) : undefined,
              borderWidth: n.stroke ? (n.strokeWidth ?? 0.2) * mm : 0,
              borderDashArray: n.dash?.map((a) => a * mm),
              borderLineCap:
                n.lineCap === "round" ? 1 : n.lineCap === "square" ? 2 : 0,
            },
          );
        } else
          page.drawRectangle({
            x: n.x * mm,
            y: (210 - n.y - n.h) * mm,
            width: n.w * mm,
            height: n.h * mm,
            color: n.fill === "none" ? undefined : color(n.fill),
            opacity: n.opacity ?? 1,
            borderOpacity: n.opacity ?? 1,
            borderColor: n.stroke ? color(n.stroke) : undefined,
            borderWidth: n.stroke ? (n.strokeWidth ?? 0.2) * mm : 0,
            borderDashArray: n.dash?.map((a) => a * mm),
            borderLineCap:
              n.lineCap === "round" ? 1 : n.lineCap === "square" ? 2 : 0,
          });
      } else if (n.kind === "text") {
        const font = n.bold ? bold : normal;
        if (Array.from(n.text).some((ch) => !charset.has(ch.codePointAt(0)!)))
          throw new Error(`同梱フォントに含まれない文字があります：${n.text}`);
        try {
          page.drawText(n.text, {
            x: n.x * mm,
            y: (210 - n.y - n.size * 0.88) * mm,
            size: n.size * mm,
            font,
            color: color(n.color),
            opacity: n.opacity ?? 1,
          });
        } catch {
          throw new Error(`文字を描画できません：${n.text}`);
        }
      } else if (n.kind === "asset") {
        let e = embedded.get(n.assetId);
        if (!e) {
          e = await embedAsset(n.assetId);
          embedded.set(n.assetId, e);
        }
        const box = fit(n, e.obj.width, e.obj.height),
          opts = {
            x: box.x * mm,
            y: (210 - box.y - box.h) * mm,
            width: box.w * mm,
            height: box.h * mm,
            opacity: n.opacity ?? 1,
          };
        if (e.type === "pdf") page.drawPage(e.obj, opts);
        else page.drawImage(e.obj, opts);
      }
      if (n.rotation) page.pushOperators(popGraphicsState());
      page.pushOperators(popGraphicsState());
    }
    onProgress?.(Math.round(((i + 1) / layout.pages.length) * 90));
  }
  onProgress?.(95);
  const saved = await pdf.save();
  onProgress?.(100);
  return { bytes: saved, layout };
}
