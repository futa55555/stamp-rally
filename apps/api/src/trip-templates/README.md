# Tripテンプレートpresetの編集

`trip-template-presets.json` に場所preset（`locations`）と活動preset（`activities`）を追加します。現在の沖縄県・北海道・温泉・海・登山は実装検証用の仮データです。本番用の内容に差し替えてください。

```json
{
  "locations": [
    {
      "name": "沖縄県",
      "aliases": ["沖縄", "おきなわ"],
      "template": {
        "genres": [
          { "name": "景色", "stamps": [{ "title": "海辺を散歩する" }] }
        ]
      }
    }
  ],
  "activities": [
    {
      "name": "海",
      "template": {
        "genres": [
          { "name": "景色", "stamps": [{ "title": "海辺を散歩する" }] }
        ]
      }
    }
  ]
}
```

- `name`、`title`、`aliases` の各文字列は前後に空白を入れず、1〜100文字で記述します。
- 場所は `name` または `aliases` に完全一致した場合に使います。`name` は自動で照合されるため、同じ文字列を `aliases` に書く必要はありません。別presetと同じ名前・別名は使えません。「那覇市」のように範囲が異なる場所は「沖縄県」の別名に含めません。
- 活動の `name` は選択肢の表示名です。活動の自由入力はTripに保存されますが、候補には使いません。
- genre名は共通表記（例：グルメ・景色・温泉・アウトドア・まち歩き・おみやげ）を使ってください。同じgenre内で同じ `title` のstampは1件にまとまります。genreが異なる同名stampは別候補です。
- 表示順は入力された場所、選択された活動、その中でのJSONの記載順です。重複したgenre・stampは最初に現れた位置にまとまります。
- 1presetあたり5〜10stampが目安です。件数の制限はありません。画像・説明・IDは不要です。stampの `title` は保存時にDBの `name` へ変換され、説明は空文字になります。

JSONの構造、文字数、preset名・場所の別名の衝突はAPI起動時に検証します。不正なデータはファイル内の項目位置を示して起動に失敗します。変更後はリポジトリのルートで `pnpm --filter api test src/trip-templates` と `pnpm --filter api build` を実行してください。JSONはAPIビルドに同梱されるため、反映にはAPIの再ビルド・再起動（デプロイ）が必要です。
