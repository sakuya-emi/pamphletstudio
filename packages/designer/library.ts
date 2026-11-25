import { validateDesign, type DesignTemplate } from "./model";
import { type Asset, type Project } from "../core/model";

export interface LibraryRelease {
  templateId: string;
  version: number;
  publishedAt: string;
  templates: DesignTemplate[];
  assets: Record<string, Asset>;
}
export interface DesignLibrary {
  format: "pamph-design-library";
  schemaVersion: 1;
  drafts: DesignTemplate[];
  assets: Record<string, Asset>;
  palettes?: Project["colorPalettes"];
  paletteId?: string;
  theme?: Project["theme"];
  chapterColors?: string[];
  releases: LibraryRelease[];
}
export function emptyLibrary(): DesignLibrary {
  return {
    format: "pamph-design-library",
    schemaVersion: 1,
    drafts: [],
    assets: {},
    releases: [],
  };
}
export function validateLibrary(value: unknown): DesignLibrary {
  if (!value || typeof value !== "object")
    throw new Error("共通ライブラリを読み込めません。");
  const lib = value as DesignLibrary;
  if (
    lib.format !== "pamph-design-library" ||
    lib.schemaVersion !== 1 ||
    !Array.isArray(lib.drafts) ||
    !Array.isArray(lib.releases) ||
    !lib.assets ||
    typeof lib.assets !== "object"
  )
    throw new Error("共通ライブラリの形式に対応していません。");
  const unique = (ids: string[]) => ids.length === new Set(ids).size;
  if (
    !unique(lib.drafts.map((t) => t.id)) ||
    !unique(lib.releases.map((r) => r.templateId + ":" + r.version))
  )
    throw new Error("共通ライブラリの版が重複しています。");
  lib.drafts.forEach(validateDesign);
  const assets = (all: Record<string, Asset>) => {
    if (!all || typeof all !== "object") throw new Error("素材が不正です。");
    for (const [id, a] of Object.entries(all)) {
      if (
        !a ||
        id !== a.id ||
        ![
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/svg+xml",
          "application/pdf",
        ].includes(a.mime) ||
        !a.data?.startsWith("data:" + a.mime + ";base64,") ||
        !(
          Number.isFinite(a.width) &&
          Number.isFinite(a.height) &&
          a.width > 0 &&
          a.height > 0
        )
      )
        throw new Error("共通ライブラリの素材が不正です。");
    }
  };
  assets(lib.assets);
  if (lib.theme) {
    const theme = lib.theme;
    if (
      !["background", "ink", "accent", "silver"].every((k) =>
        /^#[0-9a-f]{6}$/i.test(String(theme[k as keyof typeof theme])),
      ) ||
      ![
        "adWidth",
        "adHeight",
        "adHalfHeight",
        "adQuarterHeight",
        "posterAspect",
        "fontSize",
        "lineHeight",
      ].every(
        (k) =>
          Number.isFinite(theme[k as keyof typeof theme]) &&
          Number(theme[k as keyof typeof theme]) > 0,
      ) ||
      !Number.isFinite(theme.margin) ||
      theme.margin < 0 ||
      !["left", "right"].includes(theme.binding) ||
      ![1, 2, 4].includes(theme.padding) ||
      !["keep", "center"].includes(theme.emptySlots) ||
      typeof theme.fontFamily !== "string"
    )
      throw new Error("共通ライブラリの表示設定が不正です。");
  }
  if (
    lib.chapterColors &&
    (!Array.isArray(lib.chapterColors) ||
      lib.chapterColors.some((c) => !/^#[0-9a-f]{6}$/i.test(c)))
  )
    throw new Error("共通の章色が不正です。");
  if (lib.palettes) {
    if (
      !Array.isArray(lib.palettes) ||
      lib.palettes.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          !p.colors ||
          Object.entries(p.colors).some(
            ([k, v]) =>
              !/^#[0-9a-f]{6}$/i.test(k) || !/^#[0-9a-f]{6}$/i.test(v),
          ),
      )
    )
      throw new Error("共通の配色が不正です。");
  }
  for (const r of lib.releases) {
    if (
      !Number.isInteger(r.version) ||
      r.version < 1 ||
      typeof r.publishedAt !== "string" ||
      !Array.isArray(r.templates) ||
      !r.templates.some((t) => t.id === r.templateId)
    )
      throw new Error("公開済みテンプレートの版が不正です。");
    if (!unique(r.templates.map((t) => t.id)))
      throw new Error("公開版の参照が重複しています。");
    r.templates.forEach(validateDesign);
    assets(r.assets);
    collectRelease(r.templates, r.assets, r.templateId);
  }
  return lib;
}
function collectRelease(
  templates: DesignTemplate[],
  assets: Record<string, Asset>,
  id: string,
) {
  const found = new Map<string, DesignTemplate>(),
    media: Record<string, Asset> = {},
    stack = new Set<string>();
  function visit(id: string) {
    if (stack.has(id)) throw new Error("テンプレートが循環参照しています。");
    if (found.has(id)) return;
    const t = templates.find((t) => t.id === id);
    if (!t) throw new Error("参照先のテンプレートがありません。");
    validateDesign(t);
    stack.add(id);
    if (t.masterId) visit(t.masterId);
    for (const o of t.objects) {
      if (o.templateRef) visit(o.templateRef);
      if (o.assetId) {
        const a = assets[o.assetId];
        if (!a) throw new Error("テンプレートの画像がありません。");
        media[a.id] = structuredClone(a);
      }
    }
    stack.delete(id);
    found.set(id, structuredClone(t));
  }
  visit(id);
  return { templates: [...found.values()], assets: media };
}
export function publishTemplate(
  library: DesignLibrary,
  id: string,
): DesignLibrary {
  const content = collectRelease(library.drafts, library.assets, id);
  const version =
    Math.max(
      0,
      ...library.releases
        .filter((r) => r.templateId === id)
        .map((r) => r.version),
    ) + 1;
  const palette = library.palettes?.find(
    (p) => p.id === library.paletteId,
  )?.colors;
  const mapColors = (value: unknown, field = ""): unknown => {
    if (
      typeof value === "string" &&
      /(?:color|fill|stroke|background|alternate)/i.test(field) &&
      /^#[0-9a-f]{6}$/i.test(value)
    )
      return palette?.[value.toLowerCase()] ?? value;
    if (Array.isArray(value)) return value.map((v) => mapColors(v));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, mapColors(v, k)]),
      );
    return value;
  };
  if (palette)
    content.templates = content.templates.map((t) => ({
      ...t,
      background: mapColors(t.background, "background") as string,
      objects: mapColors(t.objects) as DesignTemplate["objects"],
    }));
  const release: LibraryRelease = {
    templateId: id,
    version,
    publishedAt: new Date().toISOString(),
    ...content,
  };
  for (const t of release.templates) if (t.id === id) t.version = version;
  return { ...library, releases: [...library.releases, release] };
}
export function restoreRelease(
  library: DesignLibrary,
  id: string,
  version: number,
): DesignLibrary {
  const release = library.releases.find(
    (r) => r.templateId === id && r.version === version,
  );
  if (!release) throw new Error("指定した版がありません。");
  const copy = structuredClone(library);
  const isolated = installedRelease(release);
  const root = {
    ...isolated.template,
    id,
    sharedSource: undefined,
    updatedAt: new Date().toISOString(),
  };
  for (const dependency of isolated.templates.filter(
    (t) => t.id !== isolated.template.id,
  ))
    if (!copy.drafts.some((t) => t.id === dependency.id))
      copy.drafts.push(dependency);
  const at = copy.drafts.findIndex((t) => t.id === id);
  if (at < 0) copy.drafts.push(root);
  else copy.drafts[at] = root;
  Object.assign(copy.assets, isolated.assets);
  return copy;
}
export function installedRelease(release: LibraryRelease) {
  const ids = new Map(
    release.templates.map((t) => [
      t.id,
      "shared:" + release.templateId + ":" + release.version + ":" + t.id,
    ]),
  );
  const assets = Object.fromEntries(
    Object.entries(release.assets).map(([id, a]) => {
      const next =
        "shared:" + release.templateId + ":" + release.version + ":asset:" + id;
      return [next, { ...structuredClone(a), id: next }];
    }),
  );
  const templates = release.templates.map((t) => ({
    ...structuredClone(t),
    id: ids.get(t.id)!,
    masterId: t.masterId ? ids.get(t.masterId) : undefined,
    sharedSource: { id: release.templateId, version: release.version },
    objects: t.objects.map((o) => ({
      ...structuredClone(o),
      templateRef: o.templateRef ? ids.get(o.templateRef) : undefined,
      assetId: o.assetId
        ? "shared:" +
          release.templateId +
          ":" +
          release.version +
          ":asset:" +
          o.assetId
        : undefined,
    })),
  }));
  return {
    templates,
    assets,
    template: templates.find((t) => t.id === ids.get(release.templateId))!,
  };
}
export function installRelease(
  p: Project,
  release: LibraryRelease,
): DesignTemplate {
  const imported = installedRelease(release);
  for (const t of imported.templates) {
    const existing = p.templates.find((x) => x.id === t.id);
    if (!existing) p.templates.push(t);
    else if (JSON.stringify(existing) !== JSON.stringify(t))
      throw new Error(
        "この公開版は冊子内で個別編集されています。別バージョンを選択してください。",
      );
  }
  for (const [id, a] of Object.entries(imported.assets)) {
    if (p.assets[id] && JSON.stringify(p.assets[id]) !== JSON.stringify(a))
      throw new Error("共通素材が冊子内で変更されています。");
    p.assets[id] = a;
  }
  return p.templates.find((t) => t.id === imported.template.id)!;
}
