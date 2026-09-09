# Stamp Rally mobile

Expo SDK 57 / React Native 0.86 / NativeWind 4.2。旅行・ジャンル・スタンプ・写真・お知らせをAPIから取得します。

## 設定・起動

1. APIに追加migrationを適用して起動します（[API README](../api/README.md)）。適用順序は **migration → API → mobile** です。
2. `apps/mobile/.env.example` を参考に `apps/mobile/.env` にAPI URL・Google OAuth client ID・必要ならApple Team IDを設定します。
3. [ビルド前の手動設定](../../docs/build-setup.md)に従ってGoogle / Appleを登録します。local / dev / stg / prodのBundle ID・Android package・schemeはそれぞれ異なります。localは `com.futa.stamprally.local` です。
4. 以前のネイティブ生成物がある場合は、同ガイドのprebuild手順で識別子・署名Teamを更新します。

```sh
pnpm install
pnpm mobile:ios
pnpm mobile:android
# 既存の開発ビルドに接続する場合
pnpm mobile:start
# EAS developmentの環境変数で実機の開発ビルドに接続する場合
pnpm mobile:start:remote
```

Google認証は `react-native-nitro-google-signin` とNitro Modulesを使うため、Expo Goではなく開発ビルドを使用します。ネイティブ依存やOAuth URL schemeを変更した際は再ビルドしてください。iOSはGoogle＋Apple、AndroidはGoogleを表示します。Appleのnonceはログインのたびに生成し、OSとAPIに同じ値を渡します。

API URLは必須です。iOSシミュレーターは `http://localhost:3000`、Androidエミュレーターは `http://10.0.2.2:3000`、remoteは端末から到達可能なHTTPS URLを指定してください。localではOAuth設定前でもexportできますが、Googleログイン時に設定エラーを表示します。remoteはAPI URL・Google Web / iOS client IDがないとビルドできません。

`APP_VARIANT` は未指定時にlocal、通常はscripts / EAS build profileから指定します。`staging` profileはEASの `preview` 環境を使います。アプリ識別子は `app.config.ts` に集約し、EASプロジェクトは全環境共通です。環境変数の登録先、配布コマンド、XcodeのApple Account変更は[手動設定ガイド](../../docs/build-setup.md)を参照してください。

remoteの必須値検証はEASの `eas-build-pre-install` と `start:remote` で実行します。EASは環境変数取得前にも `app.config.ts` を評価するため、config読込だけでは必須値エラーにしません。

参照：[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)、[Google認証のExpo設定](https://react-native-nitro-google-sign-in.github.io/docs/setup/expo/)、[TanStack QueryのReact Native対応](https://tanstack.com/query/latest/docs/framework/react/react-native)。

## データ・認証の構成

- `src/app/`：Expo Router、NativeTabs、認証状態に応じた `Stack.Protected`。`ONBOARDING` のユーザーは名前設定成功後にMainへ進みます。
- `src/pages/`：画面と画面専用コンポーネント。旅行・ジャンル・スタンプのフォームは `entity-editor/` に集約します。
- `src/features/app-data/api/`：axiosクライアント、セッション管理、TanStack Query、全ページ取得、mutation。`AppDataProvider` は認証と操作を公開し、全旅行データをContextには保持しません。
- `src/features/{trips,photos,notifications}/`：画面に必要なリソース取得、ドメイン型、代表画像の選択、通知・保存後の階層付き遷移。
- `src/features/auth/`：Google／AppleのID token取得。refresh tokenはSecureStore、access tokenはメモリに保持します。
- `src/shared/`：UI、エラー整形、日付・テーマなど。依存方向は `app → pages → features → shared`、feature間の参照は許可します。
- `src/features/app-data/{mocks,tests,model}/` と `api/DataService.ts`：既存の純粋なドメインテスト用のモック資産。実行時のProviderは使いません。

起動時はrefresh tokenからセッションを復元して `/users/me` を取得します。通信失敗時は復元の再試行を表示し、認証拒否時はログイン画面に戻ります。同時401のrefreshは1本にまとめ、元のリクエストを1回だけ再送します。ログアウト時は通信・Queryキャッシュ・認証状態を破棄し、古い通信やネイティブログイン結果を受け付けません。SecureStoreの書き込みと消去も直列化しています。

Queryのキーにはユーザー・リソース・条件を含めます。旅行・ジャンル・スタンプ・写真・参加者は `limit=100` でcursor末尾まで取得します。通知は20件ごとに追加読み込みし、バッジはAPIの全未読件数を使います。再フォーカス、アプリ復帰、通信復旧、手動更新で再取得します。達成状態・写真件数・未読集計にはサーバーの値を使います。

ジャンル内の画像投稿は全ページ取得が完了してから代表画像の候補に渡します。お気に入りがあればその中から、なければ全画像からランダムに選びます。候補の集合が変わるまで同じ画面内の選択を保持するため、投稿数に応じて取得量が増えます。

通知と編集完了時には対象と親リソースを取得し、旅行→ジャンル→スタンプ→写真の戻る階層を構築します。保存後に遷移の取得が失敗しても、再試行で同じ項目を重複作成しません。編集中の値はQueryの再取得で上書きしません。

## 今回利用できる操作

- 旅行・ジャンル・スタンプの取得、作成、編集。旅行の行き先は空白・空項目を除いて順序と重複を保持します。`[]` で全解除できます。
- 写真の表示、お気に入り、共有、端末への保存、参加者による削除。既存の `mediaUrl` を使います。
- 自分以外の写真は、写真詳細で表示に成功して画面がフォーカスされている場合だけ既読にします。隣の写真の先読みでは既読にしません。通知既読は独立しています。
- 写真投稿・カバー画像の追加と変更は準備中表示です。端末内URIはAPIへ送信しません。既存カバーの解除は利用できます。

画像upload・複数枚投稿・派生画像URLへの移行・画像キャッシュ方針・招待UI・動画UI・プッシュ通知・リアルタイム配信は後続です。動画や招待の既存APIは維持します。

## 検証

```sh
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm lint
pnpm --filter mobile exec expo export --platform ios --platform android
```

自動テストはセッション復元、初回名前設定、同時・遅延401、logoutとrefresh／SecureStore／ネイティブログインの競合、ページ境界、mutationのキャッシュ反映、代表画像の保持、表示後の既読、通知の親階層取得を検証します。既存の並べ替え・日程・行き先・共有・保存のテストも維持しています。

OAuth設定済みの開発ビルドで、以下の端末確認を行ってください：

1. iOSのGoogle／AppleとAndroidのGoogleで実ログインし、新規アカウントは名前設定を完了する。
2. アプリを終了・再起動してログインが復元すること、オフライン起動は再試行できること、ログアウト後の再起動でログイン画面になることを確認する。
3. 参加者間で旅行・ジャンル・スタンプを更新し、お知らせと未読件数、階層付き遷移を確認する。
4. 写真詳細の横スワイプ、お気に入り、共有、保存、既読、削除後の達成状態を確認する。実機の権限とOSシートはunit／exportでは検証できません。

## 写真

ログイン画面の風景は同梱画像です。`assets/demo` は [Unsplash](https://unsplash.com/license) のサンプル写真で、元のURLは `assets/demoPhotoUrls.ts` に記録しています。
