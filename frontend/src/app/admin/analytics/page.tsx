'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Music, 
  ShoppingCart, 
  ArrowLeft, 
  Download, 
  RefreshCw,
  Clock,
  Zap,
  Award,
  Eye,
  DollarSign,
  Target,
  Star,
  MapPin,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/format';
import { 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart 
} from 'recharts';

// Mock data para analytics
const mockAnalytics = {
  // Datos de ventas por día
  salesData: [
    { date: '2024-01-01', sales: 450000, orders: 23, customers: 18 },
    { date: '2024-01-02', sales: 520000, orders: 28, customers: 22 },
    { date: '2024-01-03', sales: 380000, orders: 19, customers: 15 },
    { date: '2024-01-04', sales: 680000, orders: 35, customers: 28 },
    { date: '2024-01-05', sales: 750000, orders: 42, customers: 35 },
    { date: '2024-01-06', sales: 920000, orders: 48, customers: 40 },
    { date: '2024-01-07', sales: 850000, orders: 45, customers: 38 }
  ],
  // Datos de música por hora
  musicData: [
    { hour: '12:00', requests: 5, priority: 2 },
    { hour: '13:00', requests: 8, priority: 3 },
    { hour: '14:00', requests: 12, priority: 4 },
    { hour: '15:00', requests: 15, priority: 6 },
    { hour: '16:00', requests: 18, priority: 8 },
    { hour: '17:00', requests: 25, priority: 12 },
    { hour: '18:00', requests: 32, priority: 15 },
    { hour: '19:00', requests: 45, priority: 22 },
    { hour: '20:00', requests: 52, priority: 28 },
    { hour: '21:00', requests: 48, priority: 25 },
    { hour: '22:00', requests: 38, priority: 18 },
    { hour: '23:00', requests: 25, priority: 12 }
  ],
  // Géneros más populares
  genreData: [
    { name: 'Reggaeton', value: 35, color: '#8884d8' },
    { name: 'Pop', value: 25, color: '#82ca9d' },
    { name: 'Rock', value: 20, color: '#ffc658' },
    { name: 'Salsa', value: 12, color: '#ff7300' },
    { name: 'Electrónica', value: 8, color: '#00ff88' }
  ],
  // Productos más vendidos
  topProducts: [
    { name: 'Cerveza Corona', sales: 145, revenue: 435000, category: 'Bebidas' },
    { name: 'Hamburguesa Clásica', sales: 89, revenue: 623000, category: 'Comida' },
    { name: 'Mojito', sales: 76, revenue: 456000, category: 'Cocteles' },
    { name: 'Alitas BBQ', sales: 65, revenue: 390000, category: 'Comida' },
    { name: 'Whisky Sour', sales: 54, revenue: 378000, category: 'Cocteles' }
  ],
  // Canciones más solicitadas
  topSongs: [
    { title: 'Tití Me Preguntó', artist: 'Bad Bunny', requests: 45, priority: 18 },
    { title: 'As It Was', artist: 'Harry Styles', requests: 38, priority: 12 },
    { title: 'Heat Waves', artist: 'Glass Animals', requests: 32, priority: 8 },
    { title: 'La Botella', artist: 'Chrystian & Ralf', requests: 28, priority: 15 },
    { title: 'Blinding Lights', artist: 'The Weeknd', requests: 25, priority: 6 }
  ],
  // Métricas de satisfacción
  satisfaction: {
    overall: 4.6,
    music: 4.8,
    food: 4.4,
    service: 4.5,
    ambiance: 4.7,
    reviews: 234,
    nps: 72
  },
  // Datos de ocupación por mesa
  tableOccupancy: [
    { table: 1, occupancy: 85, revenue: 125000 },
    { table: 2, occupancy: 92, revenue: 145000 },
    { table: 3, occupancy: 78, revenue: 98000 },
    { table: 4, occupancy: 88, revenue: 132000 },
    { table: 5, occupancy: 95, revenue: 156000 },
    { table: 6, occupancy: 82, revenue: 115000 },
    { table: 7, occupancy: 90, revenue: 138000 },
    { table: 8, occupancy: 87, revenue: 128000 }
  ]
};

