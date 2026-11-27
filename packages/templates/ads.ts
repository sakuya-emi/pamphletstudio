import type { AdSize, Theme, Project } from "../core/model";
import { adCompany } from "../core/registration";
import {
  rect,
  text,
  wrap,
  fallbackMeasure,
  type Measure,
  type Context,
  type Node,
} from "../layout-engine/types";
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
export function adPlaceholderLabel(project: Project, adId?: string) {
  return adId
    ? `${adCompany(project, adId) || "企業名未設定"}\n画像未登録`
    : "企業未設定（広告未設定）";
}

export function adPlaceholder(
  box: { x: number; y: number; w: number; h: number },
  label: string,
  measure: Measure = fallbackMeasure,
): Node[] {
  let size = 3;
  let lines = wrap(label, Math.max(1, box.w - 6), size, measure);
  while (lines.length * size * 1.4 > box.h - 4 && size > 1) {
    size -= 0.1;
    lines = wrap(label, Math.max(1, box.w - 6), size, measure);
  }
  return [
    {
      ...rect(box.x, box.y, box.w, box.h, "#faf9f6", "#d9d6cf"),
      editorOnly: true,
      componentKind: "ad-placeholder",
    },
    ...lines.map((line, i): Node => ({
      ...text(
        box.x + 3,
        box.y + (box.h - lines.length * size * 1.4) / 2 + i * size * 1.4,
        Math.max(1, box.w - 6),
        line,
        size,
        "#808080",
      ),
      editorOnly: true,
      componentKind: "ad-placeholder",
    })),
  ];
}
