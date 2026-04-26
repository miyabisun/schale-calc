# schale-calc

[SchaleDB](https://schaledb.com/stage) のドロップデータと、
[ブルーアーカイブ攻略 Wiki の装備ページ](https://bluearchive.wikiru.jp/?%E8%A3%85%E5%82%99%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6) に掲載されている Tier アップの必要素材数をもとに、
任務 Normal 2倍期間で装備設計図を効率よく集める方法を模索しました。

計算結果はこちらです。

- **[オニア先生の黄金比を満たす最小 AP プラン](docs/onia-golden-plan.md)** — 黄金比を在庫として用意するための最小 AP の参考値。
- **[Area 別 1 出撃あたり万能設計図削減量](docs/area-wildcard-efficiency.md)** — エリア選びの効率比較。

> 2倍期間中の最終運用 (= 周回プラン本編) は別途策定中。

育成目標は [オニア先生の黄金比](docs/onia-golden-ratio.md) を採用しています。

---

### 詳細 (計算に使ったスクリプトやロジック)

- [任務データの読み方と絞り込み条件](docs/campaign-spec.md)
- [装備 Tier アップ仕様と万能設計図レート](docs/equipment-upgrade.md)
- [計算スクリプト](scripts/)
- [生成・取得したデータ](data/)
