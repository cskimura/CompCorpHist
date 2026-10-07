# CompCorpHist
diagram of computer corporation

View: https://cskimura.github.io/CompCorpHist/history.html

## データの更新方法

`data.yaml` を直接編集して push するだけで反映されます(ビルドステップは不要)。

- `corporation:` に会社を1つ追加:
  ```yaml
  "SomeCorp":
      from: "1990-00-00"
      to: "now"
      wiki: "https://en.wikipedia.org/wiki/SomeCorp"
  ```
  創業日が不明な場合は `from` を省略できます(破線で表示されます)。

- `event:` に買収・合併・分割などの関係を1つ追加:
  ```yaml
  - date: "2024-01-01"
    kind: "acquired"   # acquired / merged / spun-off / carved-out / invested / partnership / transfer / subsidiary
    label: "SomeCorp was acquired by OtherCorp"
    source: "SomeCorp"
    target: "OtherCorp"
  ```
  `date` には対象企業の設立日・終了日を指すショートカット(`"SomeCorp:start"` / `"SomeCorp:end"`)も使えます。

行の並び順(レイアウト)は `history.html` を開いたときにブラウザ側で自動計算されるため、手動で順序を管理する必要はありません。企業の線やラベルをクリックすると関連するイベントだけハイライトされます。
