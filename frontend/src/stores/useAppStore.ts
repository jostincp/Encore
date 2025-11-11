import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, User, Song, QueueItem, MenuItem, PointsTransaction, BarStats } from '@/types';
import { wsManager } from '@/utils/websocket';

interface AppStore extends AppState {
  // Actions para User
  setUser: (user: User | null) => void;
  updateUserPoints: (points: number) => void;
  setTableNumber: (tableNumber: number | null) => void;
  
  // Actions para Bar Connection
  setBarId: (barId: string | null) => void;
  connectToBar: (barId: string, tableNumber: number) => Promise<void>;
  disconnectFromBar: () => void;
  
  // Actions para Music & Queue
  setCurrentSong: (song: Song | null) => void;
  setQueue: (queue: QueueItem[]) => void;
  addToQueue: (queueItem: QueueItem) => void;
  removeFromQueue: (queueId: string) => void;
  updateQueueItem: (queueId: string, updates: Partial<QueueItem>) => void;
  reorderQueue: (newOrder: QueueItem[]) => void;
  
  // Actions para Menu & Cart
  setMenu: (menu: MenuItem[]) => void;
  updateMenuItem: (itemId: string, updates: Partial<MenuItem>) => void;
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  
  // Actions para Points
  addPointsTransaction: (transaction: PointsTransaction) => void;
  setPointsHistory: (history: PointsTransaction[]) => void;
  
  // Actions para Bar Stats
  setBarStats: (stats: BarStats) => void;
  
  // Actions para Connection
  setConnectionStatus: (isConnected: boolean) => void;
  connectWebSocket: (tableNumber?: number, barId?: string) => Promise<void>;
  disconnectWebSocket: () => void;
  
  // Computed values
  getCartTotal: () => { totalPrice: number; totalPoints: number; itemCount: number };
  getUserPointsBalance: () => number;
  getQueuePosition: (queueId: string) => number;
}

