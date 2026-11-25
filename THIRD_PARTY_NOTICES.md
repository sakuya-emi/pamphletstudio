# Third-party notices / 第三者の権利表示

## 本アプリの実行依存

React、pdf-lib、@pdf-lib/fontkit、PDF.js、JSZip、idb-keyval、Lucide、jsPDF、svg2pdf.js等を使用します。直接依存はpackage.json、確定した構成はpackage-lock.json、インストール済み各パッケージが宣言するライセンス一覧はdocs/third-party-inventory.jsonにあります。各パッケージのLICENSE / NOTICEが正式な条件です。一覧は自動収集した宣言情報で、全推移依存やファイルの法的監査完了を示すものではありません。配布時はバンドルするコードごとの条件を保持してください。

Noto Sans CJK JPのMedium/Bold静的TrueType版を同梱しています。著作権・SIL Open Font Licenseの全文はpublic/fonts/LICENSE.txt、取得・変換情報はpublic/fonts/README.mdです。ArialやAdobeのフォント・素材は同梱していません。アイコンは既存依存のLucideを使用します（ISC、実際のLICENSEはnode_modules/lucide-react/LICENSE）。

## 調査資料として保存したVectorCraft / DesignCraft

出典：
- https://github.com/storytold/vectorcraft
- https://github.com/storytold/designcraft

両プロジェクトはルートでMIT OR Apache-2.0を示しています。取得した資料・ソース抜粋はdocs/research/vectorcraftとdocs/research/designcraftに保管し、それぞれLICENSE-MIT、LICENSE-APACHE、NOTICE、ASSETS.mdをそのまま添えています。著作権表示と権利条件は各原文に従います。ファイルハッシュはdocs/research-manifest.json、確認コミット情報は各commit.jsonです。実行アプリに両エンジンを組み込んだものではなく、今回のデザイナーモードは独自のTypeScript実装です。

取得資料のブランド・アイコン・フォント・画像等の権利はコードのルートライセンスだけでは判断できません。ASSETS.mdとNOTICEの個別条件を保持し、将来採用するコード・素材・推移依存を改めて確認してください。ArtCraft等の商標・ロゴを本アプリのブランドや素材として使用していません。

利用者が登録するポスター・広告・大学ロゴ等は利用者側で使用権を確認する素材です。参考パンフレットPDFそのものをアプリの配布画像として同梱していません。

アンケートのQRコードを端末内で生成するため、Kazuhiko Arase の qrcode-generator（MIT）を使用します。ライセンスは public/licenses/qrcode-generator.txt に同梱します。お知らせのぶんちゃん画像は利用者提供のHEICを表示用JPEGに変換したものです。
