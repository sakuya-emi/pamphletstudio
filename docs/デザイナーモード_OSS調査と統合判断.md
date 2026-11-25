# デザイナーモード：OSS調査と統合判断

調査日：2026年11月6日。以下は調査で確認した事実、採用判断、未検証の範囲を分けた記録です。ドキュメントは圧縮せず、このフォルダに通常のMarkdownと取得資料として保存しています。

## 1. 結論

VectorCraftとDesignCraftのコードを、今回のWeb版の実行エンジンとしては組み込んでいません。既存Reactアプリと共通mm座標の描画データを維持し、編集・保存・データ連動は独自TypeScriptで実装しました。これは両OSSが利用できないという判断ではありません。Rust/WASMのUI、座標、ドキュメント、組版、保存、PDFの境界を橋渡しする必要があり、単にReactへコンポーネントとして追加できる構成ではないためです。

将来の再利用候補は、VectorCraftの幾何・パス演算、DesignCraftの文書・組版エンジンです。今回の段階では、既存アプリ全面置換やPDFバックエンドの差し替えを行わず、モデル境界を拡張しました。

## 2. 調査対象と証拠

- VectorCraft： https://github.com/storytold/vectorcraft
- DesignCraft： https://github.com/storytold/designcraft
- 調査時にGitHub APIで記録したmainのコミット：VectorCraft `f3d9970f690fdc1a018980b00fc68863efb3f006`、DesignCraft `8fce28258def76e0079848933dbc31c9665b6767`。

README、LICENSE-MIT、LICENSE-APACHE、NOTICE、ASSETS.md、Cargo.toml、アーキテクチャ、WebアプリのCargo.tomlとmain.rs、再利用候補crateのCargo.tomlとlib.rsを取得しました。取得物は `docs/research/vectorcraft/` と `docs/research/designcraft/` に保存しています。コミットAPIの応答はcommit.jsonです。取得はmainのURLを順次参照したため、全ファイルが単一コミットの完全なスナップショットだと保証するものではありません。各取得ファイルのSHA-256をresearch-manifest.jsonに保存します。将来採用する際には必ずコミットを固定して取得し直してください。

## 3. ライセンスと素材

### コード

両プロジェクトのルートはMIT OR Apache-2.0です。利用側がいずれかを選ぶ構成です。MITでコードをコピー・配布するなら著作権表示と許諾文を保持する必要があります。Apache-2.0を選ぶなら、ライセンス文、該当するNOTICE、改変表示等を適切に引き継ぐ必要があります。ルートのライセンス表示だけで、全依存ライブラリ・素材の条件が同じになるわけではありません。

今回取得したソースと資料のフォルダには、対応するLICENSE-MIT、LICENSE-APACHE、NOTICEを一緒に保存しています。アプリのruntimeへ両OSSのコードをコピーしていないため、アプリをVectorCraft／DesignCraftの派生エンジンとして配布しているわけではありません。

### NOTICEと依存ライブラリ

VectorCraftのNOTICEにはLucide、Source Sans／Serif、Inter、JetBrains Mono、egui既定フォント等の条件が記載されています。Rust依存にはkurbo、peniko、vello_cpu、skrifa、harfrust、usvg、linesweeper、egui、eframe等が挙がっています。WASMプラグイン用のwasmiと、wasmparserのApache-2.0 WITH LLVM-exceptionにも注意が必要です。

DesignCraft側も、フォント・アイコン・組版データ・依存crateの別ライセンスをNOTICEとASSETS.mdで案内しています。Cargo.tomlにはcrates.ioだけでなく、craft-libsやwinit等のGit依存と固定revがあります。上位ライセンスだけを見て、Git依存・推移依存を一括で再配布可能と断定していません。

