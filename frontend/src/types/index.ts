// Tipos principales del sistema Encore

export interface User {
  id: string;
  tableNumber: number;
  points: number;
  role: 'client' | 'admin';
  sessionId: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string;
  videoUrl?: string;
  spotifyUrl?: string;
  genre?: string;
  requestedBy?: string;
  tableNumber?: number;
  pointsCost: number;
  isPriority?: boolean;
}

export interface QueueItem {
  id: string;
  song: Song;
  requestedBy: string;
  tableNumber: number;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'playing' | 'completed';
  isPriority: boolean;
  pointsSpent: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  pointsReward: number;
  category: 'bebidas' | 'comidas' | 'postres' | 'especiales';
  imageUrl?: string;
  model3dUrl?: string;
  isAvailable: boolean;
  ingredients?: string[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  totalPrice: number;
  totalPoints: number;
}

export interface Order {
  id: string;
  tableNumber: number;
  items: CartItem[];
  totalAmount: number;
  totalPointsEarned: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered';
  timestamp: Date;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  type: 'earned' | 'spent';
  amount: number;
  description: string;
  timestamp: Date;
  relatedOrderId?: string;
  relatedSongId?: string;
}

export interface BarStats {
  activeTables: number;
  totalRevenue: number;
  songsInQueue: number;
  topSellingItems: MenuItem[];
  popularSongs: Song[];
  averagePointsPerTable: number;
}

export interface MusicProvider {
  type: 'youtube' | 'spotify';
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface BarConfig {
  id: string;
  name: string;
  musicProvider: MusicProvider;
  pointsPerEuro: number;
  songBaseCost: number;
  priorityMultiplier: number;
  welcomeBonus: number;
  maxSongsPerTable: number;
  autoApproveRequests: boolean;
}

export interface WebSocketMessage {
  type: 'queue_update' | 'song_approved' | 'song_rejected' | 'now_playing' | 'points_updated' | 'order_status';
  payload: unknown;
  tableNumber?: number;
  timestamp: Date;
}

// Estados de la aplicación
export interface AppState {
  user: User | null;
  currentSong: Song | null;
  queue: QueueItem[];
  menu: MenuItem[];
  cart: CartItem[];
  pointsHistory: PointsTransaction[];
  barStats: BarStats;
  isConnected: boolean;
  tableNumber: number | null;
}

// Props de componentes
export interface QRScannerProps {
  onScanSuccess: (tableNumber: number) => void;
  onScanError: (error: string) => void;
}

export interface MusicPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export interface Menu3DProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
}

export interface AdminDashboardProps {
  stats: BarStats;
  queue: QueueItem[];
  onApproveRequest: (queueId: string) => void;
  onRejectRequest: (queueId: string) => void;
  onReorderQueue: (newOrder: QueueItem[]) => void;
}