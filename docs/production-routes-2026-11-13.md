# 制作の入口・デザイン選択（2026-11-13）

以前はホームに冊子操作とデザイナー入口が並び、デザイン候補を選ぶと共通テンプレートは別ダイアログに移り、一部の標準デザインと配色は即時適用されていた。

- ホームの入口を「テンプレートを作る」「パンフレットを作る」の2つに変更。冊子の新規作成・再開・読込・見本は冊子ルートにまとめた。
- 冊子作成後は「デザイン」「掲載情報」「誌面を確認・編集」「最終確認・PDF出力」の順。開催情報は掲載情報の中で編集する。最終確認から従来の校正用RGB PDFを直接生成する。
- 候補のクリックはプレビュー専用。「現在使用中」と「プレビュー中・未適用」を区別し、対象と範囲を確認してから適用する。キャンセル・画面移動では未適用の候補を破棄する。確定後は既存の取り消し履歴で戻せる。ページマスターはマスターを使用できるカスタムページが対象。
- 共通テンプレート制作には対象名と保存状態を表示。従来の下書き自動保存・公開版・冊子への明示適用を維持。保存形式、組版エンジン、PDF出力エンジン、作図ツールは変更していない。

## 検証

ローカルブラウザで、ホーム2択、キーボードからのテンプレート制作開始、白紙の表の共通保存と再開、見本冊子でのプレビュー・キャンセル・確定・取り消し、最終確認からのPDF生成、新規冊子の開催情報の前後移動と保存、ブラウザ再読み込み後の既存冊子の再開を確認。掲載データを維持する回帰テストを追加し、全199件が成功。TypeScript型チェックを含む本番ビルドも成功した。スマートフォン実機、Excelファイルを取り込むところからのブラウザ通し確認、全種類の適用操作、公開サーバー上での表示は未確認。ファイル削除なし。

## 変更ファイル

- apps/web/src/App.tsx
- apps/web/src/StartRoutes.tsx
- apps/web/src/ProjectHome.tsx
- apps/web/src/SharedDesigner.tsx
- apps/web/src/Designer.tsx
- apps/web/src/style.css
- apps/web/src/editor/ComponentApplyDialog.tsx
- apps/web/src/workspace/ComponentChoices.tsx
- apps/web/src/workspace/design-selection.ts
- apps/web/src/workspace/LibraryPageDialog.tsx
- apps/web/src/workspace/DataWorkspace.tsx
- apps/web/src/workspace/PaletteControl.tsx
- tests/design-selection.test.ts
- docs/production-routes-2026-11-13.md
