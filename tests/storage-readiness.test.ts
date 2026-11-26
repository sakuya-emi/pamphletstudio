import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  set: async (key: string, value: unknown) => {
    db.set(key, structuredClone(value));
  },
  get: async (key: string) => structuredClone(db.get(key)),
  keys: async () => [...db.keys()],
  del: async (key: string) => {
    db.delete(key);
  },
}));
import { createFestivalProject } from "../packages/core/festival-opening";
import {
  interpretRows,
  planRow,
  sheets,
  type ImportSheet,
} from "../packages/core/excel-import";
import { writeSource } from "../packages/core/editing";
import {
  prepareProjectForSave,
  validateProject,
  webStorage,
  type UnreadableProject,
} from "../packages/project-storage";
import fixture from "./fixtures/excel-template-v2.json";
beforeEach(() => db.clear());
it("real Excel template imports then cleared basic information saves, reloads and deletes", async () => {
  const p = createFestivalProject();
  let imported = 0;
  for (const [sheet, rows] of Object.entries(fixture)) {
    if (!Object.hasOwn(sheets, sheet)) continue;
    for (const row of interpretRows(sheet as ImportSheet, rows, true)) {
      const plan = planRow(p, row);
      expect(plan.error, sheet + row.line).toBeFalsy();
      plan.apply(p, plan.candidates[0]?.id);
      imported++;
    }
  }
  expect(imported).toBeGreaterThanOrEqual(53);
  for (const field of ["edition", "date", "time", "university"])
    writeSource(p, { type: "project", id: p.id, field }, "");
  p.contentVersion = "generated";
  p.lastPdf = {
    contentVersion: "generated",
    at: new Date().toISOString(),
    pages: 28,
  };
  await webStorage.autosave(p);
  const recent = await webStorage.recent();
  expect(recent).toHaveLength(1);
  expect(recent[0].edition).toBe(0);
  const loaded = (await webStorage.load(await webStorage.save(recent[0])))
    .project;
  expect([loaded.date, loaded.time, loaded.university]).toEqual(["", "", ""]);
  expect(loaded.lastPdf).toEqual(p.lastPdf);
  await webStorage.remove(p.id);
  expect(await webStorage.recent()).toEqual([]);
});
it.each([undefined, null, ""])(
  "recovers previously saved cleared edition %s",
  (value) => {
    const p = { ...createFestivalProject(), edition: value };
    expect(validateProject(p).edition).toBe(0);
  },
);
it("rejects invalid writes before replacing good data and reports only damaged entries for deletion", async () => {
  const p = createFestivalProject();
  await webStorage.autosave(p);
  await expect(
    webStorage.autosave({ ...p, edition: Number.NaN }),
  ).rejects.toThrow();
  await expect(webStorage.save({ ...p, date: {} as string })).rejects.toThrow();
  db.set("pamph:damaged", {
    id: "damaged",
    name: "壊れたデータ",
    schemaVersion: 999,
  });
  let damaged: UnreadableProject[] = [];
  const valid = await webStorage.recent((count, entries) => {
    expect(count).toBe(1);
    damaged = entries;
  });
  expect(valid.map((q) => q.id)).toEqual([p.id]);
  expect(damaged[0].id).toBe("damaged");
  expect(damaged[0].reason).toContain("スキーマ");
  await webStorage.remove(damaged[0].id);
  expect((await webStorage.recent()).map((q) => q.id)).toEqual([p.id]);
  expect(prepareProjectForSave(valid[0]).edition).toBe(p.edition);
});
