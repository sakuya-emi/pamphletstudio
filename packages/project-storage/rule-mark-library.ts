import { get, update } from "idb-keyval";
import type { Asset } from "../core/model";

const KEY = "shared-rule-marks:v1";

export async function loadRuleMarks(): Promise<Asset[]> {
  return (await get<Asset[]>(KEY)) ?? [];
}

export async function addRuleMarks(assets: Asset[]): Promise<void> {
  const marked = assets.filter(
    (a) => a.rulePicture === "smoking" || a.rulePicture === "drinking",
  );
  if (!marked.length) return;
  await update<Asset[]>(KEY, (previous) => {
    const items = new Map((previous ?? []).map((a) => [a.id, a]));
    for (const a of marked) if (!items.has(a.id)) items.set(a.id, a);
    return [...items.values()];
  });
}
