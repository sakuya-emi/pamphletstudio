import { normalizeSurveyUrl } from "./survey-url";
import { type Project, type AdSize, insertBlock } from "./model";
import {
  addAd,
  addEvent,
  addMenu,
  addStaff,
  adCompany,
  categoryNames,
  eventCategory,
  nextRecordId,
  setAdCompany,
  type EventCategory,
} from "./registration";
import { festivalDate } from "./festival-date";
import { writeSource } from "./editing";

const events = [
  "企画名",
  "団体名",
  "建物",
  "階数",
  "教室",
  "詳細な場所",
  "ポスター要否",
];
const stage = ["企画名", "開始時刻", "終了時刻", "ポスター要否"];
export const sheets = {
  学生企画: events,
  模擬店: events,
  ステージ企画: stage,
  学生ステージ企画: stage,
  キッチンカー: [
    "会社名",
    "メニュー1",
    "メニュー2",
    "メニュー3",
    "メニュー4",
    "メニュー5",
  ],
  協賛企業: ["企業名", "読み仮名", "並び替えキー"],
  広告: ["企業名", "広告サイズ"],
  スタッフ: ["分類", "氏名"],
  "章・インデックス": ["章名"],
  基本情報: ["項目", "内容"],
  アンケート: ["アンケートURL", "見出し", "本文"],
  挨拶: ["肩書", "氏名", "本文"],
  "お知らせ・注意事項": ["種類", "見出し", "本文"],
  "外部・特別企画": [
    "企画名",
    "団体名",
    "場所",
    "開始時刻",
    "終了時刻",
    "備考",
    "ポスター要否",
  ],
  ページ用テキスト: ["掲載箇所", "見出し", "本文・項目"],
} as const;
export type ImportSheet = keyof typeof sheets;
export type ImportRow = {
  sheet: ImportSheet;
  line: number;
  cells: string[];
  error?: string;
  sample?: boolean;
};
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .trim()
    .replace(/[\s　]+/g, "");
const aliases: Record<string, string> = {
  URL: "アンケートURL",
  回答URL: "アンケートURL",
  フォームURL: "アンケートURL",
  イベント名: "企画名",
  主催団体: "団体名",
  開始時間: "開始時刻",
  終了時間: "終了時刻",
  名前: "氏名",
  かな: "読み仮名",
  並べ替えキー: "並び替えキー",
  教室番号: "教室",
  詳細場所: "詳細な場所",
};
function header(v: string, names: readonly string[]) {
  const n = norm(v).replace(/\(任意\)$/, "");
  const name = aliases[n] ?? n;
  return names.indexOf(
    names.includes(name)
      ? name
      : name === "企業名"
        ? "会社名"
        : name === "会社名"
          ? "企業名"
          : name,
  );
}
const categories = Object.fromEntries(
  Object.entries(categoryNames).map(([k, v]) => [v, k]),
) as Partial<Record<ImportSheet, EventCategory>>;
const fields: Record<string, string> = {
  大学名: "university",
  学園祭名: "festival",
  開催回数: "edition",
  開催日: "date",
  開催時間: "time",
  テーマ: "tagline",
};
const size = (v: string) =>
  ({
    full: "full",
    half: "half",
    quarter: "quarter",
    "1ページ": "full",
    "1/2ページ": "half",
    "1/4ページ": "quarter",
  })[norm(v).toLowerCase()] as AdSize | undefined;
