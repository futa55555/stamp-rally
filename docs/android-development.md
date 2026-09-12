# Androidのローカル開発

Android Studioのエミュレーター、またはUSBデバッグを有効にしたAndroid実機を使います。Android SDKの `platform-tools`（`adb`）をPATHに追加してください。

Androidの `localhost` はAndroid自身です。エミュレーターから開発PCの `127.0.0.1` に直接接続するアドレスは `10.0.2.2` です。このプロジェクトでは `adb reverse` でポートを転送し、iOSと同じ `localhost` の環境変数で開発します。招待WebのAPI接続先とCORS設定も共通にできます。

## 環境変数

`apps/mobile/.env`：

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000
# 招待リンクの共有を使う場合のみ設定
EXPO_PUBLIC_INVITATION_ORIGIN=http://localhost:5173
```

招待Webを使う場合は、`apps/web/.env` に `WEB_API_URL=http://localhost:3000`、`apps/api/.env` に `INVITATION_PUBLIC_ORIGIN=http://localhost:5173` を設定します。

## 起動

1. Android StudioのDevice Managerでエミュレーターを起動するか、USBデバッグを許可した実機を接続します。`adb devices` に状態 `device` で表示されることを確認します。
2. リポジトリのルートでポートを転送します。

   ```sh
   pnpm mobile:android:connect
   ```

   Androidの3000番（API）、5173番（招待Web）、8081番（Metro）を開発PCの同じポートへ転送します。エミュレーターの再起動や実機の再接続後は再実行してください。

3. 別のターミナルでAPIを起動します。招待Webの確認にはWebも起動します。

   ```sh
   pnpm api:dev
   ```

   ```sh
   pnpm web:dev
   ```

4. Androidアプリをビルド・インストールして起動します。

   ```sh
   pnpm mobile:android
   ```

ネイティブの変更がなくインストール済みなら、`pnpm mobile:start` のターミナルで `a` を押して開けます。Metroが既に起動している場合はそのターミナルを使います。

複数のAndroid端末が接続されている場合は、対象を明示して転送します。

```sh
ANDROID_SERIAL=emulator-5554 pnpm mobile:android:connect
```

`adb reverse --list` で転送設定を確認できます。Androidのブラウザで `http://localhost:5173/` を開くと招待Webを確認できます。HTTPのローカルURLにはOSのアプリ関連付けを生成しないため、招待リンクからの自動起動はremote dev / stagingのHTTPS URLで検証します。

参考：[Android Emulatorのネットワークアドレス](https://developer.android.com/studio/run/emulator-networking-address)、[React Nativeのadb reverseによる接続](https://reactnative.dev/docs/0.80/running-on-device)。
