'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Settings, Download, Eye, Printer, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import QRGeneratorCanvas from '@/components/QRGeneratorCanvas';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from '@/hooks/useToast';
import { API_ENDPOINTS } from '@/utils/constants';

interface GeneratedQR {
  id: string;
  tableNumber: number;
  qrData: string;
  qrUrl: string;
  isActive: boolean;
  createdAt: Date;
  scannedCount?: number;
  lastScanned?: Date;
}

interface QRConfig {
  size: number;
  margin: number;
  level: 'L' | 'M' | 'Q' | 'H';
  includeMargin: boolean;
  bgColor: string;
  fgColor: string;
}

export default function AdminQRPage() {
  const { user, setUser } = useAppStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [generatedQRCodes, setGeneratedQRCodes] = useState<GeneratedQR[]>([]);
  const [barId, setBarId] = useState<string>('');
  const [barName, setBarName] = useState<string>('Encore Bar');
  const [totalTables, setTotalTables] = useState<number>(20);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [qrConfig, setQRConfig] = useState<QRConfig>({
    size: 256,
    margin: 4,
    level: 'H',
    includeMargin: true,
    bgColor: '#ffffff',
    fgColor: '#000000'
  });

  // Obtener el barId del usuario/admin
  useEffect(() => {
    const fetchBarData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
        if (!token) {
          showErrorToast('No hay token de autenticación');
          return;
        }

        const response = await fetch(`${API_ENDPOINTS.base}/api/bars/my`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const bars = data?.data?.bars || data?.bars;
          if (Array.isArray(bars) && bars.length > 0) {
            const bar = bars[0];
            setBarId(bar.id || bar._id);
            setBarName(bar.name || 'Encore Bar');
            if (bar.totalTables) {
              setTotalTables(bar.totalTables);
            }
          }
        } else {
          // Si no hay bar, usar un ID temporal para desarrollo
          setBarId('demo-bar-' + Date.now());
          setBarName('Demo Bar');
        }
      } catch (error) {
        console.error('Error fetching bar data:', error);
        // Usar ID temporal para desarrollo
        setBarId('demo-bar-' + Date.now());
        setBarName('Demo Bar');
      }
    };

    fetchBarData();
  }, []);

  // Cargar QR codes existentes cuando se obtiene el barId
  useEffect(() => {
    const loadExistingQRCodes = async () => {
      if (!barId || barId.startsWith('demo-bar-')) return;

      try {
        const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
        if (!token) return;

        const response = await fetch(`http://localhost:3001/api/qr/bar/${barId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.qrCodes && data.qrCodes.length > 0) {
            const loadedQRCodes: GeneratedQR[] = data.qrCodes.map((qr: any) => ({
              id: `qr-${qr.tableNumber}-loaded`,
              tableNumber: qr.tableNumber,
              qrData: qr.url,
              qrUrl: qr.url,
              isActive: true,
              createdAt: new Date(qr.generatedAt),
              scannedCount: 0
            }));
            setGeneratedQRCodes(loadedQRCodes);
          }
        }
      } catch (error) {
        console.error('Error loading existing QR codes:', error);
      }
    };

    loadExistingQRCodes();
  }, [barId]);

  const handleGenerateQR = (tableNumber: number, qrData: GeneratedQR) => {
    setGeneratedQRCodes(prev => {
      // Reemplazar si ya existe para esa mesa
      const filtered = prev.filter(qr => qr.tableNumber !== tableNumber);
      return [...filtered, qrData].sort((a, b) => a.tableNumber - b.tableNumber);
    });

    showSuccessToast(`QR generado para Mesa ${tableNumber}`);
  };

  const generateAllQRCodes = async () => {
    setIsGeneratingAll(true);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
      if (!token) {
        showErrorToast('No hay token de autenticación');
        setIsGeneratingAll(false);
        return;
      }

      // Llamar al backend para generar y guardar QR codes
      const response = await fetch('http://localhost:3001/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          numberOfTables: totalTables,
          baseUrl: window.location.origin,
          width: qrConfig.size,
          errorCorrectionLevel: qrConfig.level
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar QR codes');
      }

      // Convertir los QR codes del backend al formato local
      const newQRCodes: GeneratedQR[] = data.qrCodes.map((qr: any) => ({
        id: `qr-${qr.tableNumber}-${Date.now()}`,
        tableNumber: qr.tableNumber,
        qrData: qr.url,
        qrUrl: qr.url,
        isActive: true,
        createdAt: new Date(qr.generatedAt),
        scannedCount: 0
      }));

      setGeneratedQRCodes(newQRCodes);
      showSuccessToast(`✅ Generados y guardados ${totalTables} códigos QR`);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      showErrorToast(error instanceof Error ? error.message : 'Error al generar códigos QR');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const downloadAllQRCodes = () => {
    if (generatedQRCodes.length === 0) {
      showErrorToast('No hay códigos QR generados');
      return;
    }

    // Crear un documento HTML con todos los QRs para imprimir
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Códigos QR - ${barId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .qr-container { display: inline-block; text-align: center; margin: 20px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; }
          .qr-code { margin: 10px 0; }
          .table-info { font-weight: bold; margin-top: 10px; }
          .bar-info { font-size: 12px; color: #666; margin-top: 5px; }
          @media print { .qr-container { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>Códigos QR - ${barName}</h1>
        <p>Total de mesas: ${generatedQRCodes.length}</p>
        ${generatedQRCodes.map(qr => `
          <div class="qr-container">
            <div class="table-info">Mesa ${qr.tableNumber}</div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr.qrData)}" alt="QR Mesa ${qr.tableNumber}">
            </div>
            <div class="bar-info">${barName}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-codes-${barName.replace(/\s+/g, '-')}.html`;
    link.click();
    URL.revokeObjectURL(url);

    showSuccessToast('Códigos QR listos para imprimir');
  };

  const printQRCodes = () => {
    if (generatedQRCodes.length === 0) {
      showErrorToast('No hay códigos QR generados');
      return;
    }

    downloadAllQRCodes();
    showSuccessToast('Abriendo vista de impresión...');
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
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <QrCode className="h-8 w-8 text-primary" />
              Generador de Códigos QR
            </h1>
            <p className="text-muted-foreground mt-1">
              Crea códigos QR únicos para cada mesa de tu bar
            </p>
            {barId && (
              <Badge variant="outline" className="mt-2">
                {barName} - ID: {barId}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={generateAllQRCodes}
              disabled={isGeneratingAll || !barId}
            >
              <Settings className={`h-4 w-4 mr-2 ${isGeneratingAll ? 'animate-spin' : ''}`} />
              Generar Todos
            </Button>
            <Button
              variant="outline"
              onClick={printQRCodes}
              disabled={generatedQRCodes.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={downloadAllQRCodes}
              disabled={generatedQRCodes.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </motion.div>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList>
            <TabsTrigger value="single">Generar Individual</TabsTrigger>
            <TabsTrigger value="bulk">Generar Múltiples</TabsTrigger>
            <TabsTrigger value="preview">Vista Previa ({generatedQRCodes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <QRGeneratorCanvas
                barId={barId}
                barName={barName}
                onGenerate={handleGenerateQR}
                maxTables={totalTables}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="bulk">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Generar Múltiples Códigos QR</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="total-tables">Número Total de Mesas</Label>
                    <Input
                      id="total-tables"
                      type="number"
                      min="1"
                      max="100"
                      value={totalTables}
                      onChange={(e) => setTotalTables(parseInt(e.target.value) || 1)}
                      placeholder="Ej: 20"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Se generarán códigos QR para mesas del 1 al {totalTables}
                  </div>
                  <Button
                    onClick={generateAllQRCodes}
                    disabled={isGeneratingAll || !barId}
                    className="w-full"
                  >
                    {isGeneratingAll ? (
                      <>
                        <Settings className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Generar {totalTables} Códigos QR
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="preview">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Vista Previa de Códigos QR</span>
                    <Badge variant="secondary">{generatedQRCodes.length} generados</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedQRCodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay códigos QR generados</p>
                      <p className="text-sm mt-2">Usa las pestañas anteriores para generar códigos QR</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {generatedQRCodes.map((qr) => (
                        <div key={qr.tableNumber} className="text-center p-4 border rounded-lg">
                          <div className="mb-2">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(qr.qrData)}`}
                              alt={`QR Mesa ${qr.tableNumber}`}
                              className="mx-auto"
                            />
                          </div>
                          <Badge variant="outline">Mesa {qr.tableNumber}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(qr.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Instrucciones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Instrucciones de Uso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold">Para el Administrador:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Genera códigos QR para cada mesa de tu bar</li>
                    <li>• Imprime los códigos y colócalos en las mesas</li>
                    <li>• Cada código contiene el ID del bar y número de mesa</li>
                    <li>• Los códigos son únicos y seguros</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">Para los Clientes:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Escanea el código QR de tu mesa con tu móvil</li>
                    <li>• Se conectará automáticamente al bar</li>
                    <li>• Podrás ver el menú y pedir canciones</li>
                    <li>• Gana puntos con tus pedidos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </AdminLayout>
  );
}