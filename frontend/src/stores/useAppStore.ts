import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, User, Song, QueueItem, MenuItem, PointsTransaction, BarStats } from '@/types';
import { wsManager } from '@/utils/websocket';

interface AppStore extends AppState {
  // Actions para User
  setUser: (user: User | null) => void;
  updateUserPoints: (points: number) => void;
  setTableNumber: (tableNumber: number | null) => void;
  
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
  connectWebSocket: (tableNumber?: number) => Promise<void>;
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
  
  // User actions
  setUser: (user) => set({ user }, false, 'setUser'),
  
  updateUserPoints: (points) => set((state) => ({
    user: state.user ? { ...state.user, points } : null
  }), false, 'updateUserPoints'),
  
  setTableNumber: (tableNumber) => set({ tableNumber }, false, 'setTableNumber'),
  
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
  
  connectWebSocket: async (tableNumber) => {
    try {
      await wsManager.connect(tableNumber);
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