'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Settings, 
  Save, 
  RefreshCw, 
  Award, 
  Target, 
  Zap,
  Plus,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatNumberWithSuffix } from '@/utils/format';

// Mock data para configuración de puntos
const mockPointsConfig = {
  // Configuración de ganancia de puntos
  earning: {
    purchaseMultiplier: 1, // 1 punto por cada $1000 COP gastados
    songRequestPoints: 50, // Puntos por pedir una canción
    dailyLoginBonus: 10, // Puntos por login diario
    referralBonus: 100, // Puntos por referir un amigo
    reviewBonus: 25, // Puntos por dejar una reseña
    socialShareBonus: 15, // Puntos por compartir en redes
    birthdayBonus: 500, // Puntos en cumpleaños
    loyaltyTierMultiplier: {
      bronze: 1,
      silver: 1.2,
      gold: 1.5,
      platinum: 2
    }
  },
  // Configuración de uso de puntos
  spending: {
    songRequestCost: 100, // Puntos para pedir una canción
    priorityPlayCost: 200, // Puntos para Priority Play
    discountRates: {
      10: 1000, // 10% descuento por 1000 puntos
      15: 1500, // 15% descuento por 1500 puntos
      20: 2000, // 20% descuento por 2000 puntos
      25: 3000  // 25% descuento por 3000 puntos
    },
    freeItemThresholds: {
      'bebida-gratis': 2500,
      'postre-gratis': 3500,
      'entrada-gratis': 5000
    }
  },
  // Configuración de niveles de lealtad
  loyaltyTiers: {
    bronze: { minPoints: 0, benefits: ['Puntos básicos'] },
    silver: { minPoints: 1000, benefits: ['20% más puntos', 'Descuentos especiales'] },
    gold: { minPoints: 5000, benefits: ['50% más puntos', 'Priority Play gratis mensual'] },
    platinum: { minPoints: 15000, benefits: ['100% más puntos', 'Mesa VIP', 'Bebida gratis mensual'] }
  }
};

// Mock data para estadísticas
const mockStats = {
  totalPointsIssued: 125000,
  totalPointsRedeemed: 87500,
  activeUsers: 342,
  averagePointsPerUser: 365,
  topSpenders: [
    { name: 'Juan Pérez', points: 2500, spent: 1800 },
    { name: 'María García', points: 2200, spent: 1650 },
    { name: 'Carlos López', points: 1950, spent: 1400 },
    { name: 'Ana Rodríguez', points: 1800, spent: 1200 },
    { name: 'Luis Martín', points: 1650, spent: 1100 }
  ],
  recentTransactions: [
    { id: '1', user: 'Juan Pérez', type: 'earned', amount: 50, reason: 'Compra en menú', date: new Date() },
    { id: '2', user: 'María García', type: 'spent', amount: 100, reason: 'Canción solicitada', date: new Date(Date.now() - 5 * 60000) },
    { id: '3', user: 'Carlos López', type: 'earned', amount: 25, reason: 'Reseña dejada', date: new Date(Date.now() - 10 * 60000) },
    { id: '4', user: 'Ana Rodríguez', type: 'spent', amount: 200, reason: 'Priority Play', date: new Date(Date.now() - 15 * 60000) },
    { id: '5', user: 'Luis Martín', type: 'earned', amount: 75, reason: 'Compra en menú', date: new Date(Date.now() - 20 * 60000) }
  ]
};

