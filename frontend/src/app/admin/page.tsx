'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Music, 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  Star, 
  DollarSign,
  Headphones,
  Coffee,
  Eye,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice, formatTime, formatDuration } from '@/utils/format';
import { API_ENDPOINTS } from '@/utils/constants';
import { BarStats, Order } from '@/types';

// Mock data para el dashboard
const mockStats: BarStats = {
  activeTables: 14,
  totalRevenue: 2450000,
  songsInQueue: 5,
  topSellingItems: [],
  popularSongs: [],
  averagePointsPerTable: 150
};

// Stats adicionales para el dashboard
const additionalStats = {
  totalTables: 20,
  totalOrders: 87,
  averageOrderValue: 28160,
  totalSongsPlayed: 156,
  averageWaitTime: 12,
  peakHours: ['19:00', '20:00', '21:00'],
  topGenres: ['Rock', 'Pop', 'Reggaeton'],
  customerSatisfaction: 4.7
};

const mockActiveOrders: Order[] = [
  {
    id: 'order-1',
    tableNumber: 5,
    items: [{
      menuItem: {
        id: '1',
        name: 'Hamburguesa Clásica',
        description: 'Deliciosa hamburguesa con carne de res',
        price: 15000,
        pointsReward: 15,
        category: 'comidas',
        isAvailable: true
      },
      quantity: 2,
      totalPrice: 30000,
      totalPoints: 30
    }],
    totalAmount: 35700,
    totalPointsEarned: 30,
    status: 'preparing',
    timestamp: new Date(Date.now() - 8 * 60000)
  },
  {
    id: 'order-2',
    tableNumber: 12,
    items: [{
      menuItem: {
        id: '2',
        name: 'Pizza Margherita',
        description: 'Pizza clásica con tomate y mozzarella',
        price: 12000,
        pointsReward: 12,
        category: 'comidas',
        isAvailable: true
      },
      quantity: 1,
      totalPrice: 12000,
      totalPoints: 12
    }],
    totalAmount: 14280,
    totalPointsEarned: 12,
    status: 'ready',
    timestamp: new Date(Date.now() - 25 * 60000)
  }
];

const mockCurrentQueue = [
  {
    id: 'queue-1',
    song: {
      id: 'song-1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      duration: 355,
      genre: 'Rock',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Queen%20Bohemian%20Rhapsody%20album%20cover%20classic%20rock%20vintage%20style&image_size=square',
      pointsCost: 50
    },
    requestedBy: 'user-1',
    tableNumber: 5,
    timestamp: new Date(Date.now() - 5 * 60000),
    status: 'approved',
    isPriority: false,
    pointsSpent: 50
  },
  {
    id: 'queue-2',
    song: {
      id: 'song-2',
      title: 'Despacito',
      artist: 'Luis Fonsi ft. Daddy Yankee',
      duration: 229,
      genre: 'Reggaeton',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Despacito%20Luis%20Fonsi%20reggaeton%20tropical%20music%20cover&image_size=square',
      pointsCost: 50
    },
    requestedBy: 'user-2',
    tableNumber: 12,
    timestamp: new Date(Date.now() - 1 * 60000),
    status: 'approved',
    isPriority: true,
    pointsSpent: 100
  }
];

