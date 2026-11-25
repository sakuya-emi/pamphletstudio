import { useMemo, useState } from "react";
import type { Project } from "../../../../packages/core/model";
import type { DesignTemplate } from "../../../../packages/designer/model";
import { renderTemplate } from "../../../../packages/designer/render";
import type { Measure } from "../../../../packages/layout-engine";
import { Preview } from "../Preview";
import { category } from "./TemplatePanel";
import {
  copyStarter,
  designKinds,
  starter,
  type DesignKind,
} from "./shared-start";

const normalized = (t: DesignTemplate) =>
  ({
    ポスター紹介: "ポスター枠",
    広告: "広告枠",
  })[category(t)] ?? category(t);

export function SharedStart({
  project,
  measure,
  onChoose,
  onCancel,
}: {
  project: Project;
  measure: Measure;
  onChoose: (template: DesignTemplate, create: boolean) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<DesignKind | null>(null);
  const examples = useMemo(
    () => designKinds.map(([kind]) => starter(kind)),
    [],
  );
  const drafts = project.templates.filter(
    (t) => t.scope !== "style" && (!kind || normalized(t) === kind),
  );
  function thumbnail(t: DesignTemplate) {
    const nodes =
      renderTemplate(project, t, measure, {
        side: "right",
        title:
          t.category === "見出し" ? "学生企画一覧" : (t.category ?? t.name),
        chapterId: project.chapters[0]?.id,
        number: 12,
        previewAds: true,
        blockId: project.blocks.find((b) => b.body?.trim())?.id,
      })[0] ?? [];
    const o = t.scope === "component" ? t.objects[0] : undefined;
    return (
      <Preview
        project={project}
        page={{
          id: t.id,
          blockId: "",
          chapterId: "",
          title: t.name,
          template: t.kind,
          physical: 1,
          side: "right",
          nodes,
          slots: [],
        }}
        thumb
        bounds={o && [o.x, o.y, o.w, o.h]}
      />
    );
  }
  return (
    <section className="shared-start" aria-label="テンプレートの作成を始める">
      <header>
        {kind && (
          <button onClick={() => setKind(null)}>← 種類を選び直す</button>
        )}
        {onCancel && <button onClick={onCancel}>編集に戻る</button>}
        <h1>{kind ? `${kind}の作り方を選ぶ` : "何をデザインしますか？"}</h1>
        <p>
          {kind
            ? "白紙から始めるか、見た目の近いデザインをコピーして編集します。"
            : "作りたい部品を選んでください。保存したデザインは別の冊子でも使えます。"}
        </p>
      </header>
      {!kind ? (
        <div className="shared-start-grid">
          {designKinds.map(([kind, usage], i) => (
            <button key={kind} onClick={() => setKind(kind)}>
              <div className="shared-start-thumb" aria-hidden="true">
                {thumbnail(examples[i])}
              </div>
              <strong>{kind}</strong>
              <small>{usage}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <button
            className="primary"
            onClick={() => onChoose(starter(kind, true), true)}
          >
            白紙から作成
          </button>
          <h2>既存デザインから作成</h2>
          <div className="shared-start-grid">
            {(drafts.length
              ? drafts
              : examples.filter((t) => t.category === kind)
            ).map((t) => (
              <button key={t.id} onClick={() => onChoose(copyStarter(t), true)}>
                <div className="shared-start-thumb" aria-hidden="true">
                  {thumbnail(t)}
                </div>
                <strong>{t.name}</strong>
                <small>コピーして編集</small>
              </button>
            ))}
          </div>
        </>
      )}
      {!onCancel && (
        <details className="shared-start-drafts">
          <summary>
            作業中のデザインを開く（
            {project.templates.filter((t) => t.scope !== "style").length}件）
          </summary>
          <ul>
            {project.templates
              .filter((t) => t.scope !== "style")
              .map((t) => (
                <li key={t.id}>
                  <button onClick={() => onChoose(t, false)}>{t.name}</button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
