# stamp rally Web

Vite＋TypeScriptの静的ページです。Cloudflare Pagesから配信します。

```sh
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm web:dev
```

ブラウザで `http://localhost:5173` を開きます。ストアURLが空欄なら「配信準備中」を表示します。招待を確認するにはローカルAPIを起動し、API側の `INVITATION_PUBLIC_ORIGIN=http://localhost:5173` を設定してください。ポートはCORS設定と一致するよう5173に固定しています。

| 環境  | Web URL                             | 起動・ビルド                          | 対応するEAS profile |
| ----- | ----------------------------------- | ------------------------------------- | ------------------- |
| local | `http://localhost:5173`             | `pnpm web:dev`                        | —（ローカル開発）   |
| dev   | `https://stamp-rally-dev.pages.dev` | `pnpm --filter web build:development` | `development`       |
| stg   | `https://stamp-rally-stg.pages.dev` | `pnpm --filter web build:staging`     | `staging`           |
| prod  | `https://stamp-rally.pages.dev`     | `pnpm --filter web build`             | `production`        |

dev/stg/prodは同じリポジトリを使う3つのPagesプロジェクトです。それぞれのプロジェクトのProduction用環境変数に、その環境のAPI URL・ストアURLを設定します。

`pnpm web:dev` はViteの `localhost` mode、remote devのビルドは `development` modeを使います。Viteでは `local` というmode名が予約されているため、ローカル用には `localhost` を使っています。手元で環境別の値を使う場合は、`apps/web/.env.localhost` / `.env.development` / `.env.staging` / `.env.production` に設定できます。`.env` と `.env.local` は全modeで読み込まれ、mode別ファイルの値が優先されます。Pagesで設定した環境変数はこれらのファイルより優先されます。[Viteの環境変数とmode](https://vite.dev/guide/env-and-mode)

```sh
pnpm --filter web test
pnpm --filter web build:development
pnpm --filter web build:staging
pnpm --filter web build
pnpm --filter web preview
```

Pagesのビルドルートはリポジトリルート、ビルドコマンドは上表、配信ディレクトリは3環境とも `apps/web/dist`。Node.js 24、pnpmはルート `package.json` のバージョンを使用します。Pages Functionsは使いません。

QRコード、`_headers`、`_redirects` をビルド時に生成します。関連付け情報は以下の静的JSONを直接編集します。現在は識別子・署名が未設定なので関連付け先は空です。

- local：[associations/local/](associations/local/)（関連付け先なし）
- dev：[associations/development/](associations/development/)（`com.futa.stamprally.dev` 用）
- stg：[associations/staging/](associations/staging/)（`com.futa.stamprally.stg` 用）
- prod：[associations/production/](associations/production/)（`com.futa.stamprally` 用）

各ディレクトリの `apple-app-site-association` は `applinks.details` に実際の `appID` と `paths: ["/", "/invite/*"]` を、`assetlinks.json` は対象環境のAndroid package名と配布署名のSHA-256を設定します。

Viteのmodeに対応するJSONだけが、そのまま `dist/.well-known/` にコピーされます。ドメインや識別子の環境変数は不要です。Viteの開発サーバーもQR・関連付けJSONを提供しますが、Pages固有のヘッダー・書き換えは公開環境か `wrangler pages dev apps/web/dist` で確認してください。

TestFlightを含むアプリとの関連付けはストアURLと独立しています。設定一覧、公開手順、実機での確認事項は [招待リンク](../../docs/invitations.md) を参照してください。
