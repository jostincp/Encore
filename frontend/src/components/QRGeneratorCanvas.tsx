'use client';

import { useState, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Copy, Settings, QrCode as QrCodeIcon, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';

interface QRGeneratorCanvasProps {
  barId: string;
  barName?: string;
  onGenerate?: (tableNumber: number, qrData: QRData) => void;
  onDelete?: (tableNumbers: number[]) => void;
  maxTables?: number;
  /** Mesas que ya tienen QR generado (desde el padre) */
  existingTableNumbers?: number[];
}

interface QRData {
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

export default function QRGeneratorCanvas({
  barId,
  barName = 'Encore Bar',
  onGenerate,
  onDelete,
  maxTables = 50,
  existingTableNumbers = []
}: QRGeneratorCanvasProps) {
  const [qrConfig, setQRConfig] = useState<QRConfig>({
    size: 256,
    margin: 4,
    level: 'H',
    includeMargin: true,
    bgColor: '#ffffff',
    fgColor: '#000000'
  });

  const [generatedQRs, setGeneratedQRs] = useState<QRData[]>([]);
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<'single' | 'grid' | 'list'>('single');
  const [selectedQRs, setSelectedQRs] = useState<string[]>([]);

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  /** Construye la URL que se codifica en el QR */
  const buildQRUrl = useCallback((tableNumber: number): string => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://encoreapp.pro';
    return `${base}/client/music?barId=${barId}&table=${tableNumber}`;
  }, [barId]);

  /** Verifica si una mesa ya tiene QR (local o del padre) */
  const tableHasQR = useCallback((tableNumber: number): boolean => {
    const inLocal = generatedQRs.some(qr => qr.tableNumber === tableNumber);
    const inParent = existingTableNumbers.includes(tableNumber);
    return inLocal || inParent;
  }, [generatedQRs, existingTableNumbers]);

  /** Genera datos para una mesa específica */
  const generateQR = async (tableNumber: number) => {
    if (!barId) {
      showErrorToast('Bar ID no disponible');
      return;
    }

    if (tableHasQR(tableNumber)) {
      showErrorToast(`La Mesa ${tableNumber} ya tiene un código QR. Elimínalo primero.`);
      return;
    }

    try {
      setIsGenerating(true);
      const url = buildQRUrl(tableNumber);

      const qrData: QRData = {
        id: `qr-${tableNumber}-${Date.now()}`,
        tableNumber,
        qrData: url,
        qrUrl: url,
        isActive: true,
        createdAt: new Date(),
        scannedCount: 0
      };

      setGeneratedQRs(prev => {
        const filtered = prev.filter(qr => qr.tableNumber !== tableNumber);
        return [...filtered, qrData].sort((a, b) => a.tableNumber - b.tableNumber);
      });

      onGenerate?.(tableNumber, qrData);
      showSuccessToast(`Código QR generado para Mesa ${tableNumber}`);
    } catch (error) {
      console.error('Error generating QR:', error);
      showErrorToast('Error al generar código QR');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Genera QR para todas las mesas */
  const generateAllQRCodes = async () => {
    if (!barId) {
      showErrorToast('Bar ID no disponible');
      return;
    }

    try {
      setIsGenerating(true);
      const newQRs: QRData[] = [];

      for (let i = 1; i <= maxTables; i++) {
        const url = buildQRUrl(i);
        newQRs.push({
          id: `qr-${i}-${Date.now()}`,
          tableNumber: i,
          qrData: url,
          qrUrl: url,
          isActive: true,
          createdAt: new Date(),
          scannedCount: 0
        });
      }

      setGeneratedQRs(newQRs);
      newQRs.forEach(qr => onGenerate?.(qr.tableNumber, qr));
      showSuccessToast(`Se generaron ${maxTables} códigos QR`);
    } catch (error) {
      console.error('Error generating all QRs:', error);
      showErrorToast('Error al generar todos los códigos QR');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Descarga un QR como PNG con diseño profesional */
  const downloadQR = (qr: QRData) => {
    // Buscar el canvas renderizado por qrcode.react
    const container = document.getElementById(`qr-canvas-${qr.tableNumber}`);
    const sourceCanvas = container?.querySelector('canvas');
    if (!sourceCanvas) {
      showErrorToast('QR no encontrado. Genera el QR primero.');
      return;
    }

    // Crear canvas con diseño profesional
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 60;
    const headerHeight = 80;
    const footerHeight = 45;
    const qrSize = qrConfig.size;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + headerHeight + footerHeight + padding;

    // Fondo blanco con borde redondeado
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Nombre del bar
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(barName, canvas.width / 2, 45);

    // Número de mesa
    ctx.font = '16px Arial, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Mesa ${qr.tableNumber}`, canvas.width / 2, 70);

    // Dibujar QR real desde el canvas de qrcode.react
    ctx.drawImage(sourceCanvas, padding, headerHeight, qrSize, qrSize);

    // Instrucciones
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Escanea para pedir música', canvas.width / 2, qrSize + headerHeight + 25);

    // Descargar
    const link = document.createElement('a');
    link.download = `qr-mesa-${qr.tableNumber}-${barName.replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showSuccessToast(`QR Mesa ${qr.tableNumber} descargado`);
  };

  /** Copia la URL del QR al portapapeles */
  const copyQRData = (qr: QRData) => {
    navigator.clipboard.writeText(qr.qrUrl);
    showSuccessToast('URL del QR copiada al portapapeles');
  };

  /** Comparte el QR usando Web Share API o copia al portapapeles */
  const shareQR = async (qr: QRData) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${barName} - Mesa ${qr.tableNumber}`,
          text: `Conéctate a la rockola digital desde la Mesa ${qr.tableNumber}`,
          url: qr.qrUrl
        });
        showSuccessToast('QR compartido exitosamente');
      } catch {
        copyQRData(qr);
      }
    } else {
      copyQRData(qr);
    }
  };

  const deleteQR = (qrId: string) => {
    setGeneratedQRs(prev => prev.filter(qr => qr.id !== qrId));
    setSelectedQRs(prev => prev.filter(id => id !== qrId));
    showSuccessToast('Código QR eliminado');
  };

  const toggleQRSelection = (qrId: string) => {
    setSelectedQRs(prev =>
      prev.includes(qrId)
        ? prev.filter(id => id !== qrId)
        : [...prev, qrId]
    );
  };

  const selectAll = () => setSelectedQRs(generatedQRs.map(qr => qr.id));
  const deselectAll = () => setSelectedQRs([]);

  const downloadSelected = () => {
    const qrsToDownload = generatedQRs.filter(qr => selectedQRs.includes(qr.id));
    qrsToDownload.forEach((qr, i) => {
      setTimeout(() => downloadQR(qr), i * 200);
    });
  };

  /** Renderiza un QR real usando qrcode.react */
  const renderQRCode = (qr: QRData, size: number = 200) => (
    <div id={`qr-canvas-${qr.tableNumber}`}>
      <QRCodeCanvas
        value={qr.qrData}
        size={size}
        bgColor={qrConfig.bgColor}
        fgColor={qrConfig.fgColor}
        level={qrConfig.level}
        includeMargin={qrConfig.includeMargin}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Códigos QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="qr-size">Tamaño</Label>
              <Select
                value={qrConfig.size.toString()}
                onValueChange={(value) => setQRConfig(prev => ({ ...prev, size: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">Pequeño (128px)</SelectItem>
                  <SelectItem value="256">Mediano (256px)</SelectItem>
                  <SelectItem value="384">Grande (384px)</SelectItem>
                  <SelectItem value="512">Extra Grande (512px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="qr-level">Corrección de Errores</Label>
              <Select
                value={qrConfig.level}
                onValueChange={(value: 'L' | 'M' | 'Q' | 'H') => setQRConfig(prev => ({ ...prev, level: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Bajo (7%)</SelectItem>
                  <SelectItem value="M">Medio (15%)</SelectItem>
                  <SelectItem value="Q">Alto (25%)</SelectItem>
                  <SelectItem value="H">Máximo (30%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="qr-bg">Color de Fondo</Label>
              <Input
                id="qr-bg"
                type="color"
                value={qrConfig.bgColor}
                onChange={(e) => setQRConfig(prev => ({ ...prev, bgColor: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="qr-fg">Color del QR</Label>
              <Input
                id="qr-fg"
                type="color"
                value={qrConfig.fgColor}
                onChange={(e) => setQRConfig(prev => ({ ...prev, fgColor: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include-margin"
              checked={qrConfig.includeMargin}
              onChange={(e) => setQRConfig(prev => ({ ...prev, includeMargin: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="include-margin">Incluir margen</Label>
          </div>
        </CardContent>
      </Card>

      {/* Generador */}
      <Card>
        <CardHeader>
          <CardTitle>Generador de Códigos QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2 flex-1">
              <Label htmlFor="table-number-input">Número de Mesa:</Label>
              <Input
                id="table-number-input"
                type="number"
                min="1"
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(parseInt(e.target.value, 10) || 0)}
                placeholder="Ej: 5"
                className="w-28"
              />

              <Button
                onClick={() => generateQR(selectedTable)}
                disabled={isGenerating || tableHasQR(selectedTable)}
              >
                <QrCodeIcon className="h-4 w-4 mr-2" />
                Generar
              </Button>
            </div>

            <Button
              onClick={generateAllQRCodes}
              disabled={isGenerating}
              variant="outline"
            >
              Generar Todos ({maxTables})
            </Button>
          </div>

          {/* Aviso si la mesa ya tiene QR */}
          {tableHasQR(selectedTable) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
              ⚠️ La Mesa {selectedTable} ya tiene un código QR. Elimínalo desde la <strong>Vista Previa</strong> para regenerarlo.
            </div>
          )}

          {/* Vista previa del QR seleccionado */}
          {generatedQRs.find(qr => qr.tableNumber === selectedTable) && (
            <div className="p-4 border rounded-lg">
              <div className="text-center">
                <h3 className="font-semibold mb-4">Vista Previa - Mesa {selectedTable}</h3>
                <div className="inline-block p-4 bg-white rounded-lg border">
                  {renderQRCode(generatedQRs.find(qr => qr.tableNumber === selectedTable)!, qrConfig.size)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {buildQRUrl(selectedTable)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestión de QRs generados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Códigos QR Generados ({generatedQRs.length})</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                Seleccionar Todos
              </Button>
              <Button size="sm" variant="outline" onClick={deselectAll}>
                Deseleccionar
              </Button>
              {selectedQRs.length > 0 && (
                <Button size="sm" onClick={downloadSelected}>
                  Descargar Seleccionados ({selectedQRs.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {generatedQRs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <QrCodeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay códigos QR generados</p>
              <p className="text-sm mt-2">Usa el generador para crear códigos para tus mesas</p>
            </div>
          ) : (
            <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'single' | 'grid' | 'list')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">Individual</TabsTrigger>
                <TabsTrigger value="grid">Cuadrícula</TabsTrigger>
                <TabsTrigger value="list">Lista</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedQRs.map((qr) => (
                    <motion.div
                      key={qr.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`border rounded-lg p-4 space-y-3 ${selectedQRs.includes(qr.id) ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Mesa {qr.tableNumber}</h3>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedQRs.includes(qr.id)}
                            onChange={() => toggleQRSelection(qr.id)}
                            className="rounded"
                          />
                          <Badge variant={qr.isActive ? "default" : "secondary"}>
                            {qr.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </div>

                      <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center p-4">
                        {renderQRCode(qr, 200)}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Creado: {qr.createdAt.toLocaleDateString()}</p>
                        <p className="truncate">{qr.qrUrl}</p>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadQR(qr)}>
                          <Download className="h-3 w-3 mr-1" />
                          PNG
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyQRData(qr)}>
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => shareQR(qr)}>
                          <Share2 className="h-3 w-3 mr-1" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteQR(qr.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="grid">
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {generatedQRs.map((qr) => (
                    <motion.div
                      key={qr.id}
                      whileHover={{ scale: 1.05 }}
                      className={`relative p-3 border rounded-lg cursor-pointer transition-all ${selectedQRs.includes(qr.id) ? 'ring-2 ring-primary border-primary' : 'border-border'
                        }`}
                      onClick={() => toggleQRSelection(qr.id)}
                    >
                      <div className="text-center">
                        <div className="text-sm font-bold mb-1">M{qr.tableNumber}</div>
                        <div className="aspect-square bg-gray-50 rounded mb-1 flex items-center justify-center overflow-hidden">
                          {renderQRCode(qr, 60)}
                        </div>
                        {qr.isActive && (
                          <div className="text-xs text-green-600">✓</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="list">
                <div className="space-y-2">
                  {generatedQRs.map((qr) => (
                    <div
                      key={qr.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${selectedQRs.includes(qr.id) ? 'bg-primary/5 border-primary' : 'border-border'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedQRs.includes(qr.id)}
                          onChange={() => toggleQRSelection(qr.id)}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium">Mesa {qr.tableNumber}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {qr.qrUrl}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadQR(qr)}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteQR(qr.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
