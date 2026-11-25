import { useRef } from "react";
import { addMenu, menus } from "../../../../packages/core/registration";
import type { Project } from "../../../../packages/core/model";
export function KitchenMenus({
  project,
  eventId,
  update,
}: {
  project: Project;
  eventId: string;
  update: (fn: (q: Project) => void) => void;
}) {
  const list = menus(project, eventId);
  const firstInput = useRef<HTMLInputElement>(null);
  const change = (id: string, name: string) =>
    update((q) => {
      q.kitchenMenus!.find((m) => m.id === id)!.name = name;
    });
  return (
    <div className="kitchen-menus">
      {list.length ? (
        list.map((m, i) => (
          <div key={m.id}>
            <input
              key={m.name}
              aria-label={"メニュー " + (i + 1)}
              defaultValue={m.name}
              onBlur={(e) => {
                if (e.target.value !== m.name) change(m.id, e.target.value);
              }}
            />
            <button
              aria-label={"メニューを上へ " + (i + 1)}
              disabled={!i}
              onClick={() =>
                update((q) => {
                  const a = q.kitchenMenus!.find((n) => n.id === m.id)!,
                    b = q.kitchenMenus!.find((n) => n.id === list[i - 1].id)!;
                  [a.order, b.order] = [b.order, a.order];
                })
              }
            >
              ↑
            </button>
            <button
              aria-label={"メニューを下へ " + (i + 1)}
              disabled={i === list.length - 1}
              onClick={() =>
                update((q) => {
                  const a = q.kitchenMenus!.find((n) => n.id === m.id)!,
                    b = q.kitchenMenus!.find((n) => n.id === list[i + 1].id)!;
                  [a.order, b.order] = [b.order, a.order];
                })
              }
            >
              ↓
            </button>
            <button
              aria-label={"メニューを削除 " + (i + 1)}
              onClick={() =>
                update((q) => {
                  q.kitchenMenus = q.kitchenMenus?.filter((n) => n.id !== m.id);
                })
              }
            >
              ×
            </button>
          </div>
        ))
      ) : (
        <input
          ref={firstInput}
          aria-label="メニュー 1"
          placeholder="メインメニュー"
          onBlur={(e) => {
            if (e.target.value)
              update((q) => {
                addMenu(q, eventId, e.target.value);
              });
          }}
        />
      )}
      <button
        onPointerDown={(e) => {
          if (!list.length) e.preventDefault();
        }}
        onClick={() =>
          update((q) => {
            if (!list.length && firstInput.current?.value)
              addMenu(q, eventId, firstInput.current.value);
            addMenu(q, eventId);
          })
        }
      >
        ＋ メニューを追加
      </button>
    </div>
  );
}
