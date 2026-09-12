# 招待リンク

## フロー

旅行の参加者がリンクを発行・共有 → 相手がログインして参加を申請 → 既存参加者の誰か1人が承認 → 参加確定。

リンクは複数人に共有でき、発行から7日間有効です。リンクを開くだけでは申請・参加者追加は発生しません。リンク発行者だけが無効化できます。期限切れ・無効化は新規申請だけを止め、届いている申請には影響しません。

リンク方式では、受取人はログインしてリンクを開いた時点で特定されます。この時点で本人のお知らせに招待を1件保存し、後から参加申請を再開できます。同じリンクの再表示で通知を重複させたり未読に戻したりしません。参加済み・申請中の旅行には受信通知を追加しません。

確定前は本人による撤回とリンク発行者による取り消しが可能です。終了後の再申請には別の新しいリンクが必要です。同じ旅行への未処理申請は1人1件で、別のリンクを開いても既存申請の発行者を変更しません。再申請時に `generation` が増え、以前の世代への操作は409になります。

旅行本体・投稿は最終承認後に閲覧可能です。参加前は認証済みユーザーが有効なトークンで旅行概要を取得できます。公開Webページには旅行名・ユーザー名・カバーを出しません。

## Phase 1 — API

適用順は migration → API → mobile です。

```sh
pnpm api:generate
pnpm api:migrate
pnpm api:dev
```

追加enumの登録とそれを使うDDL・移行を2つのmigrationに分け、受信通知のリンク参照と重複防止制約を3つ目のmigrationで追加しています。名前指定の未回答招待は `CANCELLED` に移行し、`ACCEPTED` と既存参加者を維持します。旧 `POST /trips/:id/invitations`、旧 `accept`、旅行作成時の `inviteeNames` は廃止しました。

認証・初期設定済みユーザー向けAPI：

| Method / Path                          | 入力・用途                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /trips/:tripId/invitation-links` | 参加者が発行。`token` はこの応答だけに含む                                                               |
| `GET /trips/:tripId/invitation-links`  | 参加者向けリンク一覧。トークン・ハッシュは返さない                                                       |
| `POST /invitation-links/:id/revoke`    | 発行者による無効化。繰り返し可能                                                                         |
| `POST /invitation-links/resolve`       | `{ token }` → 旅行概要・発行者・期限・参加済みか・既存申請・申請可能か。申請可能なら本人の受信通知を保存 |
| `GET /invitation-links/:id`            | 自分のお知らせに保存された招待の概要。期限切れ・無効化済みは参加済み・申請中のみ取得可能                 |
| `POST /invitation-links/:id/request`   | 自分のお知らせに保存された有効なリンクから参加を申請                                                     |
| `POST /invitations`                    | `{ token }` → 自分の参加申請                                                                             |
| `GET /invitations?view=mine`           | 自分の申請一覧。終了分も含む。既定は `mine`                                                              |
| `GET /invitations?view=review`         | 自分が参加している旅行の最終承認待ち                                                                     |
| `GET /trips/:tripId/invitations`       | 旅行参加者向け全状態の申請一覧                                                                           |
| `GET /invitations/:id`                 | 申請本人・旅行参加者向け詳細                                                                             |
| `POST /invitations/:id/confirm`        | `{ generation }`。既存参加者による最終承認                                                               |
| `POST /invitations/:id/decline`        | `{ generation }`。本人による撤回                                                                         |
| `POST /invitations/:id/cancel`         | `{ generation }`。発行者による取り消し                                                                   |

一覧は既存の `limit` / `cursor` 方式です。状態は `PENDING_CONFIRMATION` / `ACCEPTED` / `DECLINED` / `CANCELLED`。申請には閲覧者の `allowedActions` を返します。不正入力は400、存在しない・権限のない対象は404、状態・世代の競合は409、期限切れ・無効リンクは410です。ただし概要取得では、旅行に参加済み・参加申請中ならリンクの期限・無効化より本人の状態を優先します。

トークンは32バイトの乱数をbase64urlにし、DBにはSHA-256だけを保存します。発行後の再取得はできません。作成直後は画面内で再共有でき、画面を離れた後は新しいリンクを発行します。古いリンクは独立して期限まで使えます。トークンや認証情報をログ・アクセス解析に記録しないでください。

申請時は既存参加者全員、結果は申請者と既存参加者のうち操作者を除く全員へアプリ内通知を作成します。状態が進んだら古い通知を既読化します。通知と申請・参加者追加は同じトランザクションに含めます。

受信通知にはリンクIDを保存し、トークンは保存しません。リンクIDからの概要取得・申請は、そのリンクの受信通知がある本人に限定し、申請時に期限と無効化を再検証します。申請後も受信通知から現在の申請状態を確認できます。

## Phase 2 — アプリと内部検証

旅行詳細の「招待・参加申請」からリンクを発行・共有します。お知らせタブには追加の一覧ボタンを置かず、通知から直接遷移します。

- 自分宛ての招待通知 → 招待内容・参加申請画面
- 他の人の参加申請・申請結果通知 → その旅行の招待管理画面
- 自分の申請結果通知 → 自分の申請の詳細画面

全環境で `EXPO_PUBLIC_INVITATION_ORIGIN` の設定時だけ招待リンクの作成・共有ボタンを表示します。未設定・空欄なら共有は無効です。共有URLは常に `<origin>/invite/<token>` で、カスタムURLスキームへのフォールバックはありません。

| 環境        | Bundle ID / package         | scheme              |
| ----------- | --------------------------- | ------------------- |
| local       | `com.futa.stamprally.local` | `stamp-rally-local` |
| development | `com.futa.stamprally.dev`   | `stamp-rally-dev`   |
| staging     | `com.futa.stamprally.stg`   | `stamp-rally-stg`   |
| production  | `com.futa.stamprally`       | `stamp-rally`       |

既存の `<scheme>://invite/<token>` の受信は引き続き扱えます。ログイン前の招待はSecureStoreに保持し、ログイン・名前設定後に元の画面へ戻ります。キャンセルと明示的なログアウトで保持情報を破棄します。アプリ終了をまたいでも保持しますが、自動申請は行いません。

