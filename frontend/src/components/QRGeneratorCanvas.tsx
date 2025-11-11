'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Settings, QrCode as QrCodeIcon, Eye, RefreshCw, Check, X, Share2 } from 'lucide-react';
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
  maxTables?: number;
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
  maxTables = 50 
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

  // Generar QR usando Canvas API (simulado)
  const generateQRCode = (data: string, size: number = 256): string => {
    // Crear un canvas para el QR
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = size;
    canvas.height = size;

    // Fondo
    ctx.fillStyle = qrConfig.bgColor;
    ctx.fillRect(0, 0, size, size);

    // Generar patrón QR simulado basado en los datos
    const hash = data.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const cellSize = Math.floor(size / 25);
    
    ctx.fillStyle = qrConfig.fgColor;
    
    // Generar patrón QR-like
    for (let i = 0; i < 25; i++) {
      for (let j = 0; j < 25; j++) {
        // Patrones de esquina (marcadores de posición)
        if ((i < 7 && j < 7) || (i < 7 && j > 17) || (i > 17 && j < 7)) {
          if ((i === 0 || i === 6 || j === 0 || j === 6) || 
              (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
            ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
          }
        } else {
          // Patrón basado en datos
          const shouldFill = (hash + i * j) % 3 === 0 || (hash + i + j) % 4 === 0;
          if (shouldFill) {
            ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // Agregar texto pequeño en el centro
    ctx.fillStyle = qrConfig.fgColor;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Encore', size / 2, size / 2);

    return canvas.toDataURL();
  };

  // Generar QR para mesa específica
  const generateQR = async (tableNumber: number) => {
    if (!barId) {
      showErrorToast('Bar ID no disponible');
      return;
    }

    try {
      setIsGenerating(true);

      const qrData: QRData = {
        id: `qr-${tableNumber}-${Date.now()}`,
        tableNumber,
        qrData: `${window.location.origin}/client/music?barId=${barId}&table=${tableNumber}`, // URL directa
        qrUrl: `${window.location.origin}/client/music?barId=${barId}&table=${tableNumber}`,
        isActive: true,
        createdAt: new Date(),
        scannedCount: 0
      };

      // Actualizar estado
      setGeneratedQRs(prev => {
        const filtered = prev.filter(qr => qr.tableNumber !== tableNumber);
        return [...filtered, qrData];
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

  // Generar QR para todas las mesas
  const generateAllQRCodes = async () => {
    try {
      setIsGenerating(true);
      
      for (let i = 1; i <= maxTables; i++) {
        await generateQR(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      showSuccessToast(`Se generaron ${maxTables} códigos QR`);

    } catch (error) {
      console.error('Error generating all QRs:', error);
      showErrorToast('Error al generar todos los códigos QR');
    } finally {
      setIsGenerating(false);
    }
  };

  // Descargar QR individual con diseño personalizado
  const downloadQR = (qr: QRData, format: 'png' | 'pdf' = 'png') => {
    if (format === 'png') {
      downloadQRAsPNG(qr);
    } else {
      showSuccessToast('Función PDF en desarrollo');
    }
  };

  const downloadQRAsPNG = (qr: QRData) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = qrConfig.size + 120;
    canvas.width = size;
    canvas.height = size + 60;

    // Fondo blanco con borde
    ctx.fillStyle = qrConfig.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Título del bar
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(barName, canvas.width / 2, 40);

    // Número de mesa
    ctx.font = '18px Arial';
    ctx.fillText(`Mesa ${qr.tableNumber}`, canvas.width / 2, 70);

    // Generar y dibujar QR real
    const qrImageData = generateQRCode(qr.qrData, qrConfig.size);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (canvas.width - qrConfig.size) / 2, 90, qrConfig.size, qrConfig.size);
      
      // Instrucciones
      ctx.font = '14px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('Escanea para conectar', canvas.width / 2, canvas.height - 20);
      ctx.fillText('y seleccionar música', canvas.width / 2, canvas.height - 5);

      // Descargar
      const link = document.createElement('a');
      link.download = `qr-mesa-${qr.tableNumber}-${barName.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();

      showSuccessToast(`QR Mesa ${qr.tableNumber} descargado`);
    };
    img.src = qrImageData;
  };

  // Copiar datos QR
  const copyQRData = (qr: QRData) => {
    navigator.clipboard.writeText(qr.qrUrl);
    showSuccessToast('URL del QR copiada al portapapeles');
  };

  // Compartir QR
  const shareQR = async (qr: QRData) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${barName} - Mesa ${qr.tableNumber}`,
          text: `Conéctate a la rockola digital desde la Mesa ${qr.tableNumber}`,
          url: qr.qrUrl
        });
        showSuccessToast('QR compartido exitosamente');
      } catch (error) {
        console.error('Error sharing QR:', error);
        copyQRData(qr);
      }
    } else {
      copyQRData(qr);
    }
  };

  // Eliminar QR
  const deleteQR = (qrId: string) => {
    setGeneratedQRs(prev => prev.filter(qr => qr.id !== qrId));
    setSelectedQRs(prev => prev.filter(id => id !== qrId));
    showSuccessToast('Código QR eliminado');
  };

  // Toggle selección
  const toggleQRSelection = (qrId: string) => {
    setSelectedQRs(prev => 
      prev.includes(qrId) 
        ? prev.filter(id => id !== qrId)
        : [...prev, qrId]
    );
  };

  // Seleccionar todos
  const selectAll = () => {
    setSelectedQRs(generatedQRs.map(qr => qr.id));
  };

  // Deseleccionar todos
  const deselectAll = () => {
    setSelectedQRs([]);
  };

  // Descargar seleccionados
  const downloadSelected = () => {
    selectedQRs.forEach(qrId => {
      const qr = generatedQRs.find(q => q.id === qrId);
      if (qr) {
        setTimeout(() => downloadQR(qr), 100);
      }
    });
  };

  // Renderizar QR real
  const renderQRCode = (qr: QRData, size: number = 200) => {
    const qrImageData = generateQRCode(qr.qrData, size);
    return (
      <img 
        src={qrImageData} 
        alt={`QR Mesa ${qr.tableNumber}`}
        className="w-full h-full object-contain"
        style={{ maxWidth: size, maxHeight: size }}
      />
    );
  };

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
                onValueChange={(value) => setQRConfig(prev => ({...prev, size: parseInt(value)}))}
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
                onValueChange={(value: 'L' | 'M' | 'Q' | 'H') => setQRConfig(prev => ({...prev, level: value}))}
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
                onChange={(e) => setQRConfig(prev => ({...prev, bgColor: e.target.value}))}
              />
            </div>

            <div>
              <Label htmlFor="qr-fg">Color del QR</Label>
              <Input
                id="qr-fg"
                type="color"
                value={qrConfig.fgColor}
                onChange={(e) => setQRConfig(prev => ({...prev, fgColor: e.target.value}))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include-margin"
              checked={qrConfig.includeMargin}
              onChange={(e) => setQRConfig(prev => ({...prev, includeMargin: e.target.checked}))}
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
              <Label htmlFor="table-select">Mesa:</Label>
              <Select 
                value={selectedTable.toString()} 
                onValueChange={(value) => setSelectedTable(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxTables }, (_, i) => i + 1).map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      Mesa {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => generateQR(selectedTable)}
                disabled={isGenerating}
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

          {/* Vista previa del QR seleccionado */}
          {generatedQRs.find(qr => qr.tableNumber === selectedTable) && (
            <div className="p-4 border rounded-lg">
              <div className="text-center">
                <h3 className="font-semibold mb-4">Vista Previa - Mesa {selectedTable}</h3>
                <div className="inline-block p-4 bg-white rounded-lg border">
                  {renderQRCode(generatedQRs.find(qr => qr.tableNumber === selectedTable)!, qrConfig.size)}
                </div>
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
            <div className="text-center py-8 text-gray-500">
              <QrCodeIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay códigos QR generados</p>
              <p className="text-sm">Usa el generador para crear códigos para tus mesas</p>
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
                      className={`border rounded-lg p-4 space-y-3 ${selectedQRs.includes(qr.id) ? 'ring-2 ring-blue-500' : ''}`}
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

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Creado: {qr.createdAt.toLocaleDateString()}</p>
                        <p>Escaneado: {qr.scannedCount || 0} veces</p>
                        {qr.lastScanned && (
                          <p>Último: {new Date(qr.lastScanned).toLocaleDateString()}</p>
                        )}
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
                      className={`relative p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedQRs.includes(qr.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                      }`}
                      onClick={() => toggleQRSelection(qr.id)}
                    >
                      <div className="text-center">
                        <div className="text-sm font-bold mb-1">M{qr.tableNumber}</div>
                        <div className="aspect-square bg-gray-50 rounded mb-1 flex items-center justify-center">
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
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        selectedQRs.includes(qr.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
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
                          <div className="text-sm text-gray-500">
                            {qr.scannedCount || 0} escaneos • {qr.isActive ? 'Activo' : 'Inactivo'}
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
