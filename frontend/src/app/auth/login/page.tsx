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
      const res = await fetch(`${API_ENDPOINTS.base}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || data?.data?.message || 'Error al iniciar sesión';
        setError(msg);
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
        setUser({
          id: user.id,
          email: user.email,
          role: user.role,
          points: 0
        } as any);
      }

      success('Inicio de sesión exitoso. Bienvenido de nuevo');
      router.push('/admin');
    } catch (err: any) {
      setError(err?.message || 'Error de red');
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
                  <p className="text-destructive text-sm">{error}</p>
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