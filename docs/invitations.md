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

| Method / Path                          | 入力・用途                                                             |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `POST /trips/:tripId/invitation-links` | 参加者が発行。`token` はこの応答だけに含む                             |
| `GET /trips/:tripId/invitation-links`  | 参加者向けリンク一覧。トークン・ハッシュは返さない                     |
| `POST /invitation-links/:id/revoke`    | 発行者による無効化。繰り返し可能                                       |
| `POST /invitation-links/resolve`       | `{ token }` → 旅行概要・発行者・期限・参加済みか・既存申請・申請可能か。申請可能なら本人の受信通知を保存 |
| `GET /invitation-links/:id`           | 自分のお知らせに保存された招待の概要。期限切れ・無効化済みも状態を表示 |
| `POST /invitation-links/:id/request`  | 自分のお知らせに保存された有効なリンクから参加を申請 |
| `POST /invitations`                    | `{ token }` → 自分の参加申請                                           |
| `GET /invitations?view=mine`           | 自分の申請一覧。終了分も含む。既定は `mine`                            |
| `GET /invitations?view=review`         | 自分が参加している旅行の最終承認待ち                                   |
| `GET /trips/:tripId/invitations`       | 旅行参加者向け全状態の申請一覧                                         |
| `GET /invitations/:id`                 | 申請本人・旅行参加者向け詳細                                           |
| `POST /invitations/:id/confirm`        | `{ generation }`。既存参加者による最終承認                             |
| `POST /invitations/:id/decline`        | `{ generation }`。本人による撤回                                       |
| `POST /invitations/:id/cancel`         | `{ generation }`。発行者による取り消し                                 |

一覧は既存の `limit` / `cursor` 方式です。状態は `PENDING_CONFIRMATION` / `ACCEPTED` / `DECLINED` / `CANCELLED`。申請には閲覧者の `allowedActions` を返します。不正入力は400、存在しない・権限のない対象は404、状態・世代の競合は409、期限切れ・無効リンクは410です。

トークンは32バイトの乱数をbase64urlにし、DBにはSHA-256だけを保存します。発行後の再取得はできません。作成直後は画面内で再共有でき、画面を離れた後は新しいリンクを発行します。古いリンクは独立して期限まで使えます。トークンや認証情報をログ・アクセス解析に記録しないでください。

申請時は既存参加者全員、結果は申請者と既存参加者のうち操作者を除く全員へアプリ内通知を作成します。状態が進んだら古い通知を既読化します。通知と申請・参加者追加は同じトランザクションに含めます。

受信通知にはリンクIDを保存し、トークンは保存しません。リンクIDからの概要取得・申請は、そのリンクの受信通知がある本人に限定し、申請時に期限と無効化を再検証します。申請後も受信通知から現在の申請状態を確認できます。

## Phase 2 — アプリと内部検証

旅行詳細の「招待・参加申請」からリンクを発行・共有します。お知らせタブには追加の一覧ボタンを置かず、通知から直接遷移します。

- 自分宛ての招待通知 → 招待内容・参加申請画面
- 他の人の参加申請・申請結果通知 → その旅行の招待管理画面
- 自分の申請結果通知 → 自分の申請の詳細画面

ドメイン未設定のlocal / development / stagingでは、各環境のカスタムURLスキームを使います。productionは公開リンク有効化まで共有ボタンを表示しません。

| 環境        | Bundle ID / package         | scheme              |
| ----------- | --------------------------- | ------------------- |
| local       | `com.futa.stamprally.local` | `stamp-rally-local` |
| development | `com.futa.stamprally.dev`   | `stamp-rally-dev`   |
| staging     | `com.futa.stamprally.stg`   | `stamp-rally-stg`   |
| production  | `com.futa.stamprally`       | `stamp-rally`       |

URLは `<scheme>://invite/<token>`。開発ビルドで確認します。ログイン前の招待はSecureStoreに保持し、ログイン・名前設定後に元の画面へ戻ります。キャンセルと明示的なログアウトで保持情報を破棄します。アプリ終了をまたいでも保持しますが、自動申請は行いません。

