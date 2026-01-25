/**
 * Supabase Realtime utilities for team synchronization
 */

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeChange<T = Record<string, unknown>> {
  table: string;
  event_type: RealtimeEventType;
  old_record: T | null;
  new_record: T | null;
}

export interface RealtimeMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  ref?: string;
}

export interface RealtimeSubscription {
  channelName: string;
  table: string;
  filter?: string;
  schema: string;
}

/**
 * Create a subscription configuration for a table
 */
export function createSubscription(
  table: string,
  filter?: string
): RealtimeSubscription {
  return {
    channelName: `realtime:public:${table}`,
    table,
    filter,
    schema: 'public',
  };
}

/**
 * Create a subscription for tasks in a project
 */
export function createTasksSubscription(projectId: string): RealtimeSubscription {
  return createSubscription('tasks', `project_id=eq.${projectId}`);
}

/**
 * Create a subscription for stories in a project
 */
export function createStoriesSubscription(
  projectId: string
): RealtimeSubscription {
  return createSubscription('stories', `project_id=eq.${projectId}`);
}

/**
 * Create a subscription for team members
 */
export function createTeamMembersSubscription(
  teamId: string
): RealtimeSubscription {
  return createSubscription('team_members', `team_id=eq.${teamId}`);
}

/**
 * Generate the Supabase realtime WebSocket URL
 */
export function getRealtimeWsUrl(supabaseUrl: string, anonKey: string): string {
  const wsUrl = supabaseUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');
  return `${wsUrl}/realtime/v1/websocket?apikey=${anonKey}&vsn=1.0.0`;
}

/**
 * Create a join message for a realtime channel
 */
export function createJoinMessage(
  subscription: RealtimeSubscription,
  ref: string
): RealtimeMessage {
  return {
    topic: subscription.channelName,
    event: 'phx_join',
    payload: {
      config: {
        postgres_changes: [
          {
            event: '*',
            schema: subscription.schema,
            table: subscription.table,
            filter: subscription.filter || '',
          },
        ],
      },
    },
    ref,
  };
}

/**
 * Create a heartbeat message
 */
export function createHeartbeatMessage(ref: string): RealtimeMessage {
  return {
    topic: 'phoenix',
    event: 'heartbeat',
    payload: {},
    ref,
  };
}

/**
 * Parse a realtime change from a message
 */
export function parseRealtimeChange<T = Record<string, unknown>>(
  message: RealtimeMessage
): RealtimeChange<T> | null {
  if (message.event !== 'postgres_changes') {
    return null;
  }

  const payload = message.payload as {
    table?: string;
    eventType?: RealtimeEventType;
    old?: T;
    new?: T;
  };

  if (!payload.table || !payload.eventType) {
    return null;
  }

  return {
    table: payload.table,
    event_type: payload.eventType,
    old_record: payload.old || null,
    new_record: payload.new || null,
  };
}

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy = 'last-writer-wins' | 'keep-local' | 'accept-remote';

/**
 * Resolve a conflict between local and remote records
 */
export function resolveConflict<T extends { updated_at?: string }>(
  local: T,
  remote: T,
  strategy: ConflictStrategy
): T {
  switch (strategy) {
    case 'last-writer-wins': {
      const localUpdated = local.updated_at || '';
      const remoteUpdated = remote.updated_at || '';
      return remoteUpdated > localUpdated ? remote : local;
    }
    case 'keep-local':
      return local;
    case 'accept-remote':
      return remote;
    default:
      return remote;
  }
}