export function excelTime(value: string) {
  const v = norm(value);
  let minutes: number;
  if (/^\d{1,2}:\d{2}(?::00)?$/.test(v)) {
    const [h, m] = v.split(":").map(Number);
    if (h > 23 || m > 59) return;
    minutes = h * 60 + m;
  } else if (/^(?:0(?:\.\d+)?|\.\d+)$/.test(v))
    minutes = Math.round(Number(v) * 1440);
  else return;
  if (minutes >= 1440) return;
  return [Math.floor(minutes / 60), minutes % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
function dateValue(v: string) {
  if (/^\d{5}$/.test(v))
    return new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000)
      .toISOString()
      .slice(0, 10);
  return v;
}
export function parseExcelText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quote || !field)) {
      if (quote && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quote = !quote;
    } else if (!quote && c === "\t") {
      row.push(field);
      field = "";
    } else if (!quote && (c === "\r" || c === "\n")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quote) throw new Error("貼り付けた表の引用符が閉じていません。");
  row.push(field);
  rows.push(row);
  return rows;
}
export function interpretRows(
  sheet: ImportSheet,
  rows: string[][],
  workbook = false,
): ImportRow[] {
  const names = sheets[sheet];
  const has = (i: number) => rows[i]?.some(Boolean);
  const firstHeader = rows.findIndex((r) => {
    const mapped = r.map((c) => header(c, names)).filter((x) => x >= 0);
    return (
      mapped.length >= Math.min(2, names.length) ||
      (mapped.includes(0) && r.filter(Boolean).length === mapped.length)
    );
  });
  let indices = names.map((_, i) => i);
  if (firstHeader >= 0) {
    const mapped = rows[firstHeader].map((v) => header(v, names));
    if (
      new Set(mapped.filter((i) => i >= 0)).size !==
      mapped.filter((i) => i >= 0).length
    )
      return [
        {
          sheet,
          line: firstHeader + 1,
          cells: rows[firstHeader],
          error: "同じ項目の列が複数あります。",
        },
      ];
    indices = names.map((_, i) => mapped.indexOf(i));
  }
  let classification = "",
    viceCount = 0;
  const result: ImportRow[] = [];
  for (let i = firstHeader + 1; i < rows.length; i++) {
    if (!has(i)) continue;
    const r = rows[i];
    if (/^\s*(?:※|入力例[：:]|記入例[：:]|注記[：:])/.test(r[0] ?? ""))
      continue;
    const cells = indices.map((n) => r[n] ?? "");
    if (
      ["挨拶", "お知らせ・注意事項", "ページ用テキスト", "アンケート"].includes(
        sheet,
      )
    )
      cells[2] = cells[2].replace(/\\n/g, "\n");
    if (sheet === "スタッフ" && firstHeader < 0 && r.length === 1) {
      cells[1] = cells[0];
      cells[0] = "";
    }
    if (
      sheet === "挨拶" &&
      norm(cells[0]) === "副実行委員長" &&
      cells.slice(1).some((v) => v.trim()) &&
      ++viceCount > 1
    )
      cells[0] = "副実行委員長2";
    if (sheet === "スタッフ") {
      if (cells[0].trim()) classification = cells[0];
      cells[0] = classification;
      if (!cells[1].trim()) continue;
    }
    if (
      (sheet === "基本情報" ||
        sheet === "挨拶" ||
        sheet === "お知らせ・注意事項" ||
        sheet === "ページ用テキスト") &&
      !cells.slice(1).some((v) => v.trim())
    )
      continue;
    if (
      (sheet === "挨拶" || sheet === "お知らせ・注意事項") &&
      !cells[2].trim() &&
      workbook &&
      sheet !== "挨拶"
    )
      continue;
    if (cells.every((c) => !c.trim())) continue;
    let error: string | undefined;
    if (sheet === "アンケート") {
      try {
        cells[0] = normalizeSurveyUrl(cells[0]);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    const posterIndex = names.indexOf("ポスター要否" as never);
    if (
      posterIndex >= 0 &&
      !["", "要", "不要"].includes(norm(cells[posterIndex]))
    )
      error = "ポスター要否は「要」または「不要」で指定してください。";
    if (sheet !== "スタッフ" && !cells[0].trim())
      error = names[0] + "が未入力です。";
    if (sheet === "学生企画" || sheet === "模擬店") {
      if (cells[3] && !/^-?\d+(?:階)?$/.test(norm(cells[3])))
        error = "階数は数字で入力してください。";
    }
    if (sheet === "広告" && !size(cells[1]))
      error = "広告サイズを確認してください（1ページ、1/2ページ、1/4ページ）。";
    if (sheet === "基本情報") {
      if (!fields[norm(cells[0])]) error = "未対応の基本情報です。";
      if (norm(cells[0]) === "開催日" && !festivalDate(dateValue(cells[1])))
        error = "開催日を確認してください。";
      if (norm(cells[0]) === "開催回数" && !/^[1-9]\d*$/.test(norm(cells[1])))
        error = "開催回数は正の整数で入力してください。";
    }
    if (
      sheet === "ステージ企画" ||
      sheet === "学生ステージ企画" ||
      sheet === "外部・特別企画"
    ) {
      const n = sheet === "外部・特別企画" ? 3 : 1;
      for (let j = n; j < n + 2; j++)
        if (cells[j].trim()) {
          const time = excelTime(cells[j]);
          if (time) cells[j] = time;
          else error = "時刻の形式を確認してください。";
        }
      if (n === 1 && !cells[n]) error = "開始時刻が未入力です。";
      if (!error && cells[n] && cells[n + 1] && cells[n] >= cells[n + 1])
        error = "終了時刻は開始時刻より後にしてください。";
    }
    result.push({
      sheet,
      line: i + 1,
      cells,
      error,
      sample:
        workbook &&
        sheet === "スタッフ" &&
        rows
          .slice(0, firstHeader)
          .some((r) => r?.some((v) => norm(v) === "スタッフ編成")),
    });
  }
  if (workbook && firstHeader < 0 && rows.some((r) => r?.some(Boolean)))
    return [{ sheet, line: 1, cells: [], error: "列見出しを特定できません。" }];
  return result;
}

type RowAction = {
  label: string;
  candidates: { id: string; label: string }[];
  apply: (p: Project, id?: string) => void;
  error?: string;
  requiresTarget?: boolean;
};
const noticeKey = (value: string) =>
  norm(value).replace(
    /(?:について|のお知らせ|のお願い|に関するお知らせ|についてのお知らせ|の注意事項|[・、。「」])/g,
    "",
  );
const similarNotice = (a: string, b: string) => {
  const x = noticeKey(a),
    y = noticeKey(b);
  return (
    !!x &&
    !!y &&
    (x === y ||
      (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))))
  );
};
const eq = (a: string | undefined, b: string) =>
  norm(a ?? "").toLowerCase() === norm(b).toLowerCase();
