'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Settings, Download, Eye, Printer, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useToast } from '@/hooks/useToast';
import { API_ENDPOINTS } from '@/utils/constants';

interface TableQR {
  id: string;
  tableNumber: number;
  qrData: string;
  qrUrl: string;
  isActive: boolean;
  createdAt: Date;
  scannedCount?: number;
  lastScanned?: Date;
}

interface BarSettings {
  id: string;
  name: string;
  totalTables: number;
  qrPrefix: string;
  customDomain?: string;
}

export default function AdminQRPage() {
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [barSettings, setBarSettings] = useState<BarSettings | null>(null);
  const [tableQRCodes, setTableQRCodes] = useState<TableQR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);

  // Cargar configuración del bar y códigos QR existentes
  useEffect(() => {
    loadBarData();
  }, []);

  const loadBarData = async () => {
    try {
      const token = localStorage.getItem('encore_access_token');
      if (!token) {
        showErrorToast('No hay token de autenticación');
        return;
      }

      // Cargar datos del bar
      const barResponse = await fetch(`${API_ENDPOINTS.base}/api/bars/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (barResponse.ok) {
        const barData = await barResponse.json();
        setBarSettings({
          id: barData.data.id,
          name: barData.data.name,
          totalTables: barData.data.totalTables || 20,
          qrPrefix: barData.data.qrPrefix || 'ENCORE',
          customDomain: barData.data.customDomain
        });
      }

      // Cargar códigos QR existentes
      const qrResponse = await fetch(`${API_ENDPOINTS.base}/api/bars/my/qrcodes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        setTableQRCodes(qrData.data || []);
      }

    } catch (error) {
      console.error('Error loading bar data:', error);
      showErrorToast('Error al cargar datos del bar');
    } finally {
      setIsLoading(false);
    }
  };

  // Generar QR para una mesa específica
  const generateTableQR = async (tableNumber: number) => {
    if (!barSettings) return;

    try {
      setIsGenerating(true);

      const token = localStorage.getItem('encore_access_token');
      const response = await fetch(`${API_ENDPOINTS.base}/api/bars/my/qrcodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tableNumber,
          regenerate: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newQR: TableQR = {
          id: data.data.id,
          tableNumber,
          qrData: data.data.qrData,
          qrUrl: data.data.qrUrl,
          isActive: true,
          createdAt: new Date(data.data.createdAt),
          scannedCount: 0
        };

        setTableQRCodes(prev => {
          const filtered = prev.filter(qr => qr.tableNumber !== tableNumber);
          return [...filtered, newQR];
        });

        showSuccessToast(`QR generado para Mesa ${tableNumber}`);
      } else {
        const errorData = await response.json();
        showErrorToast(errorData.message || 'Error al generar QR');
      }

    } catch (error) {
      console.error('Error generating QR:', error);
      showErrorToast('Error al generar código QR');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generar QR para todas las mesas
  const generateAllQRCodes = async () => {
    if (!barSettings) return;

    try {
      setIsGenerating(true);
      const generated: TableQR[] = [];

      for (let i = 1; i <= barSettings.totalTables; i++) {
        await generateTableQR(i);
        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      showSuccessToast(`Se generaron ${barSettings.totalTables} códigos QR`);

    } catch (error) {
      console.error('Error generating all QRs:', error);
      showErrorToast('Error al generar todos los códigos QR');
    } finally {
      setIsGenerating(false);
    }
  };

  // Descargar QR individual
  const downloadQR = (qr: TableQR) => {
    const link = document.createElement('a');
    link.download = `qr-mesa-${qr.tableNumber}-${barSettings?.name}.png`;
    
    // Crear imagen con el QR y texto
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 350;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borde
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Título
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(barSettings?.name || 'Encore Bar', canvas.width / 2, 40);

    // Mesa
    ctx.font = '16px Arial';
    ctx.fillText(`Mesa ${qr.tableNumber}`, canvas.width / 2, 65);

    // Placeholder para QR (en producción usaría una librería QR)
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(50, 80, 200, 200);
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Arial';
    ctx.fillText('QR Code', canvas.width / 2, 180);

    // Instrucciones
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Escanea para conectar', canvas.width / 2, 300);
    ctx.fillText('y seleccionar música', canvas.width / 2, 315);

    link.href = canvas.toDataURL();
    link.click();

    showSuccessToast(`QR Mesa ${qr.tableNumber} descargado`);
  };

  // Descargar todos los QRs en PDF
  const downloadAllQRCodes = async () => {
    try {
      setIsGenerating(true);
      
      // Aquí iría la lógica para generar PDF con todos los QRs
      // Por ahora, descargamos individualmente
      for (const qr of tableQRCodes) {
        downloadQR(qr);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      showSuccessToast('Todos los códigos QR descargados');

    } catch (error) {
      console.error('Error downloading all QRs:', error);
      showErrorToast('Error al descargar códigos QR');
    } finally {
      setIsGenerating(false);
    }
  };

  // Eliminar QR
  const deleteQR = async (qrId: string) => {
    try {
      const token = localStorage.getItem('encore_access_token');
      const response = await fetch(`${API_ENDPOINTS.base}/api/bars/my/qrcodes/${qrId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setTableQRCodes(prev => prev.filter(qr => qr.id !== qrId));
        showSuccessToast('Código QR eliminado');
      } else {
        showErrorToast('Error al eliminar código QR');
      }

    } catch (error) {
      console.error('Error deleting QR:', error);
      showErrorToast('Error al eliminar código QR');
    }
  };

  // Toggle selección de mesa
  const toggleTableSelection = (tableNumber: number) => {
    setSelectedTables(prev => 
      prev.includes(tableNumber) 
        ? prev.filter(t => t !== tableNumber)
        : [...prev, tableNumber]
    );
  };

  // Generar QR para mesas seleccionadas
  const generateSelectedQRCodes = async () => {
    for (const tableNumber of selectedTables) {
      await generateTableQR(tableNumber);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setSelectedTables([]);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </PageContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <QrCode className="h-8 w-8 text-blue-600" />
                Generador de Códigos QR
              </h1>
              <p className="text-gray-600 mt-2">
                Genera y gestiona códigos QR para que tus clientes se conecten desde sus mesas
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {barSettings?.name || 'Bar no configurado'}
            </Badge>
          </div>

          {/* Configuración del Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración del Establecimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bar-name">Nombre del Bar</Label>
                  <Input
                    id="bar-name"
                    value={barSettings?.name || ''}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="total-tables">Total de Mesas</Label>
                  <Input
                    id="total-tables"
                    type="number"
                    value={barSettings?.totalTables || 20}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="qr-prefix">Prefijo QR</Label>
                  <Input
                    id="qr-prefix"
                    value={barSettings?.qrPrefix || 'ENCORE'}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>• Cada código QR será único por mesa</p>
                <p>• Los clientes escanean para conectarse automáticamente</p>
                <p>• Puedes regenerar códigos en cualquier momento</p>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="generator" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generator">Generador</TabsTrigger>
              <TabsTrigger value="manage">Gestionar</TabsTrigger>
              <TabsTrigger value="print">Imprimir</TabsTrigger>
            </TabsList>

            {/* Tab Generador */}
            <TabsContent value="generator" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generar Códigos QR</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Acciones rápidas */}
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={generateAllQRCodes}
                      disabled={isGenerating || !barSettings}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Generar Todos ({barSettings?.totalTables || 0})
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedTables(Array.from({length: barSettings?.totalTables || 20}, (_, i) => i + 1))}
                      disabled={!barSettings}
                    >
                      Seleccionar Todos
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedTables([])}
                      disabled={selectedTables.length === 0}
                    >
                      Deseleccionar
                    </Button>
                  </div>

                  {/* Mesas seleccionadas */}
                  {selectedTables.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">
                        {selectedTables.length} mesas seleccionadas
                      </p>
                      <Button 
                        onClick={generateSelectedQRCodes}
                        disabled={isGenerating}
                        size="sm"
                      >
                        Generar Seleccionados
                      </Button>
                    </div>
                  )}

                  {/* Grid de mesas */}
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {Array.from({ length: barSettings?.totalTables || 20 }, (_, i) => i + 1).map(tableNumber => {
                      const hasQR = tableQRCodes.some(qr => qr.tableNumber === tableNumber);
                      const isSelected = selectedTables.includes(tableNumber);
                      
                      return (
                        <motion.button
                          key={tableNumber}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleTableSelection(tableNumber)}
                          onDoubleClick={() => generateTableQR(tableNumber)}
                          className={`
                            relative p-3 rounded-lg border-2 transition-all
                            ${hasQR 
                              ? 'bg-green-50 border-green-300 text-green-800' 
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                            }
                            ${isSelected 
                              ? 'ring-2 ring-blue-500 border-blue-500' 
                              : ''
                            }
                            hover:shadow-md
                          `}
                        >
                          <div className="text-center">
                            <div className="text-lg font-bold">M{tableNumber}</div>
                            {hasQR && (
                              <div className="text-xs mt-1">✓ QR</div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="text-xs text-gray-500 text-center">
                    Click para seleccionar • Doble click para generar QR individual
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Gestionar */}
            <TabsContent value="manage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Códigos QR Generados ({tableQRCodes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {tableQRCodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No hay códigos QR generados</p>
                      <p className="text-sm">Ve a la pestaña "Generador" para crear códigos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tableQRCodes.map((qr) => (
                        <motion.div
                          key={qr.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Mesa {qr.tableNumber}</h3>
                            <Badge variant={qr.isActive ? "default" : "secondary"}>
                              {qr.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          
                          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                            <QrCode className="h-16 w-16 text-gray-400" />
                          </div>

                          <div className="text-xs text-gray-500 space-y-1">
                            <p>Creado: {qr.createdAt.toLocaleDateString()}</p>
                            {qr.scannedCount !== undefined && (
                              <p>Escaneado: {qr.scannedCount} veces</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => downloadQR(qr)}>
                              <Download className="h-3 w-3 mr-1" />
                              Descargar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => generateTableQR(qr.tableNumber)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => deleteQR(qr.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Imprimir */}
            <TabsContent value="print" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    Opciones de Impresión
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={downloadAllQRCodes}
                      disabled={isGenerating || tableQRCodes.length === 0}
                      className="h-20 flex-col"
                    >
                      <Download className="h-6 w-6 mb-2" />
                      Descargar Todos (PNG)
                    </Button>
                    <Button 
                      variant="outline"
                      disabled={tableQRCodes.length === 0}
                      className="h-20 flex-col"
                    >
                      <Printer className="h-6 w-6 mb-2" />
                      Generar PDF para Imprimir
                    </Button>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-semibold text-amber-800 mb-2">💡 Recomendaciones de Impresión:</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Usa papel de alta calidad (200g/m² o superior)</li>
                      <li>• Asegúrate que los códigos QR tengan al menos 2x2 cm</li>
                      <li>• Imprime en color o alto contraste</li>
                      <li>• Protege los códigos con laminado o plástico</li>
                      <li>• Coloca los códigos en lugares visibles de cada mesa</li>
                      <li>• Prueba cada código QR antes de desplegar</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </AdminLayout>
  );
}
