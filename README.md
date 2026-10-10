# schale-calc

ブルーアーカイブのイベントや募集について計算した結果を、計算ごとのディレクトリにまとめています。
結果は GitHub Pages で公開しています。

**公開ページ: https://miyabisun.github.io/schale-calc/**

## 計算の一覧

| ディレクトリ | 内容 | 公開ページ |
|---|---|---|
| [dice-run-occult-2026/](dice-run-occult-2026/) | 復刻「我らオカルト研究会」（2026年10月）のサイコロランで、確定サイコロの使い方ごとに神名のカケラの数を比べたモンテカルロ・シミュレーション | [サイコロランの確定サイコロの使い方](https://miyabisun.github.io/schale-calc/dice-run-occult-2026/) |
| [gacha/](gacha/) | ピックアップの生徒が揃う確率を、呼び出しポイントと呼び出しチャージで比べた計算（旧 [arona-gacha-calc](https://github.com/miyabisun/arona-gacha-calc) から移設） | [ガチャ確率の比較](https://miyabisun.github.io/schale-calc/gacha/)（[English](https://miyabisun.github.io/schale-calc/gacha/en/)） |
| [equipment-blueprint/](equipment-blueprint/) | 任務 Normal の2倍期間に装備設計図を集める周回の計算 | [README](equipment-blueprint/README.md) から各結果へ |

## 計算をやり直す

Node.js 18 以上で動きます。

```sh
npm ci
npm test        # すべての計算のテスト
npm run build   # 保存済みのデータから、装備設計図の結果と gacha・サイコロランの公開ページを作り直す
```

個別に作り直すときは次のコマンドを使います。

| コマンド | 作り直すもの |
|---|---|
| `npm run build:normal` | `equipment-blueprint/data/campaign-normal-rewards.yaml`（`data/raw/` から作る） |
| `npm run plan:onia-golden` | `equipment-blueprint/data/onia-golden-plan.yaml` と `equipment-blueprint/docs/onia-golden-plan.md` |
| `npm run build:gacha` | `gacha/` の公開ページ・グラフ・計算結果の JSON |
| `npm run build:dice-run` | `dice-run-occult-2026/index.html` と `dice-run-occult-2026/data/results.json`（保存済みの乱数表 `data/table.json` と、次の行の `data/optimal.json` を使う） |
| `npm run solve:dice-run` | `dice-run-occult-2026/data/optimal.json`（サイコロランの期待値が最大になる使い方の計算結果。`npm run build` には含まれない） |
| `npm run fetch` | `equipment-blueprint/data/raw/`（SchaleDB から取得し直す） |

`npm run solve:dice-run` は、手持ちの上限を16個・18個・20個と広げながら最適な使い方を計算するため、手元のPC（Ryzen 7 PRO 4750GE）で約3分かかり、メモリを最大約7GB使います。結果は `data/optimal.json` に保存してあるので、ページを作り直すだけなら実行は要りません。乱数表や盤面の計算を変えたときは、`npm run solve:dice-run` の後に `npm run build:dice-run` を実行します。

サイコロランの乱数表を作り直す場合は `node dice-run-occult-2026/scripts/generate-table.js` を実行します。乱数表を変えると公開中の数値も変わります。

## 公開の仕組み

GitHub Pages は main ブランチのリポジトリ直下を配信しています。
`index.html` が一覧ページで、各ディレクトリの `index.html` がそれぞれの公開ページです。
ページの配色と組み方は [DESIGN.md](DESIGN.md) にまとめています。

## ライセンス

[gacha/](gacha/) は移設元の MIT License（[gacha/LICENSE](gacha/LICENSE)）を引き継いでいます。
