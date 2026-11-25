import type { KeyboardEvent } from "react";
export function CommitField({
  value,
  onCommit,
  label,
  type = "text",
  rows,
}: {
  value: string;
  onCommit: (value: string) => void;
  label?: string;
  type?: string;
  rows?: number;
}) {
  const key = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (
      e.key !== "Enter" ||
      e.nativeEvent.isComposing ||
      e.keyCode === 229 ||
      (rows && e.shiftKey)
    )
      return;
    e.preventDefault();
    e.currentTarget.blur();
  };
  const props = {
    defaultValue: value,
    "aria-label": label,
    onKeyDown: key,
    onBlur: (e: { currentTarget: { value: string } }) => {
      if (e.currentTarget.value !== value) onCommit(e.currentTarget.value);
    },
  };
  return rows ? (
    <textarea key={value} rows={rows} {...props} />
  ) : (
    <input key={value} type={type} {...props} />
  );
}