export default function AdminPointsPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const { success } = useToast();
  const [config, setConfig] = useState(mockPointsConfig);
  const [stats] = useState(mockStats);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const handleSaveConfig = () => {
    // Aquí se guardaría la configuración en el backend
    setIsEditing(false);
    success('Configuración de puntos actualizada');
  };

  const handleResetConfig = () => {
    setConfig(mockPointsConfig);
    success('Configuración restablecida');
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'silver': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'gold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'platinum': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
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
                <Coins className="h-8 w-8 text-primary" />
                Estrategia de Puntos
              </h1>
              <p className="text-muted-foreground mt-1">
                Configura y monitorea el sistema de puntos de fidelidad
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetConfig}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restablecer
            </Button>
            <Button
              variant={isEditing ? "default" : "outline"}
              onClick={() => setIsEditing(!isEditing)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {isEditing ? 'Modo Vista' : 'Modo Edición'}
            </Button>
          </div>
        </motion.div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="earning">Ganar Puntos</TabsTrigger>
            <TabsTrigger value="spending">Usar Puntos</TabsTrigger>
            <TabsTrigger value="loyalty">Niveles</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Puntos Emitidos</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatNumberWithSuffix(stats.totalPointsIssued)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Puntos Canjeados</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatNumberWithSuffix(stats.totalPointsRedeemed)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Usuarios Activos</p>
                        <p className="text-2xl font-bold text-purple-600">{stats.activeUsers}</p>
                      </div>
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Promedio por Usuario</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {stats.averagePointsPerUser}
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Spenders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Top Usuarios por Puntos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.topSpenders.map((user, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="font-bold text-primary">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.spent} puntos gastados
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {user.points} pts
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Transacciones Recientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.type === 'earned' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {transaction.type === 'earned' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium">{transaction.user}</p>
                              <p className="text-sm text-muted-foreground">{transaction.reason}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              transaction.type === 'earned' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'earned' ? '+' : '-'}{transaction.amount} pts
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.date.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* Earning Points Tab */}
          <TabsContent value="earning">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Configuración de Ganancia de Puntos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Purchase Multiplier */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="purchaseMultiplier">Puntos por Compra</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="purchaseMultiplier"
                          type="number"
                          value={config.earning.purchaseMultiplier}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            earning: { ...prev.earning, purchaseMultiplier: Number(e.target.value) }
                          }))}
                          disabled={!isEditing}
                        />
                        <span className="text-sm text-muted-foreground">punto(s) por cada $1000 COP</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="songRequestPoints">Puntos por Canción</Label>
                      <Input
                        id="songRequestPoints"
                        type="number"
                        value={config.earning.songRequestPoints}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          earning: { ...prev.earning, songRequestPoints: Number(e.target.value) }
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {/* Bonus Points */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="dailyLoginBonus">Login Diario</Label>
                      <Input
                        id="dailyLoginBonus"
                        type="number"
                        value={config.earning.dailyLoginBonus}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          earning: { ...prev.earning, dailyLoginBonus: Number(e.target.value) }
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="referralBonus">Referir Amigo</Label>
                      <Input
                        id="referralBonus"
                        type="number"
                        value={config.earning.referralBonus}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          earning: { ...prev.earning, referralBonus: Number(e.target.value) }
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reviewBonus">Dejar Reseña</Label>
                      <Input
                        id="reviewBonus"
                        type="number"
                        value={config.earning.reviewBonus}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          earning: { ...prev.earning, reviewBonus: Number(e.target.value) }
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {/* Loyalty Tier Multipliers */}
                  <div>
                    <h4 className="font-medium mb-3">Multiplicadores por Nivel</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(config.earning.loyaltyTierMultiplier).map(([tier, multiplier]) => (
                        <div key={tier}>
                          <Label htmlFor={`${tier}Multiplier`} className="capitalize">
                            {tier}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`${tier}Multiplier`}
                              type="number"
                              step="0.1"
                              value={multiplier}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                earning: {
                                  ...prev.earning,
                                  loyaltyTierMultiplier: {
                                    ...prev.earning.loyaltyTierMultiplier,
                                    [tier]: Number(e.target.value)
                                  }
                                }
                              }))}
                              disabled={!isEditing}
                            />
                            <span className="text-sm text-muted-foreground">x</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end">
                      <Button onClick={handleSaveConfig}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Spending Points Tab */}
          <TabsContent value="spending">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Minus className="h-5 w-5" />
                    Configuración de Uso de Puntos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Music Costs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="songRequestCost">Costo Canción Normal</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="songRequestCost"
                          type="number"
                          value={config.spending.songRequestCost}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            spending: { ...prev.spending, songRequestCost: Number(e.target.value) }
                          }))}
                          disabled={!isEditing}
                        />
                        <span className="text-sm text-muted-foreground">puntos</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="priorityPlayCost">Costo Priority Play</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="priorityPlayCost"
                          type="number"
                          value={config.spending.priorityPlayCost}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            spending: { ...prev.spending, priorityPlayCost: Number(e.target.value) }
                          }))}
                          disabled={!isEditing}
                        />
                        <span className="text-sm text-muted-foreground">puntos</span>
                      </div>
                    </div>
                  </div>

                  {/* Discount Rates */}
                  <div>
                    <h4 className="font-medium mb-3">Descuentos por Puntos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(config.spending.discountRates).map(([discount, points]) => (
                        <div key={discount} className="space-y-2">
                          <Label>{discount}% de descuento</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={points}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                spending: {
                                  ...prev.spending,
                                  discountRates: {
                                    ...prev.spending.discountRates,
                                    [discount]: Number(e.target.value)
                                  }
                                }
                              }))}
                              disabled={!isEditing}
                            />
                            <span className="text-sm text-muted-foreground">pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Free Items */}
                  <div>
                    <h4 className="font-medium mb-3">Items Gratuitos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(config.spending.freeItemThresholds).map(([item, points]) => (
                        <div key={item} className="space-y-2">
                          <Label className="capitalize">{item.replace('-', ' ')}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={points}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                spending: {
                                  ...prev.spending,
                                  freeItemThresholds: {
                                    ...prev.spending.freeItemThresholds,
                                    [item]: Number(e.target.value)
                                  }
                                }
                              }))}
                              disabled={!isEditing}
                            />
                            <span className="text-sm text-muted-foreground">pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end">
                      <Button onClick={handleSaveConfig}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Loyalty Tiers Tab */}
          <TabsContent value="loyalty">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(config.loyaltyTiers).map(([tier, data]) => (
                  <Card key={tier} className="relative overflow-hidden">
                    <div className={`absolute top-0 left-0 right-0 h-1 ${getTierColor(tier).replace('text-', 'bg-').replace('dark:text-', 'dark:bg-')}`} />
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <span className="capitalize">{tier}</span>
                        <Badge className={getTierColor(tier)}>
                          <Award className="h-3 w-3 mr-1" />
                          {tier.toUpperCase()}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor={`${tier}MinPoints`}>Puntos Mínimos</Label>
                        <Input
                          id={`${tier}MinPoints`}
                          type="number"
                          value={data.minPoints}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            loyaltyTiers: {
                              ...prev.loyaltyTiers,
                              [tier]: {
                                ...prev.loyaltyTiers[tier as keyof typeof prev.loyaltyTiers],
                                minPoints: Number(e.target.value)
                              }
                            }
                          }))}
                          disabled={!isEditing}
                        />
                      </div>
                      
                      <div>
                        <Label>Beneficios</Label>
                        <div className="space-y-2 mt-2">
                          {data.benefits.map((benefit, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-primary rounded-full" />
                              <span className="text-sm">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {isEditing && (
                <div className="flex justify-end">
                  <Button onClick={handleSaveConfig}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Configuración
                  </Button>
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AdminLayout>
  );
}