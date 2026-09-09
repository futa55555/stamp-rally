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

写真はJPEG・PNG・WebP・HEIC/HEIF・AVIF、動画はMP4/MOVのH.264・HEVCに対応します。Live Photosの動画とのペア保存、RAW、アニメーション画像、旅行カバーのアップロードは対象外です。

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

削除はDB側の権限・公開状態と連動し、R2の原本・派生・途中ファイルを清掃します。処理中に削除されたファイルは、変換が後から完了しても公開しません。清掃処理も再試行できるようにDBへ記録します。

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
