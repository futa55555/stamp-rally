# 写真・動画のアップロード

1回の追加は写真・動画を合計30件、うち動画5件までです。1ファイルが1つの投稿になり、変換が完了したものから旅行の参加者に表示します。

| データ     | 上限・用途                                               |
| ---------- | -------------------------------------------------------- |
| 写真の原本 | 50,000,000 bytes。受け取ったファイルを変更せず保存       |
| 動画の原本 | 1,000,000,000 bytes、300秒以内                           |
| large      | 長辺2560 px以内のWebP、品質82。全画面表示とズーム        |
| small      | 長辺768 px以内のWebP、品質78。サムネイル                 |
| playback   | H.264/AACのMP4、最大30 fps、長辺1920 px・短辺1080 px以内 |
| BlurHash   | プレースホルダー用の文字列。DBだけに保存                 |

品質はWebPの圧縮パラメーターで、原本に対する品質の割合ではありません。派生画像は縦横比を維持し、拡大・切り抜きをせず、向きを補正してsRGBへ変換します。動画のlarge/smallは1秒地点（1秒未満の動画は中央）の静止画です。HDR動画の表示用データはSDRへ変換します。

表示・再生には派生データだけを使います。表示に失敗してもoriginalへフォールバックしません。共有・端末への保存は、参加権限を確認して取得したoriginalを元のファイル形式で渡します。共有先アプリが行う変換は、このアプリによる原本保存とは別です。

写真はJPEG・PNG・WebP・HEIC/HEIF・AVIF、動画はMP4/MOVのH.264・HEVCに対応します。Live Photosの動画とのペア保存、RAW、アニメーション画像は対象外です。

デコード対象は最大1億画素までです。ワーカーでは画像デコード・動画変換に時間制限を設け、1プロセスで同時に1件を処理します。1 GBの原本と再生用動画を一時保存できるよう、ワーカーには少なくとも3 GBの作業用ディスクを用意してください。

## 構成

端末 → 署名付きURLで非公開R2 → 完了API → PostgreSQLの永続ジョブ → 変換ワーカー → READY

APIとワーカーは別プロセスです。APIはユーザーと旅行への参加権限を確認し、送信先と短時間有効な取得URLを発行します。ストレージの認証情報を端末へ渡しません。DBにはオブジェクトのkey、BlurHash、寸法、形式、サイズ、動画時間、処理状態を保持し、署名付きURLは保存しません。

動画は16 MiB単位で分割送信します。アプリは送信状態をユーザー別に保存し、復帰後にサーバー側の送信済みパートと照合して再開します。端末からの送信はOSによるアプリ終了後の継続を保証しません。サーバーでの変換はアプリ終了後も継続します。

R2のアカウント・バケットが未設定でも、APIの他機能とストレージを置き換えたテストは実行できます。実際のアップロードにはR2接続設定とワーカーの起動が必要です。モックのテスト成功だけを実R2での動作確認とは扱いません。

## 起動とR2設定

`apps/api/.env.example`を参考にAPIとワーカーの環境変数を設定します。

| 環境変数                                    | 値                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                              | APIと同じPostgreSQL。pg-boss用の`pgboss`スキーマを作成できる接続        |
| `R2_ACCOUNT_ID`                             | CloudflareのアカウントID                                                |
| `R2_ENDPOINT`                               | 任意の接続先上書き。省略時はアカウントIDから導出                        |
| `R2_BUCKET`                                 | 非公開バケット名                                                        |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | 対象バケットのオブジェクト読み書きを許可するR2のAPI認証情報             |
| `FFMPEG_PATH` / `FFPROBE_PATH`              | 実行ファイルのパス。コンテナでは既定値を使用                            |
| `MEDIA_LEGACY_ALLOWED_ORIGINS`              | 既存URL取り込みを許可するHTTPS originのカンマ区切り。空なら取り込み無効 |

```sh
pnpm install
docker compose up -d postgres
pnpm api:generate
pnpm api:migrate
pnpm api:dev
```

別ターミナルで、HEICデコーダーとFFmpegを含むワーカーを起動します。初回はネイティブライブラリのビルドが必要です。

```sh
docker compose --profile media up -d --build media-worker
docker compose logs -f media-worker
```

ホストに対応するlibvips・HEICデコーダー・FFmpegが既にある場合は、`pnpm --filter api build`後に`pnpm api:worker`でも起動できます。通常のSharp配布バイナリだけではHEIC対応を保証できないため、ワーカー用Dockerfileでは実際のHEIC生成・デコードをビルド時に確認します。

