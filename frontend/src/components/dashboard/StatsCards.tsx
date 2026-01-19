import { Card, CardContent } from '@/components/ui/card';
import { Circle, Play, Eye, CheckCircle2, XCircle } from 'lucide-react';
import type { TaskStatus } from 'shared/types';

interface StatsCardsProps {
  taskCounts: Record<TaskStatus, number>;
}

interface StatCardConfig {
  status: TaskStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const statConfigs: StatCardConfig[] = [
  {
    status: 'todo',
    label: 'Todo',
    icon: <Circle className="h-5 w-5" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    status: 'inprogress',
    label: '進行中',
    icon: <Play className="h-5 w-5" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    status: 'inreview',
    label: 'レビュー中',
    icon: <Eye className="h-5 w-5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    status: 'done',
    label: '完了',
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    status: 'cancelled',
    label: 'キャンセル',
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
];

export function StatsCards({ taskCounts }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {statConfigs.map((config) => (
        <Card key={config.status} className="border shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                {config.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">{taskCounts[config.status] ?? 0}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
