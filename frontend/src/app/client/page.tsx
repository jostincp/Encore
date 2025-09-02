'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Menu, Clock, Star, User, LogOut, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPoints } from '@/utils/format';

export default function ClientHub() {
  const {
    user,
    tableNumber,
    isConnected,
    queue,
    cart,
    disconnectWebSocket,
    setUser
  } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Verificar si el usuario está autenticado
    if (!user || !tableNumber) {
      router.push('/qr');
      return;
    }

    // Actualizar hora cada minuto
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, [user, tableNumber, router]);

  const handleLogout = () => {
    disconnectWebSocket();
    setUser(null);
    showSuccessToast('Sesión cerrada correctamente');
    router.push('/');
  };

  const navigateToSection = (section: string) => {
    router.push(`/client/${section}`);
  };

  if (!user || !tableNumber) {
    return null; // Evitar flash mientras redirige
  }

  const sections = [
    {
      id: 'music',
      title: 'Rockola Digital',
      description: 'Explora y solicita tu música favorita',
      icon: Music,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-pink-500',
      stats: `${queue.length} en cola`,
      action: 'Explorar Música'
    },
    {
      id: 'menu',
      title: 'Menú 3D',
      description: 'Descubre nuestro menú interactivo',
      icon: Menu,
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-red-500',
      stats: `${cart.length} en carrito`,
      action: 'Ver Menú'
    },
    {
      id: 'queue',
      title: 'Cola Musical',
      description: 'Sigue el estado de tus canciones',
      icon: Clock,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-cyan-500',
      stats: queue.find(item => item.requestedBy === user.id) ? 'Tu canción en cola' : 'Sin canciones',
      action: 'Ver Cola'
    },
    {
      id: 'points',
      title: 'Mis Puntos',
      description: 'Gestiona tus puntos y recompensas',
      icon: Star,
      color: 'bg-yellow-500',
      gradient: 'from-yellow-500 to-orange-500',
      stats: formatPoints(user.points),
      action: 'Ver Historial'
    }
  ];

  return (
    <Layout background="gradient" animate>
      <PageContainer className="min-h-screen p-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">¡Bienvenido!</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mesa {tableNumber}</span>
                <span>•</span>
                <span>{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-1">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
            
            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Points Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Puntos Disponibles</p>
                  <p className="text-3xl font-bold text-primary">{formatPoints(user.points)}</p>
                </div>
                <div className="bg-primary/10 p-3 rounded-full">
                  <Star className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  1 canción = 50 puntos
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Priority Play = 100 puntos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
              >
                <Card 
                  className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 h-full"
                  onClick={() => navigateToSection(section.id)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className={`bg-gradient-to-r ${section.gradient} p-3 rounded-full group-hover:scale-110 transition-transform`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {section.stats}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      {section.description}
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                    >
                      {section.action}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-sm text-muted-foreground mb-4">
            ¿Necesitas ayuda? El personal del bar estará encantado de asistirte
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" size="sm">
              Llamar Mesero
            </Button>
            <Button variant="outline" size="sm">
              Ver Tutorial
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}