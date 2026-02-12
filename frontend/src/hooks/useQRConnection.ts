import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from '@/hooks/useToast';

/**
 * Hook para gestionar la conexión QR del cliente con un bar.
 * Lee barId y table de URL params, cookies o localStorage.
 */
export function useQRConnection() {
  const { connectToBar, disconnectFromBar, barId, tableNumber } = useAppStore();
  const { success: showSuccess, error: showError } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const hasCheckedRef = useRef(false);

  // Detectar parámetros QR desde URL o cookies (solo una vez)
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkQRConnection = async () => {
      // Si ya está conectado, no reconectar
      if (barId && tableNumber) {
        setIsConnected(true);
        return;
      }

      // Obtener parámetros desde URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlBarId = urlParams.get('barId');
      const urlTableNumber = urlParams.get('table');

      // Obtener parámetros desde cookies
      const cookies = document.cookie.split(';');
      const cookieBarId = cookies.find(c => c.trim().startsWith('encore_bar_id='))?.split('=')[1];
      const cookieTableNumber = cookies.find(c => c.trim().startsWith('encore_table_number='))?.split('=')[1];

      // Obtener parámetros desde localStorage
      const storedBarId = localStorage.getItem('encore_bar_id');
      const storedTableNumber = localStorage.getItem('encore_table_number');

      // Prioridad: URL > cookies > localStorage
      const finalBarId = urlBarId || cookieBarId || storedBarId;
      const finalTableNumber = urlTableNumber || cookieTableNumber || storedTableNumber;

      if (finalBarId && finalTableNumber) {
        try {
          setIsConnecting(true);
          await connectToBar(finalBarId, parseInt(finalTableNumber));
          setIsConnected(true);
          showSuccess(`Conectado al bar (Mesa ${finalTableNumber})`);

          // Guardar en localStorage para persistencia
          localStorage.setItem('encore_bar_id', finalBarId);
          localStorage.setItem('encore_table_number', finalTableNumber);
        } catch (error) {
          setIsConnected(false);
          showError('Error al conectar con el bar');
          console.error('QR Connection error:', error);
        } finally {
          setIsConnecting(false);
        }
      }
    };

    checkQRConnection();
  }, [connectToBar, showSuccess, showError, barId, tableNumber]);

  const disconnect = () => {
    disconnectFromBar();
    setIsConnected(false);
    hasCheckedRef.current = false;

    // Limpiar almacenamiento
    localStorage.removeItem('encore_bar_id');
    localStorage.removeItem('encore_table_number');

    // Limpiar cookies
    document.cookie = 'encore_bar_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'encore_table_number=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    showSuccess('Desconectado del bar');
  };

  const connectManually = async (manualBarId: string, manualTableNumber: number) => {
    try {
      setIsConnecting(true);
      await connectToBar(manualBarId, manualTableNumber);
      setIsConnected(true);
      showSuccess(`Conectado al bar (Mesa ${manualTableNumber})`);

      // Guardar en localStorage
      localStorage.setItem('encore_bar_id', manualBarId);
      localStorage.setItem('encore_table_number', manualTableNumber.toString());
    } catch (error) {
      setIsConnected(false);
      showError('Error al conectar con el bar');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    isConnecting,
    isConnected,
    barId,
    tableNumber,
    disconnect,
    connectManually
  };
}