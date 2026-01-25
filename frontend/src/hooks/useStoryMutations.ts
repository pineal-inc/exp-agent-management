import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  storiesApi,
  Story,
  CreateStoryRequest,
  UpdateStoryRequest,
} from '@/lib/api';

export interface UseStoryMutationsResult {
  createStory: (data: CreateStoryRequest) => Promise<Story>;
  updateStory: (storyId: string, data: UpdateStoryRequest) => Promise<Story>;
  deleteStory: (storyId: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

/**
 * Hook for story CRUD mutations with optimistic updates
 */
export const useStoryMutations = (projectId: string | undefined): UseStoryMutationsResult => {
  const queryClient = useQueryClient();
  const queryKey = ['stories', projectId];

  const createMutation = useMutation({
    mutationFn: (data: CreateStoryRequest) => storiesApi.create(data),
    onSuccess: (newStory) => {
      queryClient.setQueryData<Story[]>(queryKey, (old = []) => [...old, newStory]);
    },
    onError: () => {
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ storyId, data }: { storyId: string; data: UpdateStoryRequest }) =>
      storiesApi.update(storyId, data),
    onMutate: async ({ storyId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousStories = queryClient.getQueryData<Story[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<Story[]>(queryKey, (old = []) =>
        old.map((story) =>
          story.id === storyId ? { ...story, ...data } : story
        )
      );

      return { previousStories };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(queryKey, context.previousStories);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (storyId: string) => storiesApi.delete(storyId),
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey });

      const previousStories = queryClient.getQueryData<Story[]>(queryKey);

      queryClient.setQueryData<Story[]>(queryKey, (old = []) =>
        old.filter((story) => story.id !== storyId)
      );

      return { previousStories };
    },
    onError: (_err, _storyId, context) => {
      if (context?.previousStories) {
        queryClient.setQueryData(queryKey, context.previousStories);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createStory: (data: CreateStoryRequest) => createMutation.mutateAsync(data),
    updateStory: (storyId: string, data: UpdateStoryRequest) =>
      updateMutation.mutateAsync({ storyId, data }),
    deleteStory: (storyId: string) => deleteMutation.mutateAsync(storyId),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export default useStoryMutations;
