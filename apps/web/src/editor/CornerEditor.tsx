import {
  corners,
  type CornerRadius,
} from "../../../../packages/designer/corners";
export function CornerEditor({
  value,
  linked,
  onChange,
  onLink,
}: {
  value: number | CornerRadius;
  linked: boolean;
  onChange: (v: CornerRadius) => void;
  onLink: (v: boolean) => void;
}) {
  const r = corners(value);
  return (
    <fieldset className="corner-editor">
      <legend>四隅の角丸（mm）</legend>
      <label className="check">
        <input
          type="checkbox"
          checked={linked}
          onChange={(e) => {
            onLink(e.target.checked);
            if (e.target.checked) onChange(corners(r.topLeft));
          }}
        />
        角丸を連動
      </label>
      <div className="corner-grid">
        {(["topLeft", "topRight", "bottomLeft", "bottomRight"] as const).map(
          (key) => (
            <label key={key}>
              <span>
                {
                  {
                    topLeft: "⌜ 左上",
                    topRight: "⌝ 右上",
                    bottomLeft: "⌞ 左下",
                    bottomRight: "⌟ 右下",
                  }[key]
                }
              </span>
              <input
                type="number"
                aria-label={
                  "角丸" +
                  {
                    topLeft: "左上",
                    topRight: "右上",
                    bottomLeft: "左下",
                    bottomRight: "右下",
                  }[key]
                }
                min="0"
                max="500"
                step=".5"
                value={r[key]}
                onChange={(e) =>
                  onChange(
                    linked
                      ? corners(Math.max(0, +e.target.value))
                      : { ...r, [key]: Math.max(0, +e.target.value) },
                  )
                }
              />
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
