'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Camera, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { validateTableNumber } from '@/utils/validation';

export default function QRPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualTable, setManualTable] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const { setUser, setTableNumber, connectWebSocket } = useAppStore();
  const router = useRouter();

  const handleQRScan = async (tableNumber: string) => {
    const tableNum = parseInt(tableNumber);
    if (isNaN(tableNum) || !validateTableNumber(tableNum)) {
      showErrorToast('Número de mesa inválido');
      return;
    }

    setIsConnecting(true);
    try {
      // Simular conexión a la mesa
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Configurar usuario y mesa
      const userId = `client_${Date.now()}`;
      setUser({
        id: userId,
        role: 'client',
        tableNumber: tableNum,
        points: 100, // Puntos iniciales
        sessionId: `session_${Date.now()}`
      });
      setTableNumber(tableNum);
      
      // Conectar WebSocket
      connectWebSocket();
      
      showSuccessToast(`¡Conectado a la Mesa ${tableNum}!`);
      
      // Redirigir al hub del cliente
      setTimeout(() => {
        router.push('/client');
      }, 1000);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error :
                          'Error al conectar con la mesa';
      showErrorToast(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualEntry = () => {
    if (!manualTable.trim()) {
      showErrorToast('Por favor ingresa un número de mesa');
      return;
    }
    handleQRScan(manualTable.trim());
  };

  const startQRScanner = () => {
    setIsScanning(true);
    // Simular escaneo exitoso después de 3 segundos
    setTimeout(() => {
      const mockTableNumber = Math.floor(Math.random() * 20) + 1;
      setIsScanning(false);
      handleQRScan(mockTableNumber.toString());
    }, 3000);
  };

  return (
    <Layout background="gradient" animate>
      <PageContainer className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 left-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            
            <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto mb-4">
              <QrCode className="h-8 w-8 text-primary mx-auto" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Acceso a Mesa</h1>
            <p className="text-muted-foreground">
              Escanea el código QR de tu mesa o ingresa el número manualmente
            </p>
          </motion.div>

          {/* QR Scanner Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Escanear QR
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isScanning ? (
                  <div className="text-center">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 mb-4">
                      <QrCode className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Apunta tu cámara al código QR de la mesa
                      </p>
                    </div>
                    <Button 
                      onClick={startQRScanner}
                      disabled={isConnecting}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Activar Cámara
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="border-2 border-primary rounded-lg p-8 mb-4 bg-primary/5">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="h-16 w-16 mx-auto mb-4"
                      >
                        <QrCode className="h-16 w-16 text-primary" />
                      </motion.div>
                      <p className="text-sm text-primary font-medium">
                        Escaneando código QR...
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => setIsScanning(false)}
                      className="w-full"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Manual Entry Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Ingreso Manual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="table-number">Número de Mesa</Label>
                  <Input
                    id="table-number"
                    type="number"
                    placeholder="Ej: 5"
                    value={manualTable}
                    onChange={(e) => setManualTable(e.target.value)}
                    disabled={isConnecting}
                    min="1"
                    max="99"
                  />
                </div>
                <Button 
                  onClick={handleManualEntry}
                  disabled={isConnecting || !manualTable.trim()}
                  className="w-full"
                >
                  {isConnecting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 mr-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </motion.div>
                      Conectando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Conectar a Mesa
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Help Text */}
          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <p className="text-xs text-muted-foreground">
              ¿No encuentras el código QR? Pregunta al personal del bar por el número de tu mesa
            </p>
          </motion.div>
        </div>
      </PageContainer>
    </Layout>
  );
}