import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { TaskStatus } from 'shared/types';

interface ProgressBarProps {
  taskCounts: Record<TaskStatus, number>;
}

export function ProgressBar({ taskCounts }: ProgressBarProps) {
  const completed = taskCounts.done ?? 0;
  const total = Object.values(taskCounts).reduce((sum, count) => sum + count, 0);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">完了率</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {completed} / {total} タスク完了
          </span>
          <span className="font-semibold text-lg">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </CardContent>
    </Card>
  );
}