検証対象は、起動中・終了状態からのリンク受信、ログイン・名前設定を挟んだ復帰、複数アカウントでの申請と承認、通信失敗・二重タップ・先行承認・操作中のログアウトです。無効リンクからもお知らせに戻れ、保存済みの通知から既存申請を確認できることを確認します。

## Phase 3 — 公開用HTTPSリンク

公開URLは `https://<招待用ホスト>/invite/<token>`。検証用と本番用のホストを分けます。ドメイン・署名情報が未確定のため、公開リンクは既定で無効です。

APIが公開ページ・関連付けファイルを提供します。ドメインをAPIへ接続し、リバースプロキシは元の `Host` を保持してください。次のパスは認証・リダイレクトなしで配信します。

- `GET /.well-known/apple-app-site-association`
- `GET /.well-known/assetlinks.json`
- `GET /invite/:token`

### 設定

API側：

| 変数                             | 値                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `INVITATION_PUBLIC_ORIGIN`       | 招待用HTTPS origin。パス・ポート・ユーザー情報なし                              |
| `INVITATION_IOS_APP_ID`          | 実際に署名された `application-identifier`。通常は `<Apple Team ID>.<bundle ID>` |
| `INVITATION_ANDROID_PACKAGE`     | 対象環境のpackage                                                               |
| `INVITATION_ANDROID_SHA256`      | 配布署名のSHA-256 fingerprint。複数はカンマ区切り                               |
| `INVITATION_APP_SCHEME`          | 上表の対象環境scheme                                                            |
| `INVITATION_IOS_INSTALL_URL`     | App Store / TestFlight等のHTTPSインストール先                                   |
| `INVITATION_ANDROID_INSTALL_URL` | Google Play / 内部配布のHTTPSインストール先                                     |

Google Play App Signing使用時は、アップロード鍵ではなくPlay配布アプリの署名を指定します。未設定の関連付けは503です。案内ページは有効リンクなら200、無効化・期限切れなら410、存在しないトークンなら404です。ページ閲覧では申請を作成しません。

mobile / EASの対象環境：

```dotenv
EXPO_PUBLIC_INVITATION_ORIGIN=https://<招待用ホスト>
EXPO_PUBLIC_INVITATION_LINKS_ENABLED=false
```

originから `ios.associatedDomains` とAndroidの `autoVerify` 付き `intentFilters` を生成します。処理対象は `/invite/` 配下。ネイティブ設定変更のため再ビルド・再インストールが必要です。

### 公開手順と完了条件

1. HTTPSドメインをAPIに接続し、関連付けJSONの200応答・Content-Type・アプリID・署名を確認する。
2. 検証環境のネイティブビルドを作り、実機のメッセージ等からHTTPSリンクをタップしてアプリ起動を確認する。
3. 未インストール時はWebでインストール方法を案内し、インストール後に同じリンクを開き直す。初回起動時の自動引き継ぎは実装していない。
4. 本番も配布署名で確認後、`EXPO_PUBLIC_INVITATION_LINKS_ENABLED=true` にしたアプリを配布する。共有URLがHTTPSになる。
5. 両OSで起動中・終了状態・未ログイン・初回登録・期限切れを確認する。アプリ内ブラウザ等で自動起動しない場合は案内ページの「アプリで開く」を使う。

関連付けファイル・案内ページは実装済みですが、実ドメインの配信、EAS署名設定、公開用ビルド・実機検証は設定値を用意してから行います。

参考：[Expo Universal Links](https://docs.expo.dev/linking/ios-universal-links/)、[Expo App Links](https://docs.expo.dev/linking/android-app-links/)、[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)。

## 自動チェック

```sh
pnpm --filter api test
pnpm --filter api test:database
pnpm --filter mobile test
pnpm typecheck
pnpm lint
```

DBテストは使い捨てDBを作成し、migrationを適用してから実行・削除します。通常の開発DBをテストのために初期化する必要はありません。
