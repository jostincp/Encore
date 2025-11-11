'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  QrCode, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Layout, PageContainer } from '@/components/ui/layout';

interface QRCodeData {
  tableNumber: number;
  qrCodeDataURL: string;
  url: string;
  barId: string;
  generatedAt: string;
}

export default function QRGeneratorPage() {
  const [numberOfTables, setNumberOfTables] = useState(10);
  const [baseUrl, setBaseUrl] = useState('https://encoreapp.pro');
  const [qrWidth, setQrWidth] = useState(300);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const response = await fetch('http://localhost:3001/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          numberOfTables,
          baseUrl,
          width: qrWidth,
          errorCorrectionLevel: 'M'
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al generar QR codes');
      }

      setQrCodes(data.qrCodes);
      setSuccess(`${data.totalQRCodes} códigos QR generados exitosamente`);
      
    } catch (error) {
      console.error('Error generando QR codes:', error);
      setError(error instanceof Error ? error.message : 'Error al generar códigos QR');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSingle = async (tableNumber: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const response = await fetch('http://localhost:3001/api/qr/generate-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          tableNumber,
          baseUrl
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al generar QR code');
      }

      // Agregar el QR individual a la lista
      setQrCodes(prev => [...prev.filter(qr => qr.tableNumber !== tableNumber), data]);
      setSuccess(`QR code para mesa ${tableNumber} generado exitosamente`);
      
    } catch (error) {
      console.error('Error generando QR code individual:', error);
      setError(error instanceof Error ? error.message : 'Error al generar código QR');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const response = await fetch('http://localhost:3001/api/qr/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          numberOfTables,
          baseUrl,
          width: 600 // Más grande para impresión
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar descarga');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `encore-qr-codes-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSuccess('ZIP descargado exitosamente');
      
    } catch (error) {
      console.error('Error descargando QR codes:', error);
      setError(error instanceof Error ? error.message : 'Error al descargar códigos QR');
    } finally {
      setDownloading(false);
    }
  };

  const downloadSingleQR = (qrCode: QRCodeData) => {
    const a = document.createElement('a');
    a.href = qrCode.qrCodeDataURL;
    a.download = `mesa-${qrCode.tableNumber}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Layout background="light" animate>
      <PageContainer className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-lg">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Generador de Códigos QR</h1>
              <p className="text-muted-foreground">
                Crea códigos QR personalizados para las mesas de tu bar
              </p>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuración
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="numberOfTables">Número de mesas</Label>
                    <Input
                      id="numberOfTables"
                      type="number"
                      min="1"
                      max="100"
                      value={numberOfTables}
                      onChange={(e) => setNumberOfTables(parseInt(e.target.value) || 1)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Entre 1 y 100 mesas
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="baseUrl">URL Base</Label>
                    <Input
                      id="baseUrl"
                      type="url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://encoreapp.pro"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      URL donde se redirigirá el QR
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="qrWidth">Tamaño del QR (px)</Label>
                    <Input
                      id="qrWidth"
                      type="number"
                      min="100"
                      max="1000"
                      value={qrWidth}
                      onChange={(e) => setQrWidth(parseInt(e.target.value) || 300)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      300px para web, 600px para impresión
                    </p>
                  </div>

                  <div className="space-y-3 pt-4">
                    <Button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <QrCode className="h-4 w-4 mr-2" />
                          Generar Todos los QR
                        </>
                      )}
                    </Button>

                    {qrCodes.length > 0 && (
                      <Button
                        onClick={handleDownload}
                        disabled={downloading}
                        variant="outline"
                        className="w-full"
                      >
                        {downloading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Descargando...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Descargar Todos (ZIP)
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* URL Preview */}
              {qrCodes.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Vista Previa de URL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-sm break-all">
                        {baseUrl}/client/music?barId=UUID-DEL-BAR&table=1
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Esta URL se generará para cada mesa con su número correspondiente
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* QR Codes Display */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Códigos QR Generados
                    </span>
                    {qrCodes.length > 0 && (
                      <Badge variant="secondary">
                        {qrCodes.length} QR codes
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {qrCodes.length === 0 ? (
                    <div className="text-center py-12">
                      <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No hay códigos QR generados
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Configura las opciones y haz clic en "Generar Todos los QR"
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto">
                        {[1, 2, 3].map((tableNum) => (
                          <Button
                            key={tableNum}
                            onClick={() => handleGenerateSingle(tableNum)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            Mesa {tableNum}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Tabs defaultValue="grid" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="grid">Vista Cuadrícula</TabsTrigger>
                        <TabsTrigger value="list">Vista Lista</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="grid" className="mt-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                          {qrCodes.map((qr) => (
                            <motion.div
                              key={qr.tableNumber}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="border rounded-lg p-3 text-center hover:shadow-md transition-shadow"
                            >
                              <h4 className="font-semibold mb-2">Mesa {qr.tableNumber}</h4>
                              <img 
                                src={qr.qrCodeDataURL} 
                                alt={`QR Mesa ${qr.tableNumber}`} 
                                className="w-full max-w-[150px] mx-auto mb-2 rounded"
                              />
                              <Button
                                onClick={() => downloadSingleQR(qr)}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Descargar
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="list" className="mt-4">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {qrCodes.map((qr) => (
                            <motion.div
                              key={qr.tableNumber}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <img 
                                  src={qr.qrCodeDataURL} 
                                  alt={`QR Mesa ${qr.tableNumber}`} 
                                  className="w-12 h-12 rounded"
                                />
                                <div>
                                  <h4 className="font-semibold">Mesa {qr.tableNumber}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Generado: {new Date(qr.generatedAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => downloadSingleQR(qr)}
                                variant="outline"
                                size="sm"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                PNG
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}
