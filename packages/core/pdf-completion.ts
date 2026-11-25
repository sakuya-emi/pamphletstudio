export function pdfCompletion(
  revision: number | string,
  generatedRevision: number | string | null,
  hasErrors: boolean,
  requiredChecksDone: boolean,
) {
  if (generatedRevision !== null && generatedRevision !== revision)
    return "出力後に変更あり";
  if (hasErrors || !requiredChecksDone) return "確認が必要";
  return generatedRevision === revision ? "PDF生成済み" : "PDF出力可能";
}
