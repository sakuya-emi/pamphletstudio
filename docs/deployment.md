# ロリポップへの自動公開

`main` へのプッシュで `.github/workflows/deploy.yml` が実行されます。GitHub の Actions → Deploy to Lolipop → Run workflow から手動で再実行することもできます。

## 接続設定

リポジトリの Settings → Secrets and variables → Actions に次の Repository secrets を登録します。値はコードやチャットに記載しません。

| Secret | 内容 |
| --- | --- |
| FTP_SERVER | FTPS対応のFTPホスト名。`ftp://` 等のスキームを付けない |
| FTP_USERNAME | FTPアカウント |
| FTP_PASSWORD | FTPパスワード |
| FTP_SERVER_DIR | FTPログイン後の、公開中の `pamphlet-studio/index.html` があるフォルダ。末尾 `/` は自動で補います。例：`./pamphlet-studio/` |

SFTPで表示される `/home/...` とFTPログイン後のパスは異なる場合があります。FTPから見える公開先を指定してください。このワークフローはFTPS（通常21番ポート）用で、SFTP用ではありません。TLS証明書の検証を有効にしています。

## 公開の流れ

1. Secretsの設定有無を確認（値は出力しません）。
2. Node.js 22で `npm ci` を実行。
3. 一時出力先 `tmp` を用意して、全テストを実行。
4. `/pamphlet-studio/` 向けに型チェック・本番ビルド。
5. ビルド済みの `dist/` の中身だけをFTPSで公開先へ同期。

テストやビルドが失敗した場合、アップロードには進みません。同時の公開は直列化します。公開フォルダ全体を消去する設定は無効です。前回の同期状態に従い、以前このワークフローが配置した古いファイルは削除・置き換えられます。

## 結果の確認

GitHub Actionsの「Upload to Lolipop with FTPS」まで成功していることを確認し、`https://emisaku511.com/pamphlet-studio/` を再読み込みしてください。失敗した場合はActionsの失敗したステップを確認します。接続拒否はロリポップ側のFTPアクセス制限・FTPS対応・接続情報を確認してください。接続情報や証明書検証を変更せずに再実行しても、設定由来の失敗は解消しません。
