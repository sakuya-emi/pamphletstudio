import type { CornerRadius } from "./corners";
export type DataField =
  | "name"
  | "group"
  | "building"
  | "floor"
  | "room"
  | "location"
  | "place"
  | "placeShort";
export interface BorderStyle {
  color: string;
  width: number;
  type: "solid" | "dotted" | "dashed" | "none";
  gap?: number;
}
export interface CellStyle {
  fill?: string;
  alternate?: string;
  color?: string;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  padding?: number;
  lineHeight?: number;
  letterSpacing?: number;
  corners?: CornerRadius;
  cornersLinked?: boolean;
  border?: Partial<Record<"top" | "right" | "bottom" | "left", BorderStyle>>;
}
export interface GroupStyle extends CellStyle {
  stroke?: string;
  strokeWidth?: number;
  shadow?: number;
  labelSize?: number;
  labelColor?: string;
  labelWidth?: number;
}
export interface TableStyle {
  variant: "grid" | "stripe" | "cards" | "split";
  base: CellStyle;
  header: CellStyle;
  headerColumns?: Record<string, CellStyle>;
  odd: CellStyle;
  even: CellStyle;
  columns: Record<string, CellStyle>;
  rows: Record<string, CellStyle>;
  cells: Record<string, CellStyle>;
  groups: Record<string, GroupStyle>;
  merge: { column: number; key: DataField; withinGroup: boolean }[];
  spans: { rowId: string; column: number; rowSpan: number; colSpan: number }[];
  rowGap: number;
  columnGap: number;
  groupGap: number;
  groupLabelWidth: number;
  groupBy: DataField | "none";
  keepGroups: boolean;
  autoHeight: boolean;
  paginate: boolean;
  leader: BorderStyle;
  leaderInset: number;
  title: {
    text: string;
    scope: "none" | "first" | "all";
    height: number;
    style: CellStyle;
  };
  group: GroupStyle;
}
export interface TableTarget {
  kind:
    | "table"
    | "cell"
    | "column"
    | "row"
    | "header"
    | "group"
    | "groupLabel"
    | "border"
    | "title";
  column?: number;
  rowId?: string;
  rowIndex?: number;
  groupKey?: string;
  rowSpan?: number;
  colSpan?: number;
}
export function defaultTableStyle(): TableStyle {
  return {
    variant: "grid",
    base: {
      fill: "#ffffff",
      color: "#231815",
      size: 3.2,
      padding: 2,
      lineHeight: 1.5,
      align: "left",
      valign: "center",
    },
    header: { fill: "#285b48", color: "#ffffff", bold: true },
    odd: { fill: "#ffffff" },
    even: { fill: "#f3f4ef" },
    columns: {},
    rows: {},
    cells: {},
    groups: {},
    merge: [],
    spans: [],
    rowGap: 0,
    columnGap: 0,
    groupGap: 3,
    groupLabelWidth: 23,
    groupBy: "building",
    keepGroups: false,
    autoHeight: true,
    paginate: true,
    leader: { color: "#808080", width: 0.18, type: "none", gap: 0.65 },
    leaderInset: 1,
    title: {
      text: "",
      scope: "none",
      height: 13,
      style: {
        fill: "#7f9fc8",
        color: "#ffffff",
        size: 6,
        bold: true,
        corners: { topLeft: 5, topRight: 5, bottomRight: 5, bottomLeft: 5 },
      },
    },
    group: {
      fill: "#ffffff",
      stroke: "#ac743a",
      strokeWidth: 0.35,
      shadow: 1,
      labelSize: 6,
      labelColor: "#ac743a",
      corners: { topLeft: 5, topRight: 5, bottomRight: 5, bottomLeft: 5 },
    },
  };
}