今回のアプリの実際のJavaScript依存は既存のReact、pdf-lib、fontkit、PDF.js、JSZip、idb-keyval、Lucide、jsPDF、svg2pdf.js等です。デザイナーモードのための追加npm依存はありません。インストール済みパッケージの宣言ライセンスはthird-party-inventory.jsonに保存します。この一覧は申告情報であり、全ファイルの法的監査結果ではありません。

### 画像・フォント・商標

両OSSのASSETS.mdは、各素材の作者・出所・ライセンスを個別に記録しています。ArtCraftの名称・ワードマーク・docs/brand配下のロゴは、コードのMIT／Apacheと別条件です。今回、それらのブランド素材やUIスクリーンショットをアプリの素材として転用していません。

craft-fontsは追加のビルド入力です。READMEでは日本語フォントをこの入力から組み込み、Webにはシステムフォントのフォールバックがないと説明しています。エンジンだけをWASMにしても日本語表示が自動的に解決するとは扱いません。今回のアプリは従来どおり同梱Noto Sans CJK JPを使用し、public/fonts/LICENSE.txtと生成方法の記録を保持しています。Arialは同梱していません。

Adobeの非公開ソース・独自アイコン・独自素材は使用していません。操作体系の参考と、権利のあるコード・素材の複製は別問題として扱っています。

## 4. アーキテクチャ

| 項目 | VectorCraft | DesignCraft |
| --- | --- | --- |
| 言語・構成 | Rust Cargo workspace | Rust Cargo workspace |
| 主な対象 | ベクター図形、アンカー、パス、ツール、複数アートボード | ページ・見開き・親ページ、フレーム、ストーリー、表、組版 |
| UI | ui-eguiを上位crateに分離 | ui-eguiを上位crateに分離 |
| 幾何 | geom。kurboの曲線とAffine、アンカーとin/outハンドル | geom。単位・変形・ヒットテスト等 |
| コア文書 | doc。アートボード・レイヤー・オブジェクト | doc。ページ・親ページ・レイヤー・表・スタイル等 |
| 操作 | toolsが操作をエンジンコマンドへ変換 | tools→engineのコマンド／セッション |
| 組版 | textと関連crate | compose。段落・フレーム・表・CJK等 |
| 出力 | render／svg／pdf等 | render／pdf／idml／epub等 |
| Web入口 | apps/vectorcraft-web | apps/designcraft-web |

VectorCraftのgeom/lib.rsは座標をポイント、上から下向きと説明しています。PathDataにはSubPath、Anchor、絶対位置のin/outハンドルがあり、kurbo::BezPathへ変換します。tools/lib.rsではBegin→Preview→Commitにより、ドラッグ中のプレビューを最後に1回の履歴にする設計が確認できました。

DesignCraftのcompose/lib.rsは、スタイル解決、shaping、行分割、フレーム／段への配置、overset検出を組版の責務にしています。出力座標はフレーム内部空間であり、ページ座標へはフレームの変形を適用する必要があります。パンフレットのEventの配列を渡すだけで同じ表が出るAPIではなく、文書・スタイル・フォント・フレームの変換が必要です。

両プロジェクトのUIより下の層が分離されている点は、エンジン部分を後から採用する上で有利です。一方、現在の.pamphと同じ保存スキーマではありません。

## 5. ブラウザとWASM

READMEとWeb用Cargo.tomlは、eframeのWeb runnerとwgpuを使い、WebGPUからWebGL2へフォールバックする構成を示しています。WebAssembly、Canvas、WebGPUまたはWebGL2などの対応が必要です。ブラウザ別の完全な対応表と最低バージョンは、今回確認した資料からは確定していません。Windows／macOSで必ず同じ動作をするという保証もしていません。

