import { useState, useEffect } from 'react';

export interface TeamConfig {
  id: string;
  name: string;
}

export interface ProjectConfig {
  id: string;
}

export interface CrewConfig {
  version: number;
  team?: TeamConfig;
  project?: ProjectConfig;
  supabase?: {
    url: string;
    anon_key: string;
  };
}

export interface TeamModeState {
  isTeamMode: boolean;
  teamId: string | null;
  teamName: string | null;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to detect and manage team mode state.
 * Team mode is determined by the presence of a .crew/config.json file
 * in the project root with team and project configurations.
 */
export const useTeamMode = (): TeamModeState => {
  const [state, setState] = useState<TeamModeState>({
    isTeamMode: false,
    teamId: null,
    teamName: null,
    projectId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // For now, team mode is detected from environment or API
    // In a full implementation, this would check the .crew/config.json
    const checkTeamMode = async () => {
      try {
        // Team mode will be determined by the backend
        // For now, default to solo mode
        setState({
          isTeamMode: false,
          teamId: null,
          teamName: null,
          projectId: null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to detect team mode',
        }));
      }
    };

    checkTeamMode();
  }, []);

  return state;
};

/**
 * Hook to check if Supabase team features are available
 */
export const useSupabaseAvailable = (): {
  isAvailable: boolean;
  isLoading: boolean;
} => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if Supabase is configured on the backend
    const checkSupabase = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          // For now, assume Supabase is available if backend is healthy
          // In a full implementation, check a specific endpoint
          setIsAvailable(true);
        }
      } catch {
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSupabase();
  }, []);

  return { isAvailable, isLoading };
};

export default useTeamMode;
