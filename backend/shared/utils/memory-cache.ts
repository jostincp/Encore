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

  // --- Set operations (Redis compatibility) ---
  private getSet(key: string): Set<string> | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    const value = item.value;
    if (value instanceof Set) return value as Set<string>;
    // If value stored as array, convert to Set
    if (Array.isArray(value)) return new Set(value as string[]);
    return null;
  }

  private ensureSet(key: string, ttl: number): Set<string> {
    let set = this.getSet(key);
    if (!set) {
      set = new Set<string>();
    }
    // Persist with TTL
    this.cache.set(key, { value: set, expiry: Date.now() + (ttl * 1000) });
    return set;
  }

  async sadd(key: string, member: string, ttl: number = 3600): Promise<number> {
    const set = this.getSet(key) ?? new Set<string>();
    const beforeSize = set.size;
    set.add(member);
    this.cache.set(key, { value: set, expiry: Date.now() + (ttl * 1000) });
    return set.size > beforeSize ? 1 : 0;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.getSet(key);
    if (!set) return 0;
    const removed = set.delete(member) ? 1 : 0;
    // Keep existing TTL
    const item = this.cache.get(key);
    if (item) {
      this.cache.set(key, { value: set, expiry: item.expiry });
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.getSet(key);
    return set ? Array.from(set.values()) : [];
  }

  async sismember(key: string, member: string): Promise<number> {
    const set = this.getSet(key);
    if (!set) return 0;
    return set.has(member) ? 1 : 0;
  }
}

export const memoryCache = new MemoryCache();
export { MemoryCache };