import type { Project } from "./model";
import type { Node } from "../layout-engine/types";
export interface ColorPalette {
  id: string;
  name: string;
  colors: Record<string, string>;
}
export function recolorNodes(project: Project, nodes: Node[]): Node[] {
  const colors = project.colorPalettes?.find(
    (p) => p.id === project.colorPaletteId,
  )?.colors;
  if (!colors) return nodes;
  const color = (value: string) => colors[value.toLowerCase()] || value;
  return nodes.map((n) => {
    if (
      n.kind === "asset" ||
      n.editorOnly ||
      n.crisp ||
      ["surveyUrl", "websiteUrl"].includes(n.source?.field || "")
    )
      return n;
    if (n.kind === "text") return { ...n, color: color(n.color) };
    return {
      ...n,
      fill: color(n.fill),
      stroke: n.stroke ? color(n.stroke) : undefined,
    };
  });
}
export function paletteColors(
  project: Project,
  nodes: Node[],
): Record<string, string> {
  const values = new Set([
    project.theme.background,
    project.theme.ink,
    project.theme.accent,
    ...project.chapters.map((c) => c.color),
  ]);
  for (const color of [
    "#d83d70",
    "#fa4834",
    "#2ba6c5",
    "#65aa94",
    "#bfe7ed",
    "#cde6dc",
    "#3b75ac",
    "#66a850",
    "#eff5e8",
    "#eaf3f7",
    "#66a8c5",
    "#e4f1f4",
    "#ffffff",
    "#231815",
  ])
    values.add(color);
  // Include registered designs that may not be applied to a page yet.
  for (const color of JSON.stringify(project.templates).match(
    /#[0-9a-f]{6}\b/gi,
  ) || [])
    values.add(color);
  for (const n of nodes) {
    if (
      n.editorOnly ||
      n.kind === "asset" ||
      ["surveyUrl", "websiteUrl"].includes(n.source?.field || "")
    )
      continue;
    if (n.kind === "text") values.add(n.color);
    else {
      values.add(n.fill);
      if (n.stroke) values.add(n.stroke);
    }
  }
  return Object.fromEntries(
    [...values]
      .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
      .map((c) => [c.toLowerCase(), c.toLowerCase()]),
  );
}
