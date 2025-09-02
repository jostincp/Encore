import { useState, useEffect, useCallback } from 'react';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

type AsyncOptions<T> = {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
};

/**
 * Hook para manejar operaciones asíncronas
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dependencies: unknown[] = [],
  options: AsyncOptions<T> = {}
): AsyncState<T> & { execute: () => void; reset: () => void } {
  const { immediate = true, onSuccess, onError } = options;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await asyncFunction();
      setState({ data: result, loading: false, error: null });
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setState({ data: null, loading: false, error });
      onError?.(error);
    }
  }, [asyncFunction, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}

/**
 * Hook para manejar múltiples operaciones asíncronas
 */
export function useAsyncQueue<T>() {
  const [queue, setQueue] = useState<Array<{
    id: string;
    promise: Promise<T>;
    status: 'pending' | 'fulfilled' | 'rejected';
    result?: T;
    error?: Error;
  }>>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);

  const addToQueue = useCallback((id: string, asyncFunction: () => Promise<T>) => {
    const promise = asyncFunction();
    
    setQueue(prev => [...prev, {
      id,
      promise,
      status: 'pending'
    }]);

    promise
      .then(result => {
        setQueue(prev => prev.map(item => 
          item.id === id 
            ? { ...item, status: 'fulfilled' as const, result }
            : item
        ));
      })
      .catch(error => {
        setQueue(prev => prev.map(item => 
          item.id === id 
            ? { ...item, status: 'rejected' as const, error }
            : item
        ));
      });

    return promise;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const pendingItems = queue.filter(item => item.status === 'pending');
      await Promise.allSettled(pendingItems.map(item => item.promise));
    } finally {
      setIsProcessing(false);
    }
  }, [queue, isProcessing]);

  const getQueueStats = useCallback(() => {
    const total = queue.length;
    const pending = queue.filter(item => item.status === 'pending').length;
    const fulfilled = queue.filter(item => item.status === 'fulfilled').length;
    const rejected = queue.filter(item => item.status === 'rejected').length;
    
    return { total, pending, fulfilled, rejected };
  }, [queue]);

  return {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
    getQueueStats
  };
}

/**
 * Hook para retry de operaciones fallidas
 */
export function useAsyncRetry<T>(
  asyncFunction: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const { data, loading, error, execute } = useAsync(asyncFunction, [], { immediate: false });

  const executeWithRetry = useCallback(async () => {
    setRetryCount(0);
    setIsRetrying(false);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setIsRetrying(true);
          setRetryCount(attempt);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
        
        const result = await execute();
        setIsRetrying(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        if (attempt === maxRetries) {
          setIsRetrying(false);
          throw lastError;
        }
      }
    }
  }, [execute, maxRetries, retryDelay]);

  const canRetry = error && retryCount < maxRetries;
  
  const retry = useCallback(() => {
    if (canRetry) {
      executeWithRetry();
    }
  }, [canRetry, executeWithRetry]);

  return {
    data,
    loading: loading || isRetrying,
    error,
    retryCount,
    isRetrying,
    canRetry,
    execute: executeWithRetry,
    retry
  };
}