'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ShoppingCart, 
  CreditCard, 
  Check,
  Clock,
  MapPin,
  User,
  Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice, formatPoints } from '@/utils/format';


export default function CheckoutPage() {
  const { user, cart, clearCart, updateUserPoints, addPointsTransaction, getUserPointsBalance } = useAppStore();
  const points = getUserPointsBalance();
  const router = useRouter();
  const { success, error } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'points'>('card');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/qr');
      return;
    }
    if (cart.length === 0 && !orderComplete) {
      router.push('/client/menu');
      return;
    }
  }, [user, cart, router, orderComplete]);

  if (!user) return null;

  const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const tax = Math.round(subtotal * 0.19); // 19% IVA
  const total = subtotal + tax;
  const pointsToEarn = Math.floor(total / 1000); // 1 punto por cada $1000
  const pointsRequired = Math.floor(total / 100); // 100 pesos por punto
  const canPayWithPoints = points >= pointsRequired;

  const handleSubmitOrder = async () => {
    if (!customerInfo.name.trim()) {
      error('Por favor ingresa tu nombre');
      return;
    }

    if (paymentMethod === 'points' && !canPayWithPoints) {
      error('No tienes suficientes puntos');
      return;
    }

    setIsProcessing(true);

    try {
      // Simular procesamiento del pedido
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simular creación de orden

      // Procesar pago
      if (paymentMethod === 'points') {
        // Descontar puntos
        const newBalance = points - pointsRequired;
        updateUserPoints(newBalance);
        addPointsTransaction({
          id: Date.now().toString(),
          userId: user.id,
          amount: -pointsRequired,
          type: 'spent',
          description: 'Pago de pedido',
          timestamp: new Date()
        });
        success(`Pagado con ${formatPoints(pointsRequired)}`);
      } else {
        // Agregar puntos ganados
        const newBalance = points + pointsToEarn;
        updateUserPoints(newBalance);
        addPointsTransaction({
          id: Date.now().toString(),
          userId: user.id,
          amount: pointsToEarn,
          type: 'earned',
          description: 'Puntos por compra',
          timestamp: new Date()
        });
        success(`¡Ganaste ${formatPoints(pointsToEarn)}!`);
      }

      // Limpiar carrito
      clearCart();
      setOrderComplete(true);
      success('¡Pedido realizado con éxito!');

    } catch {
      error('Error al procesar el pedido');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderComplete) {
    return (
      <Layout background="dark" animate>
        <PageContainer className="min-h-screen p-4 flex items-center justify-center">
          <motion.div
            className="text-center max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-4">¡Pedido Confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              Tu pedido ha sido enviado a la cocina. Te notificaremos cuando esté listo.
            </p>
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>Tiempo estimado: 20-30 minutos</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span>Mesa {user.tableNumber}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/client')}
                className="w-full"
              >
                Volver al Hub
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/client/menu')}
                className="w-full"
              >
                Seguir Comprando
              </Button>
            </div>
          </motion.div>
        </PageContainer>
      </Layout>
    );
  }

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
                <ShoppingCart className="h-6 w-6 text-primary" />
                Finalizar Pedido
              </h1>
              <p className="text-sm text-muted-foreground">
                Mesa {user.tableNumber}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <motion.div
            className="lg:col-span-2 space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Cart Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Tu Pedido ({cart.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence>
                  {cart.map((item, index) => (
                    <motion.div
                      key={item.menuItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      <Image 
                        src={item.menuItem.imageUrl || '/placeholder-food.jpg'} 
                        alt={item.menuItem.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.menuItem.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.menuItem.category}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Cantidad: {item.quantity}
                          </Badge>
                          <span className="text-sm font-medium">
                            {formatPrice(item.menuItem.price)} c/u
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(item.menuItem.price * item.quantity)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notas Especiales</Label>
                  <Input
                    id="notes"
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Alergias, preferencias, etc."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={paymentMethod} onValueChange={(value: string) => setPaymentMethod(value as 'card' | 'cash' | 'points')}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="card">Tarjeta</TabsTrigger>
                    <TabsTrigger value="cash">Efectivo</TabsTrigger>
                    <TabsTrigger value="points" disabled={!canPayWithPoints}>
                      Puntos {!canPayWithPoints && '(Insuficientes)'}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="card" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Pagarás con tarjeta de crédito o débito al momento de la entrega.
                    </p>
                  </TabsContent>
                  <TabsContent value="cash" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Pagarás en efectivo al momento de la entrega.
                    </p>
                  </TabsContent>
                  <TabsContent value="points" className="mt-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Pagarás con tus puntos acumulados.
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span>Puntos requeridos:</span>
                        <span className="font-medium">{formatPoints(pointsRequired)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Tus puntos actuales:</span>
                        <span className={`font-medium ${canPayWithPoints ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPoints(points)}
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Total */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVA (19%):</span>
                    <span>{formatPrice(tax)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                {paymentMethod !== 'points' && (
                  <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Gift className="h-4 w-4" />
                      <span className="text-sm font-medium">¡Ganarás {formatPoints(pointsToEarn)}!</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Tiempo estimado: 20-30 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span>Entrega en Mesa {user.tableNumber}</span>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitOrder}
                  disabled={isProcessing || cart.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Procesando...
                    </div>
                  ) : (
                    `Confirmar Pedido - ${formatPrice(total)}`
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Al confirmar tu pedido aceptas nuestros términos y condiciones.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageContainer>
    </Layout>
  );
}