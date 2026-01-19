# DAGビューでの依存関係なしタスク表示の改善

## 概要
タスクを追加した時に、依存関係がなくてもDAGエリアにノードとして表示できるようにする。

## 現状
- **依存関係あり** → DAGビューに表示
- **依存関係なし & 未完了** → サイドバー（タスクプール）に表示
- **依存関係なし & 完了** → アーカイブに表示

## 要望
- タスク作成直後でも、DAGエリアにノードとして表示したい
- サイドバーからドラッグ＆ドロップでDAGに配置したい

## 実装方針

### 変更箇所
**ファイル**: `frontend/src/components/tasks/TaskDagView.tsx`

現在のタスク分類ロジック（207-235行目）を以下のように変更：

```typescript
// 現在のロジック
const hasDependency = tasksWithDependencies.has(task.id);
if (hasDependency) {
  inDag.push(task);  // 依存関係あり → DAG
} else if (task.status === 'done') {
  inArchive.push(task);  // 依存関係なし & 完了 → アーカイブ
} else {
  inPool.push(task);  // 依存関係なし & 未完了 → プール
}

// 新しいロジック
const hasDependency = tasksWithDependencies.has(task.id);
const hasPosition = task.dag_position_x !== null && task.dag_position_y !== null;

if (hasDependency || hasPosition) {
  inDag.push(task);  // 依存関係あり OR 位置情報あり → DAG
} else if (task.status === 'done') {
  inArchive.push(task);  // 依存関係なし & 位置なし & 完了 → アーカイブ
} else {
  inPool.push(task);  // 依存関係なし & 位置なし & 未完了 → プール
}
```

### 動作フロー
1. タスク作成時 → サイドバー（タスクプール）に表示
2. サイドバーからDAGエリアにドラッグ＆ドロップ → `dag_position_x/y` が設定される
3. DAGエリアに表示される（依存関係がなくても）
4. DAGノードをサイドバーにドラッグ → `dag_position_x/y` がクリアされ、プールに戻る

## 検証方法
1. `pnpm run dev` でアプリ起動（バックエンドも起動）
2. プロジェクトを作成
3. タスクを作成 → サイドバーに表示される
4. サイドバーからDAGエリアにドラッグ＆ドロップ → DAGに表示される
5. DAGノードをサイドバーにドラッグ → プールに戻る

## 変更ファイル
- `frontend/src/components/tasks/TaskDagView.tsx` - タスク分類ロジック変更（約10行）
