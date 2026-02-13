'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from '@/hooks/useToast';
import { useQRConnection } from '@/hooks/useQRConnection';
import { QRScanner } from '@/components/QRScanner';
import { useRouter } from 'next/navigation';
import { validateTableNumber } from '@/utils/validation';
import BackButton from '@/components/ui/back-button';
import { Layout, PageContainer } from '@/components/ui/layout';
import { API_ENDPOINTS } from '@/utils/constants';

/**
 * Extrae barId y table de una URL QR o de un JSON legacy.
 * Soporta ambos formatos para retrocompatibilidad.
 */
type QRResult = { barId: string; table: number } | { token: string } | null;

/**
 * Extrae datos de una URL QR (Token o Legacy) o JSON.
 */
function parseQRData(raw: string): QRResult {
  // Formato 3: URL con Token (Nuevo estándar)
  // Ej: https://encoreapp.pro/api/t/a1b2c3d4e5f6g7h8
  try {
    const url = new URL(raw);
    if (url.pathname.startsWith('/api/t/')) {
      const parts = url.pathname.split('/');
      const token = parts[parts.length - 1];
      if (token && token.length >= 16) {
        return { token };
      }
    }

    // Formato 1: URL directa (Legacy)
    // Ej: https://encoreapp.pro/client/music?barId=uuid&table=5
    const barId = url.searchParams.get('barId');
    const table = url.searchParams.get('table');
    if (barId && table) {
      const tableNum = parseInt(table, 10);
      if (!isNaN(tableNum) && tableNum > 0) {
        return { barId, table: tableNum };
      }
    }
  } catch {
    // No es una URL válida, intentar JSON
  }

  // Formato 2: JSON compacto (Legacy)
  // Ej: {"b":"bar-123","t":"5","v":"1.0"}
  try {
    const parsed = JSON.parse(raw);
    if (parsed.b && parsed.t) {
      const tableNum = parseInt(parsed.t, 10);
      if (!isNaN(tableNum) && tableNum > 0) {
        return { barId: parsed.b, table: tableNum };
      }
    }
  } catch {
    // No es JSON
  }

  return null;
}

export default function QRAccessPage() {
  const [manualTable, setManualTable] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const { setUser, setTableNumber, connectWebSocket } = useAppStore();
  const router = useRouter();
  const { barId, connectManually } = useQRConnection();

  /** Procesa los datos escaneados del QR (URL o JSON) */
  const handleQRScan = async (qrRawData: string) => {
    setIsConnecting(true);
    try {
      const parsed = parseQRData(qrRawData);

      if (!parsed) {
        throw new Error('Código QR inválido. Escanea un QR de mesa de Encore.');
      }

      let targetBarId: string;
      let targetTable: number;

      // Si es un token, validarlo con el backend
      if ('token' in parsed) {
        const response = await fetch(`${API_ENDPOINTS.base || 'http://localhost:3001'}/api/t/${parsed.token}`, {
          headers: { 'Accept': 'application/json' }
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Error al validar token QR');
        }

        targetBarId = data.data.barId;
        targetTable = data.data.tableNumber;
      } else {
        // Es legacy (barId + table)
        targetBarId = parsed.barId;
        targetTable = parsed.table;
      }

      if (!validateTableNumber(targetTable)) {
        throw new Error('Número de mesa inválido');
      }

      await connectManually(targetBarId, targetTable);

      // Configurar usuario y mesa (simulado para cliente anónimo)
      const userId = `client_${Date.now()}`;
      setUser({
        id: userId,
        role: 'client',
        tableNumber: targetTable,
        points: 100,
        sessionId: `session_${Date.now()}`
      });
      setTableNumber(targetTable);

      connectWebSocket();
      showSuccessToast(`¡Conectado a la Mesa ${targetTable}!`);

      // Redirigir a la vista del cliente
      setTimeout(() => {
        router.push(`/client/music?barId=${targetBarId}&table=${targetTable}`);
      }, 1000);
    } catch (error: unknown) {
      console.error('QR Scan Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al conectar con la mesa';
      showErrorToast(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  /** Conexión manual ingresando número de mesa */
  const handleManualEntry = () => {
    if (!manualTable.trim()) {
      showErrorToast('Por favor ingresa un número de mesa');
      return;
    }

    const tableNum = parseInt(manualTable.trim(), 10);
    if (isNaN(tableNum) || !validateTableNumber(tableNum)) {
      showErrorToast('Número de mesa inválido');
      return;
    }

    if (!barId) {
      showErrorToast('No se detectó el Bar ID. Abre el enlace desde el QR del bar.');
      return;
    }

    // Construir URL estándar y procesarla
    const qrUrl = `${window.location.origin}/client/music?barId=${barId}&table=${tableNum}`;
    handleQRScan(qrUrl);
  };

  return (
    <>
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
              <BackButton label="Volver" />

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
                  <div className="text-center">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 mb-4">
                      <QrCode className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Apunta tu cámara al código QR de la mesa
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowScanner(true)}
                      disabled={isConnecting}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {isConnecting ? 'Conectando...' : 'Activar Cámara'}
                    </Button>
                  </div>
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
      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </>
  );
}