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
import { Mail, Shield } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/constants';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { success } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_ENDPOINTS.base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || 'Error al solicitar recuperación';
        setError(msg);
        return;
      }

      setSuccessMsg(data?.message || 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
      success('Solicitud enviada. Revisa tu correo');
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
                Recuperar contraseña
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

                {error && (
                  <p className="text-destructive text-sm">{error}</p>
                )}

                {successMsg && (
                  <p className="text-green-600 text-sm">{successMsg}</p>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Enviando…' : 'Enviar instrucciones'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push('/auth/login')}
                >
                  Volver al login
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}