既存の`mediaUrl`を取り込む場合は、許可する旧ストレージのoriginを設定してから、ビルド済みAPIで`pnpm --filter api media:backfill`を実行します。これはLEGACY行をキューへ追加する操作で、処理はワーカーが行います。失敗原因を解消後、`pnpm --filter api media:backfill --retry-failed`で失敗した旧データも再予約できます。旧データのURLをログに出力しません。

バケットの公開アクセスは有効にしません。Webクライアントでも検証する場合は、アプリのoriginに対する`PUT/GET/HEAD`、必要なリクエストヘッダーと`ETag`レスポンスヘッダーをCORSに設定します。未完了multipartを一定期間後に破棄するR2ライフサイクルルールも設定してください。`media/`以下へ一律の期限削除ルールを設定すると公開済み原本も消えるため、通常オブジェクトの清掃はアプリ側の参照確認に従います。

## API

全ルートに通常のBearer認証とACTIVEユーザー判定を適用します。進捗・再試行・キャンセルは投稿者自身だけが操作できます。公開済み投稿の閲覧・保存・削除は旅行の参加者が行えます。

| Method / Path              | 内容                                                           |
| -------------------------- | -------------------------------------------------------------- |
| POST /uploads/batches      | `{stampId, clientRequestId?, files}`。上限を検証して追加を予約 |
| GET /uploads/batches/:id   | ファイルごとの進捗と送信先を取得・更新                         |
| POST /uploads/:id/parts    | `{partNumbers}` のパート送信URLを発行                          |
| GET /uploads/:id/parts     | 送信済みパートを取得                                           |
| POST /uploads/:id/complete | アップロード完了を受け付け、変換処理を予約                     |
| POST /uploads/:id/retry    | 失敗したファイルを再試行                                       |
| DELETE /uploads/:id        | ファイルの追加をキャンセル                                     |
| GET /posts/:id/original    | `{url, expiresAt, mimeType, fileName}`。共有・保存用           |

各`files`項目は`clientId, fileName, mimeType, byteSize, mediaType`と、動画の場合は任意の`durationMs`を持ちます。クライアント申告だけでは公開せず、サーバーで実ファイルを検証します。`clientRequestId`には再送時も同じUUIDを使用します。

投稿のレスポンスは`smallUrl, largeUrl, playbackUrl, blurhash, width, height, durationMs`を含みます。移行用の`mediaUrl`は写真のlargeまたは動画のplaybackを指します。従来の任意URLを登録する`POST /posts`は使用せず、アップロード完了を経由してください。

## 状態と削除

`PENDING → PROCESSING → READY`を基本とし、失敗は`FAILED`、キャンセルは`CANCELLED`になります。移行前のデータは`LEGACY`として扱います。一時的な処理失敗は最大3回の試行まで自動再試行し、非対応・破損ファイルは再試行せず失敗を表示します。変換中・失敗・未移行の投稿は一覧、代表画像、写真件数、未読、達成集計へ含めません。`photoCount`と`hasUnreadPhotos`は画像だけを集計する既存の意味を維持し、`mediaCount`・`videoCount`・`hasUnreadMedia`で動画を含む状態を区別します。

初めてREADYになった時点で、写真・動画ともに他の参加者へ1件ずつ通知します。ジョブの再実行で通知を重複させません。写真はlargeの表示成功、動画は再生開始を既読の基準とし、サムネイルやBlurHashの表示だけで既読にしません。

`DELETE /posts/:id`は公開済み投稿の`deleted_at`を設定してゴミ箱へ移します。参加者全員が`GET /posts/trash`で参加中の旅行の投稿を確認し、`POST /posts/:id/restore`で削除時刻から30×24時間以内に復元できます。ゴミ箱は旅行の作成日時・ID、投稿の削除日時・IDの降順でページングします。`GET /posts/trash/:id`は復元可能な投稿のプレビュー専用です。お気に入り・既読・投稿日時を保持し、復元で新規投稿通知は発行しません。

期限内はR2の原本・派生ファイルを保持します。期限後はworkerの稼働状況に関係なく復元を拒否します。workerは毎分、期限切れを最大100件ずつ`purged_at`で復元不可にし、同一トランザクションで`media_cleanup`に清掃を記録します。`purged_at`はR2削除完了時刻ではありません。20分の猶予後に原本・派生・途中ファイルをR2から削除し、未完了multipartも中断します。失敗・部分失敗時はキューを残して再試行します。復元不可のDBレコードは保持しますが、R2清掃の保護対象から外します。孤立ファイル清掃も復元期間と20分の猶予を尊重します。

処理中に削除されたファイルは、変換が後から完了しても公開しません。APIとworkerの両方を新しいスキーマに対応するバージョンへ切り替えてください。

