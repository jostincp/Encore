'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ShoppingCart, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Filter, 
  Search, 
  User, 
  Phone, 
  Mail, 
  MessageSquare,
  Utensils,
  Timer,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice, formatTime, formatRelativeTime } from '@/utils/format';
import { Order as BaseOrder } from '@/types';

// Tipo extendido para el admin con propiedades adicionales
interface AdminOrder extends BaseOrder {
  userId: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'card' | 'cash' | 'points';
  customerInfo: {
    name: string;
    phone: string;
    email: string;
    notes: string;
  };
  createdAt: Date;
  estimatedTime: number;
}

// Mock data para pedidos
const mockOrders: AdminOrder[] = [
  {
    id: 'order-1',
    userId: 'user-1',
    tableNumber: 5,
    items: [
      { 
        menuItem: { id: '1', name: 'Hamburguesa Clásica', description: 'Deliciosa hamburguesa', price: 15000, pointsReward: 150, category: 'comidas', isAvailable: true },
        quantity: 2, 
        totalPrice: 30000, 
        totalPoints: 300 
      },
      { 
        menuItem: { id: '2', name: 'Papas Fritas', description: 'Papas crujientes', price: 8000, pointsReward: 80, category: 'comidas', isAvailable: true },
        quantity: 1, 
        totalPrice: 8000, 
        totalPoints: 80 
      }
    ],
    subtotal: 38000,
    tax: 7220,
    total: 45220,
    totalAmount: 45220,
    totalPointsEarned: 380,
    status: 'preparing',
    paymentMethod: 'card',
    customerInfo: { 
      name: 'Juan Pérez', 
      phone: '+57 300 123 4567', 
      email: 'juan@email.com', 
      notes: 'Sin cebolla en la hamburguesa' 
    },
    createdAt: new Date(Date.now() - 8 * 60000),
    timestamp: new Date(Date.now() - 8 * 60000),
    estimatedTime: 15
  },
  {
    id: 'order-2',
    userId: 'user-2',
    tableNumber: 12,
    items: [
      { 
        menuItem: { id: '3', name: 'Pizza Margherita', description: 'Pizza clásica', price: 18000, pointsReward: 180, category: 'comidas', isAvailable: true },
        quantity: 1, 
        totalPrice: 18000, 
        totalPoints: 180 
      },
      { 
        menuItem: { id: '4', name: 'Coca Cola', description: 'Bebida refrescante', price: 5000, pointsReward: 50, category: 'bebidas', isAvailable: true },
        quantity: 2, 
        totalPrice: 10000, 
        totalPoints: 100 
      }
    ],
    subtotal: 28000,
    tax: 5320,
    total: 33320,
    totalAmount: 33320,
    totalPointsEarned: 280,
    status: 'ready',
    paymentMethod: 'cash',
    customerInfo: { 
      name: 'María García', 
      phone: '+57 301 987 6543', 
      email: '', 
      notes: '' 
    },
    createdAt: new Date(Date.now() - 25 * 60000),
    timestamp: new Date(Date.now() - 25 * 60000),
    estimatedTime: 0
  },
  {
    id: 'order-3',
    userId: 'user-3',
    tableNumber: 8,
    items: [
      { 
        menuItem: { id: '5', name: 'Alitas BBQ', description: 'Alitas con salsa BBQ', price: 12000, pointsReward: 120, category: 'comidas', isAvailable: true },
        quantity: 3, 
        totalPrice: 36000, 
        totalPoints: 360 
      }
    ],
    subtotal: 36000,
    tax: 6840,
    total: 42840,
    totalAmount: 42840,
    totalPointsEarned: 360,
    status: 'pending',
    paymentMethod: 'points',
    customerInfo: { 
      name: 'Carlos López', 
      phone: '', 
      email: 'carlos@email.com', 
      notes: 'Extra salsa BBQ' 
    },
    createdAt: new Date(Date.now() - 2 * 60000),
    timestamp: new Date(Date.now() - 2 * 60000),
    estimatedTime: 20
  },
  {
    id: 'order-4',
    userId: 'user-4',
    tableNumber: 15,
    items: [
      { 
        menuItem: { id: '6', name: 'Salmón a la Plancha', description: 'Salmón fresco', price: 22000, pointsReward: 220, category: 'especiales', isAvailable: true },
        quantity: 1, 
        totalPrice: 22000, 
        totalPoints: 220 
      },
      { 
        menuItem: { id: '7', name: 'Ensalada César', description: 'Ensalada fresca', price: 6000, pointsReward: 60, category: 'comidas', isAvailable: true },
        quantity: 1, 
        totalPrice: 6000, 
        totalPoints: 60 
      }
    ],
    subtotal: 28000,
    tax: 5320,
    total: 33320,
    totalAmount: 33320,
    totalPointsEarned: 280,
    status: 'delivered',
    paymentMethod: 'card',
    customerInfo: { 
      name: 'Ana Rodríguez', 
      phone: '+57 302 456 7890', 
      email: 'ana@email.com', 
      notes: 'Término medio el salmón' 
    },
    createdAt: new Date(Date.now() - 45 * 60000),
    timestamp: new Date(Date.now() - 45 * 60000),
    estimatedTime: 0
  }
];

