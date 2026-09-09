# Stamp Rally API

NestJS + Prisma + PostgreSQL。認証済みの参加者が、trip → genre → stamp と投稿を共有するAPIです。

## コード構成

- `src/auth/`：JWT認証、初期設定完了の判定。
- `src/trips/`：trip機能、参加者のアクセス判定。`TripAccessModule` は参加者判定だけを公開し、各機能から利用します。
- `src/common/`：paginationと共通の入力検証。
- `src/database/`：Prisma接続、transaction処理、migrationの検証。
- 各機能のディレクトリ：controller・service・repository・entity・DTO。
- `test/trips.integration-spec.ts`：アプリ全体を通すtripの統合テスト。

## 開発・検証

環境別のAPI・DB・Google / Appleの設定は[ビルド前の手動設定](../../docs/build-setup.md)を参照してください。remoteは環境ごとにAPIインスタンスを分け、デプロイ先から環境変数を注入します。各APIが許可するclient IDはGoogle・Appleそれぞれ1つです。

リポジトリルートで `pnpm install`、`docker compose up -d postgres` を実行し、`apps/api/.env.example` を参考に `apps/api/.env` を設定してください。

```sh
pnpm --filter api exec prisma generate --config ./prisma7.config.ts
pnpm --filter api exec prisma migrate deploy --config ./prisma7.config.ts
pnpm --filter api start:dev

pnpm --filter api test
pnpm --filter api test:database
pnpm --filter api lint
pnpm --filter api build
```

`test:database` はintegrationとe2eを実行します。`test:integration` / `test:e2e` で個別実行も可能です。`.env.test`（または明示した `DATABASE_URL`）の接続先に実行ごとの一時DBを作り、全migrationを適用して、終了時に削除します。接続ユーザーにはDB作成権限が必要です。既存の開発DB・テストDBのデータは削除しません。

### ローカル開発用ユーザー・トークン（Insomnia等）

Google/Appleログインを用意せずに、通常のJWT認証と参加者判定を通してAPIを手動検証するためのCLIです。HTTPの開発用ログインAPIは追加していません。

DBを起動し、上記のgenerate・migrationを済ませてから、リポジトリルートで実行します。

```sh
# 名前設定済み・ACTIVEのテストユーザー3人を用意する
pnpm --filter api db:seed

# 指定ユーザーの新しいセッションとトークンを発行する
pnpm --filter api dev:token --user dev-user-1

# 別のユーザーに切り替えて、招待や参加者判定も試せる
pnpm --filter api dev:token --user dev-user-2
pnpm --filter api dev:token --user dev-user-3
```

ユーザーの識別名は `dev-user-1`〜`dev-user-3` です。固定UUIDで管理するので、APIで名前を変更しても同じ識別名で選べます。Seederは存在しないユーザーだけを作成し、既存ユーザーの名前・状態・セッションや、Trip・投稿などを変更・削除しません。別のユーザーが初期名を使用していた場合は、全体をロールバックしてエラーにします。サンプルTripなどは作成しません。

Prismaにも同じseed処理を登録してあるため、`pnpm --filter api exec prisma db seed --config ./prisma7.config.ts` でも実行できます。Seeder自体にはDBリセット・migration処理はありません。DBを初期化したあとは、migration、Seeder、トークン発行をやり直してください。

トークン発行コマンドは以下のJSONを出力します（値は説明用）。`--silent` を付けた `pnpm --filter api --silent dev:token --user dev-user-1` なら、pnpmの実行案内を省いてJSONだけを取得できます。

```json
{
  "user": {
    "key": "dev-user-1",
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "dev-user-1",
    "status": "ACTIVE"
  },
  "accessToken": "<access-token>",
  "refreshToken": "<refresh-token>",
  "refreshTokenExpiresAt": "<ISO日時>",
  "accessTokenExpiresAt": "<ISO日時>"
}
```

