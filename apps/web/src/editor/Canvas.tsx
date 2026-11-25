import { pathData } from "../../../../packages/designer/geometry";
import {
  penGeometry,
  type PenPoint,
} from "../../../../packages/designer/path-tools";
import { object } from "../../../../packages/designer/model";
import type { TableTarget } from "../../../../packages/designer/table-model";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type PointerEventHandler,
} from "react";
import type {
  DesignTemplate,
  DesignObject,
} from "../../../../packages/designer/model";
import type { Project } from "../../../../packages/core/model";
import type { Node, Box } from "../../../../packages/layout-engine";
import { NodeView } from "../Preview";
import type { Tool } from "./ToolBar";
type TextEdit = { id: string; value: string } | null;
type Props = {
  editingComponentId: string | null;
  tableTarget: TableTarget | null;
  onTableTarget: (t: TableTarget) => void;
  onEnterComponent: (id: string) => void;
  isolatedGroup?: string | null;
  onIsolateGroup?: (id: string) => void;
  backdrop?: Node[];
  space: RefObject<boolean>;
  svg: RefObject<SVGSVGElement | null>;
  tool: Tool;
  zoom: number;
  down: PointerEventHandler<SVGSVGElement>;
  move: PointerEventHandler<SVGSVGElement>;
  up: () => void;
  onCancel: () => void;
  setContext: (v: { x: number; y: number } | null) => void;
  setSelection: (ids: string[]) => void;
  setZoom: Dispatch<SetStateAction<number>>;
  finishPen: () => void;
  t: DesignTemplate;
  setPanel: (v: "layers" | "pages" | "templates") => void;
  setTextEditing: Dispatch<SetStateAction<TextEdit>>;
  setMessage: (v: string) => void;
  scene: Node[];
  project: Project;
  showGrid: boolean;
  showGuides: boolean;
  showRulers: boolean;
  selection: string[];
  selectedBox: Box | null;
  first?: DesignObject;
  pen: PenPoint[];
  rubber: Box | null;
  textEditing: TextEdit;
  saveText: () => void;
};
export function Canvas({
  editingComponentId,
  tableTarget,
  onTableTarget,
  onEnterComponent,
  onIsolateGroup,
  isolatedGroup,
  backdrop,
  space,
  svg,
  tool,
  zoom,
  down,
  move,
  up,
  onCancel,
  setContext,
  setSelection,
  setZoom,
  finishPen,
  t,
  setPanel,
  setTextEditing,
  setMessage,
  scene,
  project,
  showGrid,
  showGuides,
  showRulers,
  selection,
  selectedBox,
  first,
  pen,
  rubber,
  textEditing,
  saveText,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null),
    pan = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
  const zoomAnchor = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  useLayoutEffect(() => {
    const a = zoomAnchor.current,
      el = wrap.current,
      art = svg.current;
    if (a && el && art) {
      const r = art.getBoundingClientRect();
      el.scrollLeft += r.left + a.x * r.width - a.clientX;
      el.scrollTop += r.top + a.y * r.height - a.clientY;
      zoomAnchor.current = null;
    }
  }, [zoom]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = svg.current?.getBoundingClientRect();
        if (r)
          zoomAnchor.current = {
            x: (e.clientX - r.left) / r.width,
            y: (e.clientY - r.top) / r.height,
            clientX: e.clientX,
            clientY: e.clientY,
          };
        setZoom((z) =>
          Math.max(0.1, Math.min(16, z * Math.exp(-e.deltaY * 0.004))),
        );
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [setZoom]);
  return (
    <div
      ref={wrap}
      className="designer-artboard-wrap"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        (e.currentTarget.closest(".designer-root") as HTMLElement)?.focus({
          preventScroll: true,
        });
        if (tool === "hand" || space.current) {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pan.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
          };
        } else setSelection([]);
      }}
      onPointerMove={(e) => {
        if (pan.current) {
          e.currentTarget.scrollLeft =
            pan.current.left + pan.current.x - e.clientX;
          e.currentTarget.scrollTop =
            pan.current.top + pan.current.y - e.clientY;
        }
      }}
      onPointerUp={() => {
        pan.current = null;
      }}
      onPointerCancel={() => {
        pan.current = null;
      }}
    >
      <svg
        ref={svg}
        className={`designer-artboard tool-${tool}`}
        viewBox="-24 -24 196 258"
        style={{
          width: ((440 * 196) / 148) * zoom,
          background: "transparent",
          boxShadow: "none",
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={onCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          const hit = (e.target as Element).closest("[data-object]");
          if (hit) setSelection([hit.getAttribute("data-object")!]);
          setContext({ x: e.clientX, y: e.clientY });
        }}
        onDoubleClick={(e) => {
          if (tool === "pen") {
            finishPen();
            return;
          }
          const hit = (e.target as Element).closest("[data-object]");
          const point = e.currentTarget.createSVGPoint();
          point.x = e.clientX;
          point.y = e.clientY;
          const local = point.matrixTransform(
            e.currentTarget.getScreenCTM()!.inverse(),
          );
          const o =
            t.objects.find((o) => o.id === hit?.getAttribute("data-object")) ||
            [...t.objects]
              .reverse()
              .find(
                (o) =>
                  local.x >= o.x &&
                  local.x <= o.x + o.w &&
                  local.y >= o.y &&
                  local.y <= o.y + o.h &&
                  o.visible !== false &&
                  t.layers.find((l) => l.id === o.layerId)?.visible,
              );

          if (!o || o.locked) return;
          if (o.groupId && o.groupId !== isolatedGroup && tool === "select") {
            onIsolateGroup?.(o.groupId);
            setSelection([o.id]);
            return;
          }
          if (["table", "index"].includes(o.kind)) {
            onEnterComponent(o.id);
            return;
          }
          setSelection([o.id]);
          setPanel("layers");
          if (o.kind === "text" && o.binding === "none" && !o.repeatRole)
            setTextEditing({ id: o.id, value: o.text });
          else if (o.groupId)
            setMessage(
              "グループ内のオブジェクトを個別選択しました。Escで選択解除。",
            );
        }}
        role="application"
        aria-label="A5デザインアートボード"
      >
        <defs>
          <pattern
            id="designer-grid"
            width={t.grid}
            height={t.grid}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${t.grid} 0 L 0 0 0 ${t.grid}`}
              fill="none"
              stroke="#858b9430"
              strokeWidth=".08"
            />
          </pattern>
        </defs>
        <rect
          width={148}
          height={210}
          fill="#ffffff"
          stroke="#888888"
          strokeWidth={0.2}
          pointerEvents="none"
        />
        {backdrop && (
          <g opacity={0.22} pointerEvents="none">
            {backdrop.map((n, i) => (
              <NodeView key={i} node={n} project={project} />
            ))}
          </g>
        )}
        {scene.map((n, i) => (
          <NodeView key={i} node={n} project={project} />
        ))}
        {showGrid && (
          <rect
            width="148"
            height="210"
            fill="url(#designer-grid)"
            pointerEvents="none"
          />
        )}
        {showGuides &&
          t.guidesX.map((x, i) => (
            <line
              key={`x${i}`}
              x1={x}
              x2={x}
              y1={0}
              y2={210}
              stroke="#858b94"
              strokeWidth=".12"
              strokeDasharray="1 1"
              pointerEvents="none"
            />
          ))}
        {showGuides &&
          t.guidesY.map((y, i) => (
            <line
              key={`y${i}`}
              x1={0}
              x2={148}
              y1={y}
              y2={y}
              stroke="#858b94"
              strokeWidth=".12"
              strokeDasharray="1 1"
              pointerEvents="none"
            />
          ))}
        {t.objects
          .filter(
            (o) =>
              o.visible !== false &&
              t.layers.find((l) => l.id === o.layerId)?.visible,
          )
          .map((o) => (
            <rect
              data-object={o.id}
              key={o.id}
              x={o.x}
              y={o.y}
              width={o.w}
              height={o.h}
              fill="transparent"
              stroke={selection.includes(o.id) ? "#575c64" : "none"}
              strokeWidth=".3"
              transform={
                o.rotation
                  ? `rotate(${o.rotation} ${o.x + o.w / 2} ${o.y + o.h / 2})`
                  : undefined
              }
              style={{
                pointerEvents:
                  o.id === editingComponentId
                    ? "none"
                    : o.locked ||
                        t.layers.find((l) => l.id === o.layerId)?.locked
                      ? "none"
                      : "all",
              }}
            />
          ))}
        {editingComponentId &&
          scene
            .filter(
              (n) =>
                n.objectId === editingComponentId &&
                n.tablePart &&
                n.kind !== "text",
            )
            .map((n, i) => (
              <rect
                key={"part" + i}
                data-table-part={JSON.stringify(n.tablePart)}
                x={n.x}
                y={n.y}
                width={Math.max(0.5, n.w)}
                height={Math.max(0.8, n.h)}
                fill="transparent"
                stroke={
                  tableTarget?.rowId === n.tablePart?.rowId &&
                  tableTarget?.column === n.tablePart?.column &&
                  tableTarget?.groupKey === n.tablePart?.groupKey
                    ? "#575c64"
                    : "none"
                }
                strokeWidth=".35"
              />
            ))}
        {editingComponentId &&
          first?.kind === "table" &&
          first.columns &&
          (() => {
            const s = first.tableStyle,
              cols = first.columns,
              sum = cols.reduce((a, c) => a + c.weight, 0),
              left = s?.variant === "cards" ? s.groupLabelWidth + 3 : 0,
              gap = s?.columnGap || 0,
              width =
                first.w -
                left -
                gap * (cols.length - 1) -
                (s?.variant === "cards" ? 6 : 0);
            let x = first.x + left;
            return cols.slice(0, -1).map((c, i) => {
              x += (width * c.weight) / sum;
              const line = (
                <g
                  key={"col" + i}
                  data-column-handle={i}
                  style={{ cursor: "col-resize" }}
                >
                  <line
                    x1={x + gap / 2}
                    x2={x + gap / 2}
                    y1={first.y}
                    y2={first.y + first.h}
                    stroke="transparent"
                    strokeWidth="3"
                    pointerEvents="stroke"
                  />
                  <line
                    pointerEvents="none"
                    x1={x + gap / 2}
                    x2={x + gap / 2}
                    y1={first.y}
                    y2={first.y + first.h}
                    stroke="#575c64"
                    strokeWidth=".7"
                    strokeDasharray="1 1"
                    style={{ cursor: "col-resize" }}
                  />
                </g>
              );
              x += gap;
              return line;
            });
          })()}
        {selectedBox && (
          <>
            <rect
              x={selectedBox.x}
              y={selectedBox.y}
              width={selectedBox.w}
              height={selectedBox.h}
              fill="none"
              stroke="#575c64"
              strokeWidth=".15"
              pointerEvents="none"
            />
            <rect
              data-handle="resize"
              x={selectedBox.x + selectedBox.w - 1}
              y={selectedBox.y + selectedBox.h - 1}
              width="2"
              height="2"
              fill="white"
              stroke="#575c64"
              strokeWidth=".3"
            />
            <line
              x1={selectedBox.x + selectedBox.w / 2}
              x2={selectedBox.x + selectedBox.w / 2}
              y1={selectedBox.y}
              y2={selectedBox.y - 5}
              stroke="#575c64"
              strokeWidth=".2"
            />
            <circle
              data-handle="rotate"
              cx={selectedBox.x + selectedBox.w / 2}
              cy={selectedBox.y - 5}
              r="1.2"
              fill="white"
              stroke="#575c64"
              strokeWidth=".3"
            />
          </>
        )}
        {tool === "anchor" &&
          first?.anchors?.map((a, i) => (
            <g
              key={i}
              transform={`rotate(${first.rotation} ${first.x + first.w / 2} ${first.y + first.h / 2})`}
            >
              {(["in", "out"] as const).map(
                (h) =>
                  a[h] && (
                    <g key={h}>
                      <line
                        x1={first.x + a.x * first.w}
                        y1={first.y + a.y * first.h}
                        x2={first.x + a[h]!.x * first.w}
                        y2={first.y + a[h]!.y * first.h}
                        stroke="#858b94"
                        strokeWidth=".2"
                      />
                      <circle
                        data-anchor={i}
                        data-control={h}
                        cx={first.x + a[h]!.x * first.w}
                        cy={first.y + a[h]!.y * first.h}
                        r="1"
                        fill="#e1e7ef"
                        stroke="#858b94"
                        strokeWidth=".2"
                      />
                    </g>
                  ),
              )}
              <circle
                data-anchor={i}
                cx={first.x + a.x * first.w}
                cy={first.y + a.y * first.h}
                r="1.2"
                fill="white"
                stroke="#575c64"
                strokeWidth=".3"
              />
            </g>
          ))}
        {pen.length > 0 && (
          <>
            <path
              d={pathData({
                ...object("path", "preview"),
                ...penGeometry(pen),
              })}
              fill="none"
              stroke="#575c64"
              strokeWidth=".3"
            />
            {pen.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1" fill="#575c64" />
            ))}
          </>
        )}
        {rubber && (
          <rect
            {...rubber}
            width={rubber.w}
            height={rubber.h}
            fill="#ffffff18"
            stroke="#575c64"
            strokeWidth=".2"
          />
        )}
        {showRulers && (
          <g pointerEvents="none" aria-label="mmルーラー">
            {Array.from({ length: 15 }, (_, i) => (
              <g key={i}>
                <line
                  x1={i * 10}
                  x2={i * 10}
                  y1={-3}
                  y2={-1}
                  stroke="#9aa6b5"
                  strokeWidth=".2"
                />
                <text x={i * 10 + 0.5} y={-3} fontSize="2.3" fill="#9aa6b5">
                  {i * 10}
                </text>
              </g>
            ))}
            {Array.from({ length: 22 }, (_, i) => (
              <g key={i}>
                <line
                  y1={i * 10}
                  y2={i * 10}
                  x1={-3}
                  x2={-1}
                  stroke="#9aa6b5"
                  strokeWidth=".2"
                />
                <text
                  x={-4}
                  y={i * 10}
                  textAnchor="end"
                  fontSize="2.3"
                  fill="#9aa6b5"
                >
                  {i * 10}
                </text>
              </g>
            ))}
          </g>
        )}
        {textEditing &&
          (() => {
            const o = t.objects.find((o) => o.id === textEditing.id);
            return (
              o && (
                <foreignObject
                  x={o.x}
                  y={o.y}
                  width={o.w}
                  height={Math.max(20, o.h)}
                >
                  <textarea
                    className="canvas-text-editor"
                    aria-label="キャンバスで文字を入力"
                    autoFocus
                    style={{
                      fontSize: o.size,
                      fontWeight: o.bold ? 700 : 500,
                      color: o.fill,
                    }}
                    value={textEditing.value}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setTextEditing({
                        ...textEditing,
                        value: e.target.value,
                      })
                    }
                    onBlur={saveText}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setTextEditing(null);
                      }
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        saveText();
                      }
                    }}
                  />
                </foreignObject>
              )
            );
          })()}
      </svg>
    </div>
  );
}