export function planRow(p: Project, row: ImportRow): RowAction {
  const {
    sheet,
    cells: [a = "", b = "", c = "", d = "", e = "", f = ""],
  } = row;
  const label = sheet === "スタッフ" ? b : a;
  const action: RowAction = {
    label,
    candidates: [],
    apply: () => {},
    error: row.error,
  };
  const cat = categories[sheet];
  if (sheet === "アンケート") {
    action.label = "アンケートQRコード";
    action.candidates = p.blocks
      .filter((block) => block.openingKind === "survey")
      .map((block) => ({ id: block.id, label: block.title }));
    action.requiresTarget = action.candidates.length > 0;
    action.apply = (q, id) => {
      const url = normalizeSurveyUrl(a);
      if (id) {
        const target = q.blocks.find(
          (block) => block.id === id && block.openingKind === "survey",
        );
        if (!target) throw new Error("アンケートの掲載先が見つかりません。");
        target.surveyUrl = url;
        if (b.trim()) target.title = b;
        if (c.trim()) target.body = c;
      } else
        insertBlock(q, {
          id: nextRecordId(q),
          template: "notice",
          openingKind: "survey",
          title: b.trim() || "アンケート",
          body:
            c.trim() ||
            "ご来場ありがとうございます。QRコードを読み取ってアンケートへのご協力をお願いします。",
          chapterId: q.chapters[0].id,
          surveyUrl: url,
        });
    };
  } else if (cat) {
    const same = p.events.filter(
      (x) => eventCategory(x) === cat && eq(x.name, a),
    );
    action.candidates = same.map((x) => ({
      id: x.id,
      label: [x.name, x.group, x.location || x.room, x.startTime]
        .filter(Boolean)
        .join(" / "),
    }));
    action.apply = (q, id) => {
      const x = id ? q.events.find((x) => x.id === id)! : addEvent(q, cat);
      x.name = a;
      if (cat !== "kitchen")
        x.posterRequired =
          norm(
            row.cells[sheets[sheet].indexOf("ポスター要否" as never)] ?? "",
          ) !== "不要";
      if (cat === "stage" || cat === "studentStage") {
        if (b) x.startTime = b;
        if (c) x.endTime = c;
        if (x.startTime && x.endTime && x.startTime >= x.endTime)
          throw new Error("更新後の終了時刻が開始時刻以前です。");
      } else if (cat === "kitchen") {
        const previous = (q.kitchenMenus ?? [])
          .filter((m) => m.eventId === x.id)
          .sort((a, b) => a.order - b.order);
        [b, c, d, e, f]
          .filter((name) => name.trim())
          .forEach((name, i) => {
            if (!name.trim()) return;
            if (previous[i]) previous[i].name = name;
            else addMenu(q, x.id, name);
          });
      } else {
        if (b) x.group = b;
        if (c) x.building = c;
        if (d) x.floor = Number(norm(d).replace(/階$/, ""));
        if (e) x.room = e;
        if (f) x.location = f;
      }
    };
  } else if (sheet === "協賛企業") {
    action.candidates = p.sponsors
      .filter((s) => eq(s.name, a))
      .map((s) => ({
        id: s.id,
        label: [s.name, s.kana, s.sortKey].filter(Boolean).join(" / "),
      }));
    action.apply = (q, id) => {
      const s = id
        ? q.sponsors.find((s) => s.id === id)!
        : { id: nextRecordId(q), name: a, kana: "", sortKey: "" };
      if (!id) q.sponsors.push(s);
      if (!q.blocks.some((b) => b.template === "sponsors"))
        insertBlock(q, {
          id: nextRecordId(q),
          title: "協賛企業一覧",
          template: "sponsors",
          chapterId:
            q.chapters.find((b) => b.name === "協賛")?.id ?? q.chapters[0].id,
        });
      if (b) s.kana = b;
      if (c) s.sortKey = c;
    };
  } else if (sheet === "広告") {
    action.candidates = p.ads
      .filter((x) => eq(adCompany(p, x.id), a))
      .map((x) => ({
        id: x.id,
        label: [a, x.size, x.assetId && p.assets[x.assetId]?.name]
          .filter(Boolean)
          .join(" / "),
      }));
    const sponsors = p.sponsors.filter((s) => eq(s.name, a));
    action.apply = (q, id) => {
      const x = id ? q.ads.find((x) => x.id === id)! : addAd(q);
      x.size = size(b)!;
      if (!id) {
        const matches = q.sponsors.filter((s) => eq(s.name, a));
        if (matches.length > 1)
          throw new Error(
            "同名の協賛企業が複数あります。掲載情報で広告を紐づけてください。",
          );
        if (matches.length === 1) x.sponsorId = matches[0].id;
        else setAdCompany(q, x.id, a);
      }
    };
    if (sponsors.length > 1 && !action.candidates.length)
      action.error = "同名の協賛企業が複数あります。";
  } else if (sheet === "スタッフ") {
    action.candidates = p.staff
      .filter((s) => eq(s.name, b))
      .map((s) => ({
        id: s.id,
        label: [s.name, s.role, s.grade ? s.grade + "年" : ""]
          .filter(Boolean)
          .join(" / "),
      }));
    action.apply = (q, id) => {
      const s = id ? q.staff.find((s) => s.id === id)! : addStaff(q, b);
      const cls = norm(a).replace(/[一二三四]/g, (x) =>
        String("一二三四".indexOf(x) + 1),
      );
      if (/^\d+年(?:生)?$/.test(cls)) s.grade = parseInt(cls);
      else if (a.trim()) s.role = a.trim();
    };
  } else if (sheet === "章・インデックス") {
    action.candidates = p.chapters
      .filter((x) => eq(x.name, a))
      .map((x) => ({ id: x.id, label: x.name }));
    action.apply = (q, id) => {
      if (!id)
        q.chapters.push({
          id: nextRecordId(q),
          name: a,
          color: q.theme.accent,
        });
    };
  } else if (sheet === "基本情報") {
    const field = fields[norm(a)];
    action.requiresTarget = true;
    action.candidates = field
      ? [
          {
            id: p.id,
            label: a + "：" + (p[field as keyof Project] || "未設定"),
          },
        ]
      : [];
    action.apply = (q) =>
      writeSource(
        q,
        { type: "project", id: q.id, field },
        field === "date" ? dateValue(b) : field === "edition" ? norm(b) : b,
      );
  } else if (sheet === "挨拶") {
    const role = norm(a);
    const kind = /実行委員長/.test(role) ? "committee" : "leaders";
    const slot = /^副実行委員長/.test(role)
      ? role.endsWith("2")
        ? 2
        : 1
      : role === "学長"
        ? 1
        : 0;
    const recognized =
      /^(?:理事長・学園長|理事長|学園長|学長|実行委員長|副実行委員長[12]?)$/.test(
        role,
      );
    action.requiresTarget = true;
    action.candidates = recognized
      ? p.blocks
          .filter((x) => x.openingKind === kind)
          .map((x) => ({ id: x.id, label: x.title + " / " + a }))
      : [];
    action.apply = (q, id) => {
      const x = q.blocks.find((x) => x.id === id)!;
      if (b) x[(["firstName", "secondName", "thirdName"] as const)[slot]] = b;
      if (c) x[(["body", "secondBody", "thirdBody"] as const)[slot]] = c;
      if (slot === 2 && c) x.viceMode = "separate";
    };
  } else if (sheet === "外部・特別企画") {
    action.candidates = p.blocks
      .filter(
        (x) => x.template === "notice" && !x.openingKind && eq(x.title, a),
      )
      .map((x) => ({ id: x.id, label: x.title }));
    action.apply = (q, id) => {
      const body = [
        b && "団体：" + b,
        c && "場所：" + c,
        [d, e].filter(Boolean).join("〜"),
        f,
      ]
        .filter(Boolean)
        .join("\n");
      const posterRequired = norm(row.cells[6] ?? "") !== "不要";
      if (id) {
        const existing = q.blocks.find((x) => x.id === id)!;
        if (body) existing.body = body;
        existing.externalEvent = true;
        existing.posterRequired = posterRequired;
      } else
        insertBlock(q, {
          externalEvent: true,
          posterRequired,
          id: nextRecordId(q),
          template: "notice",
          title: a,
          chapterId:
            q.chapters.find((x) => x.name === "企画")?.id ?? q.chapters[0].id,
          body,
        });
    };
  } else {
    const key = sheet === "ページ用テキスト" ? a : b;
    const kind = /アンケート/.test(key)
      ? "survey"
      : /禁煙|禁酒/.test(key)
        ? "rules"
        : /ゴミ|ごみ/.test(key)
          ? "waste"
          : undefined;
    action.candidates = p.blocks
      .filter(
        (x) =>
          eq(x.title, key) ||
          (kind && x.openingKind === kind) ||
          (sheet === "お知らせ・注意事項" && similarNotice(x.title, key)),
      )
      .map((x) => ({ id: x.id, label: x.title }));
    action.requiresTarget =
      sheet === "ページ用テキスト" ||
      (sheet === "お知らせ・注意事項" && action.candidates.length > 0);
    action.apply = (q, id) => {
      if (id) {
        const x = q.blocks.find((x) => x.id === id)!;
        if (b && sheet === "ページ用テキスト") x.title = b;
        if (c) x.body = c;
      } else
        insertBlock(q, {
          id: nextRecordId(q),
          template: "notice",
          title: b,
          chapterId: q.chapters[0].id,
          body: c,
        });
    };
    if (sheet === "お知らせ・注意事項" && !b.trim())
      action.error = "見出しが未入力です。";
  }
  if (action.requiresTarget && !action.candidates.length && !action.error)
    action.error = "掲載先を特定できません。見出しや肩書を確認してください。";
  return action;
}

