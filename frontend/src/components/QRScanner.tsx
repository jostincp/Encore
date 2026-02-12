'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Escáner QR real usando html5-qrcode.
 * Lee QR codes con la cámara trasera del dispositivo.
 */
export function QRScanner({ onScan, onClose, isOpen }: QRScannerProps) {
  const [error, setError] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<string>('qr-reader-container');

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        // Estado 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (err) {
      // Ignorar errores al detener (ya detenido, etc.)
      console.warn('Error stopping scanner:', err);
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;

    setError('');
    setIsInitializing(true);

    try {
      // Importación dinámica para evitar SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');

      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false
        },
        (decodedText: string) => {
          // QR escaneado exitosamente
          setLastScanned(decodedText);
          onScan(decodedText);

          // Detener escáner después de un scan exitoso
          setTimeout(() => {
            stopScanner();
            onClose();
          }, 1500);
        },
        () => {
          // Ignorar errores de decodificación (cada frame que no tiene QR)
        }
      );
    } catch (err: any) {
      console.error('Error starting QR scanner:', err);

      if (err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilita la cámara en la configuración del navegador.');
      } else if (err?.message?.includes('NotFoundError') || err?.name === 'NotFoundError') {
        setError('No se encontró una cámara en el dispositivo.');
      } else {
        setError('No se pudo iniciar la cámara. Verifica los permisos.');
      }

      scannerRef.current = null;
    } finally {
      setIsInitializing(false);
    }
  }, [onScan, onClose, stopScanner]);

  // Iniciar/detener escáner cuando se abre/cierra el modal
  useEffect(() => {
    if (isOpen) {
      // Pequeño delay para que el DOM renderice el contenedor
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualInput = () => {
    const manualUrl = prompt('Ingresa la URL del QR (ej: https://encoreapp.pro/client/music?barId=...&table=5):');
    if (manualUrl) {
      setLastScanned(manualUrl);
      onScan(manualUrl);
      stopScanner();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-background/95 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Escanear Código QR
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contenedor del escáner de cámara */}
              <div className="relative rounded-lg overflow-hidden bg-black min-h-[300px]">
                <div id={containerRef.current} className="w-full" />

                {/* Overlay de inicialización */}
                {isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center text-white">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="mx-auto mb-2"
                      >
                        <Camera className="h-8 w-8" />
                      </motion.div>
                      <p className="text-sm">Iniciando cámara...</p>
                    </div>
                  </div>
                )}

                {/* Badge de estado */}
                <div className="absolute top-2 left-2 right-2 z-10">
                  {lastScanned ? (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      QR Escaneado
                    </Badge>
                  ) : !error && !isInitializing ? (
                    <Badge variant="secondary" className="animate-pulse">
                      <Camera className="h-3 w-3 mr-1" />
                      Escaneando...
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Controles */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleManualInput}
                  className="flex-1"
                >
                  Entrada Manual
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    stopScanner();
                    setTimeout(() => startScanner(), 500);
                  }}
                  disabled={isInitializing}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
              </div>

              {/* Información */}
              <div className="text-xs text-muted-foreground text-center">
                Apunta la cámara al código QR de tu mesa
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}