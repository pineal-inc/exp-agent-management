import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Circle, Play, Eye, CheckCircle2, XCircle } from 'lucide-react';
import type { TaskWithAttemptStatus, TaskStatus } from 'shared/types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface RecentActivityProps {
  tasks: TaskWithAttemptStatus[];
  onTaskClick?: (task: TaskWithAttemptStatus) => void;
}

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-slate-500" />,
  inprogress: <Play className="h-4 w-4 text-blue-500" />,
  inreview: <Eye className="h-4 w-4 text-amber-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  cancelled: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  inprogress: '進行中',
  inreview: 'レビュー中',
  done: '完了',
  cancelled: 'キャンセル',
};

export function RecentActivity({ tasks, onTaskClick }: RecentActivityProps) {
  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [tasks]);

  if (recentTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近のアクティビティ</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">アクティビティがありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近のアクティビティ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {recentTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onTaskClick?.(task)}
          >
            <div className="shrink-0">{STATUS_ICONS[task.status]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABELS[task.status]} ・{' '}
                {formatDistanceToNow(new Date(task.updated_at), {
                  addSuffix: true,
                  locale: ja,
                })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