export type ImportDifference = {
  field: string;
  before: unknown;
  after: unknown;
};
const fieldLabels: Record<string, string> = {
  surveyUrl: "アンケートURL（QRコード）",
  posterRequired: "ポスター要否",
  university: "大学名",
  festival: "学園祭名",
  edition: "開催回数",
  date: "開催日",
  time: "開催時間",
  tagline: "テーマ",
  name: "名称",
  group: "団体名",
  building: "建物",
  floor: "階数",
  room: "教室",
  location: "開催場所",
  startTime: "開始時刻",
  endTime: "終了時刻",
  kana: "読み仮名",
  sortKey: "並び替えキー",
  size: "広告サイズ",
  grade: "学年",
  role: "役職",
  title: "見出し",
  body: "本文",
  firstName: "氏名",
  secondName: "氏名（2人目）",
  thirdName: "氏名（3人目）",
  secondBody: "本文（2人目）",
  thirdBody: "本文（3人目）",
  viceMode: "副委員長の表示",
  menus: "メニュー",
  sponsorPage: "協賛企業一覧",
};
function comparisonFields(
  p: Project,
  row: ImportRow,
  id: string,
): Record<string, unknown> {
  if (row.sheet === "基本情報") {
    const key = fields[norm(row.cells[0])];
    return { [key]: p[key as keyof Project] };
  }
  const event = p.events.find((e) => e.id === id);
  if (categories[row.sheet] && event)
    return {
      ...event,
      menus:
        p.kitchenMenus
          ?.filter((m) => m.eventId === id)
          .sort((a, b) => a.order - b.order)
          .map((m) => m.name) ?? [],
    };
  if (row.sheet === "協賛企業")
    return {
      ...p.sponsors.find((s) => s.id === id),
      sponsorPage: p.blocks.some((b) => b.template === "sponsors")
        ? "あり"
        : "",
    };
  if (row.sheet === "広告") return { ...p.ads.find((s) => s.id === id) };
  if (row.sheet === "スタッフ") return { ...p.staff.find((s) => s.id === id) };
  if (row.sheet === "章・インデックス")
    return { ...p.chapters.find((s) => s.id === id) };
  return { ...p.blocks.find((b) => b.id === id) };
}
export function inspectImportTarget(
  p: Project,
  row: ImportRow,
  id: string,
  action = planRow(p, row),
) {
  const before = comparisonFields(p, row, id);
  // Copy only the records an import action can modify; keep large media out of the preview calculation.
  const copy: Project = {
    ...p,
    events: p.events.map((x) => ({ ...x })),
    sponsors: p.sponsors.map((x) => ({ ...x })),
    ads: p.ads.map((x) => ({ ...x })),
    staff: p.staff.map((x) => ({ ...x })),
    chapters: p.chapters.map((x) => ({ ...x })),
    blocks: p.blocks.map((x) => ({ ...x })),
    pageOrder: [...p.pageOrder],
    kitchenMenus: p.kitchenMenus?.map((x) => ({ ...x })),
  };
  try {
    action.apply(copy, id);
  } catch (e) {
    return {
      differences: [] as ImportDifference[],
      error: e instanceof Error ? e.message : String(e),
      safe: false,
    };
  }
  const after = comparisonFields(copy, row, id);
  const differences = Object.entries(after)
    .filter(
      ([k, v]) =>
        fieldLabels[k] && JSON.stringify(before[k]) !== JSON.stringify(v),
    )
    .map(([k, v]) => ({ field: fieldLabels[k], before: before[k], after: v }));
  const safe =
    differences.length > 0 &&
    differences.every(
      (d) =>
        d.before === undefined ||
        d.before === null ||
        d.before === "" ||
        (row.sheet === "基本情報" && d.field === "開催回数" && d.before === 0),
    );
  return { differences, safe, error: undefined };
}
export type ImportState =
  "add" | "update" | "same" | "skip" | "review" | "error";
