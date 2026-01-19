import { useMemo } from 'react';
import { StatsCards } from './StatsCards';
import { StatusPieChart } from './StatusPieChart';
import { ProgressBar } from './ProgressBar';
import { RecentActivity } from './RecentActivity';
import type { TaskWithAttemptStatus, TaskStatus } from 'shared/types';

interface ProjectDashboardProps {
  tasks: TaskWithAttemptStatus[];
  onViewTaskDetails?: (task: TaskWithAttemptStatus) => void;
}

export function ProjectDashboard({ tasks, onViewTaskDetails }: ProjectDashboardProps) {
  const taskCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      todo: 0,
      inprogress: 0,
      inreview: 0,
      done: 0,
      cancelled: 0,
    };

    tasks.forEach((task) => {
      counts[task.status]++;
    });

    return counts;
  }, [tasks]);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Stats Cards */}
      <StatsCards taskCounts={taskCounts} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusPieChart taskCounts={taskCounts} />
        <ProgressBar taskCounts={taskCounts} />
      </div>

      {/* Recent Activity */}
      <RecentActivity tasks={tasks} onTaskClick={onViewTaskDetails} />
    </div>
  );
}