## リリース時の確認

1. バックアップを確保し、追加migrationを適用する。既存の投稿ID・日時・お気に入り・既読を保持する。
2. APIとワーカーのR2接続先を同じ非公開バケットに設定する。
3. 許可した旧ストレージから既存`mediaUrl`を取り込み、原本と派生を作成する。移行では新規投稿通知を作成しない。
4. 未移行・失敗データを確認する。旧URLをそのまま表示する代替処理は使わない。
5. API、ワーカー、ネイティブ依存を含むモバイルのビルドを順に反映する。
6. 実R2とiOS・Android実機で、30件の追加、一部失敗・再開、HEIC/HEVC、動画再生、ピンチズーム、原本の保存・共有を確認する。

監視対象は変換待ち件数・経過時間、変換失敗、期限切れアップロード、清掃失敗です。ログやエラー報告に署名付きURL・ストレージ秘密鍵を含めないでください。

## 自動検証

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter api test
pnpm --filter api test:database
pnpm --filter mobile test
```

DBテストは実行ごとの一時DBを作り、migration、公開処理、参加権限、pg-bossの永続化・再試行を確認します。既存の開発DBは変更しません。通常のホスト環境ではHEIC/FFmpegのネイティブテストをスキップするため、対応デコーダーを含むコンテナでも実行してください。

```sh
docker build -f apps/api/Dockerfile.worker -t stamp-media-worker .
docker run --rm --user root -e MEDIA_CODEC_TESTS=1 stamp-media-worker pnpm exec vitest run src/media-processing/media-processor.service.spec.ts
```

テスト時のroot指定はVitestのキャッシュ書き込み用です。通常のワーカーはDockerfileで設定した`node`ユーザーで実行します。これらのテストは実R2や端末の権限ダイアログ・OS共有シートの検証を置き換えるものではありません。

## 旅行カバー

旅行の作成・編集フォームから端末の静止画像を1枚選ぶと、画像の中央を8:5で自動的に切り抜いてプレビューします。保存ボタンを押すまでは端末内の下書きです。保存時に幅最大2,560pxのPNGを送信し、画像処理完了後に旅行を保存します。変更する場合は写真を選び直します。選択元の画像は送信・保存しません。

- `POST /uploads/covers`: `clientRequestId`（UUID）、`byteSize`（1〜50,000,000）、`mimeType: image/png`を送り、画像IDと15分有効のPUT URLを取得します。同じユーザー・リクエストIDは同じアップロードを返します。
- `GET /uploads/covers/:id`: 所有者だけが状態を取得できます。未送信の場合はPUT URLも返します。
- `POST /uploads/covers/:id/complete`: 実体のサイズとContent-Typeを確認し、`cover-process`キューへ投入します。ワーカーで内容と8:5の比率を検証し、WebPとBlurHashを生成します。保存する画像はWebPのみです。
- `DELETE /uploads/covers/:id`: 未使用のカバーをキャンセルします。旅行に設定済みの画像は旅行の更新APIで解除します。
- 旅行のPOST/PATCHは`coverAssetId`を受け取ります。省略は維持、`null`は解除です。設定可能なのは本人がアップロードしたREADY状態の未使用画像です。旅行のPOSTには`clientRequestId`も渡し、保存応答が失われても二重作成を防ぎます。

`coverImageUrl`は読み取り専用です。DBにはオブジェクトキーを保存し、旅行一覧・詳細・招待のレスポンス生成時に1時間有効のGET URLを署名します。既存の外部URLカバーは差し替え・解除まで表示できます。モバイルの画像キャッシュは署名を除いたキーを利用します。

画像処理中は4秒ごとに状態queryをinvalidateします。背景移行、通信切断、画面離脱で送信と待機を停止し、フォームが残っていれば再試行で処理状態を確認して再開します。2分間処理待ちになった場合も下書きを残して再試行できる状態に戻します。

画像の紐付けと旅行保存は同じDBトランザクションです。差し替え・解除・旅行削除時はDBトリガーで旧画像の削除を永続キューに記録します。未使用画像は24時間で回収し、署名付きPUTの再送に備えて実体削除には20分の猶予を設けます。ワーカー停止中に残った画像は`covers/`配下の48時間以上前の未参照キーを掃除します。処理のリトライ上限は3回です。

導入順はDB migration → API・ワーカー → モバイルです。書き込み時の`coverImageUrl`は廃止したため、古いモバイルは更新が必要です。`expo-image-manipulator`を追加しているため、既存の開発クライアントもネイティブ再ビルドが必要です。