Insomniaでは **Auth → Bearer Token** のToken欄に `accessToken` の値だけを貼ります。`Bearer ` は付けません。まず `GET http://localhost:3000/users/me` でユーザーを確認し、続いてTripなどを作成できます。ユーザーはすでに `ACTIVE` なので、初回の名前設定は不要です。APIサーバーは別途 `pnpm --filter api start:dev` で起動してください。

トークンは通常ログインと同じ署名鍵・有効期限を使います。`.env.example` の設定ではaccess tokenは15分、refresh tokenは30日です。期限切れ時は発行コマンドを再実行するか、以下で更新できます。

```http
POST http://localhost:3000/auth/refresh
Content-Type: application/json

{ "refreshToken": "<現在のrefreshToken>" }
```

refresh成功後は、返された **accessTokenとrefreshTokenの両方**を差し替えてください。使用済みrefresh tokenは再利用できません。CLI再実行は新しいセッションを作り、既存セッションを削除しません。既存仕様どおり、ログアウトはrefresh tokenを失効させますが、access tokenは期限まで有効です。

安全対策・実行条件：

- `apps/api/.env` を読み、同名の環境変数が既にあればそちらを優先します。APIサーバーとCLIの接続先・JWT設定を揃えてください。CLI自体にはGoogle/Appleの設定は不要です。
- `NODE_ENV` は未設定・`development`・`test` のみ許可します。
- PostgreSQLのホストは `localhost`・`127.0.0.1`・`[::1]`、DB名は `stamp_rally`・`stamp_rally_test`・既存テストランナーの一時DB名だけを許可します。URLクエリは `schema` のみ許可し、`host` 等による上書きは拒否します。
- 接続先の制限は設定の誤りを防ぐためのものです。本番DBへのローカルトンネルや本番のJWT秘密鍵を使用しないでください。
- トークン発行は固定テストユーザーかつ `ACTIVE` に限定し、Google/Appleのアカウントが紐づくユーザーには発行しません。
- 出力されたトークンは秘密情報です。コミットや共有をしないでください。CLIはトークンをファイルに保存せず、DBにはrefresh tokenのハッシュだけを保存します。
- 開発用コードは `scripts/`、専用ビルドの出力はGit管理外の `.dev-dist/` に置きます。本番の `dist/` とAppModuleには含めません。

`20260907133000_add_trip_domain` は既存の非nullユーザー名に重複がある場合、名前を報告してtransactionをロールバックします。自動改名や削除は行いません。適用前にも次のSQLで確認できます。

```sql
SELECT name, count(*) FROM users
WHERE name IS NOT NULL GROUP BY name HAVING count(*) > 1;
```

## 認証・名前・権限

認証APIと `GET/PATCH /users/me` は既存仕様を維持します。`PATCH /users/me` の `{ "name": "名前" }` で初期設定が完了し、`ACTIVE` になります。新たなusernameフィールドはありません。

ユーザー名は前後の空白を除去した1〜20文字で、全ユーザー間で一意です。日本語・内部の空白は使用でき、大文字小文字は区別します（`Futa` と `futa` は別名）。未設定のnullは複数ユーザーに許可されます。他人と同名への変更は409、自分の現在の名前への更新は成功します。

domain APIには `Authorization: Bearer <accessToken>` と `ACTIVE` が必要です。trip内の閲覧・編集・招待・投稿・お気に入り変更は、全参加者が同じ権限を持ちます。名前検索はACTIVEユーザー間のみ可能です。

- 401：認証されていない、または認証されたユーザーが存在しない。
- 403：初期設定が未完了。
- 404：対象が存在しない、またはそのtripに参加していない。
- 400：入力・UUID・日付・絞り込み・cursorが不正。
- 409：ユーザー名の重複、招待の状態競合、自分自身・参加済みユーザーへの招待。

既存のJWT方式を使用します。ログアウトはrefresh tokenを失効し、発行済みaccess tokenは有効期限まで利用可能です。

