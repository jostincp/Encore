import { toast } from 'sonner';
import { useCallback } from 'react';
import { UI_CONFIG, SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/utils/constants';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

type ToastOptions = {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
};

/**
 * Hook personalizado para manejar notificaciones toast
 */
export function useToast() {
  const showToast = useCallback((
    type: ToastType,
    message: string,
    options: ToastOptions = {}
  ) => {
    const {
      duration = UI_CONFIG.toastDuration,
      dismissible = true,
      action
    } = options;

    const toastOptions = {
      duration,
      dismissible,
      action
    };

    switch (type) {
      case 'success':
        return toast.success(message, toastOptions);
      case 'error':
        return toast.error(message, toastOptions);
      case 'warning':
        return toast.warning(message, toastOptions);
      case 'info':
        return toast.info(message, toastOptions);
      case 'loading':
        return toast.loading(message, { ...toastOptions, duration: Infinity });
      default:
        return toast(message, toastOptions);
    }
  }, []);

  // Métodos de conveniencia
  const success = useCallback((message: string, options?: ToastOptions) => {
    return showToast('success', message, options);
  }, [showToast]);

  const error = useCallback((message: string, options?: ToastOptions) => {
    return showToast('error', message, options);
  }, [showToast]);

  const warning = useCallback((message: string, options?: ToastOptions) => {
    return showToast('warning', message, options);
  }, [showToast]);

  const info = useCallback((message: string, options?: ToastOptions) => {
    return showToast('info', message, options);
  }, [showToast]);

  const loading = useCallback((message: string, options?: ToastOptions) => {
    return showToast('loading', message, options);
  }, [showToast]);

  // Métodos específicos del dominio
  const songAdded = useCallback((songTitle: string) => {
    return success(`"${songTitle}" ${SUCCESS_MESSAGES.songAdded}`);
  }, [success]);

  const orderPlaced = useCallback((orderTotal: string) => {
    return success(`${SUCCESS_MESSAGES.orderPlaced} - Total: ${orderTotal}`);
  }, [success]);

  const pointsEarned = useCallback((points: number) => {
    return success(`${SUCCESS_MESSAGES.pointsEarned}: +${points} puntos`);
  }, [success]);

  const insufficientPoints = useCallback((required: number, available: number) => {
    return error(`${ERROR_MESSAGES.insufficientPoints}. Necesitas ${required}, tienes ${available}`);
  }, [error]);

  const networkError = useCallback(() => {
    return error(ERROR_MESSAGES.network, {
      action: {
        label: 'Reintentar',
        onClick: () => window.location.reload()
      }
    });
  }, [error]);

  const qrScanned = useCallback((tableNumber: number) => {
    return success(`${SUCCESS_MESSAGES.qrScanned} - Mesa ${tableNumber}`);
  }, [success]);

  const maxSongsReached = useCallback((maxSongs: number) => {
    return warning(`${ERROR_MESSAGES.maxSongsReached} (${maxSongs})`);
  }, [warning]);

  const songNotAvailable = useCallback((songTitle: string) => {
    return error(`"${songTitle}" - ${ERROR_MESSAGES.songNotAvailable}`);
  }, [error]);

  const queueFull = useCallback(() => {
    return warning(ERROR_MESSAGES.queueFull);
  }, [warning]);

  // Método para promesas con toast de loading
  const promise = useCallback(async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ): Promise<T> => {
    const toastId = loading(messages.loading);
    
    try {
      const result = await promise;
      toast.dismiss(toastId);
      
      const successMessage = typeof messages.success === 'function' 
        ? messages.success(result)
        : messages.success;
      
      success(successMessage);
      return result;
    } catch (err) {
      toast.dismiss(toastId);
      
      const errorMessage = typeof messages.error === 'function'
        ? messages.error(err as Error)
        : messages.error;
      
      error(errorMessage);
      throw err;
    }
  }, [loading, success, error]);

  // Método para dismissar todos los toasts
  const dismissAll = useCallback(() => {
    toast.dismiss();
  }, []);

  // Método para dismissar un toast específico
  const dismiss = useCallback((toastId: string | number) => {
    toast.dismiss(toastId);
  }, []);

  return {
    // Métodos básicos
    showToast,
    success,
    error,
    warning,
    info,
    loading,
    
    // Métodos específicos del dominio
    songAdded,
    orderPlaced,
    pointsEarned,
    insufficientPoints,
    networkError,
    qrScanned,
    maxSongsReached,
    songNotAvailable,
    queueFull,
    
    // Utilidades
    promise,
    dismiss,
    dismissAll
  };
}

/**
 * Hook para manejar errores de API con toast automático
 */
export function useApiErrorHandler() {
  const { error, networkError } = useToast();

  const handleError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      // Errores de red
      if (err.message.includes('fetch') || err.message.includes('network')) {
        networkError();
        return;
      }
      
      // Errores de API específicos
      if (err.message.includes('401')) {
        error(ERROR_MESSAGES.unauthorized);
        return;
      }
      
      if (err.message.includes('404')) {
        error(ERROR_MESSAGES.notFound);
        return;
      }
      
      if (err.message.includes('500')) {
        error(ERROR_MESSAGES.serverError);
        return;
      }
      
      // Error genérico
      error(err.message || ERROR_MESSAGES.serverError);
    } else {
      error(ERROR_MESSAGES.serverError);
    }
  }, [error, networkError]);

  return { handleError };
}