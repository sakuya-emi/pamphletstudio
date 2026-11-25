import fontkit from "@pdf-lib/fontkit";
import type { Measure } from "../layout-engine/types";
export interface FontBytes {
  medium: Uint8Array;
  bold: Uint8Array;
}
// pdf-lib encodes glyph IDs with nominal advances, without GPOS positioning.
// Disable localized Latin alternates (Noto digits can otherwise map to PUA glyphs),
// fraction substitutions and kerning consistently in preview/measurement/PDF.
export const PDF_FONT_FEATURES = {
  kern: false,
  liga: false,
  clig: false,
  calt: false,
  frac: false,
  numr: false,
  dnom: false,
  locl: false,
};
export function fontMeasure(bytes: FontBytes): Measure {
  const normal = fontkit.create(bytes.medium),
    bold = fontkit.create(bytes.bold);
  const caches = [new Map<string, number>(), new Map<string, number>()];
  return (s, size, strong) => {
    const cache = caches[strong ? 1 : 0];
    let advance = cache.get(s);
    if (advance === undefined) {
      const f = strong ? bold : normal;
      advance =
        f
          .layout(s, PDF_FONT_FEATURES)
          .positions.reduce(
            (n: number, pos: { xAdvance: number }) => n + pos.xAdvance,
            0,
          ) / f.unitsPerEm;
      if (s.length <= 512) {
        if (cache.size >= 8192) cache.delete(cache.keys().next().value!);
        cache.set(s, advance);
      }
    }
    return advance * size;
  };
}
