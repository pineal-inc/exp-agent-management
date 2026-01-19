import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/contexts/ProjectContext';
import { useTaskAttemptsWithSessions } from '@/hooks/useTaskAttempts';
import { useTaskAttemptWithSession } from '@/hooks/useTaskAttempt';
import { useSingleTaskProperties } from '@/hooks/useTaskProperties';
import { useNavigateWithSearch } from '@/hooks';
import { useUserSystem } from '@/components/ConfigProvider';
import { useTaskDependencies } from '@/hooks/useTaskDependencies';
import { useTaskMutationsWithUndo } from '@/hooks/useTaskMutationsWithUndo';
import { paths } from '@/lib/paths';
import type { TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';
import { NewCardContent } from '../ui/new-card';
import { Button } from '../ui/button';
import { PlusIcon, ExternalLink, ChevronDown, ChevronRight, Play, Archive, Send, Clock } from 'lucide-react';
import { CreateAttemptDialog } from '@/components/dialogs/tasks/CreateAttemptDialog';
import WYSIWYGEditor from '@/components/ui/wysiwyg';
import { DataTable, type ColumnDef } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAttemptExecution } from '@/hooks/useAttemptExecution';
import { useSessionQueueInteraction } from '@/hooks/useSessionQueueInteraction';
import { sessionsApi } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TaskPanelProps {
  task: TaskWithAttemptStatus | null;
}

