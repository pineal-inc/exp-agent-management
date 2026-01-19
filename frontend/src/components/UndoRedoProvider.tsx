import { useUndoRedo } from '@/hooks/useUndoRedo';

/**
 * Undo/Redoのキーボードショートカットを有効化するプロバイダー
 * App.tsxで1回だけ使用する
 */
export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  // Undo/Redoのキーボードショートカットを有効化
  useUndoRedo();

  return <>{children}</>;
}