export default function AdminOrdersPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast } = useToast();
  const [orders, setOrders] = useState(mockOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setSelectedOrder] = useState<AdminOrder | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tableNumber.toString().includes(searchTerm) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ordersByStatus = {
    pending: filteredOrders.filter(o => o.status === 'pending'),
    preparing: filteredOrders.filter(o => o.status === 'preparing'),
    ready: filteredOrders.filter(o => o.status === 'ready'),
    delivered: filteredOrders.filter(o => o.status === 'delivered')
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: AdminOrder['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, estimatedTime: newStatus === 'ready' ? 0 : order.estimatedTime }
        : order
    ));
    
    const statusMessages = {
      pending: 'Pedido marcado como pendiente',
      confirmed: 'Pedido confirmado',
      preparing: 'Pedido en preparación',
      ready: 'Pedido listo para entregar',
      delivered: 'Pedido entregado'
    };
    
    showSuccessToast(statusMessages[newStatus]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'confirmed': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'preparing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'ready': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'delivered': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertTriangle className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'preparing': return <Utensils className="h-4 w-4" />;
      case 'ready': return <Bell className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'card': return 'Tarjeta';
      case 'cash': return 'Efectivo';
      case 'points': return 'Puntos';
      default: return method;
    }
  };

  const OrderCard = ({ order }: { order: AdminOrder }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="font-bold text-primary">{order.tableNumber}</span>
          </div>
          <div>
            <h4 className="font-medium">{order.customerInfo.name}</h4>
            <p className="text-sm text-muted-foreground">#{order.id.slice(-6)}</p>
          </div>
        </div>
        <Badge className={getStatusColor(order.status)}>
          {getStatusIcon(order.status)}
          {order.status === 'pending' && 'Pendiente'}
          {order.status === 'confirmed' && 'Confirmado'}
          {order.status === 'preparing' && 'Preparando'}
          {order.status === 'ready' && 'Listo'}
          {order.status === 'delivered' && 'Entregado'}
        </Badge>
      </div>

      <div className="space-y-2 mb-3">
        {order.items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span>{item.quantity}x {item.menuItem.name}</span>
            <span>{formatPrice(item.totalPrice)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
        <span>{formatRelativeTime(order.createdAt)}</span>
        <span className="font-medium text-foreground">{formatPrice(order.total)}</span>
      </div>

      {order.estimatedTime > 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-600 mb-3">
          <Timer className="h-4 w-4" />
          <span>Tiempo estimado: {order.estimatedTime} min</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {order.status === 'pending' && (
          <Button
            size="sm"
            onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
            className="flex-1"
          >
            Iniciar Preparación
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            size="sm"
            onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
            className="flex-1"
          >
            Marcar como Listo
          </Button>
        )}
        {order.status === 'ready' && (
          <Button
            size="sm"
            onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
            className="flex-1"
          >
            Marcar como Entregado
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrder(order)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles del Pedido #{order.id.slice(-6)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Información del Cliente
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {order.customerInfo.name}</p>
                    <p><strong>Mesa:</strong> {order.tableNumber}</p>
                    {order.customerInfo.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {order.customerInfo.phone}
                      </p>
                    )}
                    {order.customerInfo.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {order.customerInfo.email}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Detalles del Pedido
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Fecha:</strong> {formatTime(order.createdAt)}</p>
                    <p><strong>Pago:</strong> {getPaymentMethodLabel(order.paymentMethod)}</p>
                    <p><strong>Estado:</strong> 
                      <Badge className={`ml-2 ${getStatusColor(order.status)}`}>
                        {order.status === 'pending' && 'Pendiente'}
                        {order.status === 'confirmed' && 'Confirmado'}
                        {order.status === 'preparing' && 'Preparando'}
                        {order.status === 'ready' && 'Listo'}
                        {order.status === 'delivered' && 'Entregado'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-medium mb-3">Items del Pedido</h4>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.menuItem.name}</p>
                        <p className="text-sm text-muted-foreground">Cantidad: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatPrice(item.totalPrice)}</p>
                        <p className="text-sm text-muted-foreground">{formatPrice(item.menuItem.price)} c/u</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {order.customerInfo.notes && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Notas Especiales
                  </h4>
                  <p className="text-sm bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg">
                    {order.customerInfo.notes}
                  </p>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVA (19%):</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {order.status === 'pending' && (
                  <Button
                    onClick={() => {
                      handleUpdateOrderStatus(order.id, 'preparing');
                      setSelectedOrder(null);
                    }}
                    className="flex-1"
                  >
                    Iniciar Preparación
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    onClick={() => {
                      handleUpdateOrderStatus(order.id, 'ready');
                      setSelectedOrder(null);
                    }}
                    className="flex-1"
                  >
                    Marcar como Listo
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button
                    onClick={() => {
                      handleUpdateOrderStatus(order.id, 'delivered');
                      setSelectedOrder(null);
                    }}
                    className="flex-1"
                  >
                    Marcar como Entregado
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );

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
                <ShoppingCart className="h-8 w-8 text-primary" />
                Gestión de Pedidos
              </h1>
              <p className="text-muted-foreground mt-1">
                Administra todos los pedidos del restaurante
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{ordersByStatus.pending.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Preparando</p>
                  <p className="text-2xl font-bold text-blue-600">{ordersByStatus.preparing.length}</p>
                </div>
                <Utensils className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Listos</p>
                  <p className="text-2xl font-bold text-green-600">{ordersByStatus.ready.length}</p>
                </div>
                <Bell className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregados</p>
                  <p className="text-2xl font-bold text-gray-600">{ordersByStatus.delivered.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, mesa o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="preparing">Preparando</SelectItem>
              <SelectItem value="ready">Listos</SelectItem>
              <SelectItem value="delivered">Entregados</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Tabs defaultValue="kanban" className="space-y-6">
            <TabsList>
              <TabsTrigger value="kanban">Vista Kanban</TabsTrigger>
              <TabsTrigger value="list">Vista Lista</TabsTrigger>
            </TabsList>
            
            <TabsContent value="kanban">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pending */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Pendientes ({ordersByStatus.pending.length})
                  </h3>
                  <div className="space-y-4">
                    <AnimatePresence>
                      {ordersByStatus.pending.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Preparing */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-blue-600" />
                    Preparando ({ordersByStatus.preparing.length})
                  </h3>
                  <div className="space-y-4">
                    <AnimatePresence>
                      {ordersByStatus.preparing.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Ready */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-green-600" />
                    Listos ({ordersByStatus.ready.length})
                  </h3>
                  <div className="space-y-4">
                    <AnimatePresence>
                      {ordersByStatus.ready.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Delivered */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-gray-600" />
                    Entregados ({ordersByStatus.delivered.length})
                  </h3>
                  <div className="space-y-4">
                    <AnimatePresence>
                      {ordersByStatus.delivered.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="list">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <AnimatePresence>
                      {filteredOrders.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </AnimatePresence>
                    
                    {filteredOrders.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No hay pedidos</p>
                        <p className="text-sm">Los pedidos aparecerán aquí cuando los clientes los realicen</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </PageContainer>
    </AdminLayout>
  );
}