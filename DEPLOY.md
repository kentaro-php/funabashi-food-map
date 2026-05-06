# デプロイ手順

## 1. GitHubリポジトリ作成

```bash
cd ~/projects
# このディレクトリ全体をリポジトリ化
cd funabashi-food-map
git init
git add .
git commit -m "Initial commit: 船橋市食品営業許可マップ"
git branch -M main
git remote add origin https://github.com/kentaro-php/funabashi-food-map.git
git push -u origin main
```

GitHub上で `kentaro-php/funabashi-food-map` リポジトリを事前に作っておく。

## 2. GitHub Pages 有効化

1. リポジトリの Settings → Pages
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / `/ (root)`
4. Save をクリック

数分後に `https://kentaro-php.github.io/funabashi-food-map/` で公開される。

## 3. 動作確認

公開URLにアクセスして以下を確認：

- [ ] 起動画面が表示される
- [ ] 「1,256件のデータを取得しました」と進捗が動く
- [ ] ダッシュボードが表示される（KPI、グラフ、ランキング）
- [ ] 検索タブで施設名検索ができる
- [ ] 地図タブで店舗が地図上に表示される

## カスタムドメインで公開する場合

`food.dspartners.jp` などで公開したい場合：

### A. CNAME ファイル方式

`funabashi-food-map/CNAME` を作成し、ドメイン名のみを記載：

```
food.dspartners.jp
```

DNS設定（Xserver等）で CNAME レコードを追加：

```
food.dspartners.jp  CNAME  kentaro-php.github.io
```

GitHub の Settings → Pages → Custom domain で `food.dspartners.jp` を入力 → Save。

HTTPS有効化のチェックボックスをONにすればLet's Encryptで自動証明書発行。

### B. dspartners.jp サブパスで公開する場合

Next.jsの公開サイト `dspartners.jp/funabashi-food/` にする場合は、`next.config.js` に rewrites を追加：

```js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/funabashi-food/:path*',
        destination: 'https://kentaro-php.github.io/funabashi-food-map/:path*',
      },
    ];
  },
}
```

## 更新の反映

データは CKAN API から動的取得するため、**再デプロイ不要**。船橋市が CKAN 上のデータを更新した時点で、サイト訪問者は最新データを見ることになります。

UI/UXの修正は、

```bash
git add .
git commit -m "Update: 〇〇を改善"
git push
```

push 後 1〜2分で自動的にPagesにデプロイされます。

## OG画像の生成（任意）

Twitter/X や Slack でリンクを貼った時にプレビュー画像が出るよう、`og-image.png`（推奨1200x630px）を作っておくと良いです。

ダッシュボードのスクリーンショットを撮って `og-image.png` として保存し、リポジトリ直下に置けば自動でメタタグから読み込まれます。

## トラブルシューティング

### CORS エラーが出る

GitHub Pages 上では問題ないはずですが、もし `data.bodik.jp` 側で CORS が制限された場合の対処：

1. Vercel Functions などで API プロキシを建てる
2. `app.js` の `CKAN_BASE` をプロキシURLに差し替える

### 地図のジオコーディングが遅い

- 初回起動で約1〜2分かかります（220町丁目をNominatim経由で取得）
- 2回目以降は localStorage キャッシュで瞬時
- もし高速化したい場合は、Geolonia の住所→座標データを事前にダウンロードして同梱する方法もあり