export const useAppStore = create<AppStore>()(devtools((set, get) => ({
  // Initial state
  user: null,
  currentSong: null,
  queue: [],
  menu: [],
  cart: [],
  pointsHistory: [],
  barStats: {
    activeTables: 0,
    totalRevenue: 0,
    songsInQueue: 0,
    topSellingItems: [],
    popularSongs: [],
    averagePointsPerTable: 0
  },
  isConnected: false,
  tableNumber: null,
  barId: null,
  
  // User actions
  setUser: (user) => set({ user }, false, 'setUser'),
  
  updateUserPoints: (points) => set((state) => ({
    user: state.user ? { ...state.user, points } : null
  }), false, 'updateUserPoints'),
  
  setTableNumber: (tableNumber) => set({ tableNumber }, false, 'setTableNumber'),
  
  // Bar Connection actions
  setBarId: (barId) => set({ barId }, false, 'setBarId'),
  
  connectToBar: async (barId: string, tableNumber: number) => {
    try {
      // Guardar en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('encore_bar_id', barId);
        localStorage.setItem('encore_table_number', tableNumber.toString());
      }
      
      // Actualizar estado
      set({ barId, tableNumber }, false, 'connectToBar');
      
      // Crear usuario temporal si no existe
      const { user } = get();
      if (!user) {
        const userId = `client_${Date.now()}`;
        get().setUser({
          id: userId,
          role: 'client',
          tableNumber,
          points: 100, // Puntos iniciales
          sessionId: `session_${Date.now()}`
        });
      }
      
      // Conectar WebSocket
      await get().connectWebSocket(tableNumber, barId);

      // Esperar un momento para que la conexión WebSocket se establezca
      await new Promise(resolve => setTimeout(resolve, 500));

      // Unirse a la sala del bar para actualizaciones en tiempo real
      try {
        if (wsManager.isConnected()) {
          wsManager.emit('join_bar', barId);
          console.log('Joined bar room:', barId);
        } else {
          console.warn('WebSocket not connected, retrying join_bar...');
          // Reintentar después de otro delay
          setTimeout(() => {
            if (wsManager.isConnected()) {
              wsManager.emit('join_bar', barId);
            }
          }, 1000);
        }
      } catch (e) {
        console.warn('No se pudo unirse a la sala del bar:', e);
      }
      
    } catch (error) {
      console.error('Error connecting to bar:', error);
      throw error;
    }
  },
  
  disconnectFromBar: () => {
    const currentBarId = get().barId;

    // Salir de la sala del bar antes de desconectar
    if (currentBarId) {
      try {
        wsManager.emit('leave_bar', currentBarId);
      } catch (e) {
        console.warn('No se pudo salir de la sala del bar:', e);
      }
    }

    // Limpiar localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('encore_bar_id');
      localStorage.removeItem('encore_table_number');
    }
    
    // Limpiar estado
    set({ barId: null, tableNumber: null }, false, 'disconnectFromBar');
    
    // Desconectar WebSocket
    get().disconnectWebSocket();
  },
  
  // Music & Queue actions
  setCurrentSong: (currentSong) => set({ currentSong }, false, 'setCurrentSong'),
  
  setQueue: (queue) => set({ queue }, false, 'setQueue'),
  
  addToQueue: (queueItem) => set((state) => ({
    queue: [...state.queue, queueItem]
  }), false, 'addToQueue'),
  
  removeFromQueue: (queueId) => set((state) => ({
    queue: state.queue.filter(item => item.id !== queueId)
  }), false, 'removeFromQueue'),
  
  updateQueueItem: (queueId, updates) => set((state) => ({
    queue: state.queue.map(item => 
      item.id === queueId ? { ...item, ...updates } : item
    )
  }), false, 'updateQueueItem'),
  
  reorderQueue: (newOrder) => set({ queue: newOrder }, false, 'reorderQueue'),
  
  // Menu & Cart actions
  setMenu: (menu) => set({ menu }, false, 'setMenu'),
  
  updateMenuItem: (itemId, updates) => set((state) => ({
    menu: state.menu.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    )
  }), false, 'updateMenuItem'),
  
  addToCart: (item, quantity = 1) => set((state) => {
    const existingItem = state.cart.find(cartItem => cartItem.menuItem.id === item.id);
    
    if (existingItem) {
      return {
        cart: state.cart.map(cartItem => 
          cartItem.menuItem.id === item.id 
            ? {
                ...cartItem,
                quantity: cartItem.quantity + quantity,
                totalPrice: (cartItem.quantity + quantity) * item.price,
                totalPoints: (cartItem.quantity + quantity) * item.pointsReward
              }
            : cartItem
        )
      };
    } else {
      return {
        cart: [...state.cart, {
          menuItem: item,
          quantity,
          totalPrice: quantity * item.price,
          totalPoints: quantity * item.pointsReward
        }]
      };
    }
  }, false, 'addToCart'),
  
  removeFromCart: (itemId) => set((state) => ({
    cart: state.cart.filter(cartItem => cartItem.menuItem.id !== itemId)
  }), false, 'removeFromCart'),
  
  updateCartItemQuantity: (itemId, quantity) => set((state) => {
    if (quantity <= 0) {
      return {
        cart: state.cart.filter(cartItem => cartItem.menuItem.id !== itemId)
      };
    }
    
    return {
      cart: state.cart.map(cartItem => 
        cartItem.menuItem.id === itemId 
          ? {
              ...cartItem,
              quantity,
              totalPrice: quantity * cartItem.menuItem.price,
              totalPoints: quantity * cartItem.menuItem.pointsReward
            }
          : cartItem
      )
    };
  }, false, 'updateCartItemQuantity'),
  
  clearCart: () => set({ cart: [] }, false, 'clearCart'),
  
  // Points actions
  addPointsTransaction: (transaction) => set((state) => ({
    pointsHistory: [transaction, ...state.pointsHistory]
  }), false, 'addPointsTransaction'),
  
  setPointsHistory: (pointsHistory) => set({ pointsHistory }, false, 'setPointsHistory'),
  
  // Bar Stats actions
  setBarStats: (barStats) => set({ barStats }, false, 'setBarStats'),
  
  // Connection actions
  setConnectionStatus: (isConnected) => set({ isConnected }, false, 'setConnectionStatus'),
  
  connectWebSocket: async (tableNumber, barId) => {
    try {
      await wsManager.connect(tableNumber, barId);
      set({ isConnected: true }, false, 'connectWebSocket');
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      set({ isConnected: false }, false, 'connectWebSocket');
      throw error;
    }
  },
  
  disconnectWebSocket: () => {
    wsManager.disconnect();
    set({ isConnected: false }, false, 'disconnectWebSocket');
  },
  
  // Computed values
  getCartTotal: () => {
    const { cart } = get();
    return cart.reduce(
      (total, item) => ({
        totalPrice: total.totalPrice + item.totalPrice,
        totalPoints: total.totalPoints + item.totalPoints,
        itemCount: total.itemCount + item.quantity
      }),
      { totalPrice: 0, totalPoints: 0, itemCount: 0 }
    );
  },
  
  getUserPointsBalance: () => {
    const { user } = get();
    return user?.points || 0;
  },
  
  getQueuePosition: (queueId) => {
    const { queue } = get();
    const index = queue.findIndex(item => item.id === queueId);
    return index >= 0 ? index + 1 : -1;
  }
}), {
  name: 'encore-store'
}));

// Selector hooks para optimizar re-renders
export const useUser = () => useAppStore(state => state.user);
export const useCurrentSong = () => useAppStore(state => state.currentSong);
export const useQueue = () => useAppStore(state => state.queue);
export const useMenu = () => useAppStore(state => state.menu);
export const useCart = () => useAppStore(state => state.cart);
export const usePointsHistory = () => useAppStore(state => state.pointsHistory);
export const useBarStats = () => useAppStore(state => state.barStats);
export const useConnectionStatus = () => useAppStore(state => state.isConnected);
export const useBarConnection = () => useAppStore(state => ({ barId: state.barId, tableNumber: state.tableNumber }));