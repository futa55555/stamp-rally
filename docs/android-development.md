# Androidのローカル開発

Android Studioのエミュレーター、またはUSBデバッグを有効にしたAndroid実機を使います。Android SDKの `platform-tools`（`adb`）をPATHに追加してください。

Androidの `localhost` はAndroid自身です。エミュレーターから開発PCの `127.0.0.1` に直接接続するアドレスは `10.0.2.2` です。このプロジェクトではローカルの起動コマンドが `adb reverse` を自動実行し、iOSと同じ `localhost` の環境変数で開発します。招待WebのAPI接続先とCORS設定も共通にできます。

## 環境変数

`apps/mobile/.env`：

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000
# 招待リンクの共有を使う場合のみ設定
EXPO_PUBLIC_INVITATION_ORIGIN=http://localhost:5173
```

招待Webを使う場合は、`apps/web/.env` に `WEB_API_URL=http://localhost:3000`、`apps/api/.env` に `INVITATION_PUBLIC_ORIGIN=http://localhost:5173` を設定します。

## 起動

1. 別のターミナルでAPIを起動します。招待Webの確認にはWebも起動します。

   ```sh
   pnpm api:dev
   ```

   ```sh
   pnpm web:dev
   ```

2. Androidアプリをビルド・インストールして起動します。

   ```sh
   pnpm mobile:android
   ```

ネイティブの変更がなくインストール済みなら、`pnpm mobile:start` のターミナルで `a` を押して開けます。Metroが既に起動している場合はそのターミナルを使います。

`mobile:start`・`mobile:android`・`mobile:ios` は、起動中にAndroidの3000番（API）と5173番（招待Web）を開発PCの同じポートへ自動転送します。Metroのポート転送はExpoが行います。後からエミュレーターを起動した場合や、実機を再接続した場合も自動で設定し直すため、別の `connect` コマンドは不要です。起動コマンドを終了すると端末の監視も終了します。

自動転送の対象は `adb devices` に状態 `device` で表示される端末です。USB実機ではUSBデバッグを許可してください。この処理はローカルの起動コマンドだけで動作し、remote dev / staging / productionのコマンドと環境変数には影響しません。

複数のAndroid端末が接続されている場合は、対象を明示して転送します。

```sh
ANDROID_SERIAL=emulator-5554 pnpm mobile:start
```

`adb reverse --list` で転送設定を確認できます。Androidのブラウザで `http://localhost:5173/` を開くと招待Webを確認できます。HTTPのローカルURLにはOSのアプリ関連付けを生成しないため、招待リンクからの自動起動はremote dev / stagingのHTTPS URLで検証します。

参考：[Android Emulatorのネットワークアドレス](https://developer.android.com/studio/run/emulator-networking-address)、[React Nativeのadb reverseによる接続](https://reactnative.dev/docs/0.80/running-on-device)。