const TaskPanel = ({ task }: TaskPanelProps) => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigateWithSearch();
  const { projectId } = useProject();
  const { config } = useUserSystem();
  const [propertiesExpanded, setPropertiesExpanded] = useState(true);

  const {
    data: attempts = [],
    isLoading: isAttemptsLoading,
    isError: isAttemptsError,
  } = useTaskAttemptsWithSessions(task?.id);

  // Fetch task properties (GitHub fields)
  const { data: taskProps } = useSingleTaskProperties(task?.id);

  // Get dependencies for checking if task has any
  const { dependencies } = useTaskDependencies(projectId);
  const { updateTask } = useTaskMutationsWithUndo(projectId);

  // Check if the current task has dependencies
  const taskHasDependencies = useMemo(() => {
    if (!task || !dependencies || dependencies.length === 0) return false;
    return dependencies.some(
      (dep) => dep.task_id === task.id || dep.depends_on_task_id === task.id
    );
  }, [task, dependencies]);

  // Handle archive action
  const handleArchive = () => {
    if (!task) return;
    updateTask.mutate({
      taskId: task.id,
      data: {
        title: null,
        description: null,
        status: 'done',
        parent_workspace_id: null,
        image_ids: null,
        dag_position_x: null,
        dag_position_y: null,
        clear_dag_position: true,
      },
    });
  };

  const { data: parentAttempt, isLoading: isParentLoading } =
    useTaskAttemptWithSession(task?.parent_workspace_id || undefined);

  const formatTimeAgo = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const absSec = Math.round(Math.abs(diffMs) / 1000);

    const rtf =
      typeof Intl !== 'undefined' &&
      typeof Intl.RelativeTimeFormat === 'function'
        ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
        : null;

    const to = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      rtf
        ? rtf.format(-value, unit)
        : `${value} ${unit}${value !== 1 ? 's' : ''} ago`;

    if (absSec < 60) return to(Math.round(absSec), 'second');
    const mins = Math.round(absSec / 60);
    if (mins < 60) return to(mins, 'minute');
    const hours = Math.round(mins / 60);
    if (hours < 24) return to(hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 30) return to(days, 'day');
    const months = Math.round(days / 30);
    if (months < 12) return to(months, 'month');
    const years = Math.round(months / 12);
    return to(years, 'year');
  };

  const displayedAttempts = [...attempts].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Get latest attempt for follow-up
  const latestAttempt = displayedAttempts[0] || null;
  const latestSessionId = latestAttempt?.session?.id;
  const latestWorkspaceId = latestAttempt?.id;

  // Check if latest attempt is running
  const { isAttemptRunning } = useAttemptExecution(latestWorkspaceId, task?.id);

  // Queue interaction for latest session
  const {
    isQueued,
    queuedMessage,
    isQueueLoading,
    queueMessage,
    cancelQueue,
  } = useSessionQueueInteraction({
    sessionId: latestSessionId,
  });

  // Local state for follow-up message
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Handle sending follow-up message
  const handleSendFollowUp = useCallback(async () => {
    if (!latestSessionId || !followUpMessage.trim()) return;

    if (isAttemptRunning) {
      // Queue message if running
      try {
        await queueMessage(followUpMessage.trim(), null);
        setFollowUpMessage('');
        setFollowUpError(null);
      } catch (error) {
        const err = error as { message?: string };
        setFollowUpError(
          `キューへの追加に失敗しました: ${err.message ?? 'Unknown error'}`
        );
      }
    } else {
      // Send directly if not running
      try {
        setIsSendingFollowUp(true);
        setFollowUpError(null);
        await sessionsApi.followUp(latestSessionId, {
          prompt: followUpMessage.trim(),
          variant: null,
          retry_process_id: null,
          force_when_dirty: null,
          perform_git_reset: null,
        });
        setFollowUpMessage('');
      } catch (error) {
        const err = error as { message?: string };
        setFollowUpError(
          `追加指示の送信に失敗しました: ${err.message ?? 'Unknown error'}`
        );
      } finally {
        setIsSendingFollowUp(false);
      }
    }
  }, [latestSessionId, followUpMessage, isAttemptRunning, queueMessage]);

  // Handle cancel queue
  const handleCancelQueue = useCallback(async () => {
    try {
      await cancelQueue();
      setFollowUpError(null);
    } catch (error) {
      const err = error as { message?: string };
      setFollowUpError(
        `キューのキャンセルに失敗しました: ${err.message ?? 'Unknown error'}`
      );
    }
  }, [cancelQueue]);

  if (!task) {
    return (
      <div className="text-muted-foreground">
        {t('taskPanel.noTaskSelected')}
      </div>
    );
  }

  const titleContent = `# ${task.title || 'Task'}`;
  const descriptionContent = task.description || '';

  // Get GitHub issue URL from task properties
  const githubIssueUrl = taskProps?.githubIssueUrl;

  // Build properties list for Notion-style display
  const propertyItems: Array<{ key: string; label: string; value: React.ReactNode }> = [];

  if (taskProps?.githubStatus) {
    propertyItems.push({
      key: 'status',
      label: 'ステータス',
      value: (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {taskProps.githubStatus}
        </span>
      ),
    });
  }

  if (taskProps?.githubPriority) {
    const priority = taskProps.githubPriority;
    const priorityClass = cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      (priority === 'P0' || priority.toLowerCase() === 'critical') &&
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      (priority === 'P1' || priority.toLowerCase() === 'high') &&
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      (priority === 'P2' || priority.toLowerCase() === 'medium') &&
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      (priority === 'P3' || priority.toLowerCase() === 'low') &&
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    );
    propertyItems.push({
      key: 'priority',
      label: '優先度',
      value: <span className={priorityClass}>{priority}</span>,
    });
  }

  if (taskProps?.githubAssignees && taskProps.githubAssignees.length > 0) {
    propertyItems.push({
      key: 'assignees',
      label: '担当者',
      value: (
        <div className="flex items-center gap-1.5 flex-wrap">
          {taskProps.githubAssignees.map((assignee) => (
            <span
              key={assignee}
              className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-secondary text-xs font-medium"
            >
              {assignee}
            </span>
          ))}
        </div>
      ),
    });
  }

  // Add ジャンル (genre) if present
  if (taskProps?.['ジャンル']) {
    propertyItems.push({
      key: 'genre',
      label: 'ジャンル',
      value: (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary">
          {taskProps['ジャンル'] as string}
        </span>
      ),
    });
  }

  // Add labels if present
  if (taskProps?.githubLabels && taskProps.githubLabels.length > 0) {
    propertyItems.push({
      key: 'labels',
      label: 'ラベル',
      value: (
        <div className="flex items-center gap-1.5 flex-wrap">
          {taskProps.githubLabels.map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      ),
    });
  }

  const attemptColumns: ColumnDef<WorkspaceWithSession>[] = [
    {
      id: 'executor',
      header: '',
      accessor: (attempt) => attempt.session?.executor || 'Base Agent',
      className: 'pr-4',
    },
    {
      id: 'branch',
      header: '',
      accessor: (attempt) => attempt.branch || '—',
      className: 'pr-4',
    },
    {
      id: 'time',
      header: '',
      accessor: (attempt) => formatTimeAgo(attempt.created_at),
      className: 'pr-0 text-right',
    },
  ];

  return (
    <>
      <NewCardContent>
        <div className="p-6 flex flex-col h-full max-h-[calc(100vh-8rem)]">
          <div className="space-y-4 overflow-y-auto flex-shrink min-h-0">
            {/* Title */}
            <WYSIWYGEditor value={titleContent} disabled />

            {/* Actions Row */}
            <div className="flex items-center gap-2">
              {/* GitHub Link */}
              {githubIssueUrl && (
                <a
                  href={githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>GitHub Issue</span>
                </a>
              )}

              {/* Archive Button */}
              {task.status !== 'done' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={taskHasDependencies || updateTask.isPending}
                  title={taskHasDependencies ? '依存関係があるタスクはアーカイブできません' : 'タスクをアーカイブ（完了）にする'}
                  className="gap-1.5"
                >
                  <Archive size={14} />
                  アーカイブ
                </Button>
              )}
            </div>

            {/* Notion-style Properties Section */}
            {propertyItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPropertiesExpanded(!propertiesExpanded)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  {propertiesExpanded ? (
                    <ChevronDown size={16} className="text-muted-foreground" />
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground/70">
                    プロパティ
                  </span>
                </button>
                {propertiesExpanded && (
                  <div className="divide-y">
                    {propertyItems.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center px-3 py-2.5 hover:bg-muted/20 transition-colors"
                      >
                        <span className="w-24 text-sm text-muted-foreground shrink-0">
                          {item.label}
                        </span>
                        <div className="flex-1">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description / Issue Body */}
            {descriptionContent && (
              <div className="pt-2">
                <WYSIWYGEditor value={descriptionContent} disabled />
              </div>
            )}
          </div>

          <div className="mt-6 flex-shrink-0 space-y-4">
            {task.parent_workspace_id && (
              <DataTable
                data={parentAttempt ? [parentAttempt] : []}
                columns={attemptColumns}
                keyExtractor={(attempt) => attempt.id}
                onRowClick={(attempt) => {
                  if (config?.beta_workspaces) {
                    navigate(`/workspaces/${attempt.id}`);
                  } else if (projectId) {
                    navigate(
                      paths.attempt(projectId, attempt.task_id, attempt.id)
                    );
                  }
                }}
                isLoading={isParentLoading}
                headerContent="Parent Attempt"
              />
            )}

            {isAttemptsLoading ? (
              <div className="text-muted-foreground">
                {t('taskPanel.loadingAttempts')}
              </div>
            ) : isAttemptsError ? (
              <div className="text-destructive">
                {t('taskPanel.errorLoadingAttempts')}
              </div>
            ) : displayedAttempts.length === 0 ? (
              /* No attempts - show prominent CTA with optional prompt */
              <div className="space-y-4">
                <div className="border rounded-lg p-6 text-center space-y-4">
                  <div className="text-muted-foreground text-sm">
                    {t('taskPanel.noAttempts')}
                  </div>
                  <Button
                    variant="accent"
                    size="lg"
                    className="gap-2"
                    onClick={() =>
                      CreateAttemptDialog.show({
                        taskId: task.id,
                        initialPrompt: followUpMessage.trim() || undefined,
                      })
                    }
                  >
                    <Play size={18} />
                    エージェントを実行
                  </Button>
                </div>

                {/* Follow-up input for new attempts */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="text-sm font-medium">
                    追加の指示（オプション）
                  </div>
                  <div className="space-y-2">
                    <WYSIWYGEditor
                      placeholder="追加の指示を入力（オプション）..."
                      value={followUpMessage}
                      onChange={setFollowUpMessage}
                      projectId={projectId}
                      className="min-h-[60px]"
                    />
                    {followUpMessage.trim() && (
                      <div className="text-xs text-muted-foreground">
                        エージェント実行時にこの指示も送信されます
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <DataTable
                  data={displayedAttempts}
                  columns={attemptColumns}
                  keyExtractor={(attempt) => attempt.id}
                  onRowClick={(attempt) => {
                    if (config?.beta_workspaces) {
                      navigate(`/workspaces/${attempt.id}`);
                    } else if (projectId && task.id) {
                      navigate(paths.attempt(projectId, task.id, attempt.id));
                    }
                  }}
                  headerContent={
                    <div className="w-full flex text-left">
                      <span className="flex-1">
                        {t('taskPanel.attemptsCount', {
                          count: displayedAttempts.length,
                        })}
                      </span>
                    <span>
                      <Button
                        variant="icon"
                        onClick={() =>
                          CreateAttemptDialog.show({
                            taskId: task.id,
                            initialPrompt: followUpMessage.trim() || undefined,
                          })
                        }
                      >
                        <PlusIcon size={16} />
                      </Button>
                    </span>
                    </div>
                  }
                />

                {/* Follow-up section for latest attempt */}
                {latestAttempt && latestSessionId ? (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="text-sm font-medium">
                      追加の指示を送る
                    </div>

                    {isQueued && queuedMessage && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          メッセージがキューに入っています。現在の実行が終了したら実行されます。
                        </AlertDescription>
                      </Alert>
                    )}

                    {followUpError && (
                      <Alert variant="destructive">
                        <AlertDescription>{followUpError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <WYSIWYGEditor
                        placeholder={
                          isAttemptRunning
                            ? '追加の指示を入力（実行終了後にキューされます）...'
                            : '追加の指示を入力...'
                        }
                        value={followUpMessage}
                        onChange={setFollowUpMessage}
                        disabled={isSendingFollowUp || isQueueLoading}
                        projectId={projectId}
                        taskAttemptId={latestWorkspaceId}
                        className="min-h-[60px]"
                      />
                      <div className="flex items-center gap-2">
                        {isQueued ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelQueue}
                            disabled={isQueueLoading}
                          >
                            キューをキャンセル
                          </Button>
                        ) : (
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={handleSendFollowUp}
                            disabled={
                              !followUpMessage.trim() ||
                              isSendingFollowUp ||
                              isQueueLoading
                            }
                            className="gap-2"
                          >
                            {isAttemptRunning ? (
                              <>
                                <Clock size={16} />
                                キューに追加
                              </>
                            ) : (
                              <>
                                <Send size={16} />
                                送信
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Follow-up input when no attempts yet */
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="text-sm font-medium">
                      追加の指示（オプション）
                    </div>
                    <div className="space-y-2">
                      <WYSIWYGEditor
                        placeholder="追加の指示を入力（オプション）..."
                        value={followUpMessage}
                        onChange={setFollowUpMessage}
                        projectId={projectId}
                        className="min-h-[60px]"
                      />
                      {followUpMessage.trim() && (
                        <div className="text-xs text-muted-foreground">
                          新しいattempt作成時にこの指示も送信されます
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </NewCardContent>
    </>
  );
};

export default TaskPanel;
