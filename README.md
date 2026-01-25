<p align="center">
  <h1 align="center">Crew</h1>
  <p align="center"><strong>みんなのためのAI駆動タスク管理</strong></p>
  <p align="center">エンジニア、PM、ビジネスチーム - AIエージェントと共に働く</p>
  <p align="center">
    <a href="https://www.npmjs.com/package/crewio"><img src="https://img.shields.io/npm/v/crewio.svg" alt="npm version"></a>
    <a href="https://github.com/pineal-inc/exp-agent-management/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License"></a>
  </p>
</p>

<p align="center">
  <img src="docs/images/image1.png" alt="Crew DAG View" width="800">
</p>

## 概要

Crewは、チーム全員がAIコーディングエージェントを活用できるモダンなタスク管理ツールです。エンジニア、PM、ビジネス担当者など、誰でも以下のことができます:

- **AIエージェントのオーケストレーション** - 複数のコーディングエージェントを並列または順次実行
- **進捗トラッキング** - カンバンボードでタスク状況を可視化
- **レビュー** - 変更内容を素早く確認し、開発サーバーを起動
- **コラボレーション** - 非技術者もAIエージェントを活用可能に
- **簡単な設定** - MCP設定を一元管理

## インストール

### npxで即座に起動（推奨）

```bash
# Crewを起動
npx crewio
```

これだけでOK！自動的にブラウザで開きます。

### MCPサーバーとして使用

Claude CodeからMCPでタスク管理する場合：

```bash
npx crewio --mcp
```

Claude Codeの設定（`~/.claude.json`）：

```json
{
  "mcpServers": {
    "crew": {
      "command": "npx",
      "args": ["-y", "crewio@latest", "--mcp"]
    }
  }
}
```

### ソースからビルド（開発者向け）

<details>
<summary>開発環境のセットアップ</summary>

#### 必要なもの

