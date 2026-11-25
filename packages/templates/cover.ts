import { backCover } from "./back-cover";
import { rect, text, type Context, type Node } from "../layout-engine/types";
export function cover(c: Context, back = false): Node[] {
  if (back && c.block.backLayout) return backCover(c);
  const { project: p } = c;
  const n: Node[] = [rect(0, 0, 148, 210, p.theme.background)];
  if (!back) {
    if (p.coverId)
      n.push({
        kind: "asset",
        assetId: p.coverId,
        x: 0,
        y: 0,
        w: 148,
        h: 210,
        source: { type: "project", id: p.id, field: "coverId" },
      });
    return n;
  }
  const asset = c.block.assetId;
  if (asset)
    n.push({
      kind: "asset",
      assetId: asset,
      x: 0,
      y: 0,
      w: 148,
      h: 210,
      source: { type: "block", id: c.block.id, field: "assetId" },
    });
  else {
    n.push(rect(13, 17, 4, 21, p.theme.accent));
    n.push(text(23, 19, 110, "TOYU FESTIVAL", 4, p.theme.accent, true));
  }
  n.push({
    ...text(15, 110, 118, c.block.title, 6, p.theme.ink, true),
    source: { type: "block", id: c.block.id, field: "title" },
  });
  if (c.block.body)
    c.block.body
      .split("\n")
      .slice(0, 8)
      .forEach((s, i) =>
        n.push({
          ...text(15, 130 + i * 6, 118, s, 3.2, p.theme.ink),
          source: { type: "block", id: c.block.id, field: "bodyLine:" + i },
        }),
      );
  if (p.logoId)
    n.push({
      kind: "asset",
      assetId: p.logoId,
      x: 15,
      y: 187,
      w: 80,
      h: 13,
      source: { type: "project", id: p.id, field: "logoId" },
    });
  else
    n.push({
      ...text(15, 190, 118, "大学ロゴ未登録", 3, p.theme.silver),
      editorOnly: true,
    });
  return n;
}
