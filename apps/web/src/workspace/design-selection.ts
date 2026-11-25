import type { Block, Project } from "../../../../packages/core/model";
import { findComponent } from "../../../../packages/designer/components";
import type { DesignTemplate } from "../../../../packages/designer/model";

export function currentPartId(
  p: Project,
  b: Block | undefined,
  t: DesignTemplate,
  targetId?: string,
) {
  if (!b || !t.componentKind) return;
  const binding = t.objects[0]?.binding;
  const kind = t.componentKind;
  const object =
    findComponent(p, b, kind, targetId, binding) ??
    (!targetId ? findComponent(p, b, kind, undefined, binding) : undefined);
  return (
    object?.templateRef ??
    b.components?.find(
      (i) =>
        i.kind === kind &&
        (!targetId || [i.id, i.targetObjectId].includes(targetId)) &&
        p.templates.find((d) => d.id === i.templateId)?.objects[0]?.binding ===
          binding,
    )?.templateId
  );
}

export function applyPageVariant(
  p: Project,
  blockId: string,
  change: Partial<Block>,
  all: boolean,
) {
  const current = p.blocks.find((b) => b.id === blockId);
  if (!current || (current.templateId && !Object.hasOwn(change, "templateId")))
    return;
  for (const b of p.blocks)
    if (
      b.id === blockId ||
      (all &&
        !b.templateId &&
        b.template === current.template &&
        b.posterMode === current.posterMode)
    )
      Object.assign(b, change);
}

export function applyThemeVariant(
  p: Project,
  key: "indexShape" | "scheduleStyle",
  value: string,
) {
  if (key === "indexShape")
    p.theme.indexShape = value === "square" ? "square" : "rounded";
  else p.theme.scheduleStyle = value === "line" ? "line" : "bands";
}