export default function AdminAnalyticsPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const toast = useToast();
  const [analytics] = useState(mockAnalytics);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const handleExportData = () => {
    toast.success('Datos exportados exitosamente');
  };

  const handleRefreshData = () => {
    // Aquí se actualizarían los datos desde el backend
    toast.success('Datos actualizados');
  };

  const totalSales = analytics.salesData.reduce((sum, day) => sum + day.sales, 0);
  const totalOrders = analytics.salesData.reduce((sum, day) => sum + day.orders, 0);
  const totalCustomers = analytics.salesData.reduce((sum, day) => sum + day.customers, 0);
  const avgOrderValue = totalSales / totalOrders;

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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics e Inteligencia
              </h1>
              <p className="text-muted-foreground mt-1">
                Análisis detallado del rendimiento del negocio
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Hoy</SelectItem>
                <SelectItem value="7d">7 días</SelectItem>
                <SelectItem value="30d">30 días</SelectItem>
                <SelectItem value="90d">90 días</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefreshData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </motion.div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="music">Música</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="operations">Operaciones</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Ventas Totales</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatPrice(totalSales)}
                        </p>
                        <p className="text-xs text-green-600 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +12.5% vs período anterior
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Órdenes</p>
                        <p className="text-2xl font-bold text-blue-600">{totalOrders}</p>
                        <p className="text-xs text-blue-600 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +8.3% vs período anterior
                        </p>
                      </div>
                      <ShoppingCart className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Clientes</p>
                        <p className="text-2xl font-bold text-purple-600">{totalCustomers}</p>
                        <p className="text-xs text-purple-600 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +15.2% vs período anterior
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Ticket Promedio</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatPrice(avgOrderValue)}
                        </p>
                        <p className="text-xs text-orange-600 flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +3.7% vs período anterior
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analytics.salesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis tickFormatter={(value) => formatPrice(Number(value))} />
                        <Tooltip 
                          formatter={(value) => [formatPrice(Number(value)), 'Ventas']}
                          labelFormatter={(value) => new Date(String(value)).toLocaleDateString('es-ES')}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="sales" 
                          stroke="#8884d8" 
                          fill="#8884d8" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Genre Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Géneros Musicales Populares</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.genreData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.genreData.map((entry: { name: string; value: number; color: string }, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Satisfaction Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Métricas de Satisfacción
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600 mb-1">
                        {analytics.satisfaction.overall}
                      </div>
                      <div className="text-sm text-muted-foreground">General</div>
                      <div className="flex justify-center mt-1">
                        {[...Array(5)].map((_, i: number) => (
                          <Star 
                            key={i} 
                            className={`h-3 w-3 ${
                              i < Math.floor(analytics.satisfaction.overall) 
                                ? 'text-yellow-400 fill-current' 
                                : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {analytics.satisfaction.music}
                      </div>
                      <div className="text-sm text-muted-foreground">Música</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {analytics.satisfaction.food}
                      </div>
                      <div className="text-sm text-muted-foreground">Comida</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 mb-1">
                        {analytics.satisfaction.service}
                      </div>
                      <div className="text-sm text-muted-foreground">Servicio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-1">
                        {analytics.satisfaction.ambiance}
                      </div>
                      <div className="text-sm text-muted-foreground">Ambiente</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600 mb-1">
                        {analytics.satisfaction.nps}
                      </div>
                      <div className="text-sm text-muted-foreground">NPS Score</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales vs Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas vs Órdenes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={analytics.salesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis yAxisId="left" tickFormatter={(value) => formatPrice(value)} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="sales" fill="#8884d8" name="Ventas" />
                        <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#82ca9d" name="Órdenes" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Products */}
                <Card>
                  <CardHeader>
                    <CardTitle>Productos Más Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.topProducts.map((product: { name: string; sales: number; revenue: number; category: string }, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="font-bold text-primary">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatPrice(product.revenue)}</p>
                            <p className="text-sm text-muted-foreground">{product.sales} vendidos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Table Occupancy */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Ocupación por Mesa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {analytics.tableOccupancy.map((table: { table: number; occupancy: number; revenue: number }) => (
                      <div key={table.table} className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Mesa {table.table}</span>
                          <Badge variant="secondary">{table.occupancy}%</Badge>
                        </div>
                        <Progress value={table.occupancy} className="mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Ingresos: {formatPrice(table.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Music Tab */}
          <TabsContent value="music">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Music Requests by Hour */}
                <Card>
                  <CardHeader>
                    <CardTitle>Solicitudes Musicales por Hora</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.musicData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="requests" fill="#8884d8" name="Solicitudes Normales" />
                        <Bar dataKey="priority" fill="#82ca9d" name="Priority Play" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Songs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Canciones Más Solicitadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.topSongs.map((song: { title: string; artist: string; requests: number; priority: number }, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <Music className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{song.title}</p>
                              <p className="text-sm text-muted-foreground">{song.artist}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{song.requests} solicitudes</p>
                            <p className="text-sm text-muted-foreground">{song.priority} priority</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{totalCustomers}</p>
                      <p className="text-sm text-muted-foreground">Clientes Únicos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">78%</p>
                      <p className="text-sm text-muted-foreground">Tasa de Retorno</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">2.3h</p>
                      <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">12 min</p>
                      <p className="text-sm text-muted-foreground">Tiempo Prep. Promedio</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Zap className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">95%</p>
                      <p className="text-sm text-muted-foreground">Eficiencia Cocina</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Award className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">98%</p>
                      <p className="text-sm text-muted-foreground">Órdenes Completadas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Eye className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">8</p>
                      <p className="text-sm text-muted-foreground">Mesas Activas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AdminLayout>
  );
}