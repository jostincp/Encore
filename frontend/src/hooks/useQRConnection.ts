import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from '@/hooks/useToast';

export function useQRConnection() {
  const { connectToBar, disconnectFromBar, barId, tableNumber } = useAppStore();
  const { success: showSuccess, error: showError } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Detectar parámetros QR desde URL o cookies
  useEffect(() => {
    const checkQRConnection = async () => {
      // Obtener parámetros desde URL (formato estándar)
      const urlParams = new URLSearchParams(window.location.search);
      const urlBarId = urlParams.get('barId');        // Parámetro estándar
      const urlTableNumber = urlParams.get('table');  // Parámetro estándar

      // Obtener parámetros desde cookies
      const cookies = document.cookie.split(';');
      const cookieBarId = cookies.find(c => c.trim().startsWith('encore_bar_id='))?.split('=')[1];
      const cookieTableNumber = cookies.find(c => c.trim().startsWith('encore_table_number='))?.split('=')[1];

      // Usar URL params primero, luego cookies
      const finalBarId = urlBarId || cookieBarId;
      const finalTableNumber = urlTableNumber || cookieTableNumber;

      if (finalBarId && finalTableNumber) {
        try {
          setIsConnecting(true);
          
          // Conectar al bar
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

    // Verificar conexión al montar el componente
    checkQRConnection();

    // Verificar periódicamente si hay cambios en los parámetros
    const interval = setInterval(checkQRConnection, 5000);

    return () => clearInterval(interval);
  }, [connectToBar, showSuccess, showError]);

  // Verificar conexión desde localStorage al montar
  useEffect(() => {
    const storedBarId = localStorage.getItem('encore_bar_id');
    const storedTableNumber = localStorage.getItem('encore_table_number');

    if (storedBarId && storedTableNumber && !barId) {
      connectToBar(storedBarId, parseInt(storedTableNumber))
        .then(() => setIsConnected(true))
        .catch(() => setIsConnected(false));
    } else if (barId && tableNumber) {
      setIsConnected(true);
    }
  }, []);

  const disconnect = () => {
    disconnectFromBar();
    setIsConnected(false);
    
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