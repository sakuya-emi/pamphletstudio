import type { Project, Block } from "../core/model";
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NodeMeta {
  /** Input guidance only; excluded from printed PDF and thumbnails. */
  editorOnly?: boolean;
  spreadSide?: "left" | "right";
  spreadIndex?: number;
  source?: import("../core/editing").DataSource;
  pageId?: string;
  id?: string;
  objectId?: string;
  layerId?: string;
  groupId?: string;
  rotation?: number;
  transformOrigin?: { x: number; y: number };
  opacity?: number;
  strokeWidth?: number;
  dash?: number[];
  lineCap?: "butt" | "round" | "square";
  tablePart?: import("../designer/table-model").TableTarget;
  componentKind?: string;
  crisp?: boolean;
}
export type Node = NodeMeta &
  (
    | ({
        kind: "rect";
        fill: string;
        stroke?: string;
        radius?: number;
        corners?: import("../designer/corners").CornerRadius;
        opacity?: number;
      } & Box)
    | ({
        kind: "text";
        text: string;
        size: number;
        color: string;
        bold?: boolean;
      } & Box)
    | ({ kind: "asset"; assetId: string } & Box)
    | ({ kind: "path"; d: string; fill: string; stroke?: string } & Box)
  );
export interface LayoutPage {
  blankReason?: string;
  automatic?:
    | {
        kind: "start";
        targetBlockId: string;
        chapterId: string;
        setting: "chapter" | "block" | "spread";
      }
    | { kind: "padding" };
  heading?: string;
  spreadSide?: "left" | "right";
  spreadKey?: string;
  id: string;
  blockId: string;
  chapterId: string;
  title: string;
  template: string;
  nodes: Node[];
  physical: number;
  number?: number;
  side: "left" | "right";
  designTemplateId?: string;
  slots: { key: string; adId?: string; size: string }[];
}
export interface Issue {
  level: "error" | "warning" | "ok" | "info" | "check";
  message: string;
  pageId?: string;
  checkId?: string;
  adId?: string;
}
export interface Layout {
  pages: LayoutPage[];
  issues: Issue[];
}
export type Measure = (text: string, size: number, bold?: boolean) => number;
export type Context = {
  project: Project;
  block: Block;
  left: number;
  width: number;
  measure: Measure;
};
export function text(
  x: number,
  y: number,
  w: number,
  value: string,
  size = 3.1,
  color = "#231815",
  bold = false,
): Node {
  return {
    kind: "text",
    x,
    y,
    w,
    h: size * 1.4,
    text: value,
    size,
    color: color === "none" ? "#000000" : color,
    opacity: color === "none" ? 0 : 1,
    bold,
  };
}
export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
  radius = 0,
  opacity = 1,
): Extract<Node, { kind: "rect" }> {
  return { kind: "rect", x, y, w, h, fill, stroke, radius, opacity };
}
export function wrap(
  value: string,
  w: number,
  size: number,
  measure: Measure,
  bold = false,
): string[] {
  const lines: string[] = [];
  for (const para of value.split("\n")) {
    let line = "";
    for (const ch of para) {
      if (line && measure(line + ch, size, bold) > w) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}
export const fallbackMeasure: Measure = (s, z) =>
  Array.from(s).reduce((n, c) => n + (/[\x00-\x7f]/.test(c) ? z * 0.56 : z), 0);
export function fit(box: Box, width: number, height: number): Box {
  const k = Math.min(box.w / width, box.h / height);
  return {
    x: box.x + (box.w - width * k) / 2,
    y: box.y + (box.h - height * k) / 2,
    w: width * k,
    h: height * k,
  };
}

/** Rotate the Japanese prolonged sound mark only in vertical composition. */
export function verticalMark(
  character: string,
  x: number,
  y: number,
  size: number,
): Pick<NodeMeta, "rotation" | "transformOrigin"> {
  return character === "ー"
    ? { rotation: 90, transformOrigin: { x: x + size / 2, y: y + size / 2 } }
    : {};
}
