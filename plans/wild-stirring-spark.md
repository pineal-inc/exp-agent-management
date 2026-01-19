# Undo/Redo（Cmd+Z）が効かない問題の修正

## 問題
タスク操作後にCmd+Z（Undo）を押しても動作しない。

## 原因
ほとんどのコンポーネントがUndo非対応の`useTaskMutations`を使用しているため、Undoスタックに操作が記録されていない。

### 現状の使用状況

| コンポーネント | 使用フック | Undo対応 |
|---------------|-----------|---------|
| TaskFormDialog | useTaskMutationsWithUndo | ✅ |
| DeleteTaskConfirmationDialog | useTaskMutationsWithUndo | ✅ |
| **TaskPanel** | useTaskMutations | ❌ |
| **TaskDagView** | useTaskMutations | ❌ |
| **NoServerContent** | useTaskMutations | ❌ |
| **ShareDialog** | useTaskMutations | ❌ |
| **StopShareTaskDialog** | useTaskMutations | ❌ |

## 実装方針

### 変更対象ファイル

1. **`frontend/src/components/TaskPanel.tsx`**
   - `useTaskMutations` → `useTaskMutationsWithUndo` に変更
   - ステータス変更（updateTask）がUndo対象になる

2. **`frontend/src/components/tasks/TaskDagView.tsx`**
   - `useTaskMutations` → `useTaskMutationsWithUndo` に変更
   - DAG位置更新（updateTask）がUndo対象になる

3. **`frontend/src/pages/NoServerContent.tsx`**
   - `useTaskMutations` → `useTaskMutationsWithUndo` に変更
   - タスク作成がUndo対象になる

4. **`frontend/src/components/ShareDialog.tsx`**
   - `useTaskMutations` → `useTaskMutationsWithUndo` に変更

5. **`frontend/src/components/StopShareTaskDialog.tsx`**
   - `useTaskMutations` → `useTaskMutationsWithUndo` に変更

### 変更内容（各ファイル共通）

```typescript
// Before
import { useTaskMutations } from '@/hooks/useTaskMutations';
const { updateTask, deleteTask, ... } = useTaskMutations(projectId);

// After
import { useTaskMutationsWithUndo } from '@/hooks/useTaskMutationsWithUndo';
const { updateTask, deleteTask, ... } = useTaskMutationsWithUndo(projectId);
```

## 検証方法

1. `pnpm run dev` でアプリ起動
2. プロジェクトを開く
3. **TaskPanel**でタスクのステータスを変更
4. Cmd+Z（Mac）/ Ctrl+Z（Windows）を押す
5. ステータスが元に戻ることを確認
6. Cmd+Shift+Z / Ctrl+Shift+Z でRedoが動作することを確認

## 変更ファイル一覧
- `frontend/src/components/TaskPanel.tsx`
- `frontend/src/components/tasks/TaskDagView.tsx`
- `frontend/src/pages/NoServerContent.tsx`
- `frontend/src/components/ShareDialog.tsx`
- `frontend/src/components/StopShareTaskDialog.tsx`