検証対象は、起動中・終了状態からのリンク受信、ログイン・名前設定を挟んだ復帰、複数アカウントでの申請と承認、通信失敗・二重タップ・先行承認・操作中のログアウトです。無効リンクの「トップに戻る」で保持中の招待を解除し、旅行一覧へ戻ります。保存済みの通知から既存申請を確認できます。

## リンクを開いたときのアプリ内遷移

トップURL `/` は旅行一覧へ進み、以前の保持中の招待を解除します。招待は未ログインならログイン・名前設定を挟んで、次の順で自動振り分けします。自動遷移は `replace` を使い、戻る操作で振り分け画面に戻りません。

| 優先順 | 状態                                               | 遷移先                                |
| ------ | -------------------------------------------------- | ------------------------------------- |
| 1      | 旅行に参加済み                                     | `/trips/trip/[tripId]`                |
| 2      | 参加申請中                                         | `/invitations/[id]`（状況確認・撤回） |
| 3      | 上記以外でリンクが期限切れ・無効化済み             | 利用できない旨と「トップに戻る」      |
| 4      | 有効なリンクで新規申請・別リンクによる再申請が可能 | 参加申請画面                          |
| 5      | 同じ有効リンクで撤回・取り消し済み                 | `/invitations/[id]`（申請結果）       |

期限切れのリンクでも参加者は旅行を開け、申請中の本人は撤回できます。概要取得は本人の参加・申請状態を確認してから期限を判定します。参加前で申請中でもない人には、期限切れ・無効化済みリンクの旅行概要を返しません。これは保存済み受信通知からの取得にも適用します。新規申請は引き続き送信時にも期限・無効化を検証します。

## Phase 3 — 静的Webと公開用HTTPSリンク

Webは `apps/web` のVite＋TypeScriptアプリを **Cloudflare Pages** で配信します。ビルドコマンドは環境ごとに後述のとおり指定し、配信先はいずれも `apps/web/dist` です。Pages Functionsは使いません。APIでのHTMLと関連付けJSONの配信は廃止しました。

公開URLは `https://<Webホスト>/` と `https://<Webホスト>/invite/<token>`。トップと招待リンクのアプリ起動はOSの関連付けに従います。

| 環境  | Web origin                          | アプリのBundle ID / package | EAS profile / environment     |
| ----- | ----------------------------------- | --------------------------- | ----------------------------- |
| local | `http://localhost:5173`             | `com.futa.stamprally.local` | —（ローカル開発）             |
| dev   | `https://stamp-rally-dev.pages.dev` | `com.futa.stamprally.dev`   | `development` / `development` |
| stg   | `https://stamp-rally-stg.pages.dev` | `com.futa.stamprally.stg`   | `staging` / `preview`         |
| prod  | `https://stamp-rally-9ok.pages.dev` | `com.futa.stamprally`       | `production` / `production`   |

