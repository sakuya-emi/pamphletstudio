import {
  insertBlock,
  type Project,
  type Event,
  type Ad,
  type Staff,
} from "./model";
export type EventCategory =
  "student" | "food" | "stage" | "studentStage" | "kitchen";
export const categoryNames: Record<EventCategory, string> = {
  student: "学生企画",
  food: "模擬店",
  stage: "ステージ企画",
  studentStage: "学生ステージ企画",
  kitchen: "キッチンカー",
};
export const eventCategory = (e: Event): EventCategory =>
  e.category && Object.hasOwn(categoryNames, e.category)
    ? e.category
    : "student";
export const isStage = (e: Event) =>
  e.category === "stage" || e.category === "studentStage";
export function nextRecordId(p: Project): string {
  const used = new Set(
    [
      ...p.events,
      ...p.ads,
      ...p.sponsors,
      ...p.staff,
      ...p.chapters,
      ...(p.kitchenMenus || []),
    ].map((r) => r.id),
  );
  let n = Math.max(1, p.nextRecordId || 1);
  while (used.has(String(n))) n++;
  p.nextRecordId = n + 1;
  return String(n);
}
export function addEvent(p: Project, category: EventCategory): Event {
  const e: Event = {
    id: nextRecordId(p),
    name: "",
    group: "",
    building: "",
    room: "",
    location: "",
    category,
    published: true,
  };
  p.events.push(e);
  ensureEventSection(p, e);
  return e;
}
function ensureEventSection(p: Project, e: Event) {
  const template =
    e.category === "kitchen" ? "kitchen" : isStage(e) ? "stage" : undefined;
  if (template && !p.blocks.some((b) => b.template === template))
    insertBlock(p, {
      id: nextRecordId(p),
      template,
      title:
        template === "stage" ? "ステージタイムテーブル" : "キッチンカー紹介",
      chapterId:
        p.chapters[template === "stage" ? 1 : 3]?.id || p.chapters[0].id,
    });
}
export function addStaff(p: Project, name = ""): Staff {
  const s = { id: nextRecordId(p), name, kana: "", grade: 0, role: "" };
  p.staff.push(s);
  return s;
}
export function addAd(p: Project): Ad {
  const a: Ad = { id: nextRecordId(p), sponsorId: "", size: "quarter" };
  p.ads.push(a);
  return a;
}
const companyKey = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
export function adCompany(p: Project, id: string): string {
  return (
    p.sponsors.find((s) => s.id === p.ads.find((a) => a.id === id)?.sponsorId)
      ?.name || ""
  );
}
export function setAdCompany(p: Project, id: string, name: string) {
  const ad = p.ads.find((a) => a.id === id);
  if (!ad) throw new Error("広告が見つかりません。");
  const trimmed = name.trim();
  if (!trimmed) {
    ad.sponsorId = "";
    return;
  }
  let s = p.sponsors.find((s) => companyKey(s.name) === companyKey(trimmed));
  if (!s) {
    s = { id: nextRecordId(p), name: trimmed, kana: "", sortKey: "" };
    p.sponsors.push(s);
  }
  ad.sponsorId = s.id;
}
export function setCategory(p: Project, id: string, category: EventCategory) {
  const e = p.events.find((e) => e.id === id);
  if (e) {
    e.category = category;
    ensureEventSection(p, e);
  }
}
export function addMenu(p: Project, eventId: string, name = "") {
  p.kitchenMenus ||= [];
  const m = {
    id: nextRecordId(p),
    eventId,
    name,
    order:
      Math.max(
        -1,
        ...p.kitchenMenus
          .filter((m) => m.eventId === eventId)
          .map((m) => m.order),
      ) + 1,
  };
  p.kitchenMenus.push(m);
  return m;
}
export function menus(p: Project, eventId: string) {
  return (p.kitchenMenus || [])
    .filter((m) => m.eventId === eventId)
    .sort((a, b) => a.order - b.order);
}
export function timeWarning(e: Event, endOptional = false) {
  if (!isStage(e)) return "";
  if (!e.startTime || (!endOptional && !e.endTime))
    return endOptional
      ? "開始時刻を入力してください。"
      : "開始時刻と終了時刻を入力してください。";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.startTime) ||
    (!!e.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.endTime))
  )
    return "時刻は例：10:30 の形式で入力してください。";
  return e.endTime && e.startTime >= e.endTime
    ? "終了時刻は開始時刻より後にしてください。"
    : "";
}
