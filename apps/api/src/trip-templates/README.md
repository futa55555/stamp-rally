# Tripテンプレートpresetの編集

`trip-template-presets.json` の `locations` と `activities` を編集します。APIの起動時に構造・文字数・別名の衝突・固定IDを検証します。

```json
{
  "locations": [
    {
      "key": "location-island",
      "name": "島県",
      "aliases": ["島"],
      "template": {
        "categories": [
          {
            "key": "category-scenery",
            "name": "景色",
            "stamps": [{ "key": "stamp-beach", "title": "海辺を散歩する" }]
          }
        ]
      }
    }
  ],
  "activities": [
    {
      "key": "activity-sea",
      "name": "海",
      "template": {
        "categories": [
          {
            "key": "category-scenery",
            "name": "景色",
            "stamps": [{ "key": "stamp-beach", "title": "海辺を散歩する" }]
          }
        ]
      }
    }
  ]
}
```

- `key` は変更しない固定IDです。英小文字・数字・ハイフンで1〜100文字にします。表示名を変える場合も同じkeyを維持し、別の体験には新しいkeyを発行します。
- 同じカテゴリー・スタンプを複数のpresetに記載するときは、同じkeyと表示名を使います。同じstamp keyは旅行内で1つのスタンプになり、複数カテゴリーに所属できます。
- `name`、`title`、`aliases` は前後に空白を入れず、1〜100文字で記述します。場所は名前または別名の完全一致で照合します。
- 活動の自由入力は旅行のメモです。テンプレート候補には使いません。
- 表示順は入力された場所、活動、その中でのJSON記載順です。重複する固定IDは最初の位置にまとまります。
- 画像・説明は不要です。新規スタンプのtitleをDBのnameに使い、説明は空文字にします。既存の旅行で利用者が編集した名称は書き換えません。

新しく作成した旅行は、固定ID、所属ごとの由来、入力とpreset keyの対応、手動で外した選択を保存します。既存データは手動追加として扱い、名前から由来を推測しません。削除済みのテンプレートを再追加すると、新しい行を作ります。

変更後は `pnpm --filter api test` と `pnpm --filter api build` を実行します。JSONはビルドに同梱するため、反映にはAPIの再ビルドとデプロイが必要です。旅行編集の契約は [docs/trip-editing.md](../../../../docs/trip-editing.md) を参照してください。
