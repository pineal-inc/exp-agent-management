import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaskStatus } from 'shared/types';

interface StatusPieChartProps {
  taskCounts: Record<TaskStatus, number>;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#64748b',
  inprogress: '#3b82f6',
  inreview: '#f59e0b',
  done: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  inprogress: '進行中',
  inreview: 'レビュー中',
  done: '完了',
  cancelled: 'キャンセル',
};

export function StatusPieChart({ taskCounts }: StatusPieChartProps) {
  const data = useMemo(() => {
    return Object.entries(taskCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status as TaskStatus],
        value: count,
        color: STATUS_COLORS[status as TaskStatus],
      }));
  }, [taskCounts]);

  const total = useMemo(() => {
    return Object.values(taskCounts).reduce((sum, count) => sum + count, 0);
  }, [taskCounts]);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ステータス分布</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">タスクがありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ステータス分布</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value}件`, '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
