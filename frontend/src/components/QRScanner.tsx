'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function QRScanner({ onScan, onClose, isOpen }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError('');
      setIsScanning(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Iniciar escaneo simulado
      startSimulatedScanning();
      
    } catch (err) {
      setError('No se pudo acceder a la cámara');
      setIsScanning(false);
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startSimulatedScanning = () => {
    // Simular escaneo de QR con datos de prueba
    const simulatedQRCodes = [
      JSON.stringify({ b: 'bar-123', t: '5', v: '1.0' }),
      JSON.stringify({ b: 'bar-demo', t: '12', v: '1.0' }),
      JSON.stringify({ b: 'test-bar', t: '8', v: '1.0' })
    ];

    let scanCount = 0;
    const scanInterval = setInterval(() => {
      if (scanCount < 3) {
        const randomQR = simulatedQRCodes[Math.floor(Math.random() * simulatedQRCodes.length)];
        setLastScanned(randomQR);
        onScan(randomQR);
        scanCount++;
        
        // Parar después de 3 escaneos simulados
        if (scanCount >= 3) {
          clearInterval(scanInterval);
          setTimeout(() => {
            stopCamera();
            onClose();
          }, 2000);
        }
      }
    }, 3000);

    // Limpiar intervalo si el componente se desmonta
    return () => clearInterval(scanInterval);
  };

  const handleManualInput = () => {
    // Para desarrollo: permitir entrada manual de datos QR
    const manualData = prompt('Ingresa los datos del QR (formato JSON):');
    if (manualData) {
      try {
        // Validar que sea JSON válido
        JSON.parse(manualData);
        setLastScanned(manualData);
        onScan(manualData);
        stopCamera();
        onClose();
      } catch (e) {
        setError('Formato de QR inválido');
      }
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
                  stopCamera();
                  onClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Preview */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                
                {/* Overlay de escaneo */}
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/50 rounded-lg">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                    </div>
                  </div>
                )}

                {/* Estado de escaneo */}
                <div className="absolute top-4 left-4 right-4">
                  {isScanning && (
                    <Badge variant="secondary" className="animate-pulse">
                      <Camera className="h-3 w-3 mr-1" />
                      Escaneando...
                    </Badge>
                  )}
                  
                  {lastScanned && (
                    <Badge variant="success" className="bg-green-500 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      QR Escaneado
                    </Badge>
                  )}
                </div>
              </div>

              {/* Barra de progreso simulada */}
              {isScanning && (
                <div className="space-y-2">
                  <Progress value={Math.random() * 100} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    Buscando código QR...
                  </p>
                </div>
              )}

              {/* Mensaje de error */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
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
                  onClick={startCamera}
                  disabled={isScanning}
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