ローカルは `pnpm web:dev` でWebを起動し、`apps/mobile/.env` に `EXPO_PUBLIC_INVITATION_ORIGIN=http://localhost:5173` を設定します。共有URLは `http://localhost:5173/invite/<token>` です。localビルドのみ `localhost` / `127.0.0.1` のHTTP originとポートを許可し、HTTPにはOSの関連付けを生成しません。Web表示はローカルで、HTTPSリンクからの実機起動はremote devのdevelopmentビルドとstgで検証します。実機の `localhost` は開発PCを指しません。

### 公開状態確認API

認証不要の `POST /public/invitation-links/status` は `{ "token": "..." }` を受け取り、次だけを返します。

```json
{ "status": "ACTIVE" }
```

状態は `ACTIVE / EXPIRED / REVOKED / NOT_FOUND`。無効化と期限切れの両方なら `REVOKED` です。形式不正の文字列トークンも `NOT_FOUND`。入力オブジェクトの不正は400、通信・DB障害はエラーとして扱い、期限切れとみなしません。応答は `Cache-Control: no-store`。状態確認では旅行・ユーザー情報を返さず、通知・申請も作成しません。

APIの `INVITATION_PUBLIC_ORIGIN` にWebのoriginを設定してCORSを許可します。ローカルのみ `http://localhost:5173` や `http://127.0.0.1:5173` も利用できます。公開招待トークンをアクセス解析やログに記録しないでください。

### Webの表示

- PC：ヘッダー `stamp rally` と、App Store / Google Playの公式バッジ・QRコードを横並びに表示。
- スマートフォン：Webのトップに到達したらOSに対応するストアへ自動遷移。
- 招待URL：まず公開APIで有効性を確認。有効ならPCはダウンロード画面、スマートフォンは対応ストアへ進む。
- 期限切れ・無効化済み・存在しない招待：「利用できません」と「トップに戻る」を表示。
- 通信失敗・不正なAPI応答・API未設定：「再試行」を表示し、自動遷移しない。10秒でタイムアウトする。
- ストア未設定：そのストアを「配信準備中」とし、バッジリンク・QR・自動遷移を無効にする。別OSのストアへは転送しない。
- 「トップに戻る」は `/`。スマートフォンではトップの自動遷移が適用される。

QRは各ストアURLをビルド時にローカル生成します。招待トークンはQRに含めません。バッジも同梱し、閲覧時に外部画像・QRサービスを呼び出しません。

### 設定

Webのビルド環境（`apps/web/.env.example`）：

| 変数                    | 値                                                |
| ----------------------- | ------------------------------------------------- |
| `WEB_API_URL`           | 公開状態確認APIのベースURL。末尾の `/` は省略可能 |
| `WEB_IOS_STORE_URL`     | App StoreのHTTPS URL。未公開なら空欄              |
| `WEB_ANDROID_STORE_URL` | Google PlayのHTTPS URL。未公開なら空欄            |

設定値はビルド時に確定します。変更後はWebを再ビルド・再配信してください。不正なURLはビルドエラーにします。`WEB_API_URL` はWebで招待の有効性を確認するための接続先です。トップのダウンロード画面だけなら不要ですが、招待URLを処理するには設定が必要です。

関連付け情報は環境変数にせず、`apps/web/associations/development/`、`associations/staging/`、`associations/production/` のJSONを直接編集します。ビルドはViteのmodeに対応するファイルだけを、そのまま `dist/.well-known/` にコピーします。ローカルの `pnpm web:dev` は `localhost` modeで動作し、`associations/local/` の関連付け先なしのJSONを使います。署名情報が未確定の間はdev/stg/prodの関連付け先も空にしています。mode別の環境変数ファイルについては [WebのREADME](../apps/web/README.md) を参照してください。

`apple-app-site-association` の `applinks.details` に、対象アプリの次の項目を追加します。

```json
{
  "appID": "<実際のapplication-identifier>",
  "paths": ["/", "/invite/*"]
}
```

`appID` は通常 `<Apple Team ID>.<bundle ID>` ですが、署名されたアプリの `application-identifier` と一致させてください。

`assetlinks.json` の配列には次の項目を追加します。

```json
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<対象アプリのpackage名>",
    "sha256_cert_fingerprints": ["<配布署名のSHA-256 fingerprint>"]
  }
}
```

署名のfingerprintはコロン区切りの32バイトの16進数です。複数の配布署名がある場合は配列に追加できます。JSONを変更した場合もWebを再ビルド・再配信してください。

Web自身のドメイン指定は不要です。ページ内のリンクやアセットは相対URLを使い、関連付けJSONにも配信元ドメインは含めません。Webのoriginを設定するのは、CORSを許可するAPIと、関連付け対象を登録するmobileだけです。