## エンドポイント

作成は201、取得・更新・招待の承認と辞退は200を返します。未知のbody/query項目はDTOを持つAPIで拒否します。

| Method / Path                 | 内容                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| GET /users/me                 | 自分のプロフィール                                                        |
| PATCH /users/me               | `{ name }` で名前設定・変更                                               |
| GET /users/lookup?name=...    | trim後の完全一致検索。返却は `{ id, name }` のみ                          |
| POST /trips                   | `{ name, startDate, endDate, coverImageUrl?, locations?, inviteeNames? }` |
| GET /trips                    | 参加中のtrip一覧と達成集計                                                |
| GET /trips/:id                | trip詳細と達成集計                                                        |
| PATCH /trips/:id              | name・startDate・endDate・coverImageUrlの部分更新                         |
| GET /trips/:id/members        | 参加者一覧。各項目に `user: { id, name }` を含む                          |
| POST /trips/:id/invitations   | `{ inviteeName }` で登録済みユーザーを招待                                |
| GET /trips/:id/invitations    | 参加者向けの招待一覧（全状態）                                            |
| GET /invitations              | 自分宛ての保留中招待一覧                                                  |
| POST /invitations/:id/accept  | 本人による承認                                                            |
| POST /invitations/:id/decline | 本人による辞退                                                            |
| POST /genres                  | `{ tripId, name, description? }`                                          |
| GET /genres?tripId=...        | trip内のgenre一覧と達成集計                                               |
| GET /genres/:id               | genre詳細と達成集計                                                       |
| PATCH /genres/:id             | name・descriptionの部分更新                                               |
| POST /stamps                  | `{ genreId, name, description? }`                                         |
| GET /stamps?genreId=...       | genre内のstamp一覧と達成状態                                              |
| GET /stamps/:id               | stamp詳細と達成状態                                                       |
| PATCH /stamps/:id             | name・descriptionの部分更新                                               |
| POST /posts                   | `{ stampId, mediaType, mediaUrl }`                                        |
| GET /posts                    | `tripId / genreId / stampId` のいずれか1つで一覧                          |
| GET /posts/:id                | 投稿詳細                                                                  |
| PATCH /posts/:id/favorite     | `{ isFavorite: true }` または `false`                                     |

リソースIDはUUIDです。genre・stampの親は変更できません。postの内容編集、trip・genre・stampの削除、退出・除名、ファイルアップロードは今回のAPIには含みません。

### trip・genre・stamp

tripの期間は `YYYY-MM-DD` の暦日で、開始日≦終了日（同日可）。時刻・タイムゾーンは持ちません。過去・未来の期間も指定でき、期間外の投稿・編集も可能です。

trip・genre・stampの名前は前後空白を除去した1〜100文字。descriptionは最大2,000文字で、省略時は空文字です。tripの代表画像URLは任意で、`null` で解除できます。部分更新は少なくとも1項目が必要です。

### 招待

trip作成と作成者の参加、指定された初期招待の作成は同一transactionです。初期招待の名前重複はtrim後にまとめ、不明な名前が含まれる場合はtripごと作成しません。

招待の状態は `PENDING / ACCEPTED / DECLINED`。本人が承認すると参加者に追加されます。保留中の重複招待・同じ判断の再送は冪等です。承認済みを辞退するなどの変更は409ですが、辞退された相手を再招待することは可能です。自動期限はありません。

招待先はユーザーIDで保持するので、改名しても宛先は変わりません。招待一覧にはtripの基本情報と招待者・受信者を含めます。承認前はtrip内コンテンツにアクセスできません。

### 投稿・お気に入り

postは `mediaType: "IMAGE" | "VIDEO"` と単一の `mediaUrl` が必須です。代表画像と投稿のURLはHTTPS形式・最大2,048文字。URLを登録するAPIで、実ファイルの保存・取得・内容検証は行いません。

