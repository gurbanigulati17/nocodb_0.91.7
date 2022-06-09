<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ オープンソースのAirtableの代替案 ✨ <br>

</h1>
<p align="center">
MySQL、PostgreSQL、SQL Server、SQLite＆Mariadbをスマートスプレッドシートに変えます。 
</p>
<div align="center">
 
[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB) 
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# クイック試し

### 1-Click Deploy

#### Heroku

<a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>
<br>

### Docker を使う

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- If this input is absent, we fallback to SQLite. In order too persist sqlite, you can mount `/usr/app/data/`. 

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### NPM を使用して

```
npx create-nocodb-app
```

### git を使う

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

アクセスダッシュボードを使用して : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# 私たちのコミュニティに参加する

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# スクリーンショット

![1](https://user-images.githubusercontent.com/86527202/136069505-82216f78-f807-4ae8-ae30-10df2115e262.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136069511-bb83b22b-6681-43cc-a332-0b62ba7e7474.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136069519-e71b8748-26a2-4026-a17a-4aab36c824fd.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136069524-ab4c550f-a35e-4134-8e2a-d1372d833406.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136069529-979b19ab-4215-4110-a765-fe9f2dc2588b.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136069531-7580c33a-5b75-4705-a950-212a31bf2349.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136069534-6cc19713-c19b-4ff7-9526-89832fef7b79.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136069536-18701963-1ef5-434b-9600-4d09f1ff9920.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136069538-49400dca-fe21-431a-babc-6909ff9de257.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136069541-8f10cc80-88bd-4682-9bd8-b363e8b212e5.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136069544-5b51b90e-dda1-4e54-b094-611d06e5aa86.png)
<br>

# 特徴

### リッチスプレッドシートインターフェース

検索、並べ替え、フィルタリング、列を隠す

- ⚡ ビューを作成する：グリッド、ギャラリー、カンバン、ガント、フォーム
- ⚡ シェアビュー：Public＆Password Protected.
- ⚡ パーソナル＆ロックビュー
- ⚡ 画像を細胞にアップロードする（S3、Minio、GCP、Azure、Digitalocean、Linode、Ovh、Backblaze で動作します）。
- ⚡ ロール：所有者、作成者、エディタ、コメンタ、ビューア、コメンタ、カスタムロール。
- ⚡ アクセス制御：データベース、テーブル＆カラムレベルでも微細に粒度のアクセス制御。

### ワークフロー自動化のための App Store

- ⚡ チャット：マイクロソフトチーム、たるみ、不和、マッピー
- ⚡ メール：SMTP、SE、MailChimp
- ⚡ SMS：Twilio.
- ⚡ whatsapp.
- ⚡ 第三者 APIS

### プログラムによる API アクセスによるアクセス

- ⚡ REST APIS（Swagger）
- ⚡ GraphQLAPI。
- ⚡ JWT 認証とソーシャル AUTH を含む
- ⚡ ZAPIER、Integomat と統合する API トークン。

# Production Setup

NoCodb には、スプレッドシートビューと外部データベースのメタデータを格納するためのデータベースが必要です。このデータベースの接続パラメータは、NC_DB 環境変数で指定できます。

## Docker

#### Example MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example SQL Server

```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose

```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## Environment variables

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/installation#environment-variables)

# Development setup

Please refer to [Development Setup](https://github.com/nocodb/nocodb/tree/master#development-setup)

# Contributing

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# なぜこれを構築しているのですか？

ほとんどのインターネットビジネスは、彼らのビジネスニーズを解決するためにスプレッドシートまたはデータベースのどちらかでそれ自体を装備しています。スプレッドシートは 1 日ごとに 10 億+人間によって使用されます。ただし、コンピューティングに関してより強力なツールであるデータベースの同様のスピードで作業しているような方法です。これを SaaS 製品で解決しようとすると、恐ろしいアクセス制御、ベンダーロック、データロック、突然の価格が変更され、最も重要なことに将来可能なものに関するガラスの天井を意味しています。

# 私たちの使命

私たちの使命は、世界ですべての単一のインターネットビジネスにオープンソースであるデータベースのための最も強力なノーコードインターフェースを提供することです。これは強力なコンピューティングツールへのアクセスを民主化するだけでなく、インターネット上で急進的な厄介な建築能力を持つ 10 億+人をもたらします。