export const importAdd = "@new";
export function importDecision(
  row: ImportRow,
  plan: ReturnType<typeof planRow>,
  duplicate: boolean,
  inspected: Map<string, ReturnType<typeof inspectImportTarget>>,
  explicit?: string,
): { state: ImportState; target: string } {
  if (plan.error) return { state: "error", target: "" };
  if (explicit === "") return { state: "skip", target: "" };
  const target =
    explicit ??
    (!row.sample &&
    !duplicate &&
    plan.candidates.length === 1 &&
    inspected.get(plan.candidates[0].id)?.safe
      ? plan.candidates[0].id
      : !row.sample &&
          !duplicate &&
          !plan.requiresTarget &&
          !plan.candidates.length
        ? importAdd
        : "");
  if (target === importAdd)
    return plan.requiresTarget
      ? { state: "review", target: "" }
      : { state: "add", target };
  if (target) {
    const info = inspected.get(target);
    return !info || info.error
      ? { state: "error", target }
      : { state: info.differences.length ? "update" : "same", target };
  }
  if (!row.sample && !duplicate && plan.candidates.length === 1) {
    const info = inspected.get(plan.candidates[0].id);
    if (info && !info.error && !info.differences.length)
      return { state: "same", target: "" };
  }
  return { state: "review", target: "" };
}
