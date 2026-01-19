# DAGビューでタスクをプールに移動した時のスクロール問題修正

## 問題
タスクをタスクプール（サイドバー）にドラッグ＆ドロップで移動させると、DAGビューが左にスクロールしてしまう。

## 原因
タスクをプールに移動すると以下の処理フローが発生：

1. `handleNodeDragStop` → タスクの位置をクリア（`dag_position_x/y = null`）
2. `dagTasks`が再計算 → ノード数が減少
3. auto-layout useEffect が発火（`nodesCount`の変更を検出）
4. `applyAutoLayout`が呼ばれる
5. **`fitView({ padding: 0.2, duration: 300 })`が呼ばれる** ← これがスクロールの原因

## 実装方針

`skipNextFitViewRef`を追加し、サイドバー/アーカイブへのドロップ時のみ`fitView`をスキップする。

### 変更ファイル
- `frontend/src/components/tasks/TaskDagView.tsx`

### 実装ステップ

#### 1. ref追加（line 160付近）
```typescript
const skipNextFitViewRef = useRef(false);
```

#### 2. applyAutoLayout関数に`skipFitView`パラメータを追加（line 331-370）
```typescript
const applyAutoLayout = useCallback((
  nodesToLayout: Node<TaskNodeData>[],
  edgesToLayout: Edge[],
  savePositions = false,
  skipFitView = false  // 新パラメータ
) => {
  // ... 既存のレイアウト計算ロジック（変更なし） ...

  // fitViewの条件付き実行
  if (!skipFitView) {
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }
}, [setNodes, fitView, swimlaneMode, genres, saveNodePositions]);
```

#### 3. handleNodeDragStopでフラグを設定（line 585-640）
```typescript
const handleNodeDragStop = useCallback(
  (_event: React.MouseEvent, node: Node<TaskNodeData>) => {
    if (isDraggingOverArchiveRef.current) {
      skipNextFitViewRef.current = true;  // ← 追加
      updateTask.mutate({...});
    } else if (isDraggingOverSidebarRef.current) {
      skipNextFitViewRef.current = true;  // ← 追加
      updateTask.mutate({...});
    } else {
      // DAG内での移動はフラグを立てない
      updateTask.mutate({...});
    }
    // ...
  },
  [updateTask]
);
```

#### 4. useEffectでフラグをチェック（line 382-432）
```typescript
if (initialLayoutAppliedRef.current && autoLayoutEnabled && hasChanges) {
  if (layoutDebounceTimerRef.current) {
    clearTimeout(layoutDebounceTimerRef.current);
  }

  // skipFitViewの値をキャプチャ（タイマー発火時にrefが変わっている可能性があるため）
  const shouldSkipFitView = skipNextFitViewRef.current;
  skipNextFitViewRef.current = false;  // リセット

  layoutDebounceTimerRef.current = setTimeout(() => {
    const freshNodes = layoutNodes(dagTasks, onViewDetails, getTaskReadiness);
    const freshEdges = createEdges(dependencies, handleEdgeDelete, genresById);
    applyAutoLayout(freshNodes, freshEdges, false, shouldSkipFitView);
    layoutDebounceTimerRef.current = null;
  }, 300);
}
```

## 検証方法

1. `pnpm run dev` でアプリ起動
2. プロジェクトを開き、DAGビューに複数のタスクを配置
3. タスクをサイドバー（プール）にドラッグ → **ビュー位置が維持される**ことを確認
4. タスクをアーカイブにドラッグ → **ビュー位置が維持される**ことを確認
5. 「自動整列」ボタンをクリック → `fitView`が実行される（従来通り）
6. swimlaneモードを切り替え → `fitView`が実行される（従来通り）
7. プールからDAGにタスクをドロップ → `fitView`が実行される（従来通り）
