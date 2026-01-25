import { useEffect, useRef, useCallback, useState } from 'react';
import {
  RealtimeChange,
  RealtimeMessage,
  RealtimeSubscription,
  createJoinMessage,
  createHeartbeatMessage,
  getRealtimeWsUrl,
  createTasksSubscription,
  createStoriesSubscription,
} from '@/lib/supabase/realtime';

export interface RealtimeSyncConfig {
  supabaseUrl: string;
  anonKey: string;
  projectId?: string;
  enabled?: boolean;
  onTaskChange?: (change: RealtimeChange) => void;
  onStoryChange?: (change: RealtimeChange) => void;
  onError?: (error: Error) => void;
}

export interface UseRealtimeSyncResult {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * Hook for real-time synchronization with Supabase
 * Manages WebSocket connection and handles incoming changes
 */
export const useRealtimeSync = (
  config: RealtimeSyncConfig
): UseRealtimeSyncResult => {
  const {
    supabaseUrl,
    anonKey,
    projectId,
    enabled = true,
    onTaskChange,
    onStoryChange,
    onError,
  } = config;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgRefCounter = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextRef = useCallback(() => {
    msgRefCounter.current += 1;
    return msgRefCounter.current.toString();
  }, []);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (subscription: RealtimeSubscription) => {
      const joinMessage = createJoinMessage(subscription, getNextRef());
      sendMessage(joinMessage);
    },
    [sendMessage, getNextRef]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: RealtimeMessage = JSON.parse(event.data);

        // Handle postgres_changes events
        if (message.event === 'postgres_changes') {
          const payload = message.payload as {
            table?: string;
            eventType?: string;
            old?: Record<string, unknown>;
            new?: Record<string, unknown>;
          };

          if (payload.table && payload.eventType) {
            const change: RealtimeChange = {
              table: payload.table,
              event_type: payload.eventType as RealtimeChange['event_type'],
              old_record: payload.old || null,
              new_record: payload.new || null,
            };

            if (change.table === 'tasks' && onTaskChange) {
              onTaskChange(change);
            } else if (change.table === 'stories' && onStoryChange) {
              onStoryChange(change);
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse realtime message:', err);
      }
    },
    [onTaskChange, onStoryChange]
  );

  const connect = useCallback(() => {
    if (!enabled || !supabaseUrl || !anonKey) {
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wsUrl = getRealtimeWsUrl(supabaseUrl, anonKey);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);

        // Subscribe to project channels if projectId is provided
        if (projectId) {
          subscribe(createTasksSubscription(projectId));
          subscribe(createStoriesSubscription(projectId));
        }

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          sendMessage(createHeartbeatMessage(getNextRef()));
        }, 30000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('Realtime WebSocket error:', event);
        setError('Connection error');
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnect if not a normal close
        if (event.code !== 1000 && enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      onError?.(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [
    enabled,
    supabaseUrl,
    anonKey,
    projectId,
    subscribe,
    sendMessage,
    getNextRef,
    handleMessage,
    onError,
  ]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  // Connect on mount or when config changes
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
};

export default useRealtimeSync;
