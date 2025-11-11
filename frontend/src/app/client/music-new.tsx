'use client';

import { useEffect, useState } from 'react';
import MusicPage from '@/components/MusicPage';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function MusicClientPage() {
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar que el usuario esté autenticado
    if (!loading && !user) {
      setError('Debes estar autenticado para acceder a la música');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'No se pudo cargar la página de música'}
            </AlertDescription>
          </Alert>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Acceso Requerido</h1>
            <p className="text-muted-foreground mb-4">
              Necesitas iniciar sesión para acceder a la rockola digital
            </p>
            <Button onClick={() => window.location.href = '/auth/login'}>
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Datos simulados del bar y puntos del usuario
  // En producción, estos datos vendrían de la API
  const mockBarId = 'demo-bar-123';
  const mockUserPoints = 1000;

  return (
    <MusicPage
      barId={mockBarId}
      userToken={user.token || ''}
      userName={user.username || user.email || 'Usuario'}
      userPoints={mockUserPoints}
    />
  );
}
