import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  url?: string;
  barId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    barId,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = barId ? `${url}?barId=${barId}` : url;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Intentar reconectar si no fue un cierre intencional
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      onError?.(error as Event);
    }
  }, [url, barId, onMessage, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString()
      };

      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', { type, data });
    }
  }, []);

  // Conectar automáticamente al montar
  useEffect(() => {
    connect();

    // Limpiar al desmontar
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconectar cuando cambie el barId
  useEffect(() => {
    if (barId) {
      disconnect();
      connect();
    }
  }, [barId, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect
  };
};

// Hook específico para eventos de cola musical
export const useQueueWebSocket = (barId?: string) => {
  const [queueUpdates, setQueueUpdates] = useState<any[]>([]);
  const [songAdded, setSongAdded] = useState<any | null>(null);
  const [songSkipped, setSongSkipped] = useState<any | null>(null);
  const [trackChanged, setTrackChanged] = useState<any | null>(null);

  const { isConnected, sendMessage } = useWebSocket({
    barId,
    onMessage: (message) => {
      switch (message.type) {
        case 'QUEUE_UPDATED':
          setQueueUpdates(prev => [...prev, message.data]);
          break;
        case 'SONG_ADDED':
          setSongAdded(message.data);
          break;
        case 'SONG_SKIPPED':
          setSongSkipped(message.data);
          break;
        case 'TRACK_CHANGED':
          setTrackChanged(message.data);
          break;
        default:
          console.log('Unhandled WebSocket message type:', message.type);
      }
    },
    onConnect: () => {
      console.log('Connected to queue WebSocket');
      // Unirse a la sala del bar
      if (barId) {
        sendMessage('join_bar', { barId });
      }
    },
    onDisconnect: () => {
      console.log('Disconnected from queue WebSocket');
    }
  });

  const joinBar = useCallback((barId: string) => {
    sendMessage('join_bar', { barId });
  }, [sendMessage]);

  const leaveBar = useCallback((barId: string) => {
    sendMessage('leave_bar', { barId });
  }, [sendMessage]);

  const requestQueuePosition = useCallback((barId: string) => {
    sendMessage('get_queue_position', { barId });
  }, [sendMessage]);

  return {
    isConnected,
    queueUpdates,
    songAdded,
    songSkipped,
    trackChanged,
    joinBar,
    leaveBar,
    requestQueuePosition,
    clearUpdates: () => setQueueUpdates([])
  };
};