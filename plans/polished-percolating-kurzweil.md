# チームタスク共有機能 - 実装計画

## 概要

詳細仕様書に基づき、Supabaseをデータ基盤としてチーム間でタスクを共有できる機能を段階的に実装する。

## 方針決定

- **実装範囲**: 段階的に実装（Phase 1から順番に）
- **データ基盤**: Supabase新規導入
- **Ideas機能**: 不要（既存Taskで代用）

## 調査結果サマリー

### 既存機能（活用可能）

| 機能 | 既存実装 |
|------|---------|
| Organization（Team相当） | `crates/server/src/routes/organizations.rs` |
| SharedTask | `crates/server/src/routes/shared_tasks.rs` |
| Invitation | organizations.rs内 |
| TaskDependency | `crates/db/src/models/task_dependency.rs` |
| DAG表示 | `frontend/src/components/tasks/TaskDAGNode.tsx` |

### 新規追加が必要

| 機能 | 説明 |
|------|------|
| Supabaseクライアント | PostgreSQL接続・認証 |
| Solo/Teamモード切替 | ローカル/リモート切り替え |
| Stories | ユーザーストーリー管理 |
| .crew/config.json | チーム設定ファイル |

---

## Phase 1: データ基盤

### 1.1 Supabaseスキーマ作成

**ファイル**: `supabase/migrations/001_initial.sql`

```sql
-- teams: チーム管理
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- team_members: メンバー管理
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_identifier)
);

-- projects: プロジェクト
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  repo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- stories: ユーザーストーリー
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  as_a TEXT,
  i_want TEXT,
  so_that TEXT,
  acceptance_criteria JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'backlog',
  story_points INTEGER,
  priority INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tasks: タスク（Supabase版）
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'feature',
  status TEXT NOT NULL DEFAULT 'todo',
  assigned_to TEXT,
  branch_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- task_dependencies: 依存関係
CREATE TABLE task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id != depends_on_id)
);
```

### 1.2 Rustバックエンド統合

**新規ファイル**:

1. `crates/services/src/services/supabase/mod.rs` - Supabaseクライアント
2. `crates/services/src/services/supabase/client.rs` - HTTP通信
3. `crates/services/src/services/supabase/models.rs` - データモデル

**修正ファイル**:

1. `crates/services/Cargo.toml` - 依存追加
2. `crates/services/src/services/mod.rs` - モジュール追加
3. `crates/server/src/lib.rs` - AppState拡張

**実装内容**:

```rust
// AppMode enum
pub enum AppMode {
    Solo,
    Team {
        team_id: Uuid,
        project_id: Uuid,
        user_identifier: String,
    },
}

// SupabaseClient
pub struct SupabaseClient {
    base_url: String,
    anon_key: String,
    http: reqwest::Client,
}
```

### 1.3 設定ファイル管理

**新規ファイル**:

1. `.crew/config.json.example` - 設定例

```json
{
  "version": 1,
  "team": {
    "id": "uuid",
    "name": "Team Name"
  },
  "project": {
    "id": "uuid"
  },
  "supabase": {
    "url": "https://xxx.supabase.co",
    "anon_key": "eyJ..."
  }
}
```

### 1.4 ローカルDB拡張

**新規ファイル**: `crates/db/migrations/YYYYMMDD_crew_config.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME
);
```

---

## 実装順序

1. [ ] Supabaseプロジェクト作成（手動）
2. [ ] スキーマ作成（`001_initial.sql`）
3. [ ] RLSポリシー作成（`002_rls_policies.sql`）
4. [ ] Cargo.toml依存追加
5. [ ] SupabaseClient実装
6. [ ] AppMode enum実装
7. [ ] モード判定ロジック実装
8. [ ] 設定ファイル読み書き実装
9. [ ] ローカルDBマイグレーション
10. [ ] 統合テスト

---

## 検証方法

### 1. Supabase接続テスト

```bash
# Rustテスト
cargo test -p services supabase
```

### 2. モード切替テスト

```bash
# Solo modeで起動（.crew/config.jsonなし）
pnpm run dev

# Team modeで起動（.crew/config.jsonあり）
echo '{"team":{"id":"..."},...}' > .crew/config.json
pnpm run dev
```

### 3. E2Eテスト

1. チーム作成
2. invite_codeでメンバー参加
3. タスク作成・共有確認

---

## 次のフェーズ（Phase 2以降）

- Phase 2: 認証・チーム機能（CLI init --team, 参加フロー）
- Phase 3: Stories機能（CRUD API, UI）
- Phase 4: タスク実行連携（自動ファイル生成, CLAUDE.md）
- Phase 5: Realtime・通知
