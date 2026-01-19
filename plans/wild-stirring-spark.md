# Cmd+Z Undo機能の実装計画

## 概要
タスク操作（作成・更新・削除・移動）をCmd+Z/Ctrl+Zで元に戻せるようにする。

## 現状分析

### 既存の技術スタック
- **状態管理**: Zustand
- **キーボード管理**: `react-hotkeys-hook` + 独自のregistry.ts
- **データ取得**: React Query (@tanstack/react-query)
- **API**: REST API (`frontend/src/lib/api.ts`)

### 関連ファイル
- `frontend/src/keyboard/registry.ts` - キーバインディング定義
- `frontend/src/stores/` - Zustandストア
- `frontend/src/hooks/useTaskMutations.ts` - タスク操作フック

---

## 実装計画

### Step 1: Undo/Redoストア作成
**ファイル**: `frontend/src/stores/useUndoRedoStore.ts`

```typescript
interface UndoableOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  taskId: string;
  data: any;        // 操作データ
  reverseData: any; // 元に戻すためのデータ
  timestamp: number;
}

interface UndoRedoState {
  past: UndoableOperation[];
  future: UndoableOperation[];
  pushOperation: (op: UndoableOperation) => void;
  undo: () => UndoableOperation | null;
  redo: () => UndoableOperation | null;
  clear: () => void;
}
```

### Step 2: キーボードショートカット登録
**ファイル**: `frontend/src/keyboard/registry.ts`

```typescript
// Action enumに追加
UNDO = 'undo',
REDO = 'redo',

// キーバインディング追加
[Action.UNDO]: { keys: ['meta+z', 'ctrl+z'], scope: Scope.GLOBAL },
[Action.REDO]: { keys: ['meta+shift+z', 'ctrl+shift+z'], scope: Scope.GLOBAL },
```

### Step 3: Undoフック作成
**ファイル**: `frontend/src/hooks/useUndoRedo.ts`

- キーボードイベントリスナー
- 操作実行ロジック（API呼び出し）
- React Queryキャッシュ更新

### Step 4: タスク操作にUndo対応を追加
**ファイル**: `frontend/src/hooks/useTaskMutations.ts`

各操作（create/update/delete）の成功時にUndoスタックにpush

### Step 5: グローバルプロバイダー追加
**ファイル**: `frontend/src/App.tsx` または新規Context

Undoフックをアプリ全体で有効化

---

## 対象操作

| 操作 | Undo時の処理 |
|------|-------------|
| タスク作成 | 作成したタスクを削除 |
| タスク更新 | 変更前の状態に戻す |
| タスク削除 | 削除したタスクを再作成 |
| ステータス移動 | 元のステータスに戻す |

---

## 検証方法

1. `pnpm run dev` でアプリ起動
2. タスクを作成 → Cmd+Z → タスクが削除される
3. タスクを編集 → Cmd+Z → 編集前に戻る
4. タスクを削除 → Cmd+Z → タスクが復元される
5. Cmd+Shift+Z → Redoが動作する

---

## 設定

- **履歴保持数**: 30件
- **リロード時**: 履歴クリア（ローカルのみ）
- **複数タブ同期**: なし（シンプルに保つ）

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/stores/useUndoRedoStore.ts` | 新規作成 - Undoスタック管理 |
| `frontend/src/keyboard/registry.ts` | Undo/Redoキーバインディング追加 |
| `frontend/src/hooks/useUndoRedo.ts` | 新規作成 - Undoロジック |
| `frontend/src/hooks/useTaskMutations.ts` | 操作時にスタックへpush |
| `frontend/src/App.tsx` | Undoフック有効化 |
