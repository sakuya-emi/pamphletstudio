import { useState } from "react";
import type {
  DesignTemplate,
  DesignObject,
} from "../../../../packages/designer/model";
import { uid } from "../../../../packages/core/model";
import {
  LockKeyhole,
  UnlockKeyhole,
  ArrowUp,
  ArrowDown,
  Layers,
  Square,
  Type,
  Image,
  Group,
} from "lucide-react";
type Props = {
  t: DesignTemplate;
  selection: string[];
  setSelection: (ids: string[]) => void;
  edit: (fn: (q: DesignTemplate) => void) => void;
};
export function LayerPanel({ t, selection, setSelection, edit }: Props) {
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  function select(o: DesignObject, shift = false, individual = false) {
    const ids =
      o.groupId && !individual
        ? t.objects.filter((a) => a.groupId === o.groupId).map((a) => a.id)
        : [o.id];
    setSelection(
      shift
        ? selection.includes(o.id)
          ? selection.filter((id) => !ids.includes(id))
          : [...new Set([...selection, ...ids])]
        : ids,
    );
  }
  function order(id: string, d: number) {
    edit((q) => {
      const i = q.layers.findIndex((l) => l.id === id),
        j = i + d;
      if (j >= 0 && j < q.layers.length)
        [q.layers[i], q.layers[j]] = [q.layers[j], q.layers[i]];
    });
  }
  function row(o: DesignObject, locked: boolean, grouped = false) {
    const Icon = o.kind === "text" ? Type : o.kind === "image" ? Image : Square;
    return (
      <div
        className="layer-item"
        key={o.id}
        draggable={!locked && !o.locked}
        onDragStart={(e) => {
          setDragId(o.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!locked) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!dragId || locked || dragId === o.id) return;
          edit((q) => {
            const from = q.objects.find((x) => x.id === dragId),
              target = q.objects.find((x) => x.id === o.id);
            if (
              !from ||
              !target ||
              from.locked ||
              q.layers.find((l) => l.id === from.layerId)?.locked
            )
              return;
            q.objects = q.objects.filter((x) => x.id !== from.id);
            from.layerId = target.layerId;
            q.objects.splice(
              q.objects.findIndex((x) => x.id === target.id) + 1,
              0,
              from,
            );
          });
          setDragId(null);
        }}
      >
        <button
          className={`layer-object ${selection.includes(o.id) ? "active" : ""}`}
          disabled={locked || o.locked || o.visible === false}
          onClick={(e) => select(o, e.shiftKey, grouped)}
          title="Shiftで複数選択、ドラッグで順序変更"
        >
          <Icon size={13} />
          <span>{o.name}</span>
        </button>
        <button
          aria-label={o.name + "の表示切替"}
          onClick={() => {
            edit((q) => {
              q.objects.find((x) => x.id === o.id)!.visible =
                o.visible === false;
            });
            if (o.visible !== false)
              setSelection(selection.filter((id) => id !== o.id));
          }}
        >
          {o.visible === false ? "非表示" : "表示"}
        </button>
        <button
          aria-label={o.name + "のロック切替"}
          disabled={locked}
          onClick={() =>
            edit((q) => {
              q.objects.find((x) => x.id === o.id)!.locked = !o.locked;
            })
          }
        >
          {o.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}
        </button>
      </div>
    );
  }
  return (
    <section>
      <h3>レイヤーとオブジェクト</h3>
      <input
        aria-label="オブジェクトを検索"
        placeholder="名前で検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {[...t.layers].reverse().map((l) => {
        const objects = t.objects
          .filter(
            (o) =>
              o.layerId === l.id &&
              (!search || o.name.toLowerCase().includes(search.toLowerCase())),
          )
          .reverse();
        const seen = new Set<string>();
        return (
          <div className="designer-layer" key={l.id}>
            <div>
              <input
                aria-label={`${l.name} 表示`}
                type="checkbox"
                checked={l.visible}
                onChange={(e) =>
                  edit((q) => {
                    q.layers.find((a) => a.id === l.id)!.visible =
                      e.target.checked;
                  })
                }
              />
              <input
                aria-label="レイヤー名"
                value={l.name}
                onChange={(e) =>
                  edit((q) => {
                    q.layers.find((a) => a.id === l.id)!.name = e.target.value;
                  })
                }
              />
              <button
                title={l.locked ? "レイヤーのロックを解除" : "レイヤーをロック"}
                aria-label={`${l.name}のロック切替`}
                onClick={() =>
                  edit((q) => {
                    q.layers.find((a) => a.id === l.id)!.locked = !l.locked;
                  })
                }
              >
                {l.locked ? (
                  <LockKeyhole size={14} />
                ) : (
                  <UnlockKeyhole size={14} />
                )}
              </button>
              <button
                aria-label={`${l.name}を前面へ`}
                title="レイヤーを前面へ"
                disabled={t.layers.at(-1)?.id === l.id}
                onClick={() => order(l.id, 1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label={`${l.name}を背面へ`}
                title="レイヤーを背面へ"
                disabled={t.layers[0]?.id === l.id}
                onClick={() => order(l.id, -1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
            {objects.map((o) => {
              if (!o.groupId) return row(o, l.locked);
              if (seen.has(o.groupId)) return null;
              seen.add(o.groupId);
              const children = objects.filter((a) => a.groupId === o.groupId);
              return (
                <details open className="layer-group" key={o.groupId}>
                  <summary>
                    <Group size={13} />
                    <button disabled={l.locked} onClick={() => select(o)}>
                      グループ · {children.length}個
                    </button>
                  </summary>
                  <div>{children.map((a) => row(a, l.locked, true))}</div>
                </details>
              );
            })}
          </div>
        );
      })}
      <button
        onClick={() =>
          edit((q) =>
            q.layers.push({
              id: uid(),
              name: `レイヤー${q.layers.length + 1}`,
              visible: true,
              locked: false,
            }),
          )
        }
      >
        <Layers size={14} /> レイヤーを追加
      </button>
    </section>
  );
}