stampに紐付くコンテンツはpostのみです。投稿者は認証中のユーザーから設定します。投稿には `author: { id, name }` と `tripId / genreId / stampId` を含めます。

お気に入りはpost共通のbooleanです。全参加者が設定・解除でき、個人別の状態や自動toggleではありません。`GET /posts` の `favoritesOnly=true` でお気に入りだけを返し、省略・falseでは全投稿を返します。

```text
GET /posts?stampId=<uuid>
GET /posts?stampId=<uuid>&favoritesOnly=true
GET /posts?genreId=<uuid>&favoritesOnly=true
GET /posts?tripId=<uuid>&favoritesOnly=true
```

tripページからはgenreとstamp、genreページからはstampを一覧APIで選択し、共通の `POST /posts` にstampIdを送ります。

### 達成集計・pagination

| リソース | 返却する達成情報                                      |
| -------- | ----------------------------------------------------- |
| Stamp    | `isCompleted`：postが1件以上存在する                  |
| Genre    | `totalStampCount / completedStampCount / isCompleted` |
| Trip     | `totalGenreCount / completedGenreCount / isCompleted` |

Genre・Tripは子が1件以上あり、そのすべてが達成済みなら達成済みです。お気に入りは達成に影響しません。途中で未達成のstamp・genreを追加すると、親も未達成に戻ります。集計は全配下を対象とし、一覧のページサイズには影響されません。

一覧は `{ items, nextCursor }`。`limit` は既定20・最大100、続きは返された `cursor` を指定します。cursorは不透明な値として扱ってください。trip・post・招待は作成日時の降順、genre・stamp・参加者は昇順です。同時刻はIDで順序を確定します。

## Mobile接続の追加契約

`20260909000000_mobile_api` をAPIリリース前に適用してください。既存のTripの `locations` は空配列になります。過去データから通知は生成しません。

| API / レスポンス                | 契約                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Trip作成・更新・取得            | `locations: string[]`。前後空白と空項目を除き、順序・重複を保持。更新時の省略は変更なし、`[]` は全解除 |
| `GET /posts`                    | 任意の `mediaType=IMAGE\|VIDEO` を追加。他のscope条件と併用可能                                        |
| Post                            | 認証ユーザーの `readAt: string \| null`                                                                |
| `PATCH /posts/:id/read`         | 画像のユーザー別既読。更新後のPostを返し、同時・再送時も最初の日時を保持                               |
| `DELETE /posts/:id`             | 参加者が削除でき、成功は204。写真既読・写真宛て通知はFKで同時に削除                                    |
| Genre                           | `hasUnreadPhotos`。自分以外の未読画像が配下にあるか                                                    |
| Stamp                           | `hasUnreadPhotos` と画像のみの `photoCount`。達成判定は既存どおり投稿の有無                            |
| `GET /notifications`            | `{ items, nextCursor, unreadCount }`。通常のcursor／limitに対応し、未読件数はページ外を含む全件        |
| `PATCH /notifications/:id/read` | 本人宛て通知を既読化し、更新後の通知を返す。最初の既読日時を保持                                       |

通知には `id / recipientId / title / body / target / readAt / createdAt` を返します。`target` は `{ type: 'trip', tripId }`、`{ type: 'genre', genreId }`、`{ type: 'stamp', stampId }`、`{ type: 'photo', postId }` のいずれかです。

写真追加、旅行情報更新、ジャンル／スタンプ作成・更新時に、操作した本人を除く参加者へ通知を保存します。対象の変更と通知生成は同じserializable transactionで処理します。正規化後に変更のない更新、お気に入り、既読、削除では通知を作りません。写真と通知の既読は独立しています。新規APIにもJWT・ACTIVE・参加者権限を適用し、アクセスできない対象は404です。

画像uploadのAPI・派生画像はこの変更には含めません。既存の `mediaUrl`、動画API、招待API、ユーザー名検索、運用用 `GET /health` は維持しています。
