import { mediaSummary } from "./workflow";
import {
  isStage,
  adCompany,
  categoryNames,
  eventCategory,
  timeWarning,
  type EventCategory,
} from "../../../../packages/core/registration";
import { KitchenMenus } from "./KitchenMenus";
import { useEffect, useMemo, useRef, useState } from "react";
import { uid, type Project } from "../../../../packages/core/model";
import {
  newEvent,
  readSource,
  writeSource,
  delimited,
  type DataSource,
} from "../../../../packages/core/editing";
import { importAsset } from "../assets";
import { download } from "../../../../packages/project-storage";
import type { Layout } from "../../../../packages/layout-engine";
import "./workspace.css";
type Sheet =
  | "events"
  | "external"
  | "stage"
  | "studentStage"
  | "food"
  | "kitchen"
  | "sponsors"
  | "ads"
  | "chapters"
  | "staff"
  | "common"
  | "assets";
type Col = {
  key: string;
  label: string;
  type?: "asset" | "boolean" | "number" | "select" | "menus";
  options?: string[];
};
const general: Col[] = [
  { key: "name", label: "企画名" },
  { key: "group", label: "団体名" },
  { key: "building", label: "建物" },
  { key: "floor", label: "階数", type: "number" },
  { key: "room", label: "教室" },
  { key: "location", label: "詳細な場所" },
  {
    key: "posterRequired",
    label: "ポスター要否（要ならチェック）",
    type: "boolean",
  },
  { key: "assetId", label: "ポスター", type: "asset" },
];
const stageCols: Col[] = [
  { key: "name", label: "企画名" },
  { key: "startTime", label: "開始時刻" },
  { key: "endTime", label: "終了時刻" },
  {
    key: "posterRequired",
    label: "ポスター要否（要ならチェック）",
    type: "boolean",
  },
  { key: "assetId", label: "ポスター", type: "asset" },
];
const cols: Record<Exclude<Sheet, "assets">, Col[]> = {
  external: [
    { key: "title", label: "企画名" },
    { key: "body", label: "本文・開催情報" },
    {
      key: "posterRequired",
      label: "ポスター要否（要ならチェック）",
      type: "boolean",
    },
    { key: "assetId", label: "ポスター", type: "asset" },
  ],
  events: general,
  food: general,
  stage: stageCols,
  studentStage: stageCols,
  kitchen: [
    { key: "name", label: "会社名" },
    { key: "menus", label: "メインメニュー", type: "menus" },
    { key: "assetId", label: "画像", type: "asset" },
  ],
  sponsors: [
    { key: "name", label: "企業名" },
    { key: "kana", label: "読み仮名" },
    { key: "sortKey", label: "並び替えキー" },
  ],
  ads: [
    { key: "companyName", label: "企業名" },
    {
      key: "size",
      label: "広告サイズ",
      type: "select",
      options: ["full", "half", "quarter"],
    },
    { key: "assetId", label: "広告データ", type: "asset" },
  ],
  chapters: [
    { key: "name", label: "章名" },
    { key: "color", label: "テーマカラー" },
    { key: "visible", label: "表示", type: "boolean" },
    {
      key: "startSide",
      label: "章開始側",
      type: "select",
      options: ["auto", "right", "left"],
    },
  ],
  staff: [{ key: "name", label: "氏名" }],
  common: [
    { key: "label", label: "項目" },
    { key: "value", label: "内容" },
  ],
};
const eventSheets: Sheet[] = [
  "events",
  "food",
  "stage",
  "studentStage",
  "kitchen",
];
const sheetCategory = (sheet: Sheet): EventCategory =>
  sheet === "events" ? "student" : (sheet as EventCategory);
