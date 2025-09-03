// Implementación de caché en memoria como fallback para Redis
import { logInfo, logWarn } from './logger';

interface CacheItem {
  value: any;
  expiry: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Limpiar elementos expirados cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<boolean> {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expiry });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset(keyValuePairs: Record<string, any>, ttl: number = 3600): Promise<boolean> {
    const expiry = Date.now() + (ttl * 1000);
    for (const [key, value] of Object.entries(keyValuePairs)) {
      this.cache.set(key, { value, expiry });
    }
    return true;
  }

  async incr(key: string, ttl?: number): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + 1;
    await this.set(key, newValue, ttl || 3600);
    return newValue;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async clearByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    let count = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) count++;
    }
    return count;
  }

  async ttl(key: string): Promise<number> {
    const item = this.cache.get(key);
    if (!item) return -2; // Key doesn't exist
    
    const remaining = Math.floor((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1; // -1 means expired
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }

  // Métodos adicionales para compatibilidad
  async setex(key: string, seconds: number, value: string): Promise<string> {
    await this.set(key, value, seconds);
    return 'OK';
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.cache.get(key);
    if (!item) return 0;
    
    item.expiry = Date.now() + (seconds * 1000);
    return 1;
  }
}

export const memoryCache = new MemoryCache();
export { MemoryCache };