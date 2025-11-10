'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  DollarSign,
  Users,
  Music,
  Clock,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Shield,
  Bell,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/ui/back-button';
import { API_ENDPOINTS } from '@/utils/constants';

// Configuración por defecto
const defaultSettings = {
  // Precios y puntos
  pointsRate: 0.01,
  minPurchase: 100,
  maxPurchase: 100000,
  priorityPlayCost: 50,

  // Límites
  maxSongsPerUser: 3,
  maxQueueSize: 100,
  songCooldownMinutes: 30,

  // Políticas
  autoApproveSongs: false,
  allowPriorityPlay: true,
  enablePointsSystem: true,

  // Notificaciones
  emailNotifications: true,
  pushNotifications: true,
  adminAlerts: true,

  // Apariencia
  theme: 'dark',
  language: 'es',

  // Información del bar
  barName: 'Encore Bar',
  barDescription: 'La mejor experiencia musical interactiva',
  contactEmail: 'admin@encore.com',
  contactPhone: '+57 300 123 4567',

  // Horarios
  openingHours: {
    monday: { open: '16:00', close: '02:00', closed: false },
    tuesday: { open: '16:00', close: '02:00', closed: false },
    wednesday: { open: '16:00', close: '02:00', closed: false },
    thursday: { open: '16:00', close: '02:00', closed: false },
    friday: { open: '16:00', close: '04:00', closed: false },
    saturday: { open: '16:00', close: '04:00', closed: false },
    sunday: { open: '16:00', close: '02:00', closed: false }
  }
};

export default function AdminSettings() {
  const { user, setUser } = useAppStore();
  const router = useRouter();
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const allowedRoles = ['admin', 'bar_owner'];

    const normalizeRole = (raw: any) => String(raw)
      .toLowerCase()
      .replace('super_admin', 'admin')
      .replace('member', 'user')
      .replace('customer', 'user');

    const ensureAuthorized = async () => {
      // Si ya hay usuario y rol permitido, cargar settings
      if (user && allowedRoles.includes(String(user.role))) {
        loadSettings();
        return;
      }

      // Intentar cargar perfil con token si no hay usuario
      const token = typeof window !== 'undefined' ? localStorage.getItem('encore_access_token') : null;
      if (!token) {
        router.push('/');
        return;
      }

      try {
        const res = await fetch(`${API_ENDPOINTS.base}/api/auth/profile`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          router.push('/');
          return;
        }

        const u = json?.data || json;
        const normalizedRole = normalizeRole(u?.role ?? 'user');
        setUser({
          id: u?.id,
          email: u?.email,
          role: normalizedRole,
          points: 0
        } as any);

        if (allowedRoles.includes(normalizedRole)) {
          loadSettings();
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    };

    ensureAuthorized();
  }, [user, router, setUser]);

  const loadSettings = () => {
    // Simular carga de configuración desde API
    // En producción, esto vendría de una API
    const savedSettings = localStorage.getItem('encore-admin-settings');
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      // Simular guardado de configuración
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Guardar en localStorage (en producción sería una API)
      localStorage.setItem('encore-admin-settings', JSON.stringify(settings));

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateNestedSetting = (parent: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof typeof prev] as any,
        [key]: value
      }
    }));
  };

  const allowedRoles = ['admin', 'bar_owner'];
  if (!user || !allowedRoles.includes(String(user.role))) return null;

  return (
    <AdminLayout>
      <PageContainer className="px-4 sm:px-6 overflow-x-hidden">
        {/* Botón de retroceso en la esquina superior izquierda */}
        <BackButton />
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 break-words">
              <SettingsIcon className="h-8 w-8 text-primary" />
              Configuración del Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona la configuración general de Encore
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={loadSettings}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </motion.div>

        {/* Save Status */}
        {saveStatus !== 'idle' && (
          <motion.div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              saveStatus === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {saveStatus === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>
              {saveStatus === 'success'
                ? 'Configuración guardada exitosamente'
                : 'Error al guardar la configuración'
              }
            </span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuración de Precios y Puntos */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Precios y Sistema de Puntos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pointsRate">Tasa de Puntos</Label>
                    <Input
                      id="pointsRate"
                      type="number"
                      step="0.01"
                      value={settings.pointsRate}
                      onChange={(e) => updateSetting('pointsRate', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Puntos por peso colombiano
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="priorityPlayCost">Costo Reproducción Prioritaria</Label>
                    <Input
                      id="priorityPlayCost"
                      type="number"
                      value={settings.priorityPlayCost}
                      onChange={(e) => updateSetting('priorityPlayCost', parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Puntos requeridos
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minPurchase">Compra Mínima</Label>
                    <Input
                      id="minPurchase"
                      type="number"
                      value={settings.minPurchase}
                      onChange={(e) => updateSetting('minPurchase', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPurchase">Compra Máxima</Label>
                    <Input
                      id="maxPurchase"
                      type="number"
                      value={settings.maxPurchase}
                      onChange={(e) => updateSetting('maxPurchase', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enablePointsSystem">Sistema de Puntos</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar acumulación y canje de puntos
                    </p>
                  </div>
                  <Switch
                    id="enablePointsSystem"
                    checked={settings.enablePointsSystem}
                    onCheckedChange={(checked) => updateSetting('enablePointsSystem', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Límites y Políticas */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Límites y Políticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxSongsPerUser">Máx. Canciones por Usuario</Label>
                    <Input
                      id="maxSongsPerUser"
                      type="number"
                      value={settings.maxSongsPerUser}
                      onChange={(e) => updateSetting('maxSongsPerUser', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxQueueSize">Tamaño Máx. de Cola</Label>
                    <Input
                      id="maxQueueSize"
                      type="number"
                      value={settings.maxQueueSize}
                      onChange={(e) => updateSetting('maxQueueSize', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="songCooldownMinutes">Tiempo de Enfriamiento</Label>
                  <Input
                    id="songCooldownMinutes"
                    type="number"
                    value={settings.songCooldownMinutes}
                    onChange={(e) => updateSetting('songCooldownMinutes', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minutos entre reproducciones de la misma canción
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="autoApproveSongs">Aprobación Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Aprobar canciones automáticamente
                      </p>
                    </div>
                    <Switch
                      id="autoApproveSongs"
                      checked={settings.autoApproveSongs}
                      onCheckedChange={(checked) => updateSetting('autoApproveSongs', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowPriorityPlay">Reproducción Prioritaria</Label>
                      <p className="text-sm text-muted-foreground">
                        Permitir pago por prioridad en cola
                      </p>
                    </div>
                    <Switch
                      id="allowPriorityPlay"
                      checked={settings.allowPriorityPlay}
                      onCheckedChange={(checked) => updateSetting('allowPriorityPlay', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Información del Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Información del Bar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="barName">Nombre del Bar</Label>
                  <Input
                    id="barName"
                    value={settings.barName}
                    onChange={(e) => updateSetting('barName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="barDescription">Descripción</Label>
                  <Textarea
                    id="barDescription"
                    value={settings.barDescription}
                    onChange={(e) => updateSetting('barDescription', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Email de Contacto</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => updateSetting('contactEmail', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Teléfono</Label>
                    <Input
                      id="contactPhone"
                      value={settings.contactPhone}
                      onChange={(e) => updateSetting('contactPhone', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notificaciones y Apariencia */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificaciones y Apariencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="emailNotifications">Notificaciones por Email</Label>
                      <p className="text-sm text-muted-foreground">
                        Recibir alertas por correo electrónico
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="pushNotifications">Notificaciones Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Notificaciones en tiempo real
                      </p>
                    </div>
                    <Switch
                      id="pushNotifications"
                      checked={settings.pushNotifications}
                      onCheckedChange={(checked) => updateSetting('pushNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="adminAlerts">Alertas de Administrador</Label>
                      <p className="text-sm text-muted-foreground">
                        Alertas críticas del sistema
                      </p>
                    </div>
                    <Switch
                      id="adminAlerts"
                      checked={settings.adminAlerts}
                      onCheckedChange={(checked) => updateSetting('adminAlerts', checked)}
                    />
                  </div>
                </div>

                <div className="border-t border-border my-6" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="theme">Tema</Label>
                    <select
                      id="theme"
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                      value={settings.theme}
                      onChange={(e) => updateSetting('theme', e.target.value)}
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Oscuro</option>
                      <option value="auto">Automático</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="language">Idioma</Label>
                    <select
                      id="language"
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                      value={settings.language}
                      onChange={(e) => updateSetting('language', e.target.value)}
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Horarios de Atención */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horarios de Atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(settings.openingHours).map(([day, hours]) => (
                  <div key={day} className="space-y-2">
                    <Label className="capitalize font-medium">
                      {day === 'monday' && 'Lunes'}
                      {day === 'tuesday' && 'Martes'}
                      {day === 'wednesday' && 'Miércoles'}
                      {day === 'thursday' && 'Jueves'}
                      {day === 'friday' && 'Viernes'}
                      {day === 'saturday' && 'Sábado'}
                      {day === 'sunday' && 'Domingo'}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hours.open}
                        onChange={(e) => updateNestedSetting('openingHours', `${day}.open`, e.target.value)}
                        disabled={hours.closed}
                      />
                      <span>a</span>
                      <Input
                        type="time"
                        value={hours.close}
                        onChange={(e) => updateNestedSetting('openingHours', `${day}.close`, e.target.value)}
                        disabled={hours.closed}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!hours.closed}
                        onCheckedChange={(checked) => updateNestedSetting('openingHours', `${day}.closed`, !checked)}
                      />
                      <Label className="text-sm">
                        {hours.closed ? 'Cerrado' : 'Abierto'}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </AdminLayout>
  );
}