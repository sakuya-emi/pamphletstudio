import { useMemo, useRef, useState } from "react";
import type { Project } from "../../../../packages/core/model";
import {
  interpretRows,
  inspectImportTarget,
  importDecision,
  importAdd,
  parseExcelText,
  planRow,
  sheets,
  type ImportRow,
  type ImportSheet,
} from "../../../../packages/core/excel-import";
import {
  adCompany,
  categoryNames,
  eventCategory,
} from "../../../../packages/core/registration";

type Props = {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  inline?: boolean;
  initialSheet?: ImportSheet;
  initialText?: string;
  close: () => void;
  done: (count: number) => void;
};
const ADD = importAdd;
const stateLabels = {
  add: "新規追加",
  update: "更新",
  same: "変更不要",
  skip: "登録しない",
  review: "要確認",
  error: "エラー",
};
const describe = (v: unknown) =>
  Array.isArray(v)
    ? v.join("、")
    : v === undefined || v === null || v === ""
      ? "未入力"
      : ({ full: "1ページ", half: "1/2ページ", quarter: "1/4ページ" }[
          String(v) as "full" | "half" | "quarter"
        ] ?? (typeof v === "boolean" ? (v ? "要" : "不要") : String(v)));
export function ExcelImport({
  project,
  update,
  inline = false,
  initialSheet,
  initialText,
  close,
  done,
}: Props) {
  const [rows, setRows] = useState<ImportRow[]>(() => {
    try {
      return initialText
        ? interpretRows(initialSheet ?? "学生企画", parseExcelText(initialText))
        : [];
    } catch {
      return [];
    }
  });
  const [visibleSheet, setVisibleSheet] = useState<ImportSheet | "">("");
  const [filter, setFilter] = useState<"all" | "changed" | "review">("all");
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"append" | "update" | "replace">("append");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [ignored, setIgnored] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const plans = useMemo(
    () => rows.map((r) => planRow(project, r)),
    [rows, project],
  );
  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    const keys = rows.map(
      (r, i) =>
        r.sheet + ":" + plans[i].label.normalize("NFKC").replace(/\s/g, ""),
    );
    keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    return keys.map((k) => (counts.get(k) ?? 0) > 1);
  }, [rows, plans]);
  const inspected = useMemo(
    () =>
      plans.map(
        (plan, i) =>
          new Map(
            plan.error
              ? []
              : plan.candidates.map((c) => [
                  c.id,
                  inspectImportTarget(project, rows[i], c.id, plan),
                ]),
          ),
      ),
    [project, rows, plans],
  );
  const decisions = plans.map((plan, i) =>
    importDecision(rows[i], plan, duplicates[i], inspected[i], choices[i]),
  );
  const effective = decisions.map((d) =>
    d.state === "add" || d.state === "update" ? d.target : "",
  );
  const targets = new Set([
    ...effective.filter((x) => x && x !== ADD),
    ...decisions.flatMap((d, i) =>
      d.state === "same"
        ? [d.target || plans[i].candidates[0]?.id].filter(Boolean)
        : [],
    ),
  ]);
  const indices = rows.flatMap((r, i) =>
    !visibleSheet || r.sheet === visibleSheet ? [i] : [],
  );
  function summary(list: number[]) {
    const sums = { add: 0, update: 0, same: 0, skip: 0, review: 0, error: 0 };
    for (const i of list) sums[decisions[i].state]++;
    return Object.entries(sums)
      .map(
        ([state, n]) =>
          stateLabels[state as keyof typeof stateLabels] + " " + n + "件",
      )
      .join(" ／ ");
  }
  function selectVisible(on: boolean) {
    setChoices((previous) => {
      const next = { ...previous };
      for (const i of indices) {
        if (!on) next[i] = "";
        else {
          const eligible = importDecision(
            rows[i],
            plans[i],
            duplicates[i],
            inspected[i],
          );
          if (
            eligible.state === "add" ||
            eligible.state === "update" ||
            eligible.state === "same"
          )
            delete next[i];
        }
      }
      return next;
    });
    setConfirmed(false);
  }
  const badTargets =
    effective.filter((x) => x && x !== ADD).length !== targets.size &&
    rows.some(
      (r, i) =>
        effective[i] &&
        effective[i] !== ADD &&
        effective.some(
          (x, j) =>
            j < i &&
            x === effective[i] &&
            rows[j].sheet === r.sheet &&
            r.sheet !== "基本情報" &&
            r.sheet !== "挨拶",
        ),
    );
  const included = new Set(
    rows.filter((_, i) => effective[i]).map((r) => r.sheet),
  );
  const removals =
    mode !== "replace"
      ? []
      : [
          ...project.events
            .filter(
              (e) =>
                included.has(categoryNames[eventCategory(e)] as ImportSheet) &&
                !targets.has(e.id) &&
                !e.assetId,
            )
            .map((e) => ({ kind: "events" as const, id: e.id, label: e.name })),
          ...project.staff
            .filter((s) => included.has("スタッフ") && !targets.has(s.id))
            .map((s) => ({ kind: "staff" as const, id: s.id, label: s.name })),
          ...project.ads
            .filter(
              (a) =>
                included.has("広告") &&
                !targets.has(a.id) &&
                !a.assetId &&
                !Object.values(project.assignments).includes(a.id),
            )
            .map((a) => ({
              kind: "ads" as const,
              id: a.id,
              label: adCompany(project, a.id),
            })),
          ...project.sponsors
            .filter(
              (s) =>
                included.has("協賛企業") &&
                !targets.has(s.id) &&
                !project.ads.some((a) => a.sponsorId === s.id),
            )
            .map((s) => ({
              kind: "sponsors" as const,
              id: s.id,
              label: s.name,
            })),
        ];
  const count = effective.filter(Boolean).length;
  const unresolvedReplacement =
    mode === "replace" &&
    plans.some(
      (p, i) =>
        included.has(rows[i].sheet) &&
        !!(
          p.error ||
          decisions[i].state === "review" ||
          decisions[i].state === "error"
        ),
    );
  const load = (next: ImportRow[]) => {
    setRows(next);
    setVisibleSheet("");
    setFilter("all");
    setChoices({});
    setConfirmed(false);
    setError(next.length ? "" : "登録できる行がありません。");
  };
  function apply() {
    try {
      update((p) => {
        const removed = new Set(
          removals.filter((r) => r.kind === "events").map((r) => r.id),
        );
        if (removed.size) {
          p.events = p.events.filter((e) => !removed.has(e.id));
          p.kitchenMenus = p.kitchenMenus?.filter(
            (m) => !removed.has(m.eventId),
          );
        }
        for (const kind of ["staff", "ads", "sponsors"] as const) {
          const ids = new Set(
            removals.filter((r) => r.kind === kind).map((r) => r.id),
          );
          if (kind === "staff") p.staff = p.staff.filter((s) => !ids.has(s.id));
          if (kind === "ads") p.ads = p.ads.filter((s) => !ids.has(s.id));
          if (kind === "sponsors")
            p.sponsors = p.sponsors.filter((s) => !ids.has(s.id));
        }
        // Companies first, so ads from the same workbook can reuse their IDs.
        const order = rows
          .map((_, i) => i)
          .sort(
            (a, b) =>
              Number(rows[b].sheet === "協賛企業") -
              Number(rows[a].sheet === "協賛企業"),
          );
        const chapterOrder: string[] = [];
        for (const i of order)
          if (effective[i]) {
            const action = planRow(p, rows[i]),
              selected = effective[i];
            if (
              action.error ||
              (selected !== ADD &&
                !action.candidates.some((c) => c.id === selected)) ||
              (selected === ADD && action.requiresTarget)
            )
              throw new Error(
                rows[i].sheet +
                  " " +
                  rows[i].line +
                  "行目：対象を確認してください。",
              );
            action.apply(p, selected === ADD ? undefined : selected);
            if (rows[i].sheet === "章・インデックス")
              chapterOrder.push(
                selected === ADD ? p.chapters.at(-1)!.id : selected,
              );
          }
        if (chapterOrder.length) {
          const ordered = chapterOrder.map((id) =>
            p.chapters.find((c) => c.id === id)!,
          );
          p.chapters = p.chapters.map((c) =>
            chapterOrder.includes(c.id) ? ordered.shift()! : c,
          );
        }
      });
      done(count);
    } catch (e) {
      setError(String(e));
    }
  }
  async function readFile(selected?: File) {
    if (!selected || loading) return;
    if (!/\.xlsx$/i.test(selected.name)) {
      setError("Excelファイル（.xlsx）を選んでください。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const workbook = await (await import("./xlsx")).readWorkbook(selected);
      setIgnored(
        workbook
          .filter((s) => !Object.hasOwn(sheets, s.name))
          .map((s) => s.name),
      );
      load(
        workbook.flatMap((s) =>
          Object.hasOwn(sheets, s.name)
            ? interpretRows(s.name as ImportSheet, s.rows, true)
            : [],
        ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  const content = (
    <>
      {inline ? (
        <>
          <p className="task-kicker">掲載情報</p>
          <h2>Excelを読み込む</h2>
        </>
      ) : (
        <h2>Excelから登録</h2>
      )}
      {!rows.length && (
        <p>掲載情報が入ったExcelファイル（.xlsx）を選んでください。</p>
      )}
      <p>
        <a
          href={`${import.meta.env.BASE_URL}templates/Pamphlet-Studio-Excel-template-v3.xlsx`}
          download
        >
          Excel雛形（アンケートURL・ポスター要否列つき）をダウンロード
        </a>
      </p>
      <button
        type="button"
        className="excel-dropzone"
        aria-label="Excelファイルをドロップまたは選択"
        aria-busy={loading}
        disabled={loading}
        onClick={() => file.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length !== 1) {
            setError("Excelファイルを1つずつドロップしてください。");
            return;
          }
          void readFile(e.dataTransfer.files[0]);
        }}
      >
        {loading ? "Excelを読み込み中…" : "ここにExcel（.xlsx）をドロップ"}
        <span className="excel-drop-hint">
          {rows.length
            ? "クリックで別のExcelを選ぶ"
            : "またはクリックしてファイルを選ぶ"}
        </span>
      </button>
      <input
        hidden
        ref={file}
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          void readFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      {decisions.some((d) => d.state === "review") && (
        <p role="status">
          「要確認」は既存の文章との違いや重複候補など、自動で登録先を決められない行です。各行の「変更前と変更後」を確認し、登録方法から「更新」または「新規追加」を選ぶと取り込まれます。「登録しない」を選ぶか要確認のままにした行は取り込みません。
        </p>
      )}
      {rows.some(
        (row, i) =>
          row.sheet === "お知らせ・注意事項" && plans[i].candidates.length > 0,
      ) && (
        <p>
          同じ内容・似た見出しのお知らせが既にあります。重複ページを作らないため、「変更前と変更後」を確認して既存ページを更新するか「登録しない」を選んでください。
        </p>
      )}
      {rows.some((row) => row.sheet === "アンケート") && (
        <p>
          「アンケート」シートのURLから、誌面とPDFのQRコードを自動生成します。QR画像の登録は不要です。既存URLがある場合は変更前後を確認し、「更新」を選んでください。
        </p>
      )}
      {ignored.length > 0 && <p>対象外のシート：{ignored.join("、")}</p>}
      {rows.some((r) => r.sample) && (
        <p>
          元のテンプレートには記入例が含まれるため、スタッフを初期選択していません。氏名を確認してから登録してください。
          <button
            onClick={() => {
              setChoices((previous) => ({
                ...previous,
                ...Object.fromEntries(
                  rows.flatMap((row, i) =>
                    row.sample &&
                    !plans[i].error &&
                    !plans[i].candidates.length &&
                    !duplicates[i]
                      ? [[i, ADD]]
                      : [],
                  ),
                ),
              }));
              setConfirmed(false);
            }}
          >
            確認したスタッフを一括選択
          </button>
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p>
            認識 {rows.length}件 ／ 登録予定 {count}件
          </p>
          <p>{summary(rows.map((_, i) => i))}</p>
          <details className="task-options">
            <summary>登録方法と表示を変更</summary>
            <label>
              登録方法{" "}
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as typeof mode);
                  setChoices({});
                  setConfirmed(false);
                }}
              >
                <option value="append">新規追加・必要な掲載先を選択</option>
                <option value="update">既存データと照合して更新</option>
                <option value="replace">選択した種類を置き換え</option>
              </select>
            </label>
            <label>
              シート{" "}
              <select
                value={visibleSheet}
                onChange={(e) =>
                  setVisibleSheet(e.target.value as ImportSheet | "")
                }
              >
                <option value="">すべてのシート</option>
                {[...new Set(rows.map((r) => r.sheet))].map((name) => (
                  <option key={name} value={name}>
                    {name}（{rows.filter((r) => r.sheet === name).length}件）
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => selectVisible(true)}>
              登録可能な行をすべて選択
            </button>
            <button onClick={() => selectVisible(false)}>選択を解除</button>
            <label>
              表示{" "}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="all">すべて</option>
                <option value="changed">変更が必要な行のみ</option>
                <option value="review">エラー・要確認のみ</option>
              </select>
            </label>
            {visibleSheet && (
              <p>
                {visibleSheet}：{summary(indices)}
              </p>
            )}
          </details>
          <div className="excel-rows">
            <table>
              <thead>
                <tr>
                  <th>Excelの行</th>
                  <th>内容</th>
                  <th>登録先・方法</th>
                </tr>
              </thead>
              <tbody>
                {indices
                  .filter(
                    (i) =>
                      filter === "all" ||
                      (filter === "review" &&
                        ["review", "error"].includes(decisions[i].state)) ||
                      (filter === "changed" &&
                        !["same", "skip"].includes(decisions[i].state)),
                  )
                  .map((i) => {
                    const row = rows[i],
                      p = plans[i],
                      decision = decisions[i];
                    const previewTarget =
                      (decision.target !== ADD && decision.target) ||
                      (p.candidates.length === 1 && p.candidates[0].id);
                    const comparison = previewTarget
                      ? inspected[i].get(previewTarget)
                      : undefined;
                    return (
                      <tr key={i}>
                        <th>
                          {row.sheet} {row.line}行目
                        </th>
                        <td>
                          {row.cells
                            .map(
                              (v) =>
                                ({
                                  full: "1ページ",
                                  half: "1/2ページ",
                                  quarter: "1/4ページ",
                                })[v] ?? v,
                            )
                            .join(" ／ ")}
                        </td>
                        <td>
                          <span>
                            {stateLabels[decision.state]}
                            {row.sample
                              ? "（記入例を含むシート）"
                              : duplicates[i]
                                ? "（ファイル内重複候補）"
                                : ""}
                          </span>
                          {p.error ? (
                            <span>{p.error}</span>
                          ) : (
                            <select
                              aria-label={
                                row.sheet + " " + row.line + "行目の登録方法"
                              }
                              value={
                                decision.target ||
                                (choices[i] === "" ? "" : "@auto")
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setChoices((previous) => {
                                  const next = { ...previous };
                                  if (value === "@auto") delete next[i];
                                  else next[i] = value;
                                  return next;
                                });
                                setConfirmed(false);
                              }}
                            >
                              <option value="@auto">自動判定</option>
                              <option value="">登録しない</option>
                              {!p.requiresTarget && (
                                <option value={ADD}>新規追加</option>
                              )}
                              {p.candidates.map((c, index) => (
                                <option key={c.id} value={c.id}>
                                  {row.sheet === "章・インデックス"
                                    ? "現在の章を維持"
                                    : "更新"}
                                  ：{c.label}
                                  {p.candidates.length > 1
                                    ? "（候補 " + (index + 1) + "）"
                                    : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {comparison?.error && <p>{comparison.error}</p>}
                          {!!comparison?.differences.length && (
                            <details>
                              <summary>変更前と変更後</summary>
                              {comparison.differences.map((d) => (
                                <p key={d.field}>
                                  {d.field}：{describe(d.before)} →{" "}
                                  {describe(d.after)}
                                </p>
                              ))}
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {mode === "replace" && (
            <>
              <p>
                画像・割当がある広告、画像付き企画、広告に紐づく企業、章・紙面設定は削除しません。
              </p>
              {removals.length > 0 && (
                <>
                  <p>
                    次の既存項目を削除します（{removals.length}件）：
                    {removals.map((r) => r.label || "名称未入力").join("、")}
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{" "}
                    削除する項目を確認しました
                  </label>
                </>
              )}
            </>
          )}
          {unresolvedReplacement && (
            <p role="alert">
              置き換えの対象に未解決の重複やエラーがあります。行ごとの登録方法を確認してください。
            </p>
          )}
          {badTargets && (
            <p role="alert">同じ更新先が複数の行で選ばれています。</p>
          )}
          <button
            className="primary"
            disabled={
              loading ||
              !count ||
              badTargets ||
              unresolvedReplacement ||
              (!!removals.length && !confirmed)
            }
            onClick={apply}
          >
            {count}件を登録
          </button>
        </>
      )}
      {loading && <p role="status">Excelを読み込み中…</p>}
      {error && <p role="alert">{error}</p>}
      {!inline && <button onClick={close}>閉じる</button>}
    </>
  );
  return inline ? (
    <section className="task-screen excel-intake">{content}</section>
  ) : (
    <div className="modal-backdrop excel-shade">
      <section
        className="modal excel-import"
        role="dialog"
        aria-modal="true"
        aria-label="Excelから登録"
      >
        {content}
      </section>
    </div>
  );
}
