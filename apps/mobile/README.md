# Stamp Rally mobile

Expo SDK 57 / React Native 0.86 / NativeWind 4.2。旅行・カテゴリー・スタンプ・写真・お知らせをAPIから取得します。

## 設定・起動

1. APIに追加migrationを適用して起動します（[API README](../api/README.md)）。適用順序は **API・worker停止 → migration → API・worker更新 → mobile更新** です。複数category対応では `20260912010000_stamp_categories` が必要で、旧APIとの互換性はありません。
2. `apps/mobile/.env.example` を参考に `apps/mobile/.env` にAPI URL・Google OAuth client ID・必要ならApple Team IDを設定します。
3. [ビルド前の手動設定](../../docs/build-setup.md)に従ってGoogle / Appleを登録します。local / dev / stg / prodのBundle ID・Android package・schemeはそれぞれ異なります。localは `com.futa.stamprally.local` です。
4. 以前のネイティブ生成物がある場合は、同ガイドのprebuild手順で識別子・署名Teamを更新します。

macOSでiOSをローカルビルドする場合は、Xcode・CocoaPodsに加えてCMakeをインストールしてください。Hermesの配布済みバイナリを取得できずソースからビルドする場合、`pod install` の時点で必要になります。

```sh
brew install cmake
```

iOSでは `app.json` の `expo-build-properties` で `usePrecompiledModules: false` を指定し、Expoモジュールをソースからビルドします。React Nativeの配布済みバイナリを取得できずソースビルドに切り替わった際、Expo側の配布済みバイナリと混在すると、起動時に `Library not loaded: @rpath/React.framework/React` で終了するためです。初回ビルドには時間がかかります。設定を変更した場合は `pnpm mobile:prebuild` → `pnpm mobile:ios` で開発ビルドを作り直してください。

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

- `src/app/`：Expo Router、NativeTabs、認証状態に応じた `Stack.Protected`。`ONBOARDING` のユーザーは名前設定成功後にMainへ進みます。招待リンクからの遷移では招待画面へ戻ります。
- `src/pages/`：画面と画面専用コンポーネント。旅行・カテゴリー・スタンプのフォームは `entity-editor/` に集約します。
- `src/features/app-data/api/`：axiosクライアント、セッション管理、TanStack Query、全ページ取得、mutation。`AppDataProvider` は認証と操作を公開し、全旅行データをContextには保持しません。
- `src/features/{trips,photos,notifications}/`：画面に必要なリソース取得、ドメイン型、代表画像の選択、通知・保存後の階層付き遷移。
- `src/features/auth/`：Google／AppleのID token取得。refresh tokenはSecureStore、access tokenはメモリに保持します。
- `src/shared/`：UI、エラー整形、日付・テーマなど。依存方向は `app → pages → features → shared`、feature間の参照は許可します。
- `src/features/app-data/{mocks,tests,model}/` と `api/DataService.ts`：既存の純粋なドメインテスト用のモック資産。実行時のProviderは使いません。

起動時はrefresh tokenからセッションを復元して `/users/me` を取得します。通信失敗時は復元の再試行を表示し、認証拒否時はログイン画面に戻ります。同時401のrefreshは1本にまとめ、元のリクエストを1回だけ再送します。ログアウト時は通信・Queryキャッシュ・認証状態を破棄し、古い通信やネイティブログイン結果を受け付けません。SecureStoreの書き込みと消去も直列化しています。

Queryのキーにはユーザー・リソース・条件を含めます。旅行・カテゴリー・スタンプ・写真・参加者は `limit=100` でcursor末尾まで取得します。通知は20件ごとに追加読み込みし、バッジはAPIの全未読件数を使います。キャッシュの鮮度は30秒で、再フォーカス・アプリ復帰・通信復旧では有効なキャッシュを再利用します。更新操作・プル更新・エラーの再試行はキャッシュを無効化し、TanStack Queryが表示中のデータを再取得します。非表示の画面は戻った時点で古いデータを取得します。処理中アップロードの進捗確認は4秒間隔で継続します。達成状態・写真件数・未読集計にはサーバーの値を使います。

画像はメモリとディスクにキャッシュし、キャッシュキーと表示コンポーネントの識別から署名パラメーターを除きます。通信には署名付きURLを使用し、画像のサイズ・バージョン・変換条件は区別します。同じ画像の署名だけが更新されても表示をリセットせず、取得に失敗した場合は新しいURLで再試行します。

カテゴリー内の画像投稿は全ページ取得が完了してから代表画像の候補に渡します。お気に入りがあればその中から、なければ全画像からランダムに選びます。候補の集合が変わるまで同じ画面内の選択を保持するため、投稿数に応じて取得量が増えます。

通知と編集完了時には対象と親リソースを取得し、旅行→カテゴリー→スタンプ→写真の戻る階層を構築します。stamp・写真の遷移には経由したcategoryを引き継ぎ、所属から外れた場合や通知から開く場合は最初のcategory（作成日時・ID昇順）を使います。通常の画面遷移では既存の戻るスタックを維持します。保存後に遷移の取得が失敗しても、再試行で同じ項目を重複作成しません。編集中の値はQueryの再取得で上書きしません。

## 今回利用できる操作

- 旅行・カテゴリー・スタンプの取得、作成、編集。旅行の行き先は前後空白を除き、同じ場所を重複追加できません。`[]` で全解除できます。
- スタンプは1つの旅行内で複数カテゴリーを選択できます。作成・編集フォームのchipで1つ以上選び、詳細では1行目に旅行名、2行目に所属カテゴリー名をカンマ区切りで表示します。テンプレートの同名候補は選択したカテゴリーを共有する1つのスタンプになります。投稿は各カテゴリーから同じものを参照します。
- 写真・動画の表示、お気に入り、共有、端末への保存、参加者による削除。サムネイルはsmall、写真詳細・ズームはlarge、動画再生はplaybackを使い、共有・保存ではoriginalを取得します。
- 自分以外の写真はlargeの表示成功、動画は最初のフレーム表示と再生開始を確認し、詳細画面がフォーカスされている場合に既読にします。隣の項目の先読み、サムネイルやBlurHashの表示では既読にしません。通知既読は独立しています。
- 写真・動画は一度に30件、うち動画5本まで追加できます。写真50MB、動画1GB・5分が上限です。送信進捗、個別再試行・キャンセル、アプリ復帰後の分割送信再開に対応します。
- 今回追加した写真・動画がすべて公開されると、投稿画面を閉じて対象のスタンプ画面へ移動します。キャンセルした項目は完了待ちの対象から外し、全件キャンセルの場合は移動しません。完了した送信記録は端末から自動で消去します。失敗した項目は再試行でき、画面移動だけの失敗で投稿を重複作成しません。
- 写真詳細は1〜4倍のピンチズーム、拡大中のパン、ダブルタップによる1倍／2倍切り替えに対応します。
- カバー画像の追加と変更は準備中表示です。既存カバーの解除は利用できます。

アップロードにはAPI側のR2設定と変換ワーカーが必要です。[アップロード仕様・起動手順](../../docs/media-uploads.md)を参照してください。端末で原本を保持して直接送信し、変換済みの項目から公開します。署名付きURLと認証トークンを送信キューへ永続化しません。招待リンク・参加申請・最終承認は[招待仕様](../../docs/invitations.md)を参照してください。プッシュ通知・リアルタイム配信は後続です。

## 検証

```sh
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm lint
pnpm --filter mobile exec expo export --platform ios --platform android
```

自動テストはセッション復元、初回名前設定、同時・遅延401、logoutとrefresh／SecureStore／ネイティブログインの競合、ページ境界、mutationのキャッシュ反映、代表画像の保持、表示後の既読、通知の親階層取得を検証します。既存の並べ替え・日程・行き先・共有・保存のテストも維持しています。

expo-image・expo-video・ジェスチャーと権限設定の変更を反映するため、既存の開発ビルドも再ビルドしてください。OAuth設定済みの開発ビルドで、以下の端末確認を行ってください：

1. iOSのGoogle／AppleとAndroidのGoogleで実ログインし、新規アカウントは名前設定を完了する。
2. アプリを終了・再起動してログインが復元すること、オフライン起動は再試行できること、ログアウト後の再起動でログイン画面になることを確認する。
3. 参加者間で旅行・カテゴリー・スタンプを更新し、お知らせと未読件数、階層付き遷移を確認する。
4. 複数カテゴリーのスタンプを作成・編集し、所属カテゴリーの一覧・詳細見出し・元のカテゴリーへの戻り・投稿の達成と既読・tripのお気に入りが重複しないことを確認する。
5. 写真詳細の横スワイプ・ズーム、動画再生、お気に入り、原本の共有・保存、既読、削除後の達成状態を確認する。
6. HEIC・HEVCを含む複数投稿、通信中断とアプリ復帰後の再開、個別失敗・キャンセル、他の参加者への公開、動画通知からの遷移を確認する。実機の権限とOSシートはunit／exportでは検証できません。

## 写真

ログイン画面の風景は同梱画像です。`assets/demo` は [Unsplash](https://unsplash.com/license) のサンプル写真で、元のURLは `assets/demoPhotoUrls.ts` に記録しています。
