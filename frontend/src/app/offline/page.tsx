'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, Home, Music, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Layout } from '@/components/ui/layout';

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Date | null>(null);

  useEffect(() => {
    // Verificar estado de conexión
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Listeners para cambios de conexión
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Estado inicial
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    // Si vuelve la conexión, redirigir automáticamente
    if (isOnline) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, router]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setLastAttempt(new Date());

    try {
      // Intentar hacer una petición de prueba
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      });

      if (response.ok) {
        router.push('/');
      } else {
        throw new Error('Server not responding');
      }
    } catch (error) {
      console.log('Still offline:', error);
      // El estado se actualizará automáticamente con los event listeners
    } finally {
      setTimeout(() => {
        setIsRetrying(false);
      }, 1000);
    }
  };

  const goHome = () => {
    router.push('/');
  };

  const goToClient = () => {
    router.push('/client');
  };

  if (isOnline) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 via-blue-500 to-purple-600">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center text-white"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Wifi className="w-16 h-16" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-2">¡Conexión Restaurada!</h1>
            <p className="text-lg opacity-90">Redirigiendo...</p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardContent className="p-8 text-center">
              {/* Icono animado */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="mb-6"
              >
                <WifiOff className="w-20 h-20 mx-auto text-red-400" />
              </motion.div>

              {/* Título y descripción */}
              <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Sin Conexión
              </h1>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                No se puede conectar a Encore en este momento. 
                Verifica tu conexión a internet e intenta nuevamente.
              </p>

              {/* Estado de último intento */}
              {lastAttempt && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-400 mb-4"
                >
                  Último intento: {lastAttempt.toLocaleTimeString()}
                </motion.p>
              )}

              {/* Botones de acción */}
              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 h-12"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Reintentando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reintentar Conexión
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={goHome}
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-10"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Inicio
                  </Button>
                  
                  <Button
                    onClick={goToClient}
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-10"
                  >
                    <Music className="w-4 h-4 mr-2" />
                    Cliente
                  </Button>
                </div>
              </div>

              {/* Consejos */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <h3 className="text-sm font-semibold mb-2 text-gray-200">
                  💡 Consejos para reconectar:
                </h3>
                <ul className="text-xs text-gray-400 space-y-1 text-left">
                  <li>• Verifica tu conexión WiFi o datos móviles</li>
                  <li>• Intenta moverte a una zona con mejor señal</li>
                  <li>• Reinicia tu router si estás en WiFi</li>
                  <li>• Algunas funciones pueden estar disponibles offline</li>
                </ul>
              </motion.div>

              {/* Funciones offline disponibles */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20"
              >
                <h3 className="text-sm font-semibold mb-2 text-green-300 flex items-center justify-center">
                  <Coffee className="w-4 h-4 mr-2" />
                  Disponible Offline:
                </h3>
                <ul className="text-xs text-green-200 space-y-1">
                  <li>• Ver menú previamente cargado</li>
                  <li>• Consultar historial de puntos</li>
                  <li>• Revisar cola musical guardada</li>
                  <li>• Navegar por la aplicación</li>
                </ul>
              </motion.div>
            </CardContent>
          </Card>

          {/* Indicador de estado de conexión */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-4 text-center"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
              <span className="text-xs text-red-300">Desconectado</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}