export default function AdminPage() {
  const { user, currentSong, queue, barStats, isConnected } = useAppStore();
  const { success: showSuccess, error: showError } = useToast();
  const router = useRouter();
  const [stats] = useState(mockStats);
  const [activeOrders] = useState(mockActiveOrders);
  const [currentQueue] = useState(mockCurrentQueue);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realBar, setRealBar] = useState<any | null>(null);
  const [realUser, setRealUser] = useState<any | null>(null);
  const [realError, setRealError] = useState<string | null>(null);
  const [realMetrics, setRealMetrics] = useState<any | null>(null);
  const barConnected = !!(realBar && (realBar.id || realBar._id));

  useEffect(() => {
    // Verificar si es admin - temporalmente deshabilitado para desarrollo
    // TODO: Implementar autenticación de admin
    /*
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    */

    // Simular usuario admin para desarrollo
    if (!user) {
      const mockAdminUser = {
        id: 'admin-1',
        name: 'Administrador',
        email: 'admin@encore.com',
        role: 'admin' as const,
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      // TODO: Remover esta simulación cuando se implemente autenticación real
      // setUser(mockAdminUser);
    }
  }, [user, router]);

  // Temporalmente permitir acceso sin verificación de admin
  // TODO: Revertir cuando se implemente autenticación
  // if (!user || user.role !== 'admin') return null;

  // Cargar datos reales del bar y del usuario usando el token guardado
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('encore_access_token') : null;
    if (!token) {
      setRealError('Token no encontrado. Registra tu cuenta o inicia sesión.');
      return;
    }

    const fetchRealData = async () => {
      try {
        setRealError(null);
        const headers = {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        } as const;

        const [barRes, userRes, metricsRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.base}/api/bars/my`, { headers }),
          fetch(`${API_ENDPOINTS.base}/api/auth/profile`, { headers }),
          fetch(`${API_ENDPOINTS.base}/api/v1/analytics/dashboard/overview`, { headers })
        ]);

        const barJson = await barRes.json().catch(() => ({}));
        const userJson = await userRes.json().catch(() => ({}));
        const metricsJson = await metricsRes.json().catch(() => ({}));

        if (!barRes.ok) {
          // Si no hay bar asociado (404), no mostrar error - es normal para nuevos usuarios
          if (barRes.status === 404) {
            setRealBar(null); // Usuario no tiene bar asociado aún
          } else {
            const msg = barJson?.message || barJson?.error || barJson?.data?.message || `Error al cargar el bar (${barRes.status})`;
            setRealError(msg);
          }
        } else {
          // La respuesta es { success, message, data: { bars: [...] } }
          const barsArr = barJson?.data?.bars || barJson?.bars;
          const bar = Array.isArray(barsArr) && barsArr.length > 0 ? barsArr[0] : null;
          setRealBar(bar);
        }

        if (!userRes.ok) {
          const msg = userJson?.message || userJson?.error || userJson?.data?.message || `Error al cargar el perfil (${userRes.status})`;
          // no sobreescribir error del bar si ya existe
          setRealError(prev => prev ?? msg);
        } else {
          const u = userJson?.data || userJson;
          setRealUser(u);
        }

        if (metricsRes.ok) {
          const m = metricsJson?.data || metricsJson;
          const normalized = {
            occupiedTables: m?.occupiedTables ?? m?.tablesOccupied ?? null,
            totalTables: m?.totalTables ?? null,
            totalRevenue: m?.totalRevenue ?? m?.salesTotal ?? null,
            totalSongsPlayed: m?.totalSongsPlayed ?? m?.songsPlayed ?? null,
            totalOrders: m?.totalOrders ?? m?.ordersTotal ?? null,
            averageOrderValue: m?.averageOrderValue ?? null
          };
          setRealMetrics(normalized);
        }
      } catch (err: any) {
        setRealError(err?.message || 'Error de red al cargar datos reales');
      }
    };

    fetchRealData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simular actualización de datos
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'preparing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'ready': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'delivered': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      case 'preparing': return <Clock className="h-4 w-4" />;
      case 'ready': return <CheckCircle className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <AdminLayout>
      <PageContainer className="p-6">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Dashboard Encore
            </h1>
            <p className="text-muted-foreground mt-1">
              Vista general del local - {formatTime(new Date())}
            </p>
            {/* Panel de datos reales del bar */}
            <div className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {!realBar && !realUser && !realError && (
                    <p className="text-sm text-muted-foreground">Cargando datos reales...</p>
                  )}
                  {realError && (
                    <p className="text-sm text-red-600">{realError}</p>
                  )}
                  {(realBar || realUser) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {realBar && (
                        <div>
                          <p className="font-medium">Bar</p>
                          <p className="text-muted-foreground">Nombre: {realBar.name || realBar.nombre || '—'}</p>
                          <p className="text-muted-foreground">ID: {realBar.id || '—'}</p>
                          {realBar.city && <p className="text-muted-foreground">Ciudad: {realBar.city}</p>}
                        </div>
                      )}
                      {realUser && (
                        <div>
                          <p className="font-medium">Administrador</p>
                          <p className="text-muted-foreground">Email: {realUser.email || '—'}</p>
                          <p className="text-muted-foreground">Usuario ID: {realUser.id || '—'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/qr')}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Generar QR
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mesas Ocupadas</p>
                  <p className="text-2xl font-bold">
                    {barConnected && realMetrics?.occupiedTables != null && realMetrics?.totalTables != null
                      ? `${realMetrics.occupiedTables}/${realMetrics.totalTables}`
                      : 'Sin datos'}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              {barConnected && realMetrics?.occupiedTables != null && realMetrics?.totalTables != null ? (
                <Progress 
                  value={(realMetrics.occupiedTables / realMetrics.totalTables) * 100} 
                  className="mt-3" 
                />
              ) : (
                <p className="text-xs text-muted-foreground mt-3">Conecta tu bar para ver métricas reales</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ventas Hoy</p>
                  <p className="text-2xl font-bold">{barConnected && realMetrics?.totalRevenue != null ? formatPrice(realMetrics.totalRevenue) : 'Sin datos'}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {barConnected && realMetrics?.totalRevenue != null ? '+12% vs ayer' : 'Conecta tu bar para ver métricas reales'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Canciones</p>
                  <p className="text-2xl font-bold">{barConnected && realMetrics?.totalSongsPlayed != null ? realMetrics.totalSongsPlayed : 'Sin datos'}</p>
                </div>
                <Music className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {barConnected && realMetrics?.totalSongsPlayed != null && realMetrics?.totalSongsPlayed > 0 ? `Promedio: ${Math.round(realMetrics.totalSongsPlayed / 8)} por hora` : 'Conecta tu bar para ver métricas reales'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
                  <p className="text-2xl font-bold">{barConnected && realMetrics?.totalOrders != null ? realMetrics.totalOrders : 'Sin datos'}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-orange-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {barConnected && realMetrics?.averageOrderValue != null ? `Promedio: ${formatPrice(realMetrics.averageOrderValue)}` : 'Conecta tu bar para ver métricas reales'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Queue */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Cola Musical Actual
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/admin/queue')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todo
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentQueue.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        item.status === 'playing' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : ''
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <Image 
                          src={item.song.thumbnailUrl} 
                          alt={item.song.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{item.song.title}</h4>
                          {item.isPriority && (
                            <Badge variant="destructive" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Priority
                            </Badge>
                          )}
                          {item.status === 'playing' && (
                            <Badge className="text-xs bg-green-600">
                              <Music className="h-3 w-3 mr-1" />
                              Reproduciendo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.song.artist} • Mesa {item.tableNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(item.song.duration)} • {item.song.genre}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">#{index + 1}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(item.timestamp)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {currentQueue.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay canciones en cola</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Orders */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    Pedidos Activos
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/admin/orders')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todo
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Mesa {order.tableNumber}</span>
                          <Badge className={getOrderStatusColor(order.status)}>
                            {getOrderStatusIcon(order.status)}
                            {order.status === 'pending' && 'Pendiente'}
                            {order.status === 'preparing' && 'Preparando'}
                            {order.status === 'ready' && 'Listo'}
                            {order.status === 'delivered' && 'Entregado'}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Pedido #{order.id}
                      </p>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {item.quantity}x {item.menuItem.name}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{formatTime(order.timestamp)}</span>
                        {order.status === 'preparing' && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            15 min
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {activeOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay pedidos activos</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Estadísticas Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{realMetrics ? 'Sin datos' : 'Sin datos'}</p>
                  <p className="text-sm text-muted-foreground">Satisfacción del Cliente</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{realMetrics ? 'Sin datos' : 'Sin datos'}</p>
                  <p className="text-sm text-muted-foreground">Tiempo Promedio de Espera</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{realMetrics ? 'Sin datos' : 'Sin datos'}</p>
                  <p className="text-sm text-muted-foreground">Géneros Más Populares</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </AdminLayout>
  );
}