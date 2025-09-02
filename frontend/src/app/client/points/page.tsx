'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Star, 
  TrendingUp,
  Gift, 
  History,
  Zap,
  Music,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPoints, formatRelativeTime, formatDateTime } from '@/utils/format';
import { PointsTransaction } from '@/types';

// Mock data para transacciones
const mockTransactions: PointsTransaction[] = [
  {
    id: '1',
    userId: 'user1',
    type: 'earned',
    amount: 50,
    description: 'Compra en menú - Hamburguesa Clásica',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    relatedOrderId: 'order1'
  },
  {
    id: '2',
    userId: 'user1',
    type: 'spent',
    amount: -25,
    description: 'Canción solicitada - Bohemian Rhapsody',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    relatedSongId: 'song1'
  },
  {
    id: '3',
    userId: 'user1',
    type: 'earned',
    amount: 30,
    description: 'Compra en menú - Cerveza Artesanal',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    relatedOrderId: 'order2'
  },
  {
    id: '4',
    userId: 'user1',
    type: 'spent',
    amount: -50,
    description: 'Priority Play - Hotel California',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
    relatedSongId: 'song2'
  },
  {
    id: '5',
    userId: 'user1',
    type: 'earned',
    amount: 100,
    description: 'Bono de bienvenida',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  }
];

export default function PointsPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast } = useToast();
  const [transactions] = useState<PointsTransaction[]>(mockTransactions);
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent' | 'bonus'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/qr');
      return;
    }
  }, [user, router]);

  if (!user) return null;

  const filteredTransactions = transactions.filter(transaction => {
    if (filter !== 'all' && transaction.type !== filter) return false;
    
    if (timeFilter !== 'all') {
      const now = new Date();
      const transactionDate = new Date(transaction.timestamp);
      
      switch (timeFilter) {
        case 'today':
          return transactionDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return transactionDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return transactionDate >= monthAgo;
      }
    }
    
    return true;
  });

  const totalEarned = transactions
    .filter(t => t.type === 'earned')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalSpent = transactions
    .filter(t => t.type === 'spent')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simular carga
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    showSuccessToast('Historial actualizado');
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned': return <ShoppingCart className="h-4 w-4" />;
      case 'spent': return <Music className="h-4 w-4" />;
      case 'bonus': return <Gift className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned': return 'text-green-600 dark:text-green-400';
      case 'spent': return 'text-red-600 dark:text-red-400';
      case 'bonus': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Layout background="dark" animate>
      <PageContainer className="min-h-screen p-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500" />
                Mis Puntos
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestiona tus puntos y revisa tu historial
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </motion.div>

        {/* Points Overview */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Puntos Actuales</p>
                  <p className="text-3xl font-bold text-yellow-500">
                    {formatPoints(user?.points || 0)}
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Ganado</p>
                  <p className="text-3xl font-bold text-green-500">
                    {formatPoints(totalEarned)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Gastado</p>
                  <p className="text-3xl font-bold text-red-500">
                    {formatPoints(totalSpent)}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Points Guide */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                ¿Cómo Funcionan los Puntos?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Gana Puntos</p>
                      <p className="text-sm text-muted-foreground">Por cada compra en el menú</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Music className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Pide Canciones</p>
                      <p className="text-sm text-muted-foreground">25 puntos por canción normal</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium">Priority Play</p>
                      <p className="text-sm text-muted-foreground">50 puntos para saltar la cola</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Bonos Especiales</p>
                      <p className="text-sm text-muted-foreground">Promociones y eventos</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Historial de Transacciones
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={(value: 'all' | 'earned' | 'spent' | 'bonus') => setFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="earned">Ganadas</SelectItem>
                      <SelectItem value="spent">Gastadas</SelectItem>
                      <SelectItem value="bonus">Bonos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={timeFilter} onValueChange={(value: 'today' | 'week' | 'month' | 'all') => setTimeFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo</SelectItem>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="week">Esta Semana</SelectItem>
                      <SelectItem value="month">Este Mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay transacciones para mostrar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {filteredTransactions.map((transaction, index) => (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${getTransactionColor(transaction.type)}`}>
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getTransactionColor(transaction.type)}`}
                              >
                                {transaction.type === 'earned' ? 'Ganado' : 
                                 transaction.type === 'spent' ? 'Gastado' : 'Bono'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(transaction.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getTransactionColor(transaction.type)}`}>
                            {transaction.amount > 0 ? '+' : ''}{formatPoints(transaction.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(transaction.timestamp)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}