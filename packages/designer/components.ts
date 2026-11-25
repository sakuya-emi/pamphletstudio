import {
  object,
  type DesignObject,
  type DesignTemplate,
  type ComponentInstance,
  type ObjectKind,
} from "./model";
import { uid, type Project, type Block } from "../core/model";
export function resolveObject(p: Project, o: DesignObject): DesignObject {
  if (!o.templateRef) return o;
  const t = p.templates.find(
    (t) => t.id === o.templateRef && t.scope === "component",
  );
  const source = t?.objects.find((a) => a.kind === o.kind);
  if (!source) return o;
  return {
    ...structuredClone(source),
    ...structuredClone(o.localOverrides || {}),
    id: o.id,
    layerId: o.layerId,
    groupId: o.groupId,
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    binding: o.binding,
    assetId: o.assetId,
    text: o.text,
    templateRef: o.templateRef,
    localOverrides: o.localOverrides,
  };
}
export function componentObject(
  p: Project,
  i: ComponentInstance,
): DesignObject {
  const t = p.templates.find((t) => t.id === i.templateId);
  if (!t || t.scope !== "component" || t.componentKind !== i.kind)
    throw new Error("部品テンプレート参照が不正です。");
  return resolveObject(p, {
    ...structuredClone(t.objects[0]),
    ...i.placement,
    ...i.overrides,
    id: i.targetObjectId || i.id,
    layerId: t.layers[0].id,
    templateRef: t.id,
    localOverrides: i.overrides,
  });
}
export function blockDesign(p: Project, b: Block): DesignTemplate | undefined {
  const base = p.templates.find((t) => t.id === b.templateId);
  if (!base) return;
  const t = structuredClone(base);
  for (const i of b.components || []) {
    const index = t.objects.findIndex(
      (o) =>
        o.id === i.targetObjectId || (!i.targetObjectId && o.kind === i.kind),
    );
    const n = componentObject(p, i);
    if (index >= 0) {
      const old = t.objects[index];
      t.objects[index] = {
        ...n,
        id: old.id,
        layerId: old.layerId,
        binding: old.binding,
        assetId: old.assetId,
        text: old.text,
        repeatRole: old.repeatRole,
      };
    } else {
      const master = p.templates.find((m) => m.id === t.masterId);
      if (master?.objects.some((o) => o.id === i.targetObjectId)) {
        t.runtimeOverrides ||= [];
        t.runtimeOverrides.push(i);
      } else {
        n.layerId = t.layers[0].id;
        t.objects.push(n);
      }
    }
  }
  return t;
}
export function findComponent(
  p: Project,
  b: Block,
  kind: ObjectKind,
  targetId?: string,
  binding?: string,
): DesignObject | undefined {
  const existing = b.components?.find(
    (i) =>
      i.kind === kind &&
      (!binding ||
        p.templates.find((t) => t.id === i.templateId)?.objects[0].binding ===
          binding) &&
      (!targetId || (i.targetObjectId || i.id) === targetId),
  );
  if (existing) return componentObject(p, existing);
  const design = blockDesign(p, b);
  const actual = design?.objects.find(
    (o) =>
      (!targetId || o.id === targetId) &&
      o.kind === kind &&
      (!binding || o.binding === binding),
  );
  if (actual) return resolveObject(p, actual);
  const master = p.templates.find((m) => m.id === design?.masterId);
  const shared = master?.objects.find(
    (o) =>
      (!targetId || o.id === targetId) &&
      o.kind === kind &&
      (!binding || o.binding === binding),
  );
  if (shared) return resolveObject(p, shared);
  if (design) return undefined;
  if (
    kind === "text" &&
    binding === "block.body" &&
    (b.template !== "notice" || b.openingKind)
  )
    return undefined;
  if (kind === "text" && binding && !["cover", "back"].includes(b.template)) {
    const body = binding === "block.body";
    const folio = binding === "page.number",
      o = object(
        "text",
        "builtin",
        folio ? 133 : 15,
        folio ? 203 : body ? (b.assetId ? 97 : 30) : 9,
        folio ? 10 : 120,
        folio ? 5 : body ? (b.assetId ? 97 : 162) : 10,
      );
    o.binding = binding as DesignObject["binding"];
    o.id = "builtin-" + binding;
    o.size = folio ? 3.2 : 5.2;
    o.mirror = folio;
    return o;
  }
  if (
    kind === "index" &&
    !["cover", "back"].includes(b.template) &&
    b.showIndex !== false
  )
    return {
      ...object("index", "builtin", 140, 0, 8, 196),
      id: "builtin-index",
      radius: 3,
      gap: 0.6,
      size: 2.8,
      stroke: "none",
      useChapterColors: true,
    };
  if (kind === "timetable" && b.template === "stage")
    return {
      ...object("timetable", "builtin", 12, 25, 126, 168),
      id: "builtin-stage",
      eventSource: "stage",
    };
  if (kind === "table" && b.template === "events")
    return {
      ...object("table", "builtin", 12, 23, 126, 174),
      id: "builtin-table",
    };
  return undefined;
}
export function applyComponent(
  p: Project,
  blockId: string,
  templateId: string,
  options: {
    targetId?: string;
    add?: boolean;
    all?: boolean;
    chapterId?: string;
  } = {},
) {
  const t = p.templates.find((t) => t.id === templateId);
  if (!t || t.scope !== "component" || !t.componentKind)
    throw new Error("ページ用のデザインは部品として適用できません。");
  const binding =
    t.componentKind === "text" || t.objects[0].binding === "advertisement"
      ? t.objects[0].binding
      : undefined;
  if (options.all) {
    for (const b of p.blocks) {
      if (options.chapterId && b.chapterId !== options.chapterId) continue;
      const d = blockDesign(p, b);
      const matching =
        d?.objects.filter(
          (o) =>
            o.kind === t.componentKind && (!binding || o.binding === binding),
        ) ?? [];
      if (matching.length) {
        for (const o of matching)
          applyComponent(p, b.id, templateId, { targetId: o.id });
      } else if (findComponent(p, b, t.componentKind, undefined, binding))
        applyComponent(p, b.id, templateId);
    }
    return;
  }
  const blocks = p.blocks.filter((b) => b.id === blockId);
  for (const b of blocks) {
    const old = findComponent(
      p,
      b,
      t.componentKind,
      options.all ? undefined : options.targetId,
      binding,
    );
    if (!old && !options.add)
      throw new Error(
        "対応する部品がありません。「新しく追加」を選択してください。",
      );
    if (!old && ["table", "posters", "timetable"].includes(t.componentKind)) {
      const d = blockDesign(p, b);
      if (
        d?.objects.some((o) =>
          ["table", "posters", "timetable"].includes(o.kind),
        ) ||
        ["events", "posters"].includes(b.template)
      )
        throw new Error("このページには既に自動改ページ部品があります。");
    }
    const prev = b.components?.find(
      (i) =>
        i.kind === t.componentKind &&
        (!binding ||
          p.templates.find((a) => a.id === i.templateId)?.objects[0].binding ===
            t.objects[0].binding) &&
        ((i.targetObjectId || i.id) === options.targetId ||
          !options.targetId ||
          options.all),
    );
    const source = old || t.objects[0];
    const instance: ComponentInstance = {
      id: prev?.id || uid(),
      kind: t.componentKind,
      templateId: t.id,
      targetObjectId: prev?.targetObjectId || old?.id,
      placement: { x: source.x, y: source.y, w: source.w, h: source.h },
      overrides: prev?.overrides,
    };
    b.components = (b.components || []).filter((i) => i.id !== prev?.id);
    b.components.push(instance);
  }
}
export function detachTemplate(p: Project, id: string) {
  for (const t of p.templates) {
    for (let j = 0; j < t.objects.length; j++) {
      const o = t.objects[j];
      if (o.templateRef === id) {
        const resolved = resolveObject(p, o);
        delete resolved.templateRef;
        delete resolved.localOverrides;
        t.objects[j] = resolved;
      }
    }
    if (t.masterId === id) t.masterId = undefined;
  }
  for (const b of p.blocks) {
    if (b.templateId === id) b.templateId = undefined;
    b.components = b.components?.filter((i) => i.templateId !== id);
  }
  p.templates = p.templates.filter((t) => t.id !== id);
}
