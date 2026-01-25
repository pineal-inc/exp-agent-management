-- Crew config: ローカル設定管理
CREATE TABLE IF NOT EXISTS crew_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue: オフライン時の変更同期キュー
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,        -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL,       -- 'tasks', 'stories', etc.
  record_id TEXT NOT NULL,        -- UUID of the record
  payload TEXT NOT NULL,          -- JSON payload
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME
);

-- Index for pending sync items
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
