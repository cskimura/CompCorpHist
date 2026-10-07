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
    kind: "acquired"   # acquired / merged / spun-off / carved-out / invested / partnership / transfer / subsidiary / divested
    label: "SomeCorp was acquired by OtherCorp"
    source: "SomeCorp"
    target: "OtherCorp"
  ```
  `date` には対象企業の設立日・終了日を指すショートカット(`"SomeCorp:start"` / `"SomeCorp:end"`)も使えます。

  `kind`の使い分け:
  - `acquired` / `merged`: 会社そのものが消滅する(買収・合併)。消滅する側の`corporation.to`も必ず更新すること。
  - `divested`: 事業部門・ブランドだけが移る(会社自体は存続し続ける)。例: 「IBMのサーバー事業をLenovoに売却」。`corporation.to`は変更しない。
  - `spun-off` / `carved-out`: 一部門が新しい法人として独立する。
  - `invested` / `partnership` / `subsidiary` / `transfer`: 出資・合弁・業務提携など、どちらの会社も消滅しない関係。

  **日付は買収発表日ではなく、取引完了(closing)日を使うこと**(発表から完了まで半年〜1年ずれることが多いため)。

- 社名変更(買収ではなく同一法人が名前を変える場合)は、`corporation`に`renames`を追加する:
  ```yaml
  "Avago":
      from: "2005-00-00"
      to: "now"
      wiki: "https://en.wikipedia.org/wiki/Avago_Technologies"
      renames:
          - date: "2016-02-01"
            name: "Broadcom Limited"
            wiki: "https://en.wikipedia.org/wiki/Broadcom_Limited"
  ```
  これにより生存期間の線は途切れずに続き、改名した時点に印が付きます(`event`に買収として書いてしまうと、本来続いている会社の線が消えてしまいます)。

行の並び順(レイアウト)は `history.html` を開いたときにブラウザ側で自動計算されるため、手動で順序を管理する必要はありません。企業の線やラベルをクリックすると関連するイベントだけハイライトされます。
