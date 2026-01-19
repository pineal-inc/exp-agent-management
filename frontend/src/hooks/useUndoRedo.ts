import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api';
import { taskKeys } from './useTask';
import { taskRelationshipsKeys } from '@/hooks/useTaskRelationships';
import { workspaceSummaryKeys } from '@/components/ui-new/hooks/useWorkspaces';
import {
  useUndoRedoStore,
  type RedoableOperation,
} from '@/stores/useUndoRedoStore';
import { Action, getKeysFor, Scope } from '@/keyboard/registry';
import type { Task, CreateTask, UpdateTask } from 'shared/types';

/**
 * Undo/Redo機能を提供するフック
 * アプリ全体で1回だけ呼び出す
 */
export function useUndoRedo() {
  const queryClient = useQueryClient();
  const {
    popUndo,
    popRedo,
    moveToRedo,
    pushOperation,
    setProcessing,
    canUndo,
    canRedo,
  } = useUndoRedoStore();

  const invalidateQueries = useCallback(
    (taskId?: string) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.byId(taskId) });
      }
      queryClient.invalidateQueries({ queryKey: taskRelationshipsKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceSummaryKeys.all });
    },
    [queryClient]
  );

  const executeUndo = useCallback(async () => {
    if (!canUndo()) return;

    const operation = popUndo();
    if (!operation) return;

    setProcessing(true);
    try {
      let redoableOp: RedoableOperation | null = null;

      switch (operation.type) {
        case 'create': {
          // create操作のundo = 作成したタスクを削除
          const taskIdToDelete = operation.reverseData.taskIdToDelete;
          if (taskIdToDelete) {
            // 削除前にタスクデータを取得（redo用）
            const taskToDelete = await tasksApi.getById(taskIdToDelete);
            await tasksApi.delete(taskIdToDelete);
            invalidateQueries(taskIdToDelete);

            redoableOp = {
              type: 'create',
              taskId: taskIdToDelete,
              redoData: {
                createData: {
                  project_id: taskToDelete.project_id,
                  title: taskToDelete.title,
                  description: taskToDelete.description,
                  status: taskToDelete.status,
                  parent_workspace_id: taskToDelete.parent_workspace_id,
                  image_ids: null,
                  shared_task_id: null,
                },
              },
              timestamp: Date.now(),
            };
          }
          break;
        }

        case 'update': {
          // update操作のundo = 以前の状態に戻す
          const previousTask = operation.reverseData.previousTask;
          if (previousTask) {
            // 現在の状態を保存（redo用）
            const currentTask = await tasksApi.getById(operation.taskId);
            const updateData: UpdateTask = {
              title: previousTask.title,
              description: previousTask.description,
              status: previousTask.status,
              parent_workspace_id: null,
              image_ids: null,
              dag_position_x: null,
              dag_position_y: null,
              clear_dag_position: false,
            };
            await tasksApi.update(operation.taskId, updateData);
            invalidateQueries(operation.taskId);

            redoableOp = {
              type: 'update',
              taskId: operation.taskId,
              redoData: {
                updatedTask: {
                  title: currentTask.title,
                  description: currentTask.description,
                  status: currentTask.status,
                  parent_workspace_id: null,
                  image_ids: null,
                  dag_position_x: null,
                  dag_position_y: null,
                  clear_dag_position: false,
                },
              },
              timestamp: Date.now(),
            };
          }
          break;
        }

        case 'delete': {
          // delete操作のundo = 削除したタスクを再作成
          const deletedTask = operation.reverseData.deletedTask;
          if (deletedTask) {
            const createData: CreateTask = {
              project_id: deletedTask.project_id,
              title: deletedTask.title,
              description: deletedTask.description,
              status: deletedTask.status,
              parent_workspace_id: deletedTask.parent_workspace_id,
              image_ids: null,
              shared_task_id: null,
            };
            const createdTask = await tasksApi.create(createData);
            invalidateQueries(createdTask.id);

            redoableOp = {
              type: 'delete',
              taskId: createdTask.id,
              redoData: {
                taskIdToDelete: createdTask.id,
              },
              timestamp: Date.now(),
            };
          }
          break;
        }
      }

      // Redoスタックに追加
      if (redoableOp) {
        moveToRedo(redoableOp);
      }
    } catch (error) {
      console.error('Undo operation failed:', error);
    } finally {
      setProcessing(false);
    }
  }, [canUndo, popUndo, setProcessing, moveToRedo, invalidateQueries]);

  const executeRedo = useCallback(async () => {
    if (!canRedo()) return;

    const operation = popRedo();
    if (!operation) return;

    setProcessing(true);
    try {
      switch (operation.type) {
        case 'create': {
          // create操作のredo = 再度タスクを作成
          const createData = operation.redoData.createData;
          if (createData) {
            const createdTask = await tasksApi.create(createData);
            invalidateQueries(createdTask.id);

            // Undoスタックに追加
            pushOperation({
              type: 'create',
              taskId: createdTask.id,
              reverseData: {
                taskIdToDelete: createdTask.id,
              },
            });
          }
          break;
        }

        case 'update': {
          // update操作のredo = 更新を再実行
          const updatedTask = operation.redoData.updatedTask;
          if (updatedTask) {
            // 現在の状態を保存（undo用）
            const currentTask = await tasksApi.getById(operation.taskId);
            await tasksApi.update(operation.taskId, updatedTask);
            invalidateQueries(operation.taskId);

            // Undoスタックに追加
            pushOperation({
              type: 'update',
              taskId: operation.taskId,
              reverseData: {
                previousTask: currentTask,
              },
            });
          }
          break;
        }

        case 'delete': {
          // delete操作のredo = 再度タスクを削除
          const taskIdToDelete = operation.redoData.taskIdToDelete;
          if (taskIdToDelete) {
            // 削除前にタスクデータを取得（undo用）
            const taskToDelete = await tasksApi.getById(taskIdToDelete);
            await tasksApi.delete(taskIdToDelete);
            invalidateQueries(taskIdToDelete);

            // Undoスタックに追加
            pushOperation({
              type: 'delete',
              taskId: taskIdToDelete,
              reverseData: {
                deletedTask: taskToDelete,
              },
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error('Redo operation failed:', error);
    } finally {
      setProcessing(false);
    }
  }, [canRedo, popRedo, setProcessing, pushOperation, invalidateQueries]);

  // Undo: Cmd+Z / Ctrl+Z
  const undoKeys = getKeysFor(Action.UNDO, Scope.GLOBAL);
  useHotkeys(
    undoKeys,
    (e) => {
      e.preventDefault();
      executeUndo();
    },
    {
      enableOnFormTags: false,
      scopes: ['*', 'global'],
    }
  );

  // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
  const redoKeys = getKeysFor(Action.REDO, Scope.GLOBAL);
  useHotkeys(
    redoKeys,
    (e) => {
      e.preventDefault();
      executeRedo();
    },
    {
      enableOnFormTags: false,
      scopes: ['*', 'global'],
    }
  );

  return {
    executeUndo,
    executeRedo,
    canUndo,
    canRedo,
  };
}

/**
 * タスク操作をUndoスタックに追加するためのヘルパーフック
 */
export function useUndoableTaskOperations() {
  const { pushOperation, isProcessing } = useUndoRedoStore();

  const recordCreate = useCallback(
    (createdTask: Task) => {
      if (isProcessing) return;
      pushOperation({
        type: 'create',
        taskId: createdTask.id,
        reverseData: {
          taskIdToDelete: createdTask.id,
        },
      });
    },
    [pushOperation, isProcessing]
  );

  const recordUpdate = useCallback(
    (taskId: string, previousTask: Task) => {
      if (isProcessing) return;
      pushOperation({
        type: 'update',
        taskId,
        reverseData: {
          previousTask,
        },
      });
    },
    [pushOperation, isProcessing]
  );

  const recordDelete = useCallback(
    (deletedTask: Task) => {
      if (isProcessing) return;
      pushOperation({
        type: 'delete',
        taskId: deletedTask.id,
        reverseData: {
          deletedTask,
        },
      });
    },
    [pushOperation, isProcessing]
  );

  return {
    recordCreate,
    recordUpdate,
    recordDelete,
  };
}
