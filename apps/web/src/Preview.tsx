import { resolveAsset } from "../../../packages/core/rule-marks";
import { inputGuides } from "./workspace/inputGuides";
import type { InputTarget } from "./workspace/ProductionEditor";
import { useState } from "react";
import type { DataSource } from "../../../packages/core/editing";
import { DirectEditor } from "./workspace/DirectEditor";
import { roundedPath } from "../../../packages/designer/corners";
import type { Project } from "../../../packages/core/model";
import {
  fit,
  type Node,
  type LayoutPage,
} from "../../../packages/layout-engine";
export function NodeView({
  node: n,
  project,
}: {
  node: Node;
  project: Project;
}) {
  let content;
  if (n.kind === "rect")
    content = (
      <path
        shapeRendering={n.crisp ? "crispEdges" : undefined}
        d={roundedPath(n.x, n.y, n.w, n.h, n.corners ?? n.radius ?? 0)}
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        fill={n.fill}
        stroke={n.stroke}
        strokeWidth={n.stroke ? (n.strokeWidth ?? 0.2) : 0}
        strokeDasharray={n.dash?.join(" ")}
        strokeLinecap={n.lineCap}
      />
    );
  else if (n.kind === "path")
    content = (
      <path
        shapeRendering={n.crisp ? "crispEdges" : undefined}
        d={n.d}
        fill={n.fill}
        stroke={n.stroke}
        strokeWidth={n.strokeWidth ?? 0.3}
        strokeDasharray={n.dash?.join(" ")}
        strokeLinecap={n.lineCap}
      />
    );
  else if (n.kind === "text")
    content = (
      <text
        x={n.x}
        y={n.y + n.size * 0.88}
        fontSize={n.size}
        fontWeight={n.bold ? 700 : 500}
        fill={n.color}
        fontFamily="Noto Sans CJK JP"
        style={{
          fontKerning: "none",
          fontVariantLigatures: "none",
          fontFeatureSettings:
            '"frac" 0, "numr" 0, "dnom" 0, "calt" 0, "locl" 0',
        }}
      >
        {n.text}
      </text>
    );
  else {
    const a = resolveAsset(project, n.assetId);
    if (!a)
      content = (
        <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="#ffcccc" />
      );
    else {
      const b = fit(n, a.width, a.height);
      content = (
        <image
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          href={a.preview || a.data}
          preserveAspectRatio="xMidYMid meet"
        />
      );
    }
  }
  const origin = n.transformOrigin || { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  return (
    <g
      opacity={n.opacity ?? 1}
      transform={
        n.rotation ? `rotate(${n.rotation} ${origin.x} ${origin.y})` : undefined
      }
    >
      {content}
    </g>
  );
}
export function Preview({
  page,
  project,
  thumb = false,
  bounds,
  onEdit,
  onEditMany,
  onAsset,
  onSelectSource,
  onNumber,
  onInput,
}: {
  page: LayoutPage;
  project: Project;
  thumb?: boolean;
  bounds?: [number, number, number, number];
  onEdit?: (s: DataSource, value: string) => void;
  onEditMany?: (changes: { source: DataSource; value: string }[]) => void;
  onAsset?: (s: DataSource, file: File) => Promise<void>;
  onSelectSource?: (s: DataSource) => void;
  onNumber?: () => void;
  onInput?: (t: InputTarget) => void;
}) {
  const [active, setActive] = useState<Node | null>(null);
  return (
    <svg
      className={thumb ? "page-svg thumbnail" : "page-svg"}
      viewBox={bounds?.join(" ") ?? "0 0 148 210"}
      role="img"
      aria-label={
        thumb
          ? `${page.title}のデザイン見本`
          : `${page.title} PDF ${page.physical}ページ`
      }
    >
      <rect x="0" y="0" width="148" height="210" fill="white" />
      {page.nodes
        .filter((node) => !node.editorOnly || (!!onInput && !thumb))
        .map((node, i) => (
          <NodeView key={node.id || i} node={node} project={project} />
        ))}
      {onEdit &&
        !thumb &&
        page.nodes
          .filter((n) => n.source)
          .map((n, i) => (
            <rect
              className="direct-hit"
              key={"edit" + i}
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={
                "編集 " +
                (n.source!.field === "websiteUrl"
                  ? "大学ウェブサイトのURL"
                  : n.source!.field === "surveyUrl"
                    ? "アンケートのURL"
                    : n.kind === "text"
                      ? n.text
                      : n.source!.field)
              }
              onClick={(e) => {
                e.stopPropagation();
                onSelectSource?.(n.source!);
                if (n.source!.type === "pageNumber") {
                  if (onInput)
                    onInput({
                      blockId: page.blockId,
                      source: n.source!,
                      componentKind: n.componentKind,
                      objectId: n.objectId,
                    });
                  else onNumber?.();
                } else if (onInput)
                  onInput({
                    blockId: page.blockId,
                    source: n.source!,
                    componentKind: n.componentKind,
                    objectId: n.objectId,
                  });
                else setActive(n);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (n.source!.type === "pageNumber") {
                    if (onInput)
                      onInput({
                        blockId: page.blockId,
                        source: n.source!,
                        componentKind: n.componentKind,
                        objectId: n.objectId,
                      });
                    else onNumber?.();
                  } else if (onInput)
                    onInput({
                      blockId: page.blockId,
                      source: n.source!,
                      componentKind: n.componentKind,
                      objectId: n.objectId,
                    });
                  else setActive(n);
                }
              }}
            />
          ))}
      {!thumb &&
        onInput &&
        inputGuides(project, page).map((g, i) => (
          <g
            key={"guide" + i}
            role="button"
            tabIndex={0}
            aria-label={g.label}
            className="input-guide"
            onClick={(e) => {
              e.stopPropagation();
              onInput(g.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onInput(g.target);
            }}
          >
            <rect
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              fill="#f5f5f5"
              fillOpacity=".9"
              stroke="#777"
              strokeDasharray="1 1"
            />
            <text
              x={g.x + g.w / 2}
              y={g.y + g.h / 2 + 1}
              fontSize="3"
              textAnchor="middle"
              fill="#555"
            >
              {g.label}
            </text>
          </g>
        ))}
      {active && onEdit && (
        <foreignObject
          x={Math.max(3, Math.min(75, active.x))}
          y={Math.max(3, Math.min(135, active.y))}
          width={70}
          height={75}
        >
          <DirectEditor
            key={page.id + JSON.stringify(active.source)}
            project={project}
            source={active.source!}
            onEdit={onEdit}
            onEditMany={onEditMany}
            onAsset={onAsset}
            onClose={() => setActive(null)}
          />
        </foreignObject>
      )}
    </svg>
  );
}
