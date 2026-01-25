# チームタスク共有機能 - Phase 2-5 実装計画

## 概要

Phase 1（データ基盤）完了後、Phase 2-5を段階的に実装する。

## 依存関係

```
Phase 1 (完了) → Phase 2 → Phase 3 ─┬─→ Phase 5
                    │               │
                    └─→ Phase 4 ───┘
```

---

## Phase 2: 認証・チーム機能

### 目標
- AppStateにSupabaseClient統合
- Teams API実装
- CLI init --team コマンド

### 新規作成ファイル
| ファイル | 内容 |
|---------|------|
| `crates/server/src/routes/teams.rs` | Teams APIエンドポイント |
| `crates/db/src/models/crew_config.rs` | crew_configモデル |
| `frontend/src/hooks/useTeamMode.ts` | チームモード検知 |
| `frontend/src/components/team/TeamInitDialog.tsx` | 初期化UI |

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `crates/local-deployment/src/lib.rs` | SupabaseClient, AppMode統合 |
| `crates/server/src/routes/mod.rs` | teamsルート追加 |
| `crates/services/src/services/supabase/client.rs` | join_team_by_invite_code追加 |

### 実装ステップ
1. **LocalDeployment拡張**: `.crew/config.json`読み込み → SupabaseClient初期化
2. **crew_config DBモデル**: CRUD操作実装
3. **Teams API**: POST /api/teams, POST /api/teams/join, GET /api/teams/:id/members
4. **フロントエンド**: useTeamMode hook, TeamInitDialog

### テスト
```bash
cargo test -p services supabase
cargo test -p local-deployment app_mode
cargo test -p server teams_api
```

---

## Phase 3: Stories機能

### 目標
- Stories CRUD API
- Kanban/Table UI
- タスクとの関連付け

### 新規作成ファイル
| ファイル | 内容 |
|---------|------|
| `crates/server/src/routes/stories.rs` | Stories API |
| `frontend/src/hooks/useProjectStories.ts` | Stories取得 |
| `frontend/src/hooks/useStoryMutations.ts` | Stories CRUD |
| `frontend/src/components/stories/StoryKanbanBoard.tsx` | Kanban表示 |
| `frontend/src/components/stories/StoryCard.tsx` | カード |
| `frontend/src/components/stories/CreateStoryDialog.tsx` | 作成UI |

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `crates/services/src/services/supabase/client.rs` | update_story, delete_story |
| `crates/services/src/services/supabase/models.rs` | UpdateStoryRequest, ts-rs export |
| `crates/server/src/routes/mod.rs` | storiesルート追加 |
| `frontend/src/lib/api.ts` | storiesApi追加 |

### API設計
```
GET    /api/stories?project_id={id}  - 一覧
POST   /api/stories                   - 作成
GET    /api/stories/:id               - 詳細
PUT    /api/stories/:id               - 更新
DELETE /api/stories/:id               - 削除
GET    /api/stories/:id/tasks         - 関連タスク
```

### テスト
```bash
cargo test -p server stories_api
pnpm run check && pnpm run lint
```

---

## Phase 4: タスク実行連携

### 目標
- タスク開始時のCLAUDE.md自動生成
- タスク状態のSupabase同期
- オフライン対応（sync_queue）

### 新規作成ファイル
| ファイル | 内容 |
|---------|------|
| `crates/services/src/services/supabase/sync.rs` | 同期サービス |
| `crates/services/src/services/supabase/file_generator.rs` | ファイル生成 |

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `crates/executors/src/actions/coding_agent_initial.rs` | CLAUDE.md生成呼び出し |
| `crates/services/src/services/events.rs` | 同期hookポイント |
| `crates/local-deployment/src/container/mod.rs` | ワークスペース開始時処理 |

### 実装ステップ
1. **FileGenerator**: ストーリー/タスク情報からCLAUDE.md生成
2. **SyncService**: タスク状態変更 → Supabase同期（失敗時はqueue）
3. **EventService統合**: タスク更新hookでSyncService呼び出し
4. **ワークスペース統合**: start_workspace()でFileGenerator実行

### テスト
```bash
cargo test -p services sync
cargo test -p services file_generator
```

---

## Phase 5: Realtime・通知

### 目標
- Supabase Realtime統合
- チーム間リアルタイム同期
- 競合解決

### 新規作成ファイル
| ファイル | 内容 |
|---------|------|
| `crates/services/src/services/supabase/realtime.rs` | Realtime接続 |
| `frontend/src/lib/supabase/realtime.ts` | Realtimeクライアント |
| `frontend/src/hooks/useRealtimeSync.ts` | Realtime hook |

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `crates/services/src/services/supabase/client.rs` | Realtime接続追加 |
| `crates/services/src/services/events.rs` | Realtime経由パッチ受信 |
| `frontend/src/hooks/useProjectTasks.ts` | Realtime統合 |

### 実装ステップ
1. **RealtimeClient**: WebSocket接続、subscribe_tasks/stories
2. **EventService統合**: リモート変更 → ローカルDB → フロントエンド配信
3. **フロントエンドhook**: Team時Realtime、Solo時既存WebSocket
4. **競合解決**: updated_atベースLast-Writer-Wins

### テスト
```bash
cargo test -p services realtime
# E2E: マルチブラウザでの同期確認
```

---

## 検証方法

### Phase 2検証
```bash
# 1. チーム作成テスト
curl -X POST http://localhost:3000/api/teams -d '{"name":"TestTeam"}'

# 2. チーム参加テスト
curl -X POST http://localhost:3000/api/teams/join -d '{"invite_code":"XXXX"}'

# 3. .crew/config.json生成確認
cat .crew/config.json
```

### Phase 3検証
```bash
# 1. Stories作成
curl -X POST http://localhost:3000/api/stories -d '{"project_id":"...","title":"..."}'

# 2. UI確認: http://localhost:3000 でKanban表示
```

### Phase 4検証
```bash
# 1. タスク開始後のCLAUDE.md確認
ls workspaces/<workspace_id>/CLAUDE.md

# 2. Supabase側でタスク状態同期確認
```

### Phase 5検証
```bash
# 1. 2つのブラウザで同一プロジェクトを開く
# 2. 片方でタスク更新
# 3. もう片方にリアルタイム反映されることを確認
```

---

## Critical Files

| ファイル | 役割 |
|---------|------|
| `crates/local-deployment/src/lib.rs` | AppState統合の中心 |
| `crates/services/src/services/supabase/client.rs` | Supabase操作基盤 |
| `crates/server/src/routes/tasks.rs` | APIパターン参照 |
| `crates/services/src/services/events.rs` | イベント配信統合 |
| `frontend/src/hooks/useProjectTasks.ts` | フロントエンドパターン参照 |
