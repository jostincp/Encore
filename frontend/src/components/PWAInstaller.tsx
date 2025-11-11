'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Monitor, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallerProps {
  className?: string;
  showOnlyButton?: boolean;
  autoShow?: boolean;
}

export function PWAInstaller({ 
  className = '',
  showOnlyButton = false,
  autoShow = true 
}: PWAInstallerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const { success: showSuccessToast, error: showErrorToast, info: showInfoToast } = useToast();

  useEffect(() => {
    // Detectar plataforma
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isDesktop = !isIOS && !isAndroid;

      if (isIOS) setPlatform('ios');
      else if (isAndroid) setPlatform('android');
      else if (isDesktop) setPlatform('desktop');
    };

    detectPlatform();

    // Verificar si ya está instalado
    const checkIfInstalled = () => {
      // PWA instalada
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }

      // En iOS Safari
      if ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) {
        setIsInstalled(true);
        return;
      }

      // Verificar si el service worker está activo de forma segura
      try {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && document.readyState === 'complete') {
          navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration && registration.active) {
              // PWA está registrada pero no necesariamente instalada
            }
          }).catch(() => {
            // Ignorar errores de estado inválido para ambientes de desarrollo
          });
        }
      } catch {
        // Evitar lanzar InvalidStateError en desarrollo
      }
    };

    checkIfInstalled();

    // Listener para el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      if (autoShow && !isInstalled) {
        // Mostrar prompt después de un delay
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 3000);
      }
    };

    // Listener para cuando la app se instala
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      showSuccessToast('¡Instalación Exitosa! Encore se ha instalado correctamente en tu dispositivo.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [autoShow, isInstalled, showSuccessToast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Mostrar instrucciones manuales según la plataforma
      showManualInstructions();
      return;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        showSuccessToast('Instalando... Encore se está instalando en tu dispositivo.');
      } else {
        showInfoToast('Instalación Cancelada. Puedes instalar Encore en cualquier momento desde el menú del navegador.');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
      showErrorToast('Error de Instalación. No se pudo instalar la aplicación. Intenta desde el menú del navegador.');
    } finally {
      setIsInstalling(false);
    }
  };

  const showManualInstructions = () => {
    let instructions = '';
    
    switch (platform) {
      case 'ios':
        instructions = 'En Safari: Toca el botón de compartir y selecciona "Añadir a pantalla de inicio".';
        break;
      case 'android':
        instructions = 'En Chrome: Toca el menú (⋮) y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".';
        break;
      case 'desktop':
        instructions = 'En tu navegador: Busca el icono de instalación en la barra de direcciones o en el menú.';
        break;
      default:
        instructions = 'Busca la opción "Instalar aplicación" o "Añadir a pantalla de inicio" en el menú de tu navegador.';
    }

    showInfoToast(`Instrucciones de Instalación: ${instructions}`);
  };

  const dismissPrompt = () => {
    setShowInstallPrompt(false);
    // Recordar que el usuario rechazó la instalación
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Si ya está instalado, no mostrar nada
  if (isInstalled) {
    return null;
  }

  // Solo mostrar botón
  if (showOnlyButton) {
    return (
      <Button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`${className} bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0`}
      >
        {isInstalling ? (
          <>
            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Instalando...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Instalar App
          </>
        )}
      </Button>
    );
  }

  return (
    <AnimatePresence>
      {showInstallPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
        >
          <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  {platform === 'desktop' ? (
                    <Monitor className="w-6 h-6 mr-3 text-purple-200" />
                  ) : (
                    <Smartphone className="w-6 h-6 mr-3 text-purple-200" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg">Instalar Encore</h3>
                    <p className="text-purple-100 text-sm">Acceso rápido desde tu pantalla de inicio</p>
                  </div>
                </div>
                <Button
                  onClick={dismissPrompt}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 p-1 h-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="mb-4">
                <div className="flex items-center text-sm text-purple-100 mb-2">
                  <Wifi className="w-4 h-4 mr-2" />
                  <span>Funciona sin conexión</span>
                </div>
                <ul className="text-xs text-purple-100 space-y-1 ml-6">
                  <li>• Acceso instantáneo desde tu pantalla de inicio</li>
                  <li>• Experiencia de aplicación nativa</li>
                  <li>• Funcionalidad offline disponible</li>
                  <li>• Notificaciones push (opcional)</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="flex-1 bg-white text-purple-600 hover:bg-purple-50 font-semibold"
                >
                  {isInstalling ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      Instalando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Instalar
                    </>
                  )}
                </Button>
                <Button
                  onClick={dismissPrompt}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  Ahora no
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook para usar el instalador de PWA
export function usePWAInstaller() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstallability = () => {
      // Verificar si puede instalarse
      const hasPrompt = 'BeforeInstallPromptEvent' in window;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone;
      
      setIsInstalled(isStandalone || (isIOSStandalone ?? false));
      setCanInstall(hasPrompt && !isStandalone && !isIOSStandalone);
    };

    checkInstallability();

    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return {
    canInstall,
    isInstalled,
    isSupported: 'serviceWorker' in navigator
  };
}