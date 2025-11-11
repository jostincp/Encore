'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Settings, Download, Eye, BarChart3, Users, Scan, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QRGeneratorCanvas from '@/components/QRGeneratorCanvas';

export default function QRDemoPage() {
  const [activeTab, setActiveTab] = useState('generator');
  const [stats, setStats] = useState({
    totalQRCodes: 0,
    activeQRCodes: 0,
    totalScans: 0,
    connectedUsers: 0
  });

  // Simular stats
  const updateStats = (totalQRCodes: number, activeQRCodes: number) => {
    setStats({
      totalQRCodes,
      activeQRCodes,
      totalScans: Math.floor(Math.random() * 1000),
      connectedUsers: Math.floor(Math.random() * 50)
    });
  };

  const handleQRGenerated = (tableNumber: number, qrData: any) => {
    console.log(`QR generated for table ${tableNumber}:`, qrData);
    // Actualizar stats
    updateStats(stats.totalQRCodes + 1, stats.activeQRCodes + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center mb-4"
          >
            <QrCode className="h-12 w-12 text-blue-600 mr-4" />
            <h1 className="text-4xl font-bold text-gray-900">
              Sistema de Códigos QR Encore
            </h1>
          </motion.div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Genera y gestiona códigos QR únicos para cada mesa de tu establecimiento. 
            Permite que tus clientes se conecten instantáneamente a la rockola digital.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <QrCode className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total QRs</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalQRCodes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Activos</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.activeQRCodes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <Scan className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Escaneos</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalScans}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Conectados</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.connectedUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generator">Generador</TabsTrigger>
            <TabsTrigger value="features">Características</TabsTrigger>
            <TabsTrigger value="workflow">Flujo de Trabajo</TabsTrigger>
            <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="space-y-6">
            <QRGeneratorCanvas 
              barId="demo-bar-123"
              barName="Encore Demo Bar"
              onGenerate={handleQRGenerated}
              maxTables={20}
            />
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-blue-600" />
                      Códigos Únicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Cada mesa tiene un código QR único con información del bar y número de mesa.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Identificación única por mesa</li>
                      <li>• Datos encriptados y seguros</li>
                      <li>• Configuración personalizable</li>
                      <li>• Validación automática</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-green-600" />
                      Conexión Instantánea
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Los clientes se conectan automáticamente al escanear el código QR.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Escaneo y conexión en 2 segundos</li>
                      <li>• Sin necesidad de registro inicial</li>
                      <li>• Acceso como usuario GUEST</li>
                      <li>• Opción de upgrade a USER</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      Analíticas en Tiempo Real
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Monitorea el uso de códigos QR y métricas de conexión.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Conteo de escaneos por mesa</li>
                      <li>• Tiempo de conexión</li>
                      <li>• Tasa de conversión</li>
                      <li>• Reportes detallados</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-orange-600" />
                      Descarga Múltiple
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Descarga códigos QR en múltiples formatos para impresión.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• PNG en alta resolución</li>
                      <li>• PDF para impresión profesional</li>
                      <li>• Descarga individual o batch</li>
                      <li>• Plantillas personalizadas</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-red-600" />
                      Gestión Avanzada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Control total sobre la configuración y estado de los códigos.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Activar/desactivar códigos</li>
                      <li>• Regenerar códigos</li>
                      <li>• Personalizar diseño</li>
                      <li>• Control de acceso</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-indigo-600" />
                      Vista Previa
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Previsualiza los códigos antes de generarlos o imprimirlos.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Vista previa en tiempo real</li>
                      <li>• Múltiples tamaños</li>
                      <li>• Personalización de colores</li>
                      <li>• Simulación de impresión</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Flujo de Trabajo del Sistema QR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Paso 1 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        1
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Configuración del Bar</h3>
                      <p className="text-gray-600 mb-3">
                        El administrador configura el bar, número de mesas y preferencias de QR.
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-mono">POST /api/bars/my</p>
                        <p className="text-sm text-gray-600">Configurar nombre, mesas, prefijo QR</p>
                      </div>
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        2
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Generación de Códigos</h3>
                      <p className="text-gray-600 mb-3">
                        El sistema genera códigos QR únicos para cada mesa con datos encriptados.
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-mono">POST /api/bars/my/qrcodes</p>
                        <p className="text-sm text-gray-600">Generar QR individual o batch</p>
                      </div>
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        3
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Impresión y Despliegue</h3>
                      <p className="text-gray-600 mb-3">
                        Descarga los códigos en PNG/PDF e imprímelos para colocar en cada mesa.
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-mono">GET /api/bars/my/qrcodes/download</p>
                        <p className="text-sm text-gray-600">Descargar individual o batch</p>
                      </div>
                    </div>
                  </div>

                  {/* Paso 4 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        4
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Escaneo del Cliente</h3>
                      <p className="text-gray-600 mb-3">
                        El cliente escanea el QR y se conecta automáticamente como GUEST.
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-mono">GET /client?b=barId&t=tableNumber</p>
                        <p className="text-sm text-gray-600">Redirección automática</p>
                      </div>
                    </div>
                  </div>

                  {/* Paso 5 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                        5
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Rockola Digital</h3>
                      <p className="text-gray-600 mb-3">
                        El cliente accede a la rockola, busca música y agrega canciones a la cola.
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-mono">WebSocket: /queue</p>
                        <p className="text-sm text-gray-600">Tiempo real y gamificación</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Estadísticas de Uso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Total de Escaneos Hoy</span>
                      <Badge variant="secondary">156</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Mesa Más Popular</span>
                      <Badge variant="secondary">Mesa 5</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Tasa de Conversión</span>
                      <Badge variant="secondary">23%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Tiempo Promedio de Conexión</span>
                      <Badge variant="secondary">2.3s</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scan className="h-5 w-5" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { table: 5, time: 'Hace 2 minutos', action: 'Cliente conectado' },
                      { table: 3, time: 'Hace 5 minutos', action: 'Cliente conectado' },
                      { table: 8, time: 'Hace 8 minutos', action: 'Cliente conectado' },
                      { table: 12, time: 'Hace 12 minutos', action: 'Cliente conectado' },
                      { table: 5, time: 'Hace 15 minutos', action: 'Cliente desconectado' }
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">Mesa {activity.table}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">{activity.action}</p>
                          <p className="text-xs text-gray-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            💡 Cómo Probar el Sistema QR
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Generación de Códigos:</h4>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Ve a la pestaña "Generador"</li>
                <li>Selecciona una mesa o genera todos los códigos</li>
                <li>Personaliza el diseño (tamaño, colores, etc.)</li>
                <li>Descarga los códigos en PNG o PDF</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">Simulación de Cliente:</h4>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Usa tu teléfono para escanear un QR generado</li>
                <li>O accede manualmente: /client?b=demo-bar-123&t=5</li>
                <li>Verás la rockola digital conectada a la mesa</li>
                <li>Prueba buscar y agregar canciones</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
