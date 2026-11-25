import { expect, it } from "vitest";
import { createProject, nextYear } from "../packages/core/model";
import { writeSource } from "../packages/core/editing";
import { festivalDate } from "../packages/core/festival-date";
import { validateProject } from "../packages/project-storage";

it("入力した日付を基準に年度と曜日をそろえ、年度更新で旧日付を残さない", () => {
  const p = createProject();
  expect(p.date).toBe("");
  writeSource(p, { type: "project", id: p.id, field: "date" }, "2027-10-25");
  expect([p.year, p.date]).toEqual([2027, "2027年10月25日（月）"]);
  expect(nextYear(p).date).toBe("");
});

it("旧ファイルの曜日と年度を補正し、単一の日付にできない表記は保持する", () => {
  const p = createProject();
  const migrated = validateProject({ ...p, date: "2027年10月25日（日）" });
  expect([migrated.year, migrated.date]).toEqual([
    2027,
    "2027年10月25日（月）",
  ]);
  expect(validateProject({ ...p, date: "10月24・25日" }).date).toBe(
    "10月24・25日",
  );
  expect(festivalDate("2027-02-29")).toBeUndefined();
});
