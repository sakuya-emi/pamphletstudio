# 実装構造

| 層 | 場所 | 責務 |
| --- | --- | --- |
| 登録データ | packages/core/model.ts | Project / Chapter / Event / Sponsor / Ad / Asset / Block / Theme |
| テンプレート | packages/templates | 表紙・目次・企画表・ポスター・広告の配置 |
| 組版 | packages/layout-engine | mm座標の描画リスト、ページ生成、順序、ノンブル、目次、インデックス、事前検証 |
| 出力 | packages/pdf-export | pdf-lib描画、フォント埋込、元PDF直接埋込、専用Worker |
| 保存 | packages/project-storage | ProjectStorage、ZIP、IndexedDB、外部ファイルの読込・ダウンロード |
| UI | apps/web/src | React、SVG描画、素材プレビュー、編集履歴 |

表示用SVGとPDFは同一のLayoutPage / Node配列を読み、改ページを別々に計算しません。テキストはfontkitで測定し、同じNotoフォントで描画します。プレビューのPDF画像はPDF.jsのサムネイルですが、出力ではAsset.dataのPDF原本を埋め込みます。WebPは出力互換性のためPNG派生画像を保持し、原本は保存します。SVGも原本と派生ベクターPDFを保持します。

ページIDはBlockのID＋生成ページ番号です。手動ページ順はpageOrderに保存し、レコードIDとは分離します。新しく発生した続きページは同じBlockのページに追従します。物理ページ順を確定してから左右・ノンブルを計算し、最後に目次の参照を解決します。目次のページ数は章数から先に確定するため、目次改ページによる相互依存はありません。

広告は明示割当を先に予約し、自動割当が重複利用しないよう消費済みIDを追跡します。別規格や重複の手動割当はエラーになります。寸法は共通幅125mmと各区分の独立した高さ180／85／45mmから計算し、素材の縦横比が違う場合は枠内で余白を付け、警告します。

.pamphのproject.jsonが復元の基準です。schemaVersion 2で追加した仕様として独立した広告高さと縦長ポスター比率を持ち、version 1からの移行処理を用意しています。theme.json / events.jsonは保守のための副本です。assets以下に原本を格納し、サムネイル・SVG派生PDF・表示設定はマニフェストに保存します。保存先OSの外部パスには依存しません。欠損素材は警告と参照切れチェックを残して、他データを読み込みます。破損JSON・未知のスキーマ・不正寸法は拒否します。

ネイティブ版ではProjectStorage実装をTauri FSへ差し替えます。CMYK変換やPDF/X検証は標準PDF出力後の独立工程として追加する想定です。印刷会社のICCとPDF/X条件が未指定のため、現時点で印刷適合を保証する出力モードは設けていません。


## デザイナー拡張：schemaVersion 3

packages/designer が編集モデル・幾何処理・データ流し込みを担います。Block.templateIdでProject.templatesを参照する場合に、固定モジュールの代わりに共通Nodeへコンパイルします。Nodeは識別子、線幅、パス、回転と原点、透明度、グループ、レイヤー情報を保持します。Preview.NodeViewとPDF描画が同じ結果を利用します。

schemaVersion 1/2から3への移行を実装し、旧ブロックはそのまま保持します。templates、masterId、素材参照は.pamph内に保存します。自由配置の一段マスターと、一つの繰り返し領域（表・ポスター・時間割）を組み合わせます。テンプレートの編集UIと入出力はDesigner.tsxに置き、Rust/WASMへの依存はありません。

詳細は「デザイナーモード_実装と引き継ぎ.md」を参照してください。


## UI/UXの再構成

編集表示はapps/web/src/editorのShell/MenuBar/ToolBar/LayerPanel/PagePanel/TemplatePanel/Canvas/PropertiesPanel/StatusBarと作成ダイアログに分離しました。commands.tsはプリセットと削除・順序操作、Designer.tsxは履歴と操作セッションの調整です。PDF・保存・登録データの境界は維持します。文字行間と揃えはschema3の省略可能フィールドで、旧データの既定値を補完します。詳細はUIUX改善_実装と操作ガイド.mdを参照してください。
