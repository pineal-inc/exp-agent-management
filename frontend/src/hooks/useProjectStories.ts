import { useQuery } from '@tanstack/react-query';
import { storiesApi, Story, StoryStatus } from '@/lib/api';
import { useMemo } from 'react';

export interface UseProjectStoriesResult {
  stories: Story[];
  storiesById: Record<string, Story>;
  storiesByStatus: Record<StoryStatus, Story[]>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch and manage stories for a project
 */
export const useProjectStories = (projectId: string | undefined): UseProjectStoriesResult => {

  const {
    data: stories = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => storiesApi.list(projectId!),
    enabled: !!projectId,
    staleTime: 5000,
  });

  const { storiesById, storiesByStatus } = useMemo(() => {
    const byId: Record<string, Story> = {};
    const byStatus: Record<StoryStatus, Story[]> = {
      backlog: [],
      ready: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };

    for (const story of stories) {
      byId[story.id] = story;
      if (byStatus[story.status]) {
        byStatus[story.status].push(story);
      }
    }

    // Sort each status group by priority (higher priority first)
    Object.values(byStatus).forEach((list) => {
      list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    });

    return { storiesById: byId, storiesByStatus: byStatus };
  }, [stories]);

  return {
    stories,
    storiesById,
    storiesByStatus,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
  };
};

export default useProjectStories;
