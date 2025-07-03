# zenbu-archiver

"zenbu" は日本語の単語 "全部" から来ています。

ある種の構造を持ったサービスから資料をすべてアーカイブするためのCLIツール

## 概要

zenbu-archiverは、ある種の構造を持ったサービスから、すべての資料をPDF形式でローカルに保存するためのツールです。

**環境変数**: `ZENBU_ARCHIVE_ORIGIN` を設定して対象サイトのオリジン（www.\*形式）を指定してください。

## インストール

```bash
git clone https://github.com/LumaKernel/zenbu-archiver
cd zenbu-archiver
bun install
./bin/cli.ts --help
```

## 使い方

### 1. 環境変数の設定

対象サイトのオリジンを環境変数で設定すると、毎回 `--origin` を指定する必要がなくなります。

```bash
export ZENBU_ARCHIVE_ORIGIN=https://www.example.com
```

### 2. Playwrightのインストール

まず、ブラウザ自動化に必要なPlaywrightをインストールします：

```bash
./bin/cli.ts playwright-install
```

### 3. ログイン

対象サービスにログインして認証情報を保存します：

```bash
./bin/cli.ts login
```

コマンドライン引数でオリジンを指定することもできます：

```bash
./bin/cli.ts login --origin https://www.example.com
```

コマンドを実行するとブラウザが起動するので、画面上でログインを完了してください。ログインが完了したら、ターミナルでEnterキーを押してください。

### 4. 授業一覧の確認

利用可能な授業の一覧を確認します：

```bash
./bin/cli.ts list
```

### 5. アーカイブの実行

すべての完了済み授業をアーカイブ：

```bash
./bin/cli.ts archive --output archives/
```

特定の授業のみをアーカイブ：

```bash
./bin/cli.ts archive --output archives/ --only "2024年前期:プログラミング入門"
```

特定の授業を除外してアーカイブ：

```bash
./bin/cli.ts archive --output archives/ --exclude "2024年前期:統計学入門"
```

複数の授業を指定する場合はカンマ区切りで：

```bash
./bin/cli.ts archive --output archives/ --only "2024年前期:プログラミング入門,2024年前期:データサイエンス基礎"
```

コマンドライン引数でオリジンを指定：

```bash
./bin/cli.ts archive --output archives/ --origin https://www.example.com --origin-api https://api.example.com
```

## 出力形式

アーカイブされたファイルは以下の構造で保存されます：

```
archives/
├── 授業名1/
│   ├── チャプター名1/
│   │   ├── 01_動画タイトル1.pdf
│   │   ├── 03_動画タイトル2.pdf
│   │   └── ...
│   └── チャプター名2/
│       └── ...
└── 授業名2/
    └── ...
```

## 重要な注意事項

### 著作権・利用規約の確認

- **このツールは、あくまでも自身が完全に著作権を持つ資料をアーカイブするための道具です**
- 自身以外が著作権を持つコンテンツに対しては、必ず対象サービスの利用規約でスクレイピング等が明示的に許可されているか確認してください
- 多くのサービスがスクレイピングやダウンロードを規約で禁止しています。**分からない場合は使用しないでください**

### 使用上の注意

- 完了していないコンテンツはアーカイブ対象になりません
- アーカイブ処理には時間がかかる場合があります
- 既に存在する出力ディレクトリを指定するとエラーになります

## 免責事項

本ソフトウェアの使用により生じたいかなる損害についても、作者は一切の責任を負いません。利用者は自己の責任において本ソフトウェアを使用するものとします。

本ソフトウェアは「現状のまま」で提供され、明示的または暗示的を問わず、いかなる保証も行いません。これには、商品性、特定目的への適合性、および権利非侵害についての保証が含まれますが、これらに限定されません。

## ライセンス

MIT License

詳細は [LICENSE](LICENSE) ファイルを参照してください。
