import {
  applyPageVariant,
  applyThemeVariant,
  currentPartId,
} from "./design-selection";
import {
  installedRelease,
  type LibraryRelease,
} from "../../../../packages/designer/library";
import { loadDesignLibrary } from "../../../../packages/project-storage/design-library";
import { useEffect, useMemo, useState } from "react";
import type { AdSize, Block, Project } from "../../../../packages/core/model";
import { createFestivalSample } from "../../../../packages/core/festival-sample";
import {
  findComponent,
  blockDesign,
} from "../../../../packages/designer/components";
import { seedLibrary } from "../../../../packages/designer/presets";
import {
  renderComponent,
  renderTemplate,
} from "../../../../packages/designer/render";
import type { DesignTemplate } from "../../../../packages/designer/model";
import {
  layoutProject,
  type Measure,
} from "../../../../packages/layout-engine";
import { Preview } from "../Preview";
import { PageChoices, templateLabel } from "./TemplateChoices";
export const componentCategories = [
  "表",
  "インデックス",
  "見出し",
  "ページ番号",
  "箇条書き",
  "タイムテーブル",
  "ポスター枠",
  "広告枠",
  "ページ",
  "ページマスター",
] as const;
export type ComponentCategory = (typeof componentCategories)[number];
export function categoryOf(t: DesignTemplate): ComponentCategory | undefined {
  if (t.componentKind === "table") return "表";
  if (t.componentKind === "index") return "インデックス";
  if (t.componentKind === "timetable") return "タイムテーブル";
  if (t.componentKind === "posters") return "ポスター枠";
  if (t.componentKind === "image" && t.objects[0]?.binding === "advertisement")
    return "広告枠";
  if (t.componentKind === "text") {
    const o = t.objects[0];
    if (o?.binding === "page.title") return "見出し";
    if (o?.binding === "page.number") return "ページ番号";
    if (o?.binding === "block.body" && o.listMarker) return "箇条書き";
  }
}
export function ComponentChoices({
  project,
  block,
  measure,
  initial = "表",
  select,
  onPage,
  builtin,
  applyPageOption,
  allowGlobal = false,
  fixedCategory,
  pendingId,
  targetId,
  onPreviewVariant,
}: {
  project: Project;
  block?: Block;
  measure: Measure;
  initial?: ComponentCategory;
  select: (t: DesignTemplate, release?: LibraryRelease) => void;
  onPage?: Parameters<typeof PageChoices>[0]["select"];
  builtin?: (key: "indexShape" | "scheduleStyle", value: string) => void;
  applyPageOption?: (change: Partial<Block>, all: boolean) => void;
  allowGlobal?: boolean;
  fixedCategory?: ComponentCategory;
  pendingId?: string;
  targetId?: string;
  onPreviewVariant?: () => void;
}) {
  const [releases, setReleases] = useState<LibraryRelease[]>([]);
  const [libraryError, setLibraryError] = useState("");
  useEffect(() => {
    const load = () => {
      void loadDesignLibrary()
        .then((lib) => setReleases(lib.releases))
        .catch(() =>
          setLibraryError(
            "共通ライブラリを読み込めませんでした。冊子内のデザインは利用できます。",
          ),
        );
    };
    load();
    window.addEventListener("pamph-library-published", load);
    return () => window.removeEventListener("pamph-library-published", load);
  }, []);
  const imported = useMemo(
    () =>
      releases.map((release) => ({ ...installedRelease(release), release })),
    [releases],
  );
  const [applyAll, setApplyAll] = useState(false);
  const [variant, setVariant] = useState<
    | {
        id: string;
        label: string;
        current: string;
        theme: ["indexShape" | "scheduleStyle", string];
      }
    | { id: string; label: string; current: string; change: Partial<Block> }
  >();
  const shownVariant = pendingId ? undefined : variant;
  const comparison = useMemo(() => {
    if (!shownVariant) return;
    const copy = {
      ...project,
      theme: { ...project.theme },
      blocks: project.blocks.map((b) => ({ ...b })),
    };
    if ("theme" in shownVariant) applyThemeVariant(copy, ...shownVariant.theme);
    else if (block)
      applyPageVariant(
        copy,
        block.id,
        shownVariant.change,
        shownVariant.id !== "standard-page" && applyAll,
      );
    const pages = layoutProject(copy, measure).pages;
    const page = pages.find((p) =>
      block
        ? p.blockId === block.id
        : "theme" in shownVariant && shownVariant.theme[0] === "scheduleStyle"
          ? p.template === "stage"
          : p.template === "events",
    );
    return { copy, page };
  }, [shownVariant, project, block, applyAll, measure]);
  const [chosenCategory, setCategory] = useState<ComponentCategory>(initial);
  const category = fixedCategory ?? chosenCategory;
  const sample = useMemo(() => createFestivalSample(), []);
  const library = useMemo(
    () =>
      [
        ...project.templates,
        ...seedLibrary(project.templates),
        ...imported
          .flatMap((r) => r.templates)
          .filter((t) => !project.templates.some((p) => p.id === t.id)),
      ].filter(
        (t) =>
          t.scope === "component" ||
          t.scope === "page" ||
          t.scope === "master" ||
          !t.scope,
      ),
    [project.templates, imported],
  );
  const examples = useMemo(() => {
    const p = {
      ...sample,
      templates: [...sample.templates, ...library],
      assets: {
        ...sample.assets,
        ...project.assets,
        ...Object.assign({}, ...imported.map((r) => r.assets)),
      },
      theme: { ...sample.theme, background: project.theme.background },
    };
    const context = {
      ...sample.blocks.find((b) => b.openingKind === "survey")!,
      body: "受付で案内を受け取る\n会場マップを確認する\n終了時刻までに退出する",
    };
    p.blocks = p.blocks.map((b) => (b.id === context.id ? context : b));
    const base = layoutProject(sample, measure).pages[1];
    return library
      .filter(
        (t) =>
          t.scope === "component" && categoryOf(t) === category && t.objects[0],
      )
      .map((t) => {
        const o = t.objects[0];
        const nodes =
          renderComponent(o, p, measure, {
            side: "right",
            title: "学生企画",
            number: 12,
            chapterId: sample.chapters[0].id,
            blockId: context.id,
          })[0] ?? [];
        const boxes = nodes.filter((n) => !n.editorOnly);
        const x = Math.max(0, Math.min(...boxes.map((n) => n.x)) - 3),
          y = Math.max(0, Math.min(...boxes.map((n) => n.y)) - 3);
        const w = Math.min(
            148 - x,
            Math.max(...boxes.map((n) => n.x + n.w)) - x + 3,
          ),
          h = Math.min(
            210 - y,
            Math.max(...boxes.map((n) => n.y + n.h)) - y + 3,
          );
        const bounds =
          boxes.length &&
          ["見出し", "ページ番号", "箇条書き", "インデックス"].includes(
            category,
          )
            ? ([x, y, w, h] as [number, number, number, number])
            : undefined;
        const other =
          category === "インデックス"
            ? renderComponent(o, p, measure, {
                side: "left",
                chapterId: sample.chapters[0].id,
              })[0]
            : undefined;
        return {
          t,
          p,
          page: { ...base, title: t.name, nodes },
          bounds,
          other: other
            ? { ...base, title: t.name + " 左", nodes: other }
            : undefined,
        };
      });
  }, [library, category, sample, measure, project.theme.background]);
  const builtins = useMemo(() => {
    if (category !== "インデックス" && category !== "タイムテーブル") return [];
    const index = category === "インデックス";
    const key = index ? "indexShape" : "scheduleStyle";
    return (
      index
        ? [
            ["rounded", "内側角丸"],
            ["square", "四角"],
          ]
        : [
            ["bands", "色帯と縦書き"],
            ["line", "細い時間軸と縦書き"],
          ]
    ).map(([value, label]) => {
      const p = { ...sample, theme: { ...sample.theme, [key]: value } };
      const pages = layoutProject(p, measure).pages;
      return {
        key: key as "indexShape" | "scheduleStyle",
        value,
        label,
        p,
        page: pages.find((pg) => pg.template === (index ? "events" : "stage"))!,
        defaultValue: index ? "rounded" : "bands",
      };
    });
  }, [category, sample, measure]);
  const variants = useMemo(() => {
    if (!block || block.templateId) return [];
    const specs: { label: string; change: Partial<Block>; key: keyof Block }[] =
      [];
    if (
      category === "ポスター枠" &&
      block.template === "posters" &&
      block.posterMode !== "single"
    ) {
      specs.push(
        {
          label: "標準の間隔",
          change: { posterSpacing: "standard" },
          key: "posterSpacing",
        },
        {
          label: "間隔を詰める",
          change: { posterSpacing: "compact" },
          key: "posterSpacing",
        },
      );
    }
    if (category === "広告枠" && block.template === "ads") {
      for (const [size, label] of [
        ["full", "全面広告"],
        ["half", "半ページ広告"],
      ] as [AdSize, string][])
        specs.push({ label, change: { adSize: size }, key: "adSize" });
    }
    if (category === "ページ" && block.template === "back") {
      specs.push(
        {
          label: "マップ左・QR右",
          change: { backLayout: "map-left" },
          key: "backLayout",
        },
        {
          label: "QR左・マップ右",
          change: { backLayout: "qr-left" },
          key: "backLayout",
        },
      );
    }
    return specs.flatMap((spec) => {
      const p = structuredClone(sample),
        b = p.blocks.find(
          (b) => b.template === block.template && b.posterMode !== "single",
        );
      if (!b) return [];
      Object.assign(b, spec.change);
      if (spec.change.adSize === "full")
        p.ads.slice(-1).forEach((a) => {
          a.size = "full";
        });
      const page = layoutProject(p, measure).pages.find(
        (pg) => pg.blockId === b.id,
      );
      return page ? [{ ...spec, p, page }] : [];
    });
  }, [block, category, sample, measure]);
  const commonPages = useMemo(() => {
    if (
      !["ページ", "ページマスター", "ポスター枠", "広告枠"].includes(category)
    )
      return [];
    return library
      .filter(
        (t) =>
          t.scope !== "component" &&
          (category === "ページマスター"
            ? t.scope === "master"
            : t.scope !== "master") &&
          (category !== "ページ" || !block || block.template === t.kind) &&
          (category !== "ポスター枠" || t.kind === "posters") &&
          (category !== "広告枠" || t.kind === "ads") &&
          (!block ||
            !t.objects.some((o) => o.repeatRole) ||
            block.template === t.kind) &&
          (!t.sharedSource || imported.some((r) => r.template.id === t.id)),
      )
      .map((t) => {
        const p = {
          ...sample,
          templates: [...sample.templates, ...library],
          assets: {
            ...sample.assets,
            ...project.assets,
            ...Object.assign({}, ...imported.map((r) => r.assets)),
          },
        };
        const nodes =
          renderTemplate(p, t, measure, {
            side: "right",
            title: "掲載ページ",
            chapterId: sample.chapters[0].id,
          })[0] ?? [];
        const base = layoutProject(sample, measure).pages[0];
        return { t, p, page: { ...base, title: t.name, nodes } };
      });
  }, [
    category,
    library,
    imported,
    sample,
    project.assets,
    measure,
    block?.template,
  ]);
  const standardPage =
    block && category === "ページ" && !variants.length
      ? (() => {
          const source = sample.blocks.find(
            (b) =>
              b.template === block.template &&
              b.openingKind === block.openingKind,
          );
          return (
            source &&
            layoutProject(sample, measure).pages.find(
              (p) => p.blockId === source.id,
            )
          );
        })()
      : undefined;
  const standardName = block
    ? templateLabel(block.template) + "の標準デザイン"
    : "標準デザイン";
  const focusBlock =
    block ??
    project.blocks.find((b) =>
      examples.some(({ t }) =>
        findComponent(
          project,
          b,
          t.componentKind!,
          undefined,
          t.objects[0].binding === "none" ? undefined : t.objects[0].binding,
        ),
      ),
    );
  const activeComponent = examples.find(
    ({ t }) => currentPartId(project, focusBlock, t, targetId) === t.id,
  )?.t;
  const activePage = commonPages.find(
    ({ t }) =>
      (t.scope === "master"
        ? project.templates.find((d) => d.id === block?.templateId)?.masterId
        : block?.templateId) === t.id,
  )?.t;
  const defaults = {
    posterSpacing: "standard",
    adSize: "half",
    backLayout: "map-left",
  } as Partial<Block>;
  const activeVariant = variants.find(
    ({ key, change }) => (block?.[key] ?? defaults[key]) === change[key],
  );
  const activeBuiltin = builtins.find(
    ({ key, value, defaultValue }) =>
      (project.theme[key] ?? defaultValue) === value,
  );
  const pageCategories =
    category === "ページ" || category === "ポスター枠" || category === "広告枠";
  return (
    <>
      <p className="design-comparison-status" aria-live="polite">
        編集対象：{block?.title ?? "パンフレット全体"} · {category}
        <br />
        現在使用中：
        {activeComponent?.name ??
          activePage?.name ??
          activeVariant?.label ??
          (allowGlobal ? activeBuiltin?.label : undefined) ??
          standardName}
      </p>
      {fixedCategory && (
        <p>
          カードは各部品のデザイン見本です。冊子全体の出力ページ数は画面上部で確認できます。
        </p>
      )}
      {libraryError && <p role="alert">{libraryError}</p>}
      {!fixedCategory && (
        <label>
          部品の種類{" "}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ComponentCategory)}
          >
            {componentCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {pageCategories && !variants.length && onPage && (
        <PageChoices
          measure={measure}
          select={onPage}
          only={
            category === "ポスター枠"
              ? "posters"
              : category === "広告枠"
                ? "ads"
                : undefined
          }
          current={block}
        />
      )}
      {shownVariant &&
        "change" in shownVariant &&
        shownVariant.id !== "standard-page" && (
          <label>
            適用範囲{" "}
            <select
              value={applyAll ? "all" : "one"}
              onChange={(e) => setApplyAll(e.target.value === "all")}
            >
              <option value="one">選択中のページのみ</option>
              <option value="all">同じ種類の標準ページすべて</option>
            </select>
          </label>
        )}
      <div className="template-grid">
        {standardPage && (
          <button
            aria-pressed={shownVariant?.id === "standard-page"}
            onClick={() => {
              setVariant({
                id: "standard-page",
                label: standardName,
                current: activePage?.name ?? standardName,
                change: { templateId: undefined },
              });
              onPreviewVariant?.();
            }}
          >
            <div className="template-thumb">
              <Preview page={standardPage} project={sample} thumb />
            </div>
            <b>{standardName}</b>
            <small>
              {!block?.templateId && "✓ 現在使用中"}
              {shownVariant?.id === "standard-page" && " · プレビュー中"}
            </small>
          </button>
        )}
        {commonPages.map(({ t, p, page }) => (
          <button
            key={t.id}
            onClick={() => (
              setVariant(undefined),
              select(t, imported.find((r) => r.template.id === t.id)?.release)
            )}
            aria-pressed={pendingId === t.id}
          >
            <div className="template-thumb">
              <Preview page={page} project={p} thumb />
            </div>
            <b>{t.name}</b>
            <small>
              {t.scope === "master" ? "共通マスター" : "ページ全体"} · v
              {t.sharedSource?.version ?? t.version}
              {activePage?.id === t.id && " · ✓ 現在使用中"}
              {pendingId === t.id && " · プレビュー中"}
            </small>
          </button>
        ))}

        {variants.map(({ label, change, key, p, page }) => {
          const active = activeVariant?.label === label;
          const id = "variant:" + label;
          return (
            <button
              key={label}
              aria-pressed={shownVariant?.id === id}
              onClick={() => {
                setVariant({
                  id,
                  label,
                  change,
                  current: activeVariant?.label ?? "標準デザイン",
                });
                onPreviewVariant?.();
              }}
            >
              <div className="template-thumb">
                <Preview page={page} project={p} thumb />
              </div>
              <b>{label}</b>
              <small>
                {category} · 登録内容を維持{active ? " · ✓ 現在使用中" : ""}
                {shownVariant?.id === id ? " · プレビュー中" : ""}
              </small>
            </button>
          );
        })}

        {allowGlobal &&
          builtins.map(({ key, value, label, p, page, defaultValue }) => {
            const active =
              !activeComponent &&
              (project.theme[key] ?? defaultValue) === value;
            const id = "theme:" + value;
            return (
              <button
                key={value}
                aria-pressed={shownVariant?.id === id}
                onClick={() => {
                  setVariant({
                    id,
                    label,
                    theme: [key, value],
                    current:
                      activeComponent?.name ??
                      activeBuiltin?.label ??
                      "標準デザイン",
                  });
                  onPreviewVariant?.();
                }}
              >
                <div className="template-thumb">
                  <Preview page={page} project={p} thumb />
                </div>
                <b>{label}</b>
                <small>
                  {category} · 冊子の標準設定{active ? " · ✓ 現在使用中" : ""}
                  {shownVariant?.id === id ? " · プレビュー中" : ""}
                </small>
              </button>
            );
          })}
        {examples.map(({ t, p, page, bounds, other }) => {
          const active = activeComponent?.id === t.id;
          return (
            <button
              key={t.id}
              aria-pressed={pendingId === t.id}
              disabled={!page.nodes.some((n) => !n.editorOnly)}
              onClick={() => (
                setVariant(undefined),
                select(t, imported.find((r) => r.template.id === t.id)?.release)
              )}
            >
              <div
                className={
                  other
                    ? "template-thumb template-index-pair"
                    : "template-thumb"
                }
              >
                {other && (
                  <Preview
                    page={other}
                    project={p}
                    thumb
                    bounds={[0, 0, 12, 196]}
                  />
                )}
                <Preview page={page} project={p} thumb bounds={bounds} />
              </div>
              <b>{t.name.replace(/^T\d+\s+/, "")}</b>
              {t.sharedSource && (
                <small>
                  公開版 v{t.sharedSource.version} ·{" "}
                  {new Date(t.updatedAt).toLocaleDateString("ja-JP")}
                </small>
              )}
              <small>
                {category} ·{" "}
                {category === "インデックス"
                  ? "章を案内"
                  : category === "タイムテーブル"
                    ? "開催時刻を表示"
                    : category === "表"
                      ? "企画を一覧にする"
                      : "選んだ部品の見た目を変更"}
                {active ? " · ✓ 現在使用中" : ""}
                {pendingId === t.id ? " · プレビュー中" : ""}
              </small>
            </button>
          );
        })}
      </div>
      {shownVariant && comparison && (
        <section aria-label="適用前の紙面" className="design-inline">
          <p>
            現在使用中：{shownVariant.current}
            <br />
            <strong>プレビュー中・未適用：{shownVariant.label}</strong>
          </p>
          <p>
            適用対象：
            {"theme" in shownVariant
              ? "冊子全体の標準デザイン（個別指定を除く）"
              : applyAll && shownVariant.id !== "standard-page"
                ? "同じ種類の標準ページすべて"
                : "このページのみ"}
          </p>
          {comparison.page && (
            <div className="apply-preview">
              <Preview page={comparison.page} project={comparison.copy} thumb />
            </div>
          )}
          <div className="button-row">
            <button onClick={() => setVariant(undefined)}>キャンセル</button>
            <button
              className="primary"
              onClick={() => {
                if ("theme" in shownVariant) builtin?.(...shownVariant.theme);
                else
                  applyPageOption?.(
                    shownVariant.change,
                    shownVariant.id !== "standard-page" && applyAll,
                  );
                setVariant(undefined);
              }}
            >
              このデザインを適用
            </button>
          </div>
        </section>
      )}
      {!pageCategories && !builtins.length && !examples.length && (
        <p>選択できるデザインはありません。</p>
      )}
      {block && blockDesign(project, block)?.masterId && (
        <p>共通マスターへの適用は、対応部品がある場合に選べます。</p>
      )}
    </>
  );
}
