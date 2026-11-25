# 禁煙・禁酒マークの標準画像と共通素材庫

- 禁煙・禁酒ページは、添付の透過PNGをそれぞれ標準表示する。画像の縦横比を維持し、プレビューとPDFで同じ画像を参照する。旧冊子で従来のイラストや文字マークを明示指定している場合は維持する。
- 詳細編集で禁煙・禁酒のページを開き、右のページ設定にある「禁煙・禁酒マーク」から、自作画像を種類別に登録・選択できる。PNG、JPEG、WebP、SVG、PDFの取り込みには既存の画像処理を使用する。
- 自作マークは同じブラウザ・同じサイトの共通素材庫に保存する。選択した画像は冊子にも内包するので、プロジェクトの保存・再読込や次年度版への引き継ぎに対応する。
- ブラウザの保存領域は、サイトデータ消去や端末移行で失われる場合がある。「素材庫を書き出す」でバックアップし、「素材庫を読み込む」で復元できる。プロジェクトの削除は共通素材庫に影響しない。

## 変更ファイル

- packages/core/rule-marks.ts — 添付の標準PNGと素材参照
- packages/templates/opening.ts — 標準・自作・従来マークの切り替え
- packages/layout-engine/index.ts — 標準マークの素材チェック
- packages/pdf-export/index.ts — 標準マークのPDF埋め込み
- packages/project-storage/rule-mark-library.ts — 共通素材庫の保存・読込
- apps/web/src/Preview.tsx — 標準マークのプレビュー表示
- apps/web/src/workspace/RuleMarkControl.tsx — 登録、選択、書き出し、復元
- apps/web/src/App.tsx — ページ設定への接続
- tests/rule-marks.test.ts — 既定の配置、旧設定、保存と年度更新の回帰テスト
- tests/festival-opening.test.ts — PDF内のマーク埋め込みの回帰テスト
- docs/rule-marks-2026-11-12.md — 操作・検証記録

## 検証

TypeScriptの型チェックを含む本番ビルドと、22ファイル・194件の自動テストが成功。新規冊子での標準配置、従来設定の維持、自作マークを含む冊子の保存・再読込と年度更新、PDFへの標準画像2枚の埋め込みを検証した。ブラウザ上の素材庫操作は実機未確認。
