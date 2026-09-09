# stamp rally Web

Vite＋TypeScriptの静的ページです。Cloudflare Pagesから配信します。

```sh
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm web:dev
```

`.env` の公開値を設定してから起動します。ストアURLが空欄なら「配信準備中」を表示します。招待を確認するには `WEB_API_URL` と、API側の `INVITATION_PUBLIC_ORIGIN`（ローカルなら `http://127.0.0.1:5173`）を設定してください。

```sh
pnpm --filter web test
pnpm --filter web build
pnpm --filter web preview
```

Pagesのビルドルートはリポジトリルート、ビルドコマンドは `pnpm --filter web build`、配信ディレクトリは `apps/web/dist`。Node.js 24、pnpmはルート `package.json` のバージョンを使用します。Pages Functionsは使いません。

QRコード、`_headers`、`_redirects` をビルド時に生成します。関連付け情報は以下の静的JSONを直接編集します。現在は識別子・署名が未設定なので関連付け先は空です。

- [apple-app-site-association](public/.well-known/apple-app-site-association)：`applinks.details` に実際の `appID` と `paths: ["/", "/invite/*"]` を設定。
- [assetlinks.json](public/.well-known/assetlinks.json)：Androidのpackage名と配布署名のSHA-256を設定。

これらはビルド時にそのまま `dist/.well-known/` にコピーされます。Viteの開発サーバーもQR・関連付けJSONを提供しますが、Pages固有のヘッダー・書き換えは公開環境か `wrangler pages dev apps/web/dist` で確認してください。

TestFlightを含むアプリとの関連付けはストアURLと独立しています。設定一覧、公開手順、実機での確認事項は [招待リンク](../../docs/invitations.md) を参照してください。