- [Rust](https://rustup.rs/)（最新の安定版）
- [Node.js](https://nodejs.org/)（>=18）
- [pnpm](https://pnpm.io/)（>=8）

#### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/pineal-inc/exp-agent-management.git
cd exp-agent-management

# 依存関係をインストール
pnpm i

# 開発サーバーを起動
pnpm run dev
```

</details>

Crewは自動的にブラウザで `http://localhost:4000` を開きます。

## 機能

### プロジェクト管理
- Gitリポジトリをプロジェクトとして追加
- 自動Git連携とバリデーション
- プロジェクト全体のファイル検索

### タスク管理
- カンバン形式のタスクボード
- タスクステータス管理（Todo、In Progress、Done）
- リッチなタスク説明

### AIエージェント連携
- Claude Code、Gemini CLI、Codex、Ampなど複数エージェント対応
- タスク作成と同時にエージェント実行を開始
- フォローアップタスクで反復的な開発

### 開発ワークフロー
- タスクごとに独立したgit worktree
- エージェントが行った変更のdiff表示
- 成功した変更をメインブランチにマージ

### 開発者ツール
- 好みのエディタでタスクを開く（VS Code、Cursor、Windsurfなど）
- リアルタイム実行モニタリング
- タスク完了時のサウンド通知

## チーム共有機能（Team Mode）

Crewはチーム間でタスクを共有するためのTeam Modeをサポートしています。Supabaseをデータ基盤として、リアルタイム同期とオフライン対応を実現しています。

### 機能概要

- **チーム管理** - 招待コードでチームに参加、メンバーの役割管理
- **Stories** - ユーザーストーリー形式でタスクをまとめて管理
- **リアルタイム同期** - チームメンバー間でタスク変更を即座に反映
- **オフライン対応** - オフライン時の変更をキューに保存し、復旧後に同期
- **CLAUDE.md自動生成** - AIエージェント向けのコンテキストファイルを自動生成

### セットアップ

#### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. `supabase/migrations/001_initial.sql`のスキーマを実行
3. Project URLとanon keyを取得

#### 2. 設定ファイルの作成

プロジェクトルートに`.crew/config.json`を作成:

```json
{
  "version": 1,
  "team": {
    "id": "your-team-uuid",
    "name": "My Team"
  },
  "project": {
    "id": "your-project-uuid"
  },
  "supabase": {
    "url": "https://xxx.supabase.co",
    "anon_key": "eyJ..."
  }
}
```

#### 3. 環境変数（オプション）

環境変数でも設定可能:

```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
```

### 使い方

#### チームの作成

```bash
# API経由でチームを作成
curl -X POST http://localhost:4000/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "My Team", "description": "開発チーム"}'
```

レスポンスに含まれる`invite_code`を使ってメンバーを招待できます。

#### チームへの参加

```bash
# 招待コードでチームに参加
curl -X POST http://localhost:4000/api/teams/join \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "ABC123", "display_name": "田中太郎"}'
```

#### Storiesの管理

```bash
# Storyを作成
curl -X POST http://localhost:4000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-uuid",
    "title": "ユーザー認証機能",
    "as_a": "登録ユーザー",
    "i_want": "メールとパスワードでログイン",
    "so_that": "個人データにアクセスできる"
  }'

# Storyに紐づくタスクを取得
curl http://localhost:4000/api/stories/{story_id}/tasks
```

### API一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/teams` | POST | チーム作成 |
| `/api/teams/join` | POST | 招待コードでチーム参加 |
| `/api/teams/{id}` | GET | チーム詳細取得 |
| `/api/teams/{id}/members` | GET | チームメンバー一覧 |
| `/api/stories` | GET/POST | Stories一覧/作成 |
| `/api/stories/{id}` | GET/PUT/DELETE | Story詳細/更新/削除 |
| `/api/stories/{id}/tasks` | GET | Storyに紐づくタスク |

### モード切り替え

- **Solo Mode**: `.crew/config.json`がない場合、ローカルSQLiteのみを使用
- **Team Mode**: `.crew/config.json`がある場合、Supabaseと同期

Team Modeでも、ローカルにデータをキャッシュするため、オフラインでも作業可能です。

### リアルタイム同期

Team Modeでは、Supabase RealtimeのWebSocket接続を使って変更をリアルタイムで受信します:

- タスクの作成・更新・削除
- Storyの変更
- チームメンバーの参加・離脱

競合が発生した場合は「Last-Writer-Wins」戦略で解決されます（`updated_at`タイムスタンプで判定）。

## 使い方ガイド: CLI vs ダッシュボード

CrewはClaude Code CLIとダッシュボードの2つの方法でAIエージェントを操作できます。それぞれの特徴を活かした使い分けを推奨します。

### Claude Code CLIで直接実行する場合

**向いているケース:**
- 単一のタスクに集中して作業したい
- 対話的にフィードバックを与えながら進めたい
- 複雑な要件を段階的に詰めていきたい
- コードの細かい部分を確認しながら進めたい

**例:**
```bash
# ターミナルでClaude Codeを起動
claude

# 対話的に作業を進める
> この関数をリファクタリングして
> もう少しエラーハンドリングを追加して
> テストも書いて
```

### ダッシュボードで並列実行する場合

**向いているケース:**
- 複数の独立したタスクを同時に進めたい
- タスクの進捗を可視化しながら管理したい
- チームでタスク状況を共有したい
- 定型的なタスクをまとめて実行したい

**例:**
1. ダッシュボードでプロジェクトを選択
2. 複数のタスクを作成（例: 「ログイン機能追加」「API修正」「テスト追加」）
3. 各タスクを並列で実行開始
4. 進捗をリアルタイムで確認
5. 完了したタスクのdiffを確認してマージ

### 組み合わせた使い方

最も効果的なのは両方を組み合わせる方法です:

1. **計画フェーズ**: ダッシュボードでタスクを整理・優先順位付け
2. **実行フェーズ**:
   - 独立したタスク → ダッシュボードで並列実行
   - 複雑なタスク → CLIで対話的に実行
3. **レビューフェーズ**: ダッシュボードでdiffを確認、マージ判断

### MCPによる連携

Claude CodeはMCP（Model Context Protocol）でダッシュボードと連携できます。CLIから直接タスクを作成・更新することも可能です:

```bash
# Claude Code内でMCPツールを使用
> このバグをタスクとして登録して
> タスク#5のステータスを完了に更新して
```

## アーキテクチャ

| レイヤー | 技術 |
|---------|------|
| バックエンド | Rust (Axum) |
| フロントエンド | React + TypeScript + Vite + Tailwind |
| データベース | SQLite (SQLx) |
| 共有型定義 | ts-rs（自動生成） |

## 開発コマンド

```bash
# 依存関係をインストール
pnpm i

# 開発サーバーを起動（フロントエンド + バックエンド）
pnpm run dev

# QAモードで起動（テスト推奨）
pnpm run dev:qa

# 型チェック
pnpm run check

# Lint
pnpm run lint

# バックエンドテスト
cargo test --workspace

# Rust から TypeScript の型を生成
pnpm run generate-types
```

## コントリビューション

コントリビューションを歓迎します！PRを送る前に、まずIssueやDiscussionを開いてください。

## ライセンス

このプロジェクトは [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) をフォークし、Apache-2.0 ライセンスの下で改変・公開しています。

### 主な変更点

- プロジェクト名を「Crew」に変更
- タスク管理機能の拡張
- AIエージェント連携の改善
- カスタムエージェント設定の追加

詳細なライセンス情報と遵守ガイドについては、[LICENSING.md](./docs/LICENSING.md) を参照してください。

**ライセンス**: Apache-2.0（[LICENSE](./LICENSE) を参照）
