import {
  indexPreset,
  tablePreset,
} from "../../../../packages/designer/presets";
import {
  createDesign,
  object,
  type DesignTemplate,
} from "../../../../packages/designer/model";
import type { Preset } from "./EditorDialog";
export function createPresetTemplate(
  kind: Preset,
  name?: string,
  number = 1,
): DesignTemplate {
  if (kind === "index")
    return Object.assign(indexPreset(), name ? { name } : {});
  if (kind === "tableA" || kind === "tableB" || kind === "tableC")
    return tablePreset(
      kind === "tableA" ? "stripe" : kind === "tableB" ? "cards" : "split",
      name,
    );
  const label = {
    table: "表",
    index: "インデックス",
    timetable: "タイムテーブル",
    posters: "ポスター紹介",
    ads: "広告",
    free: "自由配置",
  }[kind];
  const t = createDesign(
    kind === "table"
      ? "events"
      : kind === "posters"
        ? "posters"
        : kind === "ads"
          ? "ads"
          : "notice",
    name || `${label} ${number}`,
  );
  const title = t.objects.find(
    (o) => o.kind === "text" && o.binding === "none",
  );
  if (title) title.text = label;
  if (kind === "timetable")
    t.objects.push(object("timetable", t.layers[0].id, 12, 28, 126, 165));
  if (kind === "ads") {
    t.objects = t.objects.filter((o) => o.binding === "page.number");
    for (let i = 0; i < 2; i++) {
      const o = object("image", t.layers[0].id, 11.5, 20 + i * 95, 125, 85);
      o.binding = "advertisement";
      o.adSize = "half";
      o.name = `1/2広告 ${i + 1}`;
      t.objects.push(o);
    }
  }
  return t;
}
export function removeObjects(t: DesignTemplate, ids: string[]) {
  t.objects = t.objects.filter(
    (o) =>
      !ids.includes(o.id) ||
      o.locked ||
      t.layers.find((l) => l.id === o.layerId)?.locked,
  );
}
export function reorderObjects(
  t: DesignTemplate,
  ids: string[],
  front: boolean,
) {
  const selected = t.objects.filter((o) => ids.includes(o.id)),
    rest = t.objects.filter((o) => !ids.includes(o.id));
  t.objects = front ? [...rest, ...selected] : [...selected, ...rest];
}
