'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
import { QrCode, Settings, Download, Eye, Printer, ArrowLeft, Trash2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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

export default function AdminQRPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [generatedQRCodes, setGeneratedQRCodes] = useState<GeneratedQR[]>([]);
  const [barId, setBarId] = useState<string>('');
  const [barName, setBarName] = useState<string>('Encore Bar');
  const [totalTables, setTotalTables] = useState<number>(20);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());

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
          setBarId('demo-bar-' + Date.now());
          setBarName('Demo Bar');
        }
      } catch (error) {
        console.error('Error fetching bar data:', error);
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
      const filtered = prev.filter(qr => qr.tableNumber !== tableNumber);
      return [...filtered, qrData].sort((a, b) => a.tableNumber - b.tableNumber);
    });
    showSuccessToast(`QR generado para Mesa ${tableNumber}`);
  };

  /** Alterna selección de un QR para eliminación */
  const toggleSelectForDeletion = (tableNumber: number) => {
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(tableNumber)) {
        next.delete(tableNumber);
      } else {
        next.add(tableNumber);
      }
      return next;
    });
  };

  /** Selecciona o deselecciona todos los QR */
  const toggleSelectAll = () => {
    if (selectedForDeletion.size === generatedQRCodes.length) {
      setSelectedForDeletion(new Set());
    } else {
      setSelectedForDeletion(new Set(generatedQRCodes.map(qr => qr.tableNumber)));
    }
  };

  /** Elimina los QR seleccionados (backend + estado local) */
  const handleDeleteSelected = async () => {
    if (selectedForDeletion.size === 0) {
      showErrorToast('Selecciona al menos un código QR para eliminar');
      return;
    }

    const tableNumbers = Array.from(selectedForDeletion);
    const confirmMsg = tableNumbers.length === 1
      ? `¿Eliminar el código QR de la Mesa ${tableNumbers[0]}?`
      : `¿Eliminar ${tableNumbers.length} códigos QR? (Mesas: ${tableNumbers.sort((a, b) => a - b).join(', ')})`;

    if (!confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
      if (token && barId && !barId.startsWith('demo-bar-')) {
        const response = await fetch('http://localhost:3001/api/qr/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ tableNumbers })
        });

        const data = await response.json();
        if (!data.success) {
          showErrorToast(data.message || 'Error al eliminar del servidor');
          return;
        }
      }

      // Actualizar estado local
      setGeneratedQRCodes(prev => prev.filter(qr => !selectedForDeletion.has(qr.tableNumber)));
      setSelectedForDeletion(new Set());
      showSuccessToast(`${tableNumbers.length} código(s) QR eliminado(s)`);
    } catch (error) {
      console.error('Error deleting QR codes:', error);
      showErrorToast('Error al conectar con el servidor para eliminar');
    }
  };

  /** Genera todos los QR codes vía backend y muestra progreso */
  const generateAllQRCodes = async () => {
    setIsGeneratingAll(true);
    setGenerationProgress(0);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
      if (!token) {
        showErrorToast('No hay token de autenticación');
        setIsGeneratingAll(false);
        return;
      }

      // Progreso simulado mientras espera respuesta del backend
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      const response = await fetch('http://localhost:3001/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          numberOfTables: totalTables,
          baseUrl: window.location.origin,
          width: 300,
          errorCorrectionLevel: 'H'
        })
      });

      clearInterval(progressInterval);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar QR codes');
      }

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
      setGenerationProgress(100);
      showSuccessToast(`✅ Generados y guardados ${totalTables} códigos QR`);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      showErrorToast(error instanceof Error ? error.message : 'Error al generar códigos QR');
    } finally {
      setTimeout(() => {
        setIsGeneratingAll(false);
        setGenerationProgress(0);
      }, 1000);
    }
  };

  /** Descarga el ZIP de QR codes desde el backend */
  const downloadAllQRCodes = async () => {
    if (generatedQRCodes.length === 0) {
      showErrorToast('No hay códigos QR generados');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('encore_access_token');
      if (!token) {
        showErrorToast('No hay token de autenticación');
        return;
      }

      showSuccessToast('Preparando descarga...');

      const response = await fetch('http://localhost:3001/api/qr/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          numberOfTables: generatedQRCodes.length,
          baseUrl: window.location.origin,
          width: 600
        })
      });

      if (!response.ok) {
        throw new Error('Error al descargar');
      }

      // Descargar el ZIP
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-codes-${barName.replace(/\s+/g, '-')}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      showSuccessToast('Códigos QR descargados como ZIP');
    } catch (error) {
      console.error('Error downloading QR codes:', error);
      showErrorToast('Error al descargar. Verifica que el backend esté corriendo.');
    }
  };

  const printQRCodes = () => {
    if (generatedQRCodes.length === 0) {
      showErrorToast('No hay códigos QR generados');
      return;
    }
    downloadAllQRCodes();
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
              size="icon"
              onClick={() => router.push('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
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
                  {barName} - ID: {barId.substring(0, 8)}...
                </Badge>
              )}
            </div>
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
              Descargar ZIP
            </Button>
          </div>
        </motion.div>

        {/* Barra de progreso de generación */}
        {isGeneratingAll && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={generationProgress} className="h-3" />
                  </div>
                  <span className="text-sm font-medium min-w-[4rem] text-right">
                    {Math.round(generationProgress)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Generando {totalTables} códigos QR...
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                existingTableNumbers={generatedQRCodes.map(qr => qr.tableNumber)}
                onDelete={(tableNumbers) => {
                  setGeneratedQRCodes(prev => prev.filter(qr => !tableNumbers.includes(qr.tableNumber)));
                  showSuccessToast(`${tableNumbers.length} código(s) QR eliminado(s)`);
                }}
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
                    <div className="flex items-center gap-2">
                      {generatedQRCodes.length > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSelectAll}
                            className="text-xs"
                          >
                            {selectedForDeletion.size === generatedQRCodes.length ? (
                              <><CheckSquare className="h-4 w-4 mr-1" /> Deseleccionar Todo</>
                            ) : (
                              <><Square className="h-4 w-4 mr-1" /> Seleccionar Todo</>
                            )}
                          </Button>
                          {selectedForDeletion.size > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteSelected}
                              className="text-xs"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Eliminar ({selectedForDeletion.size})
                            </Button>
                          )}
                        </>
                      )}
                      <Badge variant="secondary">{generatedQRCodes.length} generados</Badge>
                    </div>
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
                        <div
                          key={qr.tableNumber}
                          onClick={() => toggleSelectForDeletion(qr.tableNumber)}
                          className={`text-center p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${selectedForDeletion.has(qr.tableNumber)
                            ? 'border-destructive bg-destructive/5 ring-2 ring-destructive/20'
                            : 'hover:border-primary/30'
                            }`}
                        >
                          {/* Checkbox de selección */}
                          <div className="flex justify-end mb-1">
                            {selectedForDeletion.has(qr.tableNumber) ? (
                              <CheckSquare className="h-4 w-4 text-destructive" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="mb-2 flex justify-center">
                            <QRCodeCanvas
                              value={qr.qrData}
                              size={128}
                              bgColor="#ffffff"
                              fgColor="#000000"
                              level="H"
                              includeMargin
                            />
                          </div>
                          <Badge variant={selectedForDeletion.has(qr.tableNumber) ? 'destructive' : 'outline'}>
                            Mesa {qr.tableNumber}
                          </Badge>
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