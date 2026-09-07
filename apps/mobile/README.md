# Stamp Rally mobile

Expo SDK 57 / React Native 0.86。React Native 標準コンポーネントと MaterialCommunityIcons で作った、旅行の写真を共有するアプリのモックです。

## 起動・検証

```sh
pnpm install
pnpm --filter mobile ios
pnpm --filter mobile android
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios --platform android
```

Google / Apple のどちらからもサンプルアカウントで入れます。実際の認証やAPI通信は行いません。変更はメモリに保持され、ログアウト後の再ログインでは残りますが、アプリの再起動・開発中のリロードではリセットされます。サンプル写真は同梱されています。

## 構成

- `src/theme/`：palette・意味別のカラートークン、余白・角丸・文字スタイル、ThemeProvider。配色は `tokens.ts` に集約し、画面では `useAppTheme()` を使用します。
- `src/components/`：標準の View / Text / Pressable などで構成した共通UI。PaperなどのUIライブラリは使用しません。
- `src/app/`：Expo Router のファイルベースルーティング。`Stack.Protected` で認証分岐し、`(main)/_layout.tsx` の `NativeTabs` に旅行・お知らせ・設定を配置します。各タブ内は `Stack` です。
- `src/navigation/`：共通ヘッダーと通知の遷移先解決。通知からは対象の親階層を構成します。
- `src/data/`：APIに対応する型、非同期の `DataService`、モックアダプター、Context / Reducer。`AppDataProvider` に別のサービスを渡して差し替えられます。
- `src/features/`：画面とデータ取得フック。

タブバーは `expo-router/unstable-native-tabs` の OS ネイティブUIです。アイコンは `NativeTabs.Trigger.VectorIcon` を通して MaterialCommunityIcons を使用し、ラベル・アイコン・選択背景・未読バッジの色もテーマトークンから指定します。

旅行は端末の暦日で期間内のものを優先し、同グループ内は作成日時の降順です。お気に入りは共有・複数枚。写真の既読は自分以外の写真が PhotoDetail で読み込みに成功し、画面がフォーカスされたときに更新します。通知の既読とは独立しています。

名前はtrim後1〜20文字、サンプルユーザー間で一意です。動画・投稿・作成編集・コメント・プッシュ通知・端末保存は今回の対象外です。UI文言は日本語、テーマはライトのみです。

## 手動確認

1. ログイン → 旅行 → ジャンル → スタンプ → 写真の順に移動し、戻る。お気に入り一覧からの写真表示も確認する。
2. 京都の「朝のまちを歩く」の未読写真（あおい）を開き、ジャンル・スタンプのバッジが消えることを確認する。
3. 星を操作し、旅行ホームのお気に入りにも反映されることを確認する。
4. お知らせから写真・スタンプ・旅行・ジャンルへ移動し、戻ると同じ旅行の親画面になることを確認する。
5. 設定で名前変更・空文字や重複名のエラー・キャンセル・キーボードを確認する。ログアウト後、戻る操作で Main に戻れないことを確認する。
6. 未来の旅行、空のジャンル／スタンプ、小さい画面、文字拡大、画像読み込み失敗を確認する。

## 写真

`assets/demo` は [Unsplash](https://unsplash.com/license) のサンプル写真です。元の画像URLは `src/data/demoPhotoUrls.ts` に記録しています。画面の旅行名や投稿者は架空で、写真はイメージです。
