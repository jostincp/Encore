'use client';

import { useEffect, useState } from 'react';
import MusicPage from '@/components/MusicPageSimple';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Simulación de hook de autenticación simple
const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de usuario
    const timer = setTimeout(() => {
      setUser({
        id: 'demo-user-123',
        username: 'Demo User',
        email: 'demo@encore.com',
        token: 'demo-token-123'
      });
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return { user, loading };
};

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
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <p className="text-red-800">
                {error || 'No se pudo cargar la página de música'}
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Acceso Requerido</h1>
            <p className="text-gray-600 mb-4">
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
