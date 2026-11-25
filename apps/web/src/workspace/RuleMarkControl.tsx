import { useEffect, useRef, useState } from "react";
import type { Asset, Block, Project } from "../../../../packages/core/model";
import { createProject } from "../../../../packages/core/model";
import { defaultRuleMark } from "../../../../packages/core/rule-marks";
import {
  addRuleMarks,
  loadRuleMarks,
} from "../../../../packages/project-storage/rule-mark-library";
import { download, webStorage } from "../../../../packages/project-storage";
import { importAsset } from "../assets";

export function RuleMarkControl({
  project,
  block,
  update,
}: {
  project: Project;
  block: Block;
  update: (fn: (p: Project) => void) => void;
}) {
  const [saved, setSaved] = useState<Asset[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const backup = useRef<HTMLInputElement>(null);
  const projectAssets = useRef(project.assets);
  projectAssets.current = project.assets;
  useEffect(() => {
    let active = true;
    const existing = Object.values(projectAssets.current).filter(
      (a) => a.rulePicture,
    );
    void addRuleMarks(existing)
      .then(loadRuleMarks)
      .then((items) => {
        if (active) setSaved(items);
      })
      .catch(() => {
        if (active)
          setMessage(
            "共通素材庫を読み込めません。冊子内のマークは引き続き利用できます。",
          );
      });
    return () => {
      active = false;
    };
  }, [project.id]);
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>禁煙・禁酒マーク</h3>
      {(["smoking", "drinking"] as const).map((kind) => {
        const field = kind === "smoking" ? "smokingPicture" : "drinkingPicture";
        const name = kind === "smoking" ? "禁煙" : "禁酒";
        const choices = [
          ...new Map(
            [...saved, ...Object.values(project.assets)]
              .filter((a) => a.rulePicture === kind)
              .map((a) => [a.id, a]),
          ).values(),
        ];
        const value = block[field] || "default";
        const current =
          choices.find((a) => a.id === value) ?? defaultRuleMark(kind);
        const apply = (id: string, asset?: Asset) =>
          update((p) => {
            const target = p.blocks.find((b) => b.id === block.id);
            if (!target) return;
            if (asset) p.assets[asset.id] = asset;
            target[field] = id;
          });
        return (
          <div key={kind}>
            {!["illustrated", "symbol"].includes(value) &&
              current.mime !== "application/pdf" && (
                <img
                  src={current.preview || current.data}
                  alt={name + "マーク"}
                  width="52"
                  height="52"
                  style={{ objectFit: "contain" }}
                />
              )}
            <label className="field">
              <span>{name}のマーク</span>
              <select
                value={
                  choices.some((a) => a.id === value) ||
                  ["illustrated", "symbol"].includes(value)
                    ? value
                    : "default"
                }
                onChange={(e) =>
                  apply(
                    e.target.value,
                    choices.find((a) => a.id === e.target.value),
                  )
                }
              >
                <option value="default">標準マーク</option>
                {value === "illustrated" && (
                  <option value="illustrated">従来のイラスト</option>
                )}
                {value === "symbol" && (
                  <option value="symbol">従来の文字マーク</option>
                )}
                {choices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="upload small">
              {name}の自作マークを登録
              <input
                hidden
                disabled={busy}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  void perform(async () => {
                    const { asset, warning } = await importAsset(f);
                    const marked = { ...asset, rulePicture: kind };
                    await addRuleMarks([marked]);
                    apply(marked.id, marked);
                    setSaved(await loadRuleMarks());
                    void navigator.storage?.persist?.().catch(() => false);
                    setMessage(
                      "共通素材庫に保存しました。" +
                        (warning ? " " + warning : ""),
                    );
                  });
                }}
              />
            </label>
          </div>
        );
      })}
      <p className="hint">
        登録したマークはこのブラウザの他の冊子でも使えます。ブラウザのデータ削除に備え、素材庫を書き出せます。
      </p>
      <button
        disabled={busy || !saved.length}
        onClick={() =>
          void perform(async () => {
            const p = createProject();
            p.name = "禁煙・禁酒マーク素材庫";
            p.assets = Object.fromEntries(
              (await loadRuleMarks()).map((a) => [a.id, a]),
            );
            download(await webStorage.save(p), "禁煙・禁酒マーク素材庫.pamph");
          })
        }
      >
        素材庫を書き出す
      </button>
      <button disabled={busy} onClick={() => backup.current?.click()}>
        素材庫を読み込む
      </button>
      <input
        ref={backup}
        hidden
        type="file"
        accept=".pamph"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void perform(async () => {
            const { project } = await webStorage.load(f);
            const marks = Object.values(project.assets).filter(
              (a) =>
                a.rulePicture === "smoking" || a.rulePicture === "drinking",
            );
            if (!marks.length)
              throw new Error("禁煙・禁酒マークが入っていないファイルです。");
            await addRuleMarks(marks);
            setSaved(await loadRuleMarks());
            setMessage("素材庫を読み込みました。");
          });
        }}
      />
      {message && <p role="status">{message}</p>}
    </section>
  );
}
