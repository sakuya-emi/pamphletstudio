/** Portable normalized SVG paths, deliberately limited to absolute M/L/Q/C/Z. */
export function tabPath(
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
  mirror = false,
): string {
  const tokens = path.match(/[MLQCZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
  if (
    !tokens.length ||
    path.replace(/[MLQCZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?|[\s,]/gi, "")
  )
    throw new Error("パスは絶対座標の M/L/Q/C/Z で指定してください。");
  let i = 0,
    out: string[] = [];
  while (i < tokens.length) {
    const command = tokens[i++];
    if (!/^[MLQCZ]$/.test(command)) throw new Error("パスの命令が不正です。");
    const count = ({ M: 2, L: 2, Q: 4, C: 6, Z: 0 } as Record<string, number>)[
      command
    ];
    const values = tokens.slice(i, i + count).map(Number);
    if (
      values.length !== count ||
      values.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
    )
      throw new Error("パス座標は0〜1で指定してください。");
    i += count;
    out.push(
      command,
      ...values.map((v, j) =>
        String(j % 2 ? y + v * h : x + (mirror ? 1 - v : v) * w),
      ),
    );
  }
  return out.join(" ");
}
