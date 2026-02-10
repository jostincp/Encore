---
tags:
  - componentes
  - utilidades
  - helpers
last_updated: 2026-02-09
---

# Utilidades y Funciones Helper

Colección de funciones utilitarias reutilizables en el proyecto Encore.

## Formateo

### `formatTime(seconds: number): string`

Convierte segundos a formato MM:SS para duración de canciones.

```typescript
// Ubicación: frontend/src/utils/formatTime.ts
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Uso
formatTime(185); // "3:05"
```

### `formatDate(date: Date): string`

Formatea fechas para display en español.

```typescript
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

// Uso
formatDate(new Date()); // "9 de febrero de 2026"
```

## Validación

### `isValidEmail(email: string): boolean`

Valida formato de email.

```typescript
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### `sanitizeInput(input: string): string`

Sanitiza inputs de usuario para prevenir XSS.

```typescript
import DOMPurify from 'dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
```

> [!WARNING] Seguridad
> SIEMPRE sanitizar inputs del usuario antes de renderizar en el DOM o enviar al backend.

## API Helpers

### `apiClient.ts`

Cliente HTTP configurado con base URL y interceptors.

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_MUSIC_SERVICE_URL || 'http://localhost:3002',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('encore_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

## Storage Helpers

### `localStorage` wrapper

```typescript
// Guarda objetos directamente
export const storage = {
  set: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  get: (key: string) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  
  remove: (key: string) => {
    localStorage.removeItem(key);
  }
};

// Uso
storage.set('user', {id: 123, name: 'Juan'});
const user = storage.get('user');
```

## Debounce y Throttle

### `debounce(fn, delay)`

Útil para búsquedas en tiempo real.

```typescript
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Uso en componente de búsqueda
const debouncedSearch = debounce((query: string) => {
  fetchSongs(query);
}, 300);
```

## Utilidades de Cola

### `calculateWaitTime(queuePosition: number): number`

Estima tiempo de espera según posición en cola.

```typescript
const AVG_SONG_DURATION = 180; // 3 minutos

export function calculateWaitTime(position: number): number {
  return position * AVG_SONG_DURATION;
}

// Uso
const waitSeconds = calculateWaitTime(5); // 900 segundos (15 min)
```

## Constantes

```typescript
// frontend/src/constants/index.ts
export const API_URLS = {
  MUSIC_SERVICE: process.env.NEXT_PUBLIC_MUSIC_SERVICE_URL,
  QUEUE_SERVICE: process.env.NEXT_PUBLIC_QUEUE_SERVICE_URL
};

export const SONG_COSTS = {
  NORMAL: 10,
  PRIORITY: 25
};

export const ROUTES = {
  MUSIC: '/client/music-final',
  ADMIN: '/admin',
  LOGIN: '/auth/login'
};
```

## Referencias

- Stack tecnológico: [[11-Stack]]
- Componentes React: [[32-Componentes-React]]