DesignCraftのREADMEはRust 1.95以上、trunk、wasm32-unknown-unknownターゲットを要求しています。ビルドは各apps/*-webでtrunk build --release、成果物は静的サイトとして配信する形です。Open／Placeはブラウザのファイル選択、Save／Exportはダウンロードになります。ネイティブ版のTCP制御チャネルはWeb版では利用できません。ローカルサーバーやHTTPSなど、GPU／クリップボード等のブラウザ条件も個別に検証が必要です。

この環境にはcargo、rustc、trunk、wasm-bindgenがありませんでした。そのため、今回の調査では両プロジェクトのWASMビルド・起動・Reactとの実際のデータ往復を実行していません。ソースにWASMターゲットがあることの確認と、統合済みという主張を区別します。

## 6. 再利用候補と独自実装の区別

| 領域 | 調査した再利用候補 | 今回の実装 | 今後採用に必要な作業 |
| --- | --- | --- | --- |
| ベジェ幾何 | VectorCraft geom / Anchor / PathData、kurbo | 正規化アンカーとin/outハンドルを独自TSで実装 | mm↔pt、正規化↔絶対座標、fill rule・閉路のアダプター |
| ブーリアン・輪郭 | VectorCraft pathops。geom / kurbo / linesweeper等に依存 | 未実装 | WASMラッパー、トポロジー・数値精度・ライセンス確認 |
| 選択・ツール | VectorCraft toolsとengine | 独自Pointer Events、選択・変形・履歴 | engine command/sessionと選択IDの橋渡し |
| 文書・親ページ | DesignCraft doc | 1階層の共通マスターとレイヤーを独自実装 | spreads/parentsと.pamphテンプレートの変換 |
| 表・段落組版 | DesignCraft compose | 可変行高・列バインディング・改ページを独自実装 | story/style/font/frame作成、oversetをエラーへ変換 |
| 印刷PDF | 両者のpdfとcraft-pdf関連 | 既存pdf-libを拡張。RGB校正用 | ICC／PDF/X条件、画像とフォント、同一組版の実機検証 |
| 企画データ連動 | そのまま使える学園祭固有実装は未確認 | Event→表／ポスター／時間割を独自実装 | 採用エンジンが変わってもこの層を保持 |
| テンプレートライブラリ | 各OSS独自形式 | .pamptplと.pamph形式3を独自実装 | 双方向変換・非対応機能の明示 |

「再利用候補」はソースとライセンスを確認した候補であり、ビルドして動作確認済みの組込コードという意味ではありません。今回のアプリに両OSS由来のRustランタイムコードはありません。

## 7. 統合する場合の方法

### A. Webアプリ全体を独立Canvas／iframeで配置

公式Web用成果物をローカル配信すれば、UIを大きく作り直さず併置できる可能性があります。ただし、ファイル選択・フォーカス・ショートカット・フォント・GPU・CSPを確認する必要があります。制作データとの往復には別途メッセージAPIが必要です。URLをiframeへ置くだけでは企画データ連動も.pamph保存も完成しません。今回は未採用です。

### B. 下位crateをWASMモジュールとして包む

専用のwasm-bindgen wrapperを作り、JSONでscene／command／resultを往復させます。座標は現アプリのmmからptへ72/25.4倍し、戻すときは逆変換します。変形の中心、パスの閉路、線幅、透明度、ID、フォント、図形の重なり順も契約に含める必要があります。

既存SVGプレビューとPDF出力を維持するなら、WASMから返すのは共通描画データです。ピクセル画像だけを返してPDFへ貼る方式は採用しません。DesignCraftの組版結果を使うなら、その結果の座標・行分割をPDF側でも再計算せず描画する必要があります。

### C. ネイティブ版の別プロセスとして採用

将来のTauri版では、CLI／制御プロトコルを別プロセスへ橋渡しする方法もあります。Web版とは別の仕組みであり、ブラウザでTCPリスナーを作る設計にはしません。クロスプラットフォーム配布、バイナリ、同梱ライセンスの検証が必要です。

現段階ではBを将来候補として設計し、今回追加したデータモデル／共通描画データを境界にしています。実際のRust採用は、固定コミットでのWASMビルド、代表原稿の往復、ライセンス集約、起動時間・メモリ・PDF差分の検証を通してから判断します。
