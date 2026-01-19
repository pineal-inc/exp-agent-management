import { create } from 'zustand';
import type { Task, CreateTask, UpdateTask } from 'shared/types';

/**
 * 操作の種類
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * Undo可能な操作
 */
export interface UndoableOperation {
  type: OperationType;
  taskId: string;
  /** 元に戻すために必要なデータ */
  reverseData: {
    /** create操作のundo用: 削除するためのtaskId */
    taskIdToDelete?: string;
    /** update操作のundo用: 更新前のタスクデータ */
    previousTask?: Task;
    /** delete操作のundo用: 再作成するためのタスクデータ */
    deletedTask?: Task;
  };
  timestamp: number;
}

/**
 * Redo可能な操作（undoの逆操作）
 */
export interface RedoableOperation {
  type: OperationType;
  taskId: string;
  /** やり直すために必要なデータ */
  redoData: {
    /** create操作のredo用: 再作成するデータ */
    createData?: CreateTask;
    /** update操作のredo用: 更新後のタスクデータ */
    updatedTask?: UpdateTask;
    /** delete操作のredo用: 削除するtaskId */
    taskIdToDelete?: string;
  };
  timestamp: number;
}

interface UndoRedoState {
  /** Undo履歴スタック */
  past: UndoableOperation[];
  /** Redo履歴スタック */
  future: RedoableOperation[];
  /** 現在undo/redo操作中かどうか（循環防止用） */
  isProcessing: boolean;
  /** 最大履歴保持数 */
  maxHistorySize: number;
}

interface UndoRedoActions {
  /**
   * 操作をundoスタックにpush
   */
  pushOperation: (operation: Omit<UndoableOperation, 'timestamp'>) => void;
  /**
   * Undo操作を実行し、undoした操作を返す
   */
  popUndo: () => UndoableOperation | null;
  /**
   * Redo操作を実行し、redoした操作を返す
   */
  popRedo: () => RedoableOperation | null;
  /**
   * Undoスタックの最新操作をRedoスタックに移動
   */
  moveToRedo: (redoableOp: RedoableOperation) => void;
  /**
   * 処理中フラグをセット
   */
  setProcessing: (value: boolean) => void;
  /**
   * 履歴をクリア
   */
  clear: () => void;
  /**
   * Undo可能かどうか
   */
  canUndo: () => boolean;
  /**
   * Redo可能かどうか
   */
  canRedo: () => boolean;
}

const MAX_HISTORY_SIZE = 30;

export const useUndoRedoStore = create<UndoRedoState & UndoRedoActions>()(
  (set, get) => ({
    past: [],
    future: [],
    isProcessing: false,
    maxHistorySize: MAX_HISTORY_SIZE,

    pushOperation: (operation) => {
      const state = get();
      // 処理中（undo/redo実行中）は新しい操作をpushしない
      if (state.isProcessing) return;

      const newOperation: UndoableOperation = {
        ...operation,
        timestamp: Date.now(),
      };

      set({
        past: [...state.past, newOperation].slice(-MAX_HISTORY_SIZE),
        // 新しい操作をpushしたらredo履歴はクリア
        future: [],
      });
    },

    popUndo: () => {
      const state = get();
      if (state.past.length === 0) return null;

      const operation = state.past[state.past.length - 1];
      set({
        past: state.past.slice(0, -1),
      });

      return operation;
    },

    popRedo: () => {
      const state = get();
      if (state.future.length === 0) return null;

      const operation = state.future[state.future.length - 1];
      set({
        future: state.future.slice(0, -1),
      });

      return operation;
    },

    moveToRedo: (redoableOp) => {
      const state = get();
      set({
        future: [...state.future, redoableOp].slice(-MAX_HISTORY_SIZE),
      });
    },

    setProcessing: (value) => {
      set({ isProcessing: value });
    },

    clear: () => {
      set({ past: [], future: [] });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  })
);
