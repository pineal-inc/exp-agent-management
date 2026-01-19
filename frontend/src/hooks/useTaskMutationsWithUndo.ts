import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigateWithSearch } from '@/hooks';
import { tasksApi } from '@/lib/api';
import { paths } from '@/lib/paths';
import { taskRelationshipsKeys } from '@/hooks/useTaskRelationships';
import { workspaceSummaryKeys } from '@/components/ui-new/hooks/useWorkspaces';
import type {
  CreateTask,
  CreateAndStartTaskRequest,
  Task,
  TaskWithAttemptStatus,
  UpdateTask,
  SharedTaskDetails,
} from 'shared/types';
import { taskKeys } from './useTask';
import { useUndoableTaskOperations } from './useUndoRedo';

/**
 * Undo/Redo対応版のタスク操作フック
 *
 * useTaskMutationsの代わりに使用することで、
 * タスク操作がUndoスタックに記録されるようになります
 */
export function useTaskMutationsWithUndo(projectId?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigateWithSearch();
  const { recordCreate, recordUpdate, recordDelete } =
    useUndoableTaskOperations();

  const invalidateQueries = (taskId?: string) => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: taskKeys.byId(taskId) });
    }
  };

  const createTask = useMutation({
    mutationFn: (data: CreateTask) => tasksApi.create(data),
    onSuccess: (createdTask: Task) => {
      invalidateQueries();
      // Undoスタックに記録
      recordCreate(createdTask);

      // Invalidate parent's relationships cache if this is a subtask
      if (createdTask.parent_workspace_id) {
        queryClient.invalidateQueries({
          queryKey: taskRelationshipsKeys.byAttempt(
            createdTask.parent_workspace_id
          ),
        });
      }
      if (projectId) {
        navigate(`${paths.task(projectId, createdTask.id)}/attempts/latest`);
      }
    },
    onError: (err) => {
      console.error('Failed to create task:', err);
    },
  });

  const createAndStart = useMutation({
    mutationFn: (data: CreateAndStartTaskRequest) =>
      tasksApi.createAndStart(data),
    onSuccess: (createdTask: TaskWithAttemptStatus) => {
      invalidateQueries();
      // Undoスタックに記録（TaskWithAttemptStatusはTaskを拡張している）
      recordCreate(createdTask as unknown as Task);

      // Invalidate parent's relationships cache if this is a subtask
      if (createdTask.parent_workspace_id) {
        queryClient.invalidateQueries({
          queryKey: taskRelationshipsKeys.byAttempt(
            createdTask.parent_workspace_id
          ),
        });
      }
      if (projectId) {
        navigate(`${paths.task(projectId, createdTask.id)}/attempts/latest`);
      }
    },
    onError: (err) => {
      console.error('Failed to create and start task:', err);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      taskId,
      data,
    }: {
      taskId: string;
      data: UpdateTask;
    }) => {
      // 更新前のタスクデータを取得（Undo用）
      const previousTask = await tasksApi.getById(taskId);
      const updatedTask = await tasksApi.update(taskId, data);
      return { updatedTask, previousTask };
    },
    onSuccess: ({ updatedTask, previousTask }) => {
      invalidateQueries(updatedTask.id);
      // Undoスタックに記録
      recordUpdate(updatedTask.id, previousTask);
    },
    onError: (err) => {
      console.error('Failed to update task:', err);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      // 削除前にタスクデータを取得（Undo用）
      const taskToDelete = await tasksApi.getById(taskId);
      await tasksApi.delete(taskId);
      return taskToDelete;
    },
    onSuccess: (deletedTask: Task) => {
      invalidateQueries(deletedTask.id);
      // Undoスタックに記録
      recordDelete(deletedTask);

      // Remove single-task cache entry to avoid stale data flashes
      queryClient.removeQueries({
        queryKey: ['task', deletedTask.id],
        exact: true,
      });
      // Invalidate all task relationships caches (safe approach since we don't know parent)
      queryClient.invalidateQueries({ queryKey: taskRelationshipsKeys.all });
      // Invalidate workspace summaries so they refresh with the deleted workspace removed
      queryClient.invalidateQueries({ queryKey: workspaceSummaryKeys.all });
    },
    onError: (err) => {
      console.error('Failed to delete task:', err);
    },
  });

  // share, unshare, linkToLocal はUndo対象外（元の実装をそのまま使用）
  const shareTask = useMutation({
    mutationFn: (taskId: string) => tasksApi.share(taskId),
    onError: (err) => {
      console.error('Failed to share task:', err);
    },
  });

  const unshareSharedTask = useMutation({
    mutationFn: (sharedTaskId: string) => tasksApi.unshare(sharedTaskId),
    onSuccess: () => {
      invalidateQueries();
    },
    onError: (err) => {
      console.error('Failed to unshare task:', err);
    },
  });

  const linkSharedTaskToLocal = useMutation({
    mutationFn: (data: SharedTaskDetails) => tasksApi.linkToLocal(data),
    onSuccess: (createdTask: Task | null) => {
      console.log('Linked shared task to local successfully', createdTask);
      if (createdTask) {
        invalidateQueries(createdTask.id);
        // リンクはUndo対象外とする
      }
    },
    onError: (err) => {
      console.error('Failed to link shared task to local:', err);
    },
  });

  return {
    createTask,
    createAndStart,
    updateTask,
    deleteTask,
    shareTask,
    stopShareTask: unshareSharedTask,
    linkSharedTaskToLocal,
  };
}