const names: Record<Sheet, string> = {
  external: "外部・特別企画",
  events: "学生企画",
  food: "模擬店",
  studentStage: "学生ステージ企画",
  kitchen: "キッチンカー",
  stage: "ステージ企画",
  sponsors: "協賛企業",
  ads: "広告",
  chapters: "章・インデックス",
  staff: "スタッフ",
  common: "共通情報・文章",
  assets: "素材ライブラリ",
};
export function DataWorkspace({
  project: p,
  layout,
  update,
  selectedId,
  onSelect,
  onHistory,
  historyVersion,
  focusSource,
  onReveal,
  onFinish,
  onImages,
  onImport,
}: {
  project: Project;
  layout: Layout;
  update: (fn: (p: Project) => void) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  onHistory: (back: boolean) => void;
  historyVersion: number;
  focusSource?: DataSource;
  onReveal?: (s: DataSource) => void;
  onFinish?: () => void;
  onImages?: () => void;
  onImport: () => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removedAt, setRemovedAt] = useState<{
    revision: number;
    count: number;
  } | null>(null);
  const endOptional = p.blocks.some((b) => b.openingKind === "schedule");
  const [sheet, setSheet] = useState<Sheet>("events"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState(""),
    [desc, setDesc] = useState(false),
    [hidden, setHidden] = useState<Record<string, string[]>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(false);
  const table = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!focusSource) return;
    setSearch("");
    setFilter(false);
    setHidden({});
    const e = p.events.find((e) => e.id === focusSource.id);
    setSheet(
      focusSource.type === "event" && e
        ? ((eventCategory(e) === "student"
            ? "events"
            : eventCategory(e)) as Sheet)
        : focusSource.type === "block" &&
            p.blocks.some((b) => b.id === focusSource.id && b.externalEvent)
          ? "external"
          : focusSource.type === "ad"
            ? "ads"
            : focusSource.type === "staff"
              ? "staff"
              : focusSource.type === "chapter"
                ? "chapters"
                : focusSource.type === "sponsor"
                  ? "sponsors"
                  : "common",
    );
  }, [focusSource]);
  const commonSources = useMemo(
    () => [
      ...p.blocks
        .filter((b) => b.externalEvent)
        .map((b) => ({
          id: b.id + ":posterRequired",
          label: b.title + "：ポスター要否（要／不要）",
          source: {
            type: "block",
            id: b.id,
            field: "posterRequired",
          } as DataSource,
        })),
      ...p.blocks.flatMap((b) => [
        {
          id: b.id + ":title",
          label: b.title + "：見出し",
          source: { type: "block", id: b.id, field: "title" } as DataSource,
        },
        {
          id: b.id + ":body",
          label: b.title + "：本文・箇条書き（改行区切り）",
          source: { type: "block", id: b.id, field: "body" } as DataSource,
        },
      ]),
    ],
    [p],
  );
  const source = (id: string, key: string): DataSource =>
    sheet === "common"
      ? commonSources.find((s) => s.id === id)!.source
      : {
          type: (
            {
              external: "block",
              events: "event",
              stage: "event",
              studentStage: "event",
              food: "event",
              kitchen: "event",
              sponsors: "sponsor",
              ads: "ad",
              chapters: "chapter",
              staff: "staff",
            } as Record<string, DataSource["type"]>
          )[sheet],
          id,
          field: key,
        };
  const rows = useMemo(() => {
    let list = (sheet === "assets"
      ? []
      : sheet === "common"
        ? commonSources.map((r) => ({
            id: r.id,
            label: r.label,
            value: readSource(p, r.source),
          }))
        : sheet === "external"
          ? p.blocks.filter((b) => b.externalEvent)
          : eventSheets.includes(sheet)
            ? p.events.filter((e) => eventCategory(e) === sheetCategory(sheet))
            : sheet === "ads"
              ? p.ads.map((a) => ({ ...a, companyName: adCompany(p, a.id) }))
              : p[sheet as "sponsors"]) as unknown as Record<string, unknown>[];
    list = list.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
    if (filter && eventSheets.includes(sheet))
      list = list.filter(
        (r) =>
          (r.posterRequired !== false && !r.assetId) ||
          !r.name ||
          (["events", "food"].includes(sheet) && !r.building),
      );
    if (sort)
      list = [...list].sort(
        (a, b) =>
          String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""), "ja", {
            numeric: true,
          }) * (desc ? -1 : 1),
      );
    else if (sheet === "stage" || sheet === "studentStage")
      list = [...list].sort((a, b) =>
        String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")),
      );
    return list;
  }, [p, sheet, search, sort, desc, filter, commonSources]);
  useEffect(() => {
    table.current
      ?.querySelector("tr.current")
      ?.scrollIntoView({ block: "nearest" });
  }, [focusSource, sheet]);
  const columns =
    sheet === "assets"
      ? []
      : cols[sheet].filter((c) => !(hidden[sheet] || []).includes(c.key));
  const change = (id: string, key: string, value: string) => {
    try {
      if ((sheet === "common" && key !== "value") || key === "id") return;
      if (key === "color" && !/^#[a-f0-9]{6}$/i.test(value))
        throw new Error("色は#RRGGBBで入力してください。");
      update((q) => writeSource(q, source(id, key), value));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  const remove = () =>
    update((q) => {
      if (eventSheets.includes(sheet)) {
        q.events = q.events.filter((r) => !selected.includes(r.id));
        q.kitchenMenus = q.kitchenMenus?.filter(
          (m) => !selected.includes(m.eventId),
        );
      } else if (sheet === "external") {
        q.blocks = q.blocks.filter((b) => !selected.includes(b.id));
      } else if (sheet === "sponsors") {
        if (q.ads.some((a) => selected.includes(a.sponsorId)))
          throw new Error(
            "広告を持つ企業は、先に広告の関連付けを変更してください。",
          );
        q.sponsors = q.sponsors.filter((r) => !selected.includes(r.id));
      } else if (sheet === "ads") {
        q.ads = q.ads.filter((r) => !selected.includes(r.id));
        for (const key of Object.keys(q.assignments))
          if (selected.includes(q.assignments[key] || ""))
            q.assignments[key] = null;
      } else if (sheet === "chapters") {
        if (q.blocks.some((b) => selected.includes(b.chapterId)))
          throw new Error(
            "使用中の章は削除できません。ページの所属を先に変更してください。",
          );
        q.chapters = q.chapters.filter((r) => !selected.includes(r.id));
      } else if (sheet === "staff")
        q.staff = q.staff.filter((r) => !selected.includes(r.id));
      setSelected([]);
    });
  const linkedAssets = [...p.events, ...p.ads].some(
    (r) => selected.includes(r.id) && !!r.assetId,
  );
  const linkedMenus = p.kitchenMenus?.some((m) => selected.includes(m.eventId));
  const linkedAds = Object.values(p.assignments).some(
    (id) => id && selected.includes(id),
  );
  function removeSelection() {
    try {
      remove();
      setRemovedAt({ revision: historyVersion + 1, count: selected.length });
      setError("");
    } catch (e) {
      setError(String(e));
    }
    setDeleteConfirm(false);
  }
  async function attach(id: string, key: string, f?: File) {
    if (!f) return;
    try {
      const { asset, warning } = await importAsset(f);
      update((q) => {
        const existing = Object.values(q.assets).find(
          (a) => a.data === asset.data,
        );
        q.assets[existing?.id || asset.id] = existing || asset;
        writeSource(q, source(id, key), existing?.id || asset.id);
      });
      setError(warning || "素材を登録しました。");
    } catch (e) {
      setError(String(e));
    }
  }
  const incomplete = (e: (typeof p.events)[number]) =>
    !e.name ||
    (["student", "food"].includes(eventCategory(e)) && !e.building) ||
    (isStage(e) && !!timeWarning(e, endOptional));
  const unplaced = p.ads.filter(
    (a) =>
      a.published !== false &&
      !layout.pages.some((pg) => pg.slots.some((s) => s.adId === a.id)),
  ).length;
  return (
    <section
      className="data-workspace"
      onCopy={(e) => {
        // Never hijack native text selection/copy inside a cell editor.
        const target = e.target as HTMLElement;
        if (selected.length && !target.closest("textarea,input,select")) {
          e.preventDefault();
          e.clipboardData.setData(
            "text/plain",
            delimited(
              rows
                .filter((r) => selected.includes(String(r.id)))
                .map((r) => columns.map((c) => String(r[c.key] ?? ""))),
              "\t",
            ),
          );
        }
      }}
    >
      <div className="data-summary">
        <strong>Excelを読み込む・取り込み済みの情報</strong>
        <span>企画 {p.events.length}件</span>
        <span>
          画像：合計{mediaSummary(p).total}件 ／ 未登録{mediaSummary(p).missing}
          件<small>{mediaSummary(p).breakdown}</small>
        </span>
        <span>
          広告 {p.ads.filter((a) => a.published !== false).length}件 / 未配置{" "}
          {unplaced}件
        </span>
        <button
          onClick={() => {
            const first = p.events.find(incomplete),
              category = first ? eventCategory(first) : "student";
            setSheet(category === "student" ? "events" : category);
            setFilter(true);
          }}
        >
          入力不足 {p.events.filter(incomplete).length}件
        </button>
        <span>
          入稿エラー {layout.issues.filter((i) => i.level === "error").length}件
        </span>
      </div>
      <p>
        「入力不足」は、企画名が空欄、学生企画・模擬店の建物が空欄、またはステージの開催時刻が不足・不正である企画の件数です。基本情報や画像の不足は含みません。
      </p>
      {sheet === "common" && (
        <p>
          開催回数・開催日・開催時間・大学名・学園祭名・テーマは、Excelの「基本情報」シートで管理しています。空欄でもPDF出力できます。
        </p>
      )}
      <details>
        <summary>Excelで取り込んだ基本情報を確認</summary>
        <p>変更はExcelの「基本情報」シートで行い、再取り込みしてください。</p>
        <dl>
          {(
            [
              ["edition", "開催回数"],
              ["date", "開催日"],
              ["time", "開催時間"],
              ["university", "大学名"],
              ["festival", "学園祭名"],
              ["tagline", "テーマ"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{p[key] || "未設定"}</dd>
            </div>
          ))}
        </dl>
      </details>
      <nav className="data-tabs">
        {Object.entries(names).map(([k, v]) => (
          <button
            key={k}
            className={sheet === k ? "active" : ""}
            onClick={() => {
              setSheet(k as Sheet);
              setSearch("");
              setSort("");
              setFilter(false);
              setSelected([]);
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      <div className="data-tools">
        <button onClick={onImport}>Excelを読み込む</button>
        {onImages && <button onClick={onImages}>画像を登録</button>}
        {onFinish && (
          <button className="primary" onClick={onFinish}>
            次へ（誌面を確認・編集） →
          </button>
        )}

        <input
          aria-label="検索"
          placeholder="検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          disabled={!selected.length || ["common", "assets"].includes(sheet)}
          onClick={() => {
            if (selected.length > 1 || linkedAssets || linkedMenus || linkedAds)
              setDeleteConfirm(true);
            else removeSelection();
          }}
        >
          選択行を削除
        </button>
        <button onClick={() => onHistory(true)}>取り消し</button>
        <button onClick={() => onHistory(false)}>やり直し</button>
        <button
          onClick={() => {
            if (sheet !== "assets")
              download(
                new Blob(
                  [
                    "\ufeff" +
                      delimited([
                        cols[sheet].map((c) => c.label),
                        ...rows.map((r) =>
                          cols[sheet].map((c) => String(r[c.key] ?? "")),
                        ),
                      ]),
                  ],
                  { type: "text/csv;charset=utf-8" },
                ),
                names[sheet] + ".csv",
              );
          }}
        >
          CSV出力
        </button>
        <details>
          <summary>表示列</summary>
          {sheet !== "assets" &&
            cols[sheet].map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={!(hidden[sheet] || []).includes(c.key)}
                  onChange={(e) =>
                    setHidden({
                      ...hidden,
                      [sheet]: e.target.checked
                        ? (hidden[sheet] || []).filter((k) => k !== c.key)
                        : [...(hidden[sheet] || []), c.key],
                    })
                  }
                />
                {c.label}
              </label>
            ))}
        </details>
      </div>
      {deleteConfirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="行の削除確認"
          >
            <h2>選択した{selected.length}行を削除しますか？</h2>
            <p>
              削除した行は紙面から外れます。
              {linkedAssets ? "画像・PDFは素材ライブラリに残ります。" : ""}
              {linkedMenus ? "この企画のメニューも削除されます。" : ""}
              {linkedAds ? "この広告の紙面への割り当ても解除されます。" : ""}
            </p>
            <button onClick={() => setDeleteConfirm(false)}>キャンセル</button>
            <button onClick={removeSelection}>{selected.length}行を削除</button>
          </section>
        </div>
      )}
      {removedAt?.revision === historyVersion && (
        <p className="data-message" role="status">
          {removedAt.count}行を削除しました。{" "}
          <button
            onClick={() => {
              onHistory(true);
              setRemovedAt(null);
            }}
          >
            元に戻す
          </button>
        </p>
      )}
      {error && (
        <p role="status" className="data-message">
          {error}
        </p>
      )}
      {sheet !== "assets" && !rows.length && !search && !filter && (
        <p className="data-message">
          {names[sheet]}
          を登録するには、Excelファイルを読み込んでください。
        </p>
      )}
      {sheet === "assets" ? (
        <div className="asset-library">
          {Object.values(p.assets).map((a) => (
            <article key={a.id}>
              <img src={a.preview || a.data} alt={a.name} />
              <strong>{a.name}</strong>
              <p>
                {p.events
                  .filter((e) => e.assetId === a.id)
                  .map((e) => e.name)
                  .join("、") || "企画では未使用"}
              </p>
              <p>
                {p.ads
                  .filter((ad) => ad.assetId === a.id)
                  .map((ad) => "広告 " + (p.ads.indexOf(ad) + 1))
                  .join("、")}
              </p>
              <p>
                使用ページ：
                {layout.pages
                  .filter((pg) =>
                    pg.nodes.some(
                      (n) => n.kind === "asset" && n.assetId === a.id,
                    ),
                  )
                  .map((pg) => pg.physical)
                  .join("、") || "なし"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="data-scroll">
          <table ref={table} role="grid" aria-label={names[sheet]}>
            <thead>
              <tr>
                {sheet === "ads" && <th>広告の配置先</th>}
                <th>選択</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      resize: "horizontal",
                      overflow: "auto",
                      minWidth: c.key === "id" ? 110 : 140,
                    }}
                  >
                    <button
                      onClick={() => {
                        setDesc(sort === c.key ? !desc : false);
                        setSort(c.key);
                      }}
                    >
                      {c.label}
                      {sort === c.key ? (desc ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
                <th>確認</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const id = String(r.id);
                const linkedPages =
                  eventSheets.includes(sheet) ||
                  ["staff", "ads", "sponsors", "external"].includes(sheet)
                    ? layout.pages.filter(
                        (pg) =>
                          pg.nodes.some(
                            (n) =>
                              !n.editorOnly &&
                              n.source?.id === id &&
                              n.source.type ===
                                (eventSheets.includes(sheet)
                                  ? "event"
                                  : sheet === "external"
                                    ? "block"
                                    : sheet === "ads"
                                      ? "ad"
                                      : sheet === "staff"
                                        ? "staff"
                                        : "sponsor"),
                          ) ||
                          (sheet === "ads" &&
                            pg.slots.some((s) => s.adId === id)) ||
                          (sheet === "external" && pg.blockId === id),
                      )
                    : undefined;
                return (
                  <tr key={id} className={selectedId === id ? "current" : ""}>
                    {sheet === "ads" && (
                      <td>
                        <select
                          aria-label={
                            "広告の配置先 " + (r.companyName || "名称未設定")
                          }
                          value={
                            layout.pages
                              .flatMap((pg) => pg.slots)
                              .find((slot) => slot.adId === id)?.key ?? ""
                          }
                          onChange={(e) => {
                            const key = e.target.value;
                            if (!key) return;
                            update((p) => {
                              for (const previous of Object.keys(p.assignments))
                                if (p.assignments[previous] === id)
                                  delete p.assignments[previous];
                              p.assignments[key] = id;
                            });
                          }}
                        >
                          <option value="">未配置</option>
                          {layout.pages.flatMap((pg) =>
                            pg.slots
                              .filter((slot) => slot.size === r.size)
                              .map((slot, i) => (
                                <option
                                  key={slot.key}
                                  value={slot.key}
                                  disabled={!!slot.adId && slot.adId !== id}
                                >
                                  PDF {pg.physical}ページ：{pg.title}／枠{i + 1}
                                  {slot.adId && slot.adId !== id
                                    ? "（使用中）"
                                    : ""}
                                </option>
                              )),
                          )}
                        </select>
                        <button
                          onClick={() =>
                            onReveal?.({ type: "ad", id, field: "assetId" })
                          }
                        >
                          広告タブで配置・ページ追加
                        </button>
                      </td>
                    )}
                    <td>
                      {onReveal && (
                        <button
                          aria-label={"パンフレットで確認 " + (ri + 1)}
                          disabled={
                            sheet !== "ads" && linkedPages?.length === 0
                          }
                          title={linkedPages
                            ?.map(
                              (pg) =>
                                pg.title +
                                "（PDF " +
                                pg.physical +
                                "ページ目）",
                            )
                            .join("、")}
                          onClick={() =>
                            onReveal(
                              sheet === "common"
                                ? commonSources.find((r) => r.id === id)!.source
                                : {
                                    type: eventSheets.includes(sheet)
                                      ? "event"
                                      : sheet === "external"
                                        ? "block"
                                        : sheet === "ads"
                                          ? "ad"
                                          : sheet === "staff"
                                            ? "staff"
                                            : sheet === "chapters"
                                              ? "chapter"
                                              : "sponsor",
                                    id,
                                    field: "name",
                                  },
                            )
                          }
                        >
                          {linkedPages
                            ? linkedPages.length
                              ? "掲載先を見る"
                              : sheet === "ads"
                                ? "広告を配置する"
                                : "未掲載"
                            : "誌面へ"}
                        </button>
                      )}
                      <input
                        aria-label={"行を選択 " + (ri + 1)}
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, id]
                              : selected.filter((s) => s !== id),
                          )
                        }
                      />
                    </td>
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        onFocus={() => onSelect(id)}
                        onDragOver={(e) => {
                          if (c.type === "asset") e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (c.type === "asset") {
                            e.preventDefault();
                            void attach(id, c.key, e.dataTransfer.files[0]);
                          }
                        }}
                      >
                        {c.type === "menus" ? (
                          <KitchenMenus
                            project={p}
                            eventId={id}
                            update={update}
                          />
                        ) : c.type === "asset" ? (
                          <div className="grid-asset">
                            {p.assets[String(r[c.key])] ? (
                              <img
                                src={
                                  p.assets[String(r[c.key])].preview ||
                                  p.assets[String(r[c.key])].data
                                }
                                alt="登録済み素材"
                              />
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) =>
                                e.currentTarget.parentElement
                                  ?.querySelector<HTMLInputElement>(
                                    'input[type="file"]',
                                  )
                                  ?.click()
                              }
                            >
                              {p.assets[String(r[c.key])]
                                ? "画像を変更"
                                : "画像を追加"}
                            </button>
                            <input
                              hidden
                              aria-label={"素材登録 " + (ri + 1)}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                void attach(id, c.key, e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                            <select
                              aria-label={"素材ライブラリから選択 " + (ri + 1)}
                              value={String(r[c.key] || "")}
                              onChange={(e) =>
                                change(id, c.key, e.target.value)
                              }
                            >
                              <option value="">未登録</option>
                              {Object.values(p.assets).map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : c.type === "boolean" ? (
                          <input
                            type="checkbox"
                            aria-label={c.label + " " + (ri + 1)}
                            checked={r[c.key] !== false}
                            onChange={(e) =>
                              change(id, c.key, String(e.target.checked))
                            }
                          />
                        ) : c.type === "select" ? (
                          <select
                            aria-label={c.label + " " + (ri + 1)}
                            value={String(r[c.key] || "")}
                            onChange={(e) => change(id, c.key, e.target.value)}
                          >
                            <option value="">未設定</option>
                            {(c.key === "sponsorId"
                              ? p.sponsors.map((s) => s.id)
                              : c.options || []
                            ).map((v) => (
                              <option key={v} value={v}>
                                {c.key === "sponsorId"
                                  ? p.sponsors.find((s) => s.id === v)?.name
                                  : (
                                      {
                                        student: "学生企画",
                                        food: "模擬店",
                                        kitchen: "キッチンカー",
                                        stage: "ステージ",
                                        full: "1ページ 125×180",
                                        half: "1/2 125×85",
                                        quarter: "1/4 125×45",
                                        auto: "連続",
                                        left: "左ページ",
                                        right: "右ページ",
                                      } as Record<string, string>
                                    )[v] || v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            rows={1}
                            aria-label={c.label + " " + (ri + 1)}
                            readOnly={
                              c.key === "id" ||
                              (sheet === "common" && c.key !== "value")
                            }
                            key={id + ":" + c.key + ":" + String(r[c.key])}
                            defaultValue={String(r[c.key] ?? "")}
                            onBlur={(e) => {
                              if (e.target.value !== String(r[c.key] ?? ""))
                                change(id, c.key, e.target.value);
                            }}
                            onPaste={(e) => {
                              const text =
                                e.clipboardData.getData("text/plain");
                              if (
                                text.includes("\t") ||
                                (text.includes("\n") && sheet !== "common")
                              ) {
                                e.preventDefault();
                                setError(
                                  "複数のセルを登録するには、Excelファイルを読み込んでください。",
                                );
                              }
                            }}
                            onKeyDown={(e) => {
                              const move = (dr: number, dc: number) => {
                                const inputs =
                                  table.current?.querySelectorAll("tbody tr");
                                const next = inputs?.[
                                  Math.max(
                                    0,
                                    Math.min(rows.length - 1, ri + dr),
                                  )
                                ]
                                  ?.querySelectorAll("td")
                                  [
                                    Math.max(
                                      1,
                                      Math.min(columns.length, ci + 1 + dc),
                                    )
                                  ]?.querySelector(
                                    "textarea,select,input",
                                  ) as HTMLElement;
                                next?.focus();
                              };
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.blur();
                                move(1, 0);
                              }
                              if (
                                e.altKey &&
                                [
                                  "ArrowUp",
                                  "ArrowDown",
                                  "ArrowLeft",
                                  "ArrowRight",
                                ].includes(e.key)
                              ) {
                                e.preventDefault();
                                move(
                                  e.key === "ArrowUp"
                                    ? -1
                                    : e.key === "ArrowDown"
                                      ? 1
                                      : 0,
                                  e.key === "ArrowLeft"
                                    ? -1
                                    : e.key === "ArrowRight"
                                      ? 1
                                      : 0,
                                );
                              }
                              if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                                e.preventDefault();
                                onHistory(!e.shiftKey);
                              }
                            }}
                          />
                        )}
                      </td>
                    ))}
                    <td>
                      {(sheet === "stage" || sheet === "studentStage") && (
                        <span>
                          {timeWarning(
                            p.events.find((e) => e.id === id)!,
                            endOptional,
                          )}
                        </span>
                      )}
                      {eventSheets.includes(sheet) && (
                        <details>
                          <summary>種別を変更</summary>
                          <select
                            aria-label={"企画種別 " + (ri + 1)}
                            value={eventCategory(
                              p.events.find((e) => e.id === id)!,
                            )}
                            onChange={(e) =>
                              change(id, "category", e.target.value)
                            }
                          >
                            {Object.entries(categoryNames).map(
                              ([key, name]) => (
                                <option key={key} value={key}>
                                  {name}
                                </option>
                              ),
                            )}
                          </select>
                          <small>入力済みの情報は保持します。</small>
                        </details>
                      )}
                      {eventSheets.includes(sheet) &&
                      (!r.name ||
                        (["events", "food"].includes(sheet) && !r.building))
                        ? "⚠ 企画名・建物を確認"
                        : sheet === "ads" && !r.assetId
                          ? "⚠ 素材未登録"
                          : sheet === "ads" &&
                              !layout.pages.some((pg) =>
                                pg.slots.some((s) => s.adId === id),
                              )
                            ? "未配置"
                            : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p>まだ登録されていません。</p>}
        </div>
      )}
      <p className="data-hint">
        内容はEnter・フォーカス移動で確定 / Tabで次へ / Alt＋矢印でセル移動 /
        Excelから複数セル貼付 / 並べ替えは表示のみ。
      </p>
    </section>
  );
}
