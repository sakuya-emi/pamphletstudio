import { adCompany } from "../core/registration";
import { resolveAsset } from "../core/rule-marks";
import { recolorNodes } from "../core/color-palette";
import { openingPage, orderedSchedule, surveyQr } from "../templates/opening";
import { kitchenPages } from "../templates/kitchen";
import { stagePreset } from "../designer/presets";
import { recordPages } from "../templates/records";
import { posterNodes, flowEvents } from "../templates/posters";
import { blockDesign, componentObject } from "../designer/components";
import {
  renderComponent,
  renderTemplate,
  templateAdObjects,
} from "../designer/render";
import type { Project, AdSize, Block } from "../core/model";
import { cover } from "../templates/cover";
import { eventPages } from "../templates/events";
import { posterPages } from "../templates/posters";
import { adBox, adCapacity, adPlaceholder, adHeight } from "../templates/ads";
import { contents, contentsRows, headingEntries } from "../templates/contents";
import {
  fallbackMeasure,
  rect,
  text,
  wrap,
  type Measure,
  type Layout,
  type LayoutPage,
  type Node,
  type Context,
} from "./types";
export * from "./types";
export function layoutProject(
  p: Project,
  measure: Measure = fallbackMeasure,
): Layout {
  return paginate(p, measure, 1);
}
function paginate(p: Project, measure: Measure, contentsCount: number): Layout {
  const pages: LayoutPage[] = [],
    issues: Layout["issues"] = [],
    used = new Set<string>();
  for (const e of p.events)
    if (
      e.published !== false &&
      e.category !== "kitchen" &&
      e.posterRequired !== false &&
      (!e.assetId || !p.assets[e.assetId])
    )
      issues.push({
        level: "warning",
        message: `ポスター未登録：${e.name}。企画データは登録済みです。画像を登録するかポスター要否を「不要」にしてください。`,
      });
  for (const b of p.blocks)
    if (
      b.externalEvent &&
      b.posterRequired !== false &&
      (!b.assetId || !p.assets[b.assetId])
    )
      issues.push({
        level: "warning",
        message: `ポスター未登録：${b.title}（外部・特別企画）。企画データは登録済みです。「外部・特別企画」タブで画像を登録するかポスター要否を「不要」にしてください。`,
      });
  // Explicit assignments reserve ads before automatic placement, irrespective of page order.
  const reserved = new Set(
    Object.values(p.assignments).filter((a): a is string => !!a),
  );
  const allocate = (key: string, size: AdSize) => {
    const explicit = Object.hasOwn(p.assignments, key);
    const ad = explicit
      ? p.ads.find((a) => a.id === p.assignments[key] && a.published !== false)
      : p.ads.find(
          (a) =>
            a.published !== false &&
            a.size === size &&
            !used.has(a.id) &&
            !reserved.has(a.id),
        );
    if (ad) {
      if (used.has(ad.id)) {
        issues.push({
          level: "error",
          message: "同じ広告が複数の枠に指定されています。",
          pageId: key.split(":slot")[0],
        });
        return;
      }
      if (ad.size !== size) {
        issues.push({
          level: "error",
          message: "広告規格と枠の規格が一致しません。",
          pageId: key.split(":slot")[0],
        });
        return;
      }
      used.add(ad.id);
    }
    return ad;
  };
  const consumed = new Set<string>();
  for (const block of p.blocks) {
    if (consumed.has(block.id)) continue;
    if (block.template === "events" && block.flowPosters) {
      const next = p.blocks[p.blocks.indexOf(block) + 1];
      if (
        next?.template === "posters" &&
        next.chapterId === block.chapterId &&
        !next.templateId &&
        !next.components?.length
      )
        consumed.add(next.id);
    }

    const c: Context = {
      project: p,
      block,
      left: p.theme.margin + 3,
      width: 148 - 2 * p.theme.margin - 4,
      measure,
    };
    const design = blockDesign(p, block);
    const tableOverride =
      !design &&
      block.components?.find((i) =>
        ["table", "posters", "timetable"].includes(i.kind),
      );
    let chunks: Node[][] = [];
    if (tableOverride)
      chunks = renderComponent(componentObject(p, tableOverride), p, measure, {
        side: "right",
        chapterId: block.chapterId,
        title: block.title,
        blockId: block.id,
      });
    else if (design)
      chunks = renderTemplate(p, design, measure, {
        side: "right",
        chapterId: block.chapterId,
        title: block.title,
        blockId: block.id,
      });
    else
      switch (block.template) {
        case "cover":
          chunks = [cover(c)];
          break;
        case "back":
          chunks = [cover(c, true)];
          break;
        case "events":
          chunks = eventPages(c);
          break;
        case "sponsors":
          chunks = recordPages(c);
          break;
        case "stage":
          chunks =
            block.openingKind === "schedule"
              ? orderedSchedule(c)
              : renderComponent(stagePreset().objects[0], p, measure, {
                  side: "right",
                  chapterId: block.chapterId,
                });
          break;
        case "kitchen":
          chunks = kitchenPages(c);
          if (!chunks.length) chunks = [[]];
          break;
        case "staff":
          chunks = recordPages(c, true);
          break;
        case "posters":
          chunks = posterPages(c);
          break;
        case "contents":
          chunks = Array.from({ length: contentsCount }, () => []);
          break;
        case "ads": {
          const size = block.adSize || "quarter",
            capacity = adCapacity[size],
            remaining = p.ads.filter(
              (a) =>
                a.published !== false && a.size === size && !used.has(a.id),
            ).length;
          chunks = Array.from(
            { length: Math.max(1, Math.ceil(remaining / capacity)) },
            () => [],
          );
          break;
        }
        default: {
          if (block.openingKind) {
            chunks = [openingPage(c)];
            if (block.openingKind === "survey") {
              try {
                surveyQr(block.surveyUrl || "", 0, 0, 1);
              } catch {
                issues.push({
                  level: "warning",
                  message: "アンケートの有効なURLを入力してください。",
                  pageId: block.id + "/0",
                });
              }
            }
            break;
          }
          // A designer's body/bullet component replaces the built-in body;
          // otherwise it would be printed twice and only one copy editable.
          const styledBody = block.components?.some(
            (component) =>
              p.templates.find((t) => t.id === component.templateId)?.objects[0]
                ?.binding === "block.body",
          );
          if (styledBody) {
            chunks.push(
              block.assetId &&
                !(block.externalEvent && block.posterRequired === false)
                ? [
                    {
                      kind: "asset",
                      assetId: block.assetId,
                      x: c.left,
                      y: 25,
                      w: c.width,
                      h: 65,
                    },
                  ]
                : [],
            );
            break;
          }
          let lines = wrap(
            block.body || "右のパネルから内容を入力してください。",
            c.width,
            p.theme.fontSize,
            measure,
          );
          const per = Math.floor(
            (192 -
              ((block.assetId || block.externalEvent) &&
              !(block.externalEvent && block.posterRequired === false)
                ? 97
                : 30)) /
              (p.theme.fontSize * p.theme.lineHeight),
          );
          for (let i = 0; i < Math.max(1, lines.length); i += per) {
            const n: Node[] = [];
            if (
              block.assetId &&
              !(block.externalEvent && block.posterRequired === false)
            )
              n.push({
                kind: "asset",
                assetId: block.assetId,
                x: c.left,
                y: 25,
                w: c.width,
                h: 65,
              });
            lines.slice(i, i + per).forEach((s, j) =>
              n.push({
                ...text(
                  c.left,
                  ((block.assetId || block.externalEvent) &&
                  !(block.externalEvent && block.posterRequired === false)
                    ? 97
                    : 30) +
                    j * p.theme.fontSize * p.theme.lineHeight,
                  c.width,
                  s,
                  p.theme.fontSize,
                  p.theme.ink,
                ),
                editorOnly: !block.body,
                source: { type: "block", id: block.id, field: "body" },
              }),
            );
            chunks.push(n);
          }
          break;
        }
      }
    if (block.template === "staff" && block.staffSpread) {
      if (chunks.length % 2) chunks.push([]);
      chunks = chunks.map((nodes, i) =>
        [...nodes, rect(0, 0, 0, 0, "none")].map((n) => ({
          ...n,
          spreadSide: ((i % 2 === 0) === (p.theme.binding === "left")
            ? "left"
            : "right") as "left" | "right",
          spreadIndex: Math.floor(i / 2),
        })),
      );
    }
    if (block.template === "events" && block.flowPosters)
      chunks = flowEvents(c, chunks);
    if (
      block.externalEvent &&
      block.posterRequired !== false &&
      (!block.assetId || !p.assets[block.assetId])
    ) {
      chunks[0]?.push(
        ...adPlaceholder(
          { x: c.left, y: 25, w: c.width, h: 65 },
          "ポスター未登録：" + block.title,
        ).map((n) => ({
          ...n,
          source: { type: "block" as const, id: block.id, field: "assetId" },
        })),
      );
    }
    if (
      block.template === "stage" &&
      !design &&
      !p.blocks.some(
        (b) => b.posterMode === "single" && b.eventCategory === "stage",
      )
    ) {
      const posters = p.events.filter(
        (e) =>
          (e.category === "stage" || e.category === "studentStage") &&
          e.published !== false &&
          e.posterRequired !== false &&
          e.assetId,
      );
      for (let at = 0; at < posters.length; at += 4)
        chunks.push(posterNodes(c, posters.slice(at, at + 4), 24));
    }

    chunks.forEach((nodes, i) => {
      const heading =
        block.template === "stage" &&
        nodes.some((n) => n.kind === "asset" && n.source?.type === "event")
          ? "ステージ企画紹介"
          : block.openingKind === "map" && block.title === "学内マップ"
            ? "マップ"
            : block.title;

      const id = `${block.id}/${i}`,
        page: LayoutPage = {
          id,
          blockId: block.id,
          chapterId: block.chapterId,
          heading,
          title: heading + (chunks.length > 1 ? ` ${i + 1}` : ""),
          template: block.template,
          designTemplateId: design?.id,
          spreadSide: nodes.find((n) => n.spreadSide)?.spreadSide,
          spreadKey: nodes.some((n) => n.spreadSide)
            ? block.id +
              "/spread/" +
              nodes.find((n) => n.spreadSide)!.spreadIndex
            : undefined,
          nodes,
          physical: 0,
          side: "right",
          slots: [],
        };
      const customAds = design ? templateAdObjects(p, design) : [];
      const sizes: AdSize[] = design
        ? customAds.map((o) => o.adSize || "quarter")
        : (block.template === "posters" && block.posterMode !== "single") ||
            ((block.flowPosters || block.template === "stage") &&
              nodes.some(
                (n) => n.kind === "asset" && n.source?.type === "event",
              ))
          ? ["quarter"]
          : block.template === "ads"
            ? Array.from(
                { length: adCapacity[block.adSize || "quarter"] },
                () => block.adSize || "quarter",
              )
            : [];
      sizes.forEach((size, j) => {
        const key = `${id}:slot${j}`,
          ad = allocate(key, size),
          box = design
            ? {
                x: customAds[j].x,
                y: customAds[j].y,
                w: customAds[j].w,
                h: customAds[j].h,
              }
            : block.template === "posters" ||
                block.flowPosters ||
                block.template === "stage"
              ? {
                  x: c.left + (c.width - p.theme.adWidth) / 2,
                  y: 198 - p.theme.adQuarterHeight,
                  w: p.theme.adWidth,
                  h: p.theme.adQuarterHeight,
                }
              : adBox(c, j, size);
        page.slots.push({ key, adId: ad?.id, size });
        if (
          design &&
          (Math.abs(box.w - p.theme.adWidth) > 0.1 ||
            Math.abs(box.h - adHeight(p.theme, size)) > 0.1)
        )
          issues.push({
            level: "warning",
            message: `広告枠の実寸 ${box.w.toFixed(1)}×${box.h.toFixed(1)}mm は規格 ${p.theme.adWidth}×${adHeight(p.theme, size)}mm と異なります。`,
            pageId: id,
          });
        if (ad?.assetId) {
          nodes.push({
            kind: "asset",
            assetId: ad.assetId,
            ...box,
            source: { type: "ad", id: ad.id, field: "assetId" },
          });
          const asset = p.assets[ad.assetId];
          if (
            asset &&
            Math.abs(asset.width / asset.height - box.w / box.h) /
              (box.w / box.h) >
              0.08
          )
            issues.push({
              level: "warning",
              message:
                "広告素材と枠の縦横比が異なります。余白で調整しています。",
              pageId: id,
            });
        } else {
          nodes.push(
            ...adPlaceholder(box, ad ? "広告素材未登録" : "広告未設定"),
          );
          issues.push({
            level: "warning",
            message: ad
              ? `広告素材が未登録です：${adCompany(p, ad.id) || "名称未設定"} ／ ${block.title}（枠${j + 1}）`
              : `広告未設定の枠があります：${block.title}（${i + 1}ページ目・枠${j + 1}）`,
            pageId: id,
          });
        }
      });
      pages.push(page);
    });
  }
  const rank = new Map(p.pageOrder.map((id, i) => [id, i]));
  if (rank.size) {
    const original = new Map(pages.map((pg, i) => [pg.id, i]));
    const pageRank = (page: LayoutPage) => {
      if (rank.has(page.id)) return rank.get(page.id)!;
      const siblings = pages.filter(
        (pg) => pg.blockId === page.blockId && rank.has(pg.id),
      );
      return siblings.length
        ? Math.max(...siblings.map((pg) => rank.get(pg.id)!)) +
            Number(page.id.split("/")[1] || 0) / 10000
        : 1e6 + original.get(page.id)!;
    };
    pages.sort((a, b) => pageRank(a) - pageRank(b));
  }
  // A spread is an indivisible pair even when a previous manual page order exists.
  const grouped: LayoutPage[] = [],
    handled = new Set<string>();
  for (const pg of pages) {
    if (handled.has(pg.id)) continue;
    if (pg.spreadKey) {
      const pair = pages.filter((n) => n.spreadKey === pg.spreadKey);
      const first = p.theme.binding === "right" ? "right" : "left";
      pair.sort(
        (a, b) =>
          Number(b.spreadSide === first) - Number(a.spreadSide === first),
      );
      grouped.push(...pair);
      pair.forEach((n) => handled.add(n.id));
    } else {
      grouped.push(pg);
      handled.add(pg.id);
    }
  }
  pages.splice(0, pages.length, ...grouped);
  const started = new Set<string>();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i],
      b = p.blocks.find((b) => b.id === pg.blockId),
      firstChapter = !started.has(pg.chapterId);
    started.add(pg.chapterId);
    const side =
      pg.spreadSide ||
      b?.startSide ||
      (firstChapter
        ? p.chapters.find((ch) => ch.id === pg.chapterId)?.startSide
        : undefined);
    if (
      side &&
      side !== "auto" &&
      (pg.spreadSide || i === 0 || pages[i - 1].blockId !== pg.blockId)
    ) {
      const actual =
        (i % 2 === 0) === (p.theme.binding === "left") ? "right" : "left";
      if (actual !== side) {
        pages.splice(i, 0, {
          id: "adjust:" + pg.id,
          blockId: "",
          chapterId: "",
          title: "自動調整ページ",
          automatic: {
            kind: "start",
            targetBlockId: pg.blockId,
            chapterId: pg.chapterId,
            setting: pg.spreadSide
              ? "spread"
              : b?.startSide && b.startSide !== "auto"
                ? "block"
                : "chapter",
          },
          blankReason: `${pg.spreadSide ? "見開き" : "「" + pg.title + "」"}を${side === "left" ? "左" : "右"}ページから始めるための白紙です。`,
          template: "blank",
          nodes: [],
          physical: 0,
          side: "right",
          slots: [],
        });
        i++;
      }
    }
  }
  while (pages.length % p.theme.padding !== 0) {
    const back = pages.map((a) => a.template).lastIndexOf("back");
    pages.splice(back < 0 ? pages.length : back, 0, {
      id: `blank-${pages.length}`,
      blockId: "",
      chapterId: "",
      title: "自動調整ページ",
      automatic: { kind: "padding" },
      blankReason:
        p.theme.padding === 4
          ? "中綴じ用に総ページ数を4の倍数にするための白紙です。"
          : "総ページ数を偶数にするための白紙です。",
      template: "blank",
      nodes: [],
      physical: 0,
      side: "right",
      slots: [],
    });
  }
  const entries = headingEntries(pages);
  const required = Math.max(1, Math.ceil(entries.length / contentsRows));
  if (
    required > contentsCount &&
    pages.some((pg) => pg.template === "contents" && !pg.designTemplateId)
  )
    return paginate(p, measure, required);
  const firstHeading = new Set(entries.map((pg) => pg.id));
  let number = (p.theme.numberStart ?? 1) - 1;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    page.physical = i + 1;
    page.side =
      (i % 2 === 0) === (p.theme.binding === "left") ? "right" : "left";
    if (!["cover", "back"].includes(page.template)) page.number = ++number;
  }
  for (const page of pages) {
    if (page.template === "blank") {
      if (page.blankReason)
        page.nodes.push({
          ...text(16, 92, 116, page.blankReason, 3, p.theme.silver),
          editorOnly: true,
        });
      continue;
    }
    const block = p.blocks.find((b) => b.id === page.blockId),
      c: Context = {
        project: p,
        block: block || ({} as Block),
        left: p.theme.margin + 3,
        width: 148 - 2 * p.theme.margin - 4,
        measure,
      };
    const design = block ? blockDesign(p, block) : undefined;
    if (design) {
      const ads: Record<string, string | undefined> = {};
      templateAdObjects(p, design).forEach((o, i) => {
        ads[o.id] = page.slots[i]?.adId;
      });
      const rendered = renderTemplate(p, design, measure, {
        side: page.side,
        number: page.number,
        chapterId: page.chapterId,
        ads,
        title: block?.title,
        blockId: block?.id,
      });
      page.nodes =
        (block?.flowPosters ? flowEvents(c, rendered) : rendered)[
          Number(page.id.split("/")[1])
        ] || [];
    }
    if (
      design &&
      page.template === "cover" &&
      p.coverId &&
      !page.nodes.some((n) => n.kind === "asset" && n.assetId === p.coverId)
    )
      page.nodes.push(...cover(c).filter((n) => n.kind === "asset"));
    if (!design && page.template === "contents")
      page.nodes.push(
        ...contents(c, pages, Number(page.id.split("/")[1]) * contentsRows),
      );
    if (!design && !["cover", "back"].includes(page.template)) {
      const posterStyle =
        p.referenceDesign &&
        page.template === "posters" &&
        block?.posterMode !== "single";
      const before: Node[] = [
        rect(
          0,
          0,
          148,
          210,
          ["staff", "sponsors"].includes(page.template)
            ? "#ffffff"
            : p.theme.background,
        ),
      ];
      const indexInstance = block?.components?.find((i) => i.kind === "index");
      if (indexInstance && page.template !== "blank")
        before.push(
          ...renderComponent(componentObject(p, indexInstance), p, measure, {
            side: page.side,
            number: page.number,
            chapterId: page.chapterId,
          })[0],
        );
      if (
        !indexInstance &&
        block?.showIndex !== false &&
        page.template !== "blank"
      ) {
        const gap = 0.6,
          visibleChapters = p.chapters.filter((ch) => ch.visible !== false),
          hh = Math.min(
            28,
            (196 - gap * Math.max(0, visibleChapters.length - 1)) /
              Math.max(1, visibleChapters.length),
          );
        visibleChapters.forEach((ch, j) => {
          const xx = page.side === "left" ? 0 : 140,
            yy = j * (hh + gap),
            active = page.chapterId === ch.id;
          before.push({
            ...rect(xx, yy, 8, hh, ch.color, undefined, 0, active ? 1 : 0.55),
            corners:
              p.theme.indexShape === "square"
                ? undefined
                : page.side === "left"
                  ? { topLeft: 0, topRight: 3, bottomLeft: 0, bottomRight: 3 }
                  : { topLeft: 3, topRight: 0, bottomLeft: 3, bottomRight: 0 },
            source: { type: "chapter", id: ch.id, field: "name" },
          });
          const chars = Array.from(ch.name);
          const z = Math.min(2.8, (hh - 3) / Math.max(1, chars.length));
          chars.forEach((s, k) =>
            before.push(
              text(
                xx + (8 - z) / 2,
                yy + (hh - chars.length * z) / 2 + k * z,
                z,
                s,
                z,
                active ? "#231815" : "#555555",
                active,
              ),
            ),
          );
        });
      }
      if (
        page.template !== "blank" &&
        page.template !== "ads" &&
        !posterStyle &&
        (page.template === "contents"
          ? page.id.endsWith("/0")
          : firstHeading.has(page.id)) &&
        !block?.components?.some(
          (i) => componentObject(p, i).binding === "page.title",
        )
      ) {
        const schedule =
          block?.openingKind === "schedule" &&
          block.title === "ステージタイムテーブル";
        const titles = schedule
          ? ["ステージ", "タイムテーブル"]
          : [page.heading ?? page.title];
        const z = p.referenceDesign
          ? Math.min(
              8.2,
              (8.2 * (c.width - 7)) /
                Math.max(c.width - 7, measure(page.title, 8.2, true)),
            )
          : 5.2;
        before.push(
          rect(
            c.left,
            9,
            0.7,
            schedule ? 22 : p.referenceDesign ? 15 : 9,
            p.theme.ink,
          ),
        );
        titles.forEach((title, j) =>
          before.push({
            ...text(
              c.left + 3,
              9 + j * 10,
              c.width - 3,
              title,
              z,
              p.theme.ink,
              true,
            ),
            source: { type: "block", id: page.blockId, field: "title" },
          }),
        );
        if (schedule)
          before.push(
            text(c.left + 3, 32, 90, "Stage timetable", 2.8, p.theme.ink),
          );
      }
      page.nodes = [...before, ...page.nodes];
      if (
        block?.showNumber !== false &&
        !block?.components?.some(
          (i) => componentObject(p, i).binding === "page.number",
        )
      ) {
        page.nodes.push({
          ...text(
            page.side === "left" ? 4 : 133,
            203,
            11,
            String(page.number),
            3.2,
            p.theme.ink,
          ),
          source: { type: "pageNumber", id: "", field: "number" },
        });
      }
    }
    if (!design && block)
      for (const instance of block.components || [])
        if (!["index", "table", "posters", "timetable"].includes(instance.kind))
          page.nodes.push(
            ...renderComponent(componentObject(p, instance), p, measure, {
              side: page.side,
              number: page.number,
              chapterId: page.chapterId,
              title: block.title,
              blockId: block.id,
            })[0],
          );
    if (
      !["cover", "back", "contents", "blank"].includes(page.template) &&
      page.heading &&
      !firstHeading.has(page.id)
    )
      page.nodes = page.nodes.filter(
        (n) =>
          !(
            n.source?.type === "block" &&
            n.source.id === page.blockId &&
            n.source.field === "title"
          ),
      );
    page.nodes = recolorNodes(p, page.nodes).map((n) => ({
      ...n,
      pageId: page.id,
    }));
    for (const node of page.nodes) {
      if (
        node.x < -0.01 ||
        node.y < -0.01 ||
        node.x + node.w > 148.01 ||
        node.y + node.h > 210.01
      )
        issues.push({
          level: node.objectId ? "warning" : "error",
          message: node.objectId
            ? "デザインの用紙外部分はPDFで切り落とされます。"
            : "要素がA5の印刷範囲を超えています。",
          pageId: page.id,
        });
      if (
        node.kind === "text" &&
        !node.editorOnly &&
        measure(node.text, node.size, node.bold) > node.w + 0.3
      )
        issues.push({
          level: "warning",
          message: `文字が枠を超えています：${node.text.slice(0, 18)}`,
          pageId: page.id,
        });
      if (node.kind === "asset") {
        const a = resolveAsset(p, node.assetId);
        if (!a)
          issues.push({
            level: "error",
            message: "素材の参照切れがあります。",
            pageId: page.id,
          });
        else if (!["application/pdf", "image/svg+xml"].includes(a.mime)) {
          const scale = Math.min(node.w / a.width, node.h / a.height),
            dpi = 25.4 / scale;
          if (dpi < 300)
            issues.push({
              level: "warning",
              message: `画像の実効解像度 ${Math.round(dpi)}dpi：${a.name}`,
              pageId: page.id,
            });
        }
      }
    }
  }
  if (Object.values(p.assets).some((a) => a.mime === "application/pdf"))
    issues.push({
      level: "warning",
      message:
        "登録PDF内のフォント・色空間・透明効果は原本に依存します。入稿前に確認してください。",
    });
  for (const ad of p.ads)
    if (ad.published !== false && !used.has(ad.id))
      issues.push({
        level: "warning",
        adId: ad.id,
        message: `未配置広告：${p.sponsors.find((s) => s.id === ad.sponsorId)?.name || "企業名未設定"}。${pages.some((pg) => pg.slots.some((slot) => slot.size === ad.size && !slot.adId)) ? "同じ規格の空き枠があります。広告タブで配置先を選んでください。" : "同じ規格の空き枠がありません。広告タブで広告ページを追加して配置できます。"}`,
      });
  if (!p.coverId && pages.some((a) => a.template === "cover"))
    issues.push({
      level: "warning",
      message: "表紙画像を登録してください（学園祭名・開催日入りの画像）。",
      pageId: pages.find((a) => a.template === "cover")?.id,
    });
  issues.push({
    level: "ok",
    message: `全${pages.length}ページ：A5縦 148 × 210mm`,
  });
  issues.push({
    level: "info",
    message: "標準PDFはRGB校正用です。CMYK・ICC・PDF/X・塗り足しは未実装です。",
  });
  for (const [id, message] of Object.entries({
    proof: "誤字脱字・ページ順序・開催回数を確認",
    map: "地図の立ち入り禁止箇所・トイレを確認",
    rights: "素材・ロゴの使用許可と広告の寸法を確認",
    remarks: "タイムテーブルの必須備考を確認",
  }))
    issues.push({
      level: "check",
      message,
      checkId: id,
    });
  return { pages, issues };
}