APIの招待Web用設定は `INVITATION_PUBLIC_ORIGIN` のみです。アプリ識別子・配布署名はWeb側の静的JSON、ストアURLはWebの上記環境変数で管理します。

mobileはlocalなら `apps/mobile/.env`、remote dev / staging / productionなら上表のEAS environmentに設定します。各環境のAPIにも同じoriginを `INVITATION_PUBLIC_ORIGIN` として設定します。

```dotenv
# local: http://localhost:5173
# development: https://stamp-rally-dev.pages.dev
# staging: https://stamp-rally-stg.pages.dev
# production: https://stamp-rally-9ok.pages.dev
EXPO_PUBLIC_INVITATION_ORIGIN=https://stamp-rally-stg.pages.dev
```

共有の有効・無効はoriginの有無だけで決まります。旧 `EXPO_PUBLIC_INVITATION_LINKS_ENABLED` は使用しないため、既存の `.env` / EAS環境から削除できます。

HTTPS originから `ios.associatedDomains` とAndroidの `autoVerify` 付き `intentFilters` を生成します。対象パスは **`/` と `/invite/*`**。ネイティブ設定変更のため再ビルド・再インストールが必要です。

**TestFlight版も通常のアプリと同じ関連付け・招待フローを使います。App Storeでの一般公開やストアURLの設定は、関連付け・招待リンク有効化の前提ではありません。** ストア未公開ならWebのストアURLは空欄のまま、TestFlightなどで配布したビルドで実機検証できます。

### Pagesへの配信手順

1. Pagesに `stamp-rally-dev`、`stamp-rally-stg`、`stamp-rally` の3プロジェクトを作り、同じリポジトリを接続する。それぞれ配信するブランチをProduction branchに指定する。ビルドルートはリポジトリルート、devのビルドコマンドは `pnpm --filter web build:development`、stgは `pnpm --filter web build:staging`、prodは `pnpm --filter web build`、出力はすべて `apps/web/dist`。Node.js 24と `package.json` のpnpmバージョンを使う。
2. 各プロジェクトのProduction用環境変数に、その環境の `WEB_API_URL` とストアURLを設定する。dev/stg用プロジェクトも、その固定URLへ配信する設定はProductionを使う。各環境のAPIの `INVITATION_PUBLIC_ORIGIN` とmobileの `EXPO_PUBLIC_INVITATION_ORIGIN` を上表のWeb originに合わせる。本番の配信先は `https://stamp-rally-9ok.pages.dev`。
3. 次の2ファイルが認証・リダイレクトなしで200、`Content-Type: application/json` を返すことを確認する。ビルド生成される `_redirects` は `/invite/*` だけを書き換え、関連付けファイルを対象に含めない。`404.html` も生成し、存在しない関連付けパスのHTMLへのSPAフォールバックを防ぐ。
   - `/.well-known/apple-app-site-association`
   - `/.well-known/assetlinks.json`
4. EAS側のoriginを設定してビルド・インストールする。Androidはアップロード鍵ではなく実際の配布署名（Google Play App Signing使用時はPlayの署名）を使う。iOSは署名済みアプリの `application-identifier` とJSONを一致させる。
5. 両OSの実機でトップ・招待URLをメッセージ等からタップする。起動中／終了状態、未ログイン、名前設定、申請中、参加確定、撤回・取り消し、期限切れ、無効化を確認する。iOSはTestFlight版も確認する。
6. 確認済みのoriginを設定したアプリを配布する。追加の有効化フラグは不要で、ストアURL未設定でも共有できる。

インストール後は元の招待リンクをもう一度開きます。インストールをまたぐ自動引き継ぎは実装していません。ブラウザやユーザー設定がWebを優先する場合まで、アプリの自動起動は保証しません。

参考：[Apple Universal Links](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html)、[Expo SDK 57設定](https://docs.expo.dev/versions/v57.0.0/config/app/)、[Cloudflare Pagesの配信](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[Pagesの書き換え](https://developers.cloudflare.com/pages/configuration/redirects/)、[同じリポジトリから複数のPagesプロジェクトを作る](https://developers.cloudflare.com/pages/configuration/monorepos/)。

## 自動チェック

```sh
pnpm --filter api test
pnpm --filter api test:database
pnpm --filter mobile test
pnpm --filter web test
pnpm --filter web build:development
pnpm --filter web build:staging
pnpm --filter web build
pnpm typecheck
pnpm lint
```

DBテストは使い捨てDBを作成し、migrationを適用してから実行・削除します。通常の開発DBをテストのために初期化する必要はありません。
