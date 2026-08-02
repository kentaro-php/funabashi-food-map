
DeepL翻訳

日本語

英語（US）
日本# 船橋市 食品営業許可マップ

[![Deploy to GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-success)](https://kentaro-php.github.io/funabashi-food-map/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

船橋市オープンデータ「食品営業施設一覧」を地図とインフォグラフィックで可視化する civic-tech ツールです。

🔗 **公開URL**: https://kentaro-php.github.io/funabashi-food-map/

![スクリーンショット](og-image.png)

## 特徴

- 📊 **常に最新**: 船橋市が公開する CKAN Data API から直接取得（更新作業不要）
- 📱 **モバイル最適化**: スマホで見やすい縦スクロール型ダッシュボード
- 🗺️ **地図ビュー**: 1,200件超の許可施設を町丁目単位でマッピング、業種別色分け
- 🔍 **横断検索**: 施設名・住所・業態・法人名で瞬時検索
- 🌓 **ダーク/ライト自動切替**: OSのカラーモードに連動

## 表示している分析

1. **業種分布** - ドーナツチャート + 全業種凡例
2. **エリア分布 TOP10** - 店舗が密集する町丁目ランキング
3. **新規許可の推移** - 月別棒グラフ（直近24ヶ月）
4. **多店舗展開ランキング** - 同一法人で複数許可を持つ事業者
5. **許可満了の波** - 今後12ヶ月の更新申請対象

## 技術スタック

| 種別 | 採用技術 |
|------|---------|
| データソース | [BODIK CKAN Data API](https://data.bodik.jp/) |
| グラフ | [Chart.js 4](https://www.chartjs.org/) |
| 地図 | [Leaflet](https://leafletjs.com/) + [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) |
| 地図タイル | [CARTO](https://carto.com/) (light/dark両対応) |
| ジオコーディング | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| ホスティング | GitHub Pages |

依存ライブラリは全て CDN 経由で読み込むため、ビルド不要・デプロイは静的ファイルのみ。

## ローカルで動かす

依存パッケージがないため、シンプルなHTTPサーバーで動きます。

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .

# Ruby
ruby -run -ehttpd . -p8000
```

ブラウザで `http://localhost:8000/` を開く。

## GitHub Pagesでデプロイ

1. このリポジトリをforkまたはclone
2. GitHubリポジトリの Settings → Pages
3. Source: `Deploy from a branch` → Branch: `main` / `/ (root)` を選択
4. 数分後、`https://<your-username>.github.io/funabashi-food-map/` で公開される

## ディレクトリ構成

```
funabashi-food-map/
├── index.html          # メインページ
├── assets/
│   ├── app.js          # アプリケーションロジック
│   ├── styles.css      # スタイル
│   └── favicon.svg     # ファビコン
├── .nojekyll           # Jekyllビルドを無効化
└── README.md
```

## データソース

- **データセット**: [食品営業施設一覧 - 船橋市オープンデータ](https://data.bodik.jp/dataset/122041_shokuhineigyoukyokasisetu)
- **ライセンス**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)
- **API エンドポイント**: `https://data.bodik.jp/api/3/action/datastore_search`
- **リソースID**: `23b029a9-6c56-4869-8cea-9a9282d50900`

## 既知の制限

- **位置情報の精度**: 町丁目レベルの代表座標で表示。番地レベルの正確な位置ではない
- **県内一円町**: 移動販売など特定住所を持たない事業者（16件）は地図対象外
- **ジオコーディング**: 初回のみ Nominatim 経由で町丁目座標を取得（約1〜2分）。2回目以降は localStorage キャッシュで瞬時表示
  
## ライセンス

MIT License

## 注意

本サイトは船橋市・公的機関とは無関係の **非公式ツール** です。データの正確性については、必ず船橋市公式の[食品営業施設一覧](https://www.city.funabashi.lg.jp/kenkou/eisei/004/p064870.html)をご確認ください。


Japan # Funabashi City Food Business License Map


[![Deploy to GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-success)](https://kentaro-php.github.io/funabashi-food-map/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)


This is a civic-tech tool that visualizes Funabashi City’s open data “List of Food Business Facilities” using maps and infographics.


🔗 **Public URL**: https://kentaro-php.github.io/funabashi-food-map/


![Screenshot](og-image.png)


## Features


- 📊 **Always Up-to-Date**: Data is retrieved directly from the CKAN Data API published by Funabashi City (no manual updates required)
- 📱 **Mobile-Optimized**: A vertical-scrolling dashboard designed for easy viewing on smartphones
- 🗺️ **Map View**: Over 1,200 licensed facilities mapped by town and block, color-coded by business type
- 🔍 **Cross-Search**: Instant search by facility name, address, business type, or company name
- 🌓 **Auto Dark/Light Mode Switch**: Synchronizes with the OS’s color mode


## Analyses Displayed


1. **Business Type Distribution** - Donut chart + legend for all business types
2. **Top 10 Area Distributions** - Ranking of town blocks with the highest concentration of stores
3. **Trends in New Licenses** - Monthly bar chart (last 24 months)
4. **Multi-Store Expansion Ranking** - Businesses holding multiple licenses under the same corporate entity
5. **License Expiration Trends** - Licenses subject to renewal applications in the next 12 months


## Technology Stack


| Category | Technologies Used |
|------|---------|
| Data Source | [BODIK CKAN Data API](https://data.bodik.jp/) |
| Charts | [Chart.js 4](https://www.chartjs.org/) |
| Maps | [Leaflet](https://leafletjs.com/) + [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) |
| Map Tiles | [CARTO](https://carto.com/) (supports both light and dark modes) |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| Hosting | GitHub Pages |


Since all dependency libraries are loaded via CDN, no build is required, and deployment involves only static files.


## Running Locally


Since there are no dependency packages, it runs on a simple HTTP server.


```bash
# Python 3
python3 -m http.server 8000


# Node.js
npx serve .


# Ruby
ruby -run -ehttpd . -p8000
```


Open `http://localhost:8000/` in your browser.


## Deploying to GitHub Pages


1. Fork or clone this repository
2. Go to Settings → Pages in your GitHub repository
3. Source: `Deploy from a branch` → Branch: Select `main` / `/ (root)`
4. After a few minutes, it will be published at `https://<your-username>.github.io/funabashi-food-map/`


## Directory Structure


```
funabashi-food-map/
├── index.html # Main page
├── assets/
│ ├── app.js # Application logic
│ ├── styles.css # Styles
│ └── favicon.svg # Favicon
├── .nojekyll # Disable Jekyll build
└── README.md
```


## Data Sources


- **Dataset**: [List of Food Service Establishments - Funabashi City Open Data](https://data.bodik.jp/dataset/122041_shokuhineigyoukyokasisetu)
- **License**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)
- **API Endpoint**: `https://data.bodik.jp/api/3/action/datastore_search`
- **Resource ID**: `23b029a9-6c56-4869-8cea-9a9282d50900`


## Known Limitations


- **Location Accuracy**: Displayed using representative coordinates at the town/block level. These are not exact locations at the street address level
- **Businesses Operating Throughout the Prefecture**: Businesses without a specific address, such as mobile vendors (16 entries), are excluded from the map
- **Geocoding**: Town/block coordinates are retrieved via Nominatim only on the first use (takes approximately 1–2 minutes). Subsequent requests are displayed instantly using the localStorage cache

## License


MIT License


## Note


This site is an **unofficial tool** unrelated to Funabashi City or any public agency. For data accuracy, please be sure to check Funabashi City’s official [List of Food Business Facilities](https://www.city.funabashi.lg.jp/kenkou/eisei/004/p064870.html).
用語集


