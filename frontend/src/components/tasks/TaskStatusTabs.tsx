import { ListTodo, Archive } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { paths } from '@/lib/paths';

interface TaskStatusTabsProps {
  className?: string;
}

type TabValue = 'active' | 'completed';

export function TaskStatusTabs({ className }: TaskStatusTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();

  const isCompletedPage = location.pathname.includes('/tasks/completed');
  const currentTab: TabValue = isCompletedPage ? 'completed' : 'active';

  const handleTabChange = (value: string) => {
    if (!value || !projectId) return;

    if (value === 'active') {
      navigate(paths.projectTasks(projectId));
    } else if (value === 'completed') {
      navigate(paths.completedTasks(projectId));
    }
  };

  return (
    <ToggleGroup
      type="single"
      value={currentTab}
      onValueChange={handleTabChange}
      className={cn('flex items-center gap-1 p-1 rounded-lg bg-muted/80', className)}
    >
      <ToggleGroupItem
        value="active"
        aria-label="Active tasks"
        active={currentTab === 'active'}
        className="flex flex-row items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium"
      >
        <ListTodo className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">タスクプール</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="completed"
        aria-label="Completed tasks"
        active={currentTab === 'completed'}
        className="flex flex-row items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium"
      >
        <Archive className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">アーカイブ</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
