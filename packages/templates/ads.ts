import type { AdSize, Theme } from "../core/model";
import { rect, text, type Context, type Node } from "../layout-engine/types";
export const adCapacity: Record<AdSize, number> = {
  full: 1,
  half: 2,
  quarter: 4,
};
export function adHeight(theme: Theme, size: AdSize) {
  return size === "full"
    ? theme.adHeight
    : size === "half"
      ? theme.adHalfHeight
      : theme.adQuarterHeight;
}
export function adBox(c: Context, index: number, size: AdSize) {
  const h = adHeight(c.project.theme, size),
    count = adCapacity[size],
    gap = count > 1 ? Math.max(0, (180 - count * h) / (count - 1)) : 0;
  return {
    x: c.left + (c.width - c.project.theme.adWidth) / 2,
    y: 20 + index * (h + gap),
    w: c.project.theme.adWidth,
    h,
  };
}
export function adPlaceholder(
  box: { x: number; y: number; w: number; h: number },
  label: string,
): Node[] {
  return [
    {
      ...rect(box.x, box.y, box.w, box.h, "#faf9f6", "#d9d6cf"),
      editorOnly: true,
      componentKind: "ad-placeholder",
    },
    {
      ...text(
        box.x + 3,
        box.y + box.h / 2 - 1.6,
        box.w - 6,
        label,
        3,
        "#808080",
      ),
      editorOnly: true,
      componentKind: "ad-placeholder",
    },
  ];
}
