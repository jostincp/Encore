// Constantes de la aplicación Encore

// Configuración de la aplicación
export const APP_CONFIG = {
  name: 'Encore',
  version: '1.0.0',
  description: 'Sistema de gestión musical y menú digital para bares',
  author: 'Encore Team'
} as const;

// URLs y endpoints
// Normaliza NEXT_PUBLIC_API_URL para evitar que incluya "/api" y barras finales.
const normalizeBaseUrl = (urlEnv?: string): string => {
  const raw = (urlEnv || 'http://localhost:3001').trim();
  // Quitar barra final
  let u = raw.replace(/\/$/, '');
  // Quitar sufijo "/api" si viene configurado así
  u = u.replace(/\/api$/i, '');
  return u;
};

export const API_URLS = {
  websocket: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3003', // Queue Service
  queueService: process.env.NEXT_PUBLIC_QUEUE_SERVICE_URL || 'http://localhost:3003', // Queue Service
  musicBase: `${process.env.NEXT_PUBLIC_MUSIC_SERVICE_URL || 'http://localhost:3002'}/api/music`, // Music Service
  authBase: `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3001'}/api/auth`, // Auth Service
};

export const API_ENDPOINTS = {
  // Base de autenticación SIN "/api"; las rutas añaden /api/... en el código
  base: normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL),
  menu: '/api/menu',
  orders: '/api/orders',
  points: '/api/points',
  queue: '/api/queue',
  admin: '/api/admin'
} as const;

// Configuración de puntos
export const POINTS_CONFIG = {
  defaultPointsPerEuro: 100,
  defaultSongBaseCost: 50,
  defaultPriorityMultiplier: 2,
  defaultWelcomeBonus: 200,
  maxPointsPerTransaction: 10000,
  minPointsToSpend: 1
} as const;

// Configuración de música
export const MUSIC_CONFIG = {
  maxSongsPerTable: 5,
  maxQueueLength: 50,
  searchResultsLimit: 20,
  maxSongDuration: 600, // 10 minutos
  minSongDuration: 30, // 30 segundos
  supportedProviders: ['youtube', 'spotify'] as const
} as const;

// Configuración del menú
export const MENU_CONFIG = {
  categories: [
    { id: 'bebidas', name: 'Bebidas', icon: '🍺' },
    { id: 'comidas', name: 'Comidas', icon: '🍔' },
    { id: 'postres', name: 'Postres', icon: '🍰' },
    { id: 'especiales', name: 'Especiales', icon: '⭐' }
  ],
  maxItemsPerCategory: 50,
  maxCartItems: 20,
  maxItemQuantity: 10
} as const;

// Estados de cola
export const QUEUE_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  playing: 'playing',
  completed: 'completed'
} as const;

// Estados de pedidos
export const ORDER_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  preparing: 'preparing',
  ready: 'ready',
  delivered: 'delivered'
} as const;

// Tipos de transacciones de puntos
export const TRANSACTION_TYPES = {
  earned: 'earned',
  spent: 'spent'
} as const;

// Roles de usuario
export const USER_ROLES = {
  client: 'client',
  admin: 'admin'
} as const;

// Configuración de WebSocket
export const WS_CONFIG = {
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  connectionTimeout: 10000
} as const;

// Configuración de UI
export const UI_CONFIG = {
  toastDuration: 4000,
  animationDuration: 300,
  debounceDelay: 500,
  loadingTimeout: 10000,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024
} as const;

// Configuración de almacenamiento local
export const STORAGE_KEYS = {
  userSession: 'encore_user_session',
  tableNumber: 'encore_table_number',
  cartItems: 'encore_cart_items',
  preferences: 'encore_preferences',
  lastVisit: 'encore_last_visit'
} as const;

// Configuración de QR
export const QR_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  scanTimeout: 30000,
  retryAttempts: 3
} as const;

// Configuración de Three.js
export const THREE_CONFIG = {
  cameraPosition: [0, 0, 5] as const,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 0.8,
  animationSpeed: 0.01,
  maxObjects: 100
} as const;

// Colores del tema
export const THEME_COLORS = {
  primary: {
    50: '#fef7ee',
    100: '#fdedd3',
    200: '#fbd7a5',
    300: '#f8bb6d',
    400: '#f59332',
    500: '#f3760b',
    600: '#e45c06',
    700: '#bd4508',
    800: '#96370e',
    900: '#792f0f'
  },
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
} as const;

// Configuración de animaciones
export const ANIMATIONS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 }
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2 }
  }
} as const;

// Configuración de errores
export const ERROR_MESSAGES = {
  network: 'Error de conexión. Verifica tu internet.',
  unauthorized: 'No tienes permisos para realizar esta acción.',
  notFound: 'El recurso solicitado no fue encontrado.',
  serverError: 'Error interno del servidor. Intenta más tarde.',
  validation: 'Los datos ingresados no son válidos.',
  timeout: 'La operación tardó demasiado tiempo.',
  qrInvalid: 'Código QR inválido o expirado.',
  tableNotFound: 'Mesa no encontrada.',
  insufficientPoints: 'No tienes suficientes puntos.',
  songNotAvailable: 'Canción no disponible.',
  queueFull: 'La cola está llena.',
  maxSongsReached: 'Has alcanzado el máximo de canciones permitidas.'
} as const;

// Configuración de éxito
export const SUCCESS_MESSAGES = {
  songAdded: 'Canción agregada a la cola',
  orderPlaced: 'Pedido realizado con éxito',
  pointsEarned: 'Puntos ganados',
  profileUpdated: 'Perfil actualizado',
  settingsSaved: 'Configuración guardada',
  qrScanned: 'Mesa asignada correctamente',
  paymentProcessed: 'Pago procesado exitosamente'
} as const;

// Configuración de desarrollo
export const DEV_CONFIG = {
  enableLogs: process.env.NODE_ENV === 'development',
  enableMockData: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
  apiDelay: parseInt(process.env.NEXT_PUBLIC_API_DELAY || '0'),
  debugMode: process.env.NEXT_PUBLIC_DEBUG === 'true'
} as const;

// Configuración de PWA
export const PWA_CONFIG = {
  name: 'Encore',
  shortName: 'Encore',
  description: 'Sistema de gestión musical y menú digital',
  themeColor: '#f3760b',
  backgroundColor: '#ffffff',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/',
  startUrl: '/'
} as const;

// Expresiones regulares útiles
export const REGEX_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[0-9]{9,15}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s]+$/,
  url: /^https?:\/\/.+/,
  youtubeId: /^[a-zA-Z0-9_-]{11}$/,
  spotifyId: /^[a-zA-Z0-9]{22}$/
} as const;

// Configuración de límites
export const LIMITS = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxImageWidth: 1920,
  maxImageHeight: 1080,
  maxTextLength: 1000,
  maxSearchResults: 50,
  maxHistoryItems: 100
} as const;
