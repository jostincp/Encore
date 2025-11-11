'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Copy, Settings, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';

interface QRGeneratorProps {
  barId: string;
  onGenerate?: (tableNumber: number, qrData: string) => void;
}

export default function QRGenerator({ barId, onGenerate }: QRGeneratorProps) {
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [qrSize, setQrSize] = useState<number>(256);
  const [generatedQR, setGeneratedQR] = useState<string>('');
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Generar el código QR con los parámetros del bar y mesa
  const generateQR = () => {
    if (!barId) {
      showErrorToast('Bar ID no disponible');
      return;
    }

    const qrData = JSON.stringify({
      b: barId, // barId
      t: tableNumber, // tableNumber
      v: '1.0', // versión del formato
      ts: Date.now() // timestamp para hacerlo único
    });

    setGeneratedQR(qrData);
    onGenerate?.(tableNumber, qrData);
    showSuccessToast(`Código QR generado para Mesa ${tableNumber}`);
  };

  const downloadQR = () => {
    if (!generatedQR) {
      showErrorToast('Primero genera un código QR');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crear un canvas con el QR y el texto
    canvas.width = qrSize + 40;
    canvas.height = qrSize + 100;
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar el QR code
    const qrCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 20, 20, qrSize, qrSize);
    }

    // Agregar texto
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Mesa ${tableNumber}`, canvas.width / 2, qrSize + 50);
    ctx.font = '12px Arial';
    ctx.fillText(`Bar ID: ${barId}`, canvas.width / 2, qrSize + 70);

    // Descargar
    const link = document.createElement('a');
    link.download = `qr-mesa-${tableNumber}.png`;
    link.href = canvas.toDataURL();
    link.click();

    showSuccessToast('Código QR descargado');
  };

  const copyQRData = () => {
    if (!generatedQR) {
      showErrorToast('Primero genera un código QR');
      return;
    }

    navigator.clipboard.writeText(generatedQR);
    showSuccessToast('Datos del QR copiados al portapapeles');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Generador de Códigos QR por Mesa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuración */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="table-number">Número de Mesa</Label>
            <Input
              id="table-number"
              type="number"
              min="1"
              max="99"
              value={tableNumber}
              onChange={(e) => setTableNumber(parseInt(e.target.value) || 1)}
              placeholder="Ej: 5"
            />
          </div>
          <div>
            <Label htmlFor="qr-size">Tamaño del QR</Label>
            <Select value={qrSize.toString()} onValueChange={(value) => setQrSize(parseInt(value))}>
              <SelectTrigger id="qr-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">Pequeño (128x128)</SelectItem>
                <SelectItem value="256">Mediano (256x256)</SelectItem>
                <SelectItem value="384">Grande (384x384)</SelectItem>
                <SelectItem value="512">Extra Grande (512x512)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botón de generar */}
        <Button onClick={generateQR} className="w-full">
          <QrCode className="h-4 w-4 mr-2" />
          Generar Código QR
        </Button>

        {/* Vista previa del QR */}
        {generatedQR && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="text-center">
              <div className="inline-block p-4 bg-white rounded-lg border">
                <QRCodeSVG
                  value={generatedQR}
                  size={qrSize}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Mesa {tableNumber} - Bar {barId}
              </p>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadQR} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              <Button variant="outline" onClick={copyQRData} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copiar Datos
              </Button>
            </div>

            {/* Información del QR */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Datos del QR:</p>
              <p className="text-xs font-mono break-all">{generatedQR}</p>
            </div>
          </motion.div>
        )}

        {/* Instrucciones */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Cada código QR es único y contiene el ID del bar y número de mesa</p>
          <p>• Los clientes pueden escanear el QR para conectarse automáticamente</p>
          <p>• Imprime y coloca los códigos QR en cada mesa de tu bar</p>
        </div>
      </CardContent>
    </Card>
  );
}