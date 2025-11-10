'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useToast } from '@/hooks/useToast';
import { motion } from 'framer-motion';
import { Mail, Lock, Shield } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/constants';
import { getLoginErrorMessage, getLoginSuggestion } from '@/utils/authErrors';
import { useAppStore } from '@/stores/useAppStore';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { success } = useToast();
  const { setUser } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Comprobación rápida de disponibilidad del servicio (health)
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 5000);
      // Probar ambos paths según si se usa Kong (8000) o servicio directo (3001)
      const tryHealth = async (path: string) => {
        try {
          const r = await fetch(`${API_ENDPOINTS.base}${path}`, {
            method: 'GET',
            signal: healthController.signal,
            headers: { 'Accept': 'application/json' }
          });
          return r.ok;
        } catch {
          return false;
        }
      };
      const healthOk = await (async () => {
        // Primero intentar ruta común en Kong
        if (await tryHealth('/api/auth/health')) return true;
        // Luego intentar health directo del servicio
        if (await tryHealth('/health')) return true;
        // Finalmente intentar health bajo /api
        if (await tryHealth('/api/health')) return true;
        return false;
      })();
      clearTimeout(healthTimeout);

      if (!healthOk) {
        setError(getLoginErrorMessage({ status: 0, message: 'Service unavailable' }));
        return;
      }

      // Timeout para evitar esperas indefinidas en la solicitud de login
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      // API_ENDPOINTS.base ahora no incluye /api
      const res = await fetch(`${API_ENDPOINTS.base}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiErr = { status: res.status, message: data?.message || data?.error };
        setError(getLoginErrorMessage(apiErr));
        return;
      }

      // Backend devuelve { token, refreshToken, user }, pero hacemos fallback por si cambia
      const accessToken = data?.token || data?.accessToken || data?.data?.token;
      const refreshToken = data?.refreshToken || data?.data?.refreshToken;
      const user = data?.user || data?.data?.user;

      if (typeof window !== 'undefined' && accessToken) {
        localStorage.setItem('encore_access_token', accessToken);
        if (refreshToken) localStorage.setItem('encore_refresh_token', refreshToken);
      }

      // Guardar usuario en el store para permisos y renderizado
      if (user) {
        const rawRole = user.role ?? 'user';
        const normalizedRole = String(rawRole)
          .toLowerCase()
          .replace('super_admin', 'admin')
          .replace('member', 'user')
          .replace('customer', 'user');

        setUser({
          id: user.id,
          email: user.email,
          role: normalizedRole,
          points: 0
        } as any);
      }

      success('Inicio de sesión exitoso. Bienvenido de nuevo');
      // Redirección robusta a /admin
      const navigateToAdmin = () => {
        try {
          // Usar replace para evitar problemas de navegación en desarrollo
          router.replace('/admin');
        } catch {}
        // Fallback duro si la navegación del router se aborta por HMR u otros motivos
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname.includes('/auth/login')) {
            window.location.href = '/admin';
          }
        }, 300);
      };
      navigateToAdmin();
    } catch (err: any) {
      // Mapear abort/timeout y errores de red claramente
      if (err?.name === 'AbortError') {
        setError('Tiempo de espera agotado al conectar con el servidor. Intente nuevamente.');
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout background="gradient" animate>
      <PageContainer className="min-h-screen p-4">
        <motion.div
          className="max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Iniciar sesión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="space-y-1">
                    <p className="text-destructive text-sm">{error}</p>
                    <p className="text-muted-foreground text-xs">
                      {getLoginSuggestion(error) || '¿Olvidó su contraseña?'}
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Ingresando…' : 'Entrar'}
                </Button>
                <div className="text-center">
                  <Link href="/auth/forgot-password" className="text-sm text-primary">
                    Olvidé mi contraseña
                  </Link>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push('/auth/register-bar-owner')}
                >
                  ¿No tienes cuenta? Crear cuenta de Propietario
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}