import { io, Socket } from 'socket.io-client';

class WebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  connect(tableNumber?: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3005';
        
        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          query: tableNumber ? { tableNumber: tableNumber.toString() } : undefined
        });
        
        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve(this.socket!);
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, don't reconnect
            return;
          }
          this.handleReconnect();
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.socket?.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  emit(event: string, data: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }
  
  on(event: string, callback: (data: unknown) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }
  
  off(event: string, callback?: (data: unknown) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
  
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// Hook para usar WebSocket en componentes React
export const useWebSocket = () => {
  return {
    connect: wsManager.connect.bind(wsManager),
    disconnect: wsManager.disconnect.bind(wsManager),
    emit: wsManager.emit.bind(wsManager),
    on: wsManager.on.bind(wsManager),
    off: wsManager.off.bind(wsManager),
    isConnected: wsManager.isConnected.bind(wsManager)
  };
};

// Tipos de eventos WebSocket
export const WS_EVENTS = {
  // Client events
  JOIN_TABLE: 'join_table',
  REQUEST_SONG: 'request_song',
  PRIORITY_REQUEST: 'priority_request',
  PLACE_ORDER: 'place_order',
  
  // Admin events
  APPROVE_SONG: 'approve_song',
  REJECT_SONG: 'reject_song',
  REORDER_QUEUE: 'reorder_queue',
  UPDATE_MENU: 'update_menu',
  
  // Server events
  QUEUE_UPDATED: 'queue_updated',
  SONG_APPROVED: 'song_approved',
  SONG_REJECTED: 'song_rejected',
  NOW_PLAYING: 'now_playing',
  PLAY_NEXT_SONG: 'play_next_song',
  POINTS_UPDATED: 'points_updated',
  ORDER_STATUS: 'order_status',
  STATS_UPDATED: 'stats_updated'
} as const;

export type WSEventType = typeof WS_EVENTS[keyof typeof WS_EVENTS];