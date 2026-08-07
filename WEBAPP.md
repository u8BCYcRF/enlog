# Enlog 閲覧用ウェブアプリ

`data/*.tsv` の現在内容を、進捗、予定、タイムライン、費用に分けて表示する読み取り専用ダッシュボードです。アプリにはデータを変更する機能がなく、Dockerコンテナにも `data/` を読み取り専用でマウントします。

## 起動

DockerとDocker Composeが利用できる環境で、リポジトリ直下から起動します。

```bash
docker compose up --build -d
```

ブラウザで [http://localhost:4173](http://localhost:4173) を開きます。

TSVをCLIから更新した後は、画面右上の「再読込」またはブラウザの再読み込みで反映されます。通常はイメージの再ビルドは不要です。

停止するときは次を実行します。

```bash
docker compose down
```

## ポートの変更

例えばポート8080で起動する場合は次のように実行します。

```bash
ENLOG_PORT=8080 docker compose up --build -d
```

この場合は `http://localhost:8080` で閲覧できます。ポートはローカルホストだけに公開され、同じネットワーク上の別端末には公開されません。

## 開発用コマンド

Node.js 22以降を利用します。

```bash
npm install
npm run dev
```

テストと本番ビルドは次のコマンドで実行します。

```bash
npm test
npm run build
```
