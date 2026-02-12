---
tags:
  - componentes
  - react
  - frontend
  - ui
last_updated: 2026-02-11
---

# Componentes React Reutilizables

Biblioteca de componentes UI compartidos basados en Shadcn UI y Radix.

## Componentes de UI Base

### Button

```typescript
// frontend/src/components/ui/button.tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function Button({ 
  className, 
  variant = 'default', 
  size = 'default',
  ...props 
}: ButtonProps) {
  return (
   <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        variant === 'default' && 'bg-primary text-white hover:bg-primary/90',
        size === 'default' && 'h-10 px-4 py-2',
        className
      )}
      {...props}
    />
  );
}
```

## Componentes de Música

### SongCard

```typescript
// frontend/src/components/SongCard.tsx
interface SongCardProps {
  song: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
  };
  onAdd: (songId: string) => void;
}

export function SongCard({ song, onAdd }: SongCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted">
      <img 
        src={song.thumbnail} 
        alt={song.title}
        className="w-16 h-16 rounded object-cover"
      />
      <div className="flex-1">
        <h3 className="font-semibold">{song.title}</h3>
        <p className="text-sm text-muted-foreground">{song.artist}</p>
      </div>
      <Button onClick={() => onAdd(song.id)}>
        Agregar
      </Button>
    </div>
  );
}
```

### QueueList

```typescript
// frontend/src/components/QueueList.tsx
interface QueueListProps {
  songs: Array<{
    id: string;
    title: string;
    artist: string;
  }>;
}

export function QueueList({ songs }: QueueListProps) {
  if (songs.length === 0) {
    return <p className="text-center text-muted-foreground">Cola vacía</p>;
  }

  return (
    <div className="space-y-2">
      {songs.map((song, index) => (
        <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <span className="text-sm font-medium text-muted-foreground">
            {index + 1}
          </span>
          <div>
            <p className="font-medium">{song.title}</p>
            <p className="text-sm text-muted-foreground">{song.artist}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Componentes de Formularios

### SearchBar

```typescript
'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Buscar...' }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 rounded-lg border"
      />
    </form>
  );
}
```

## Componentes de Layout

### AdminDashboard Layout

```typescript
// frontend/src/components/layouts/AdminLayout.tsx
interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

## Hooks Personalizados

### `useQueue`

```typescript
// frontend/src/hooks/useQueue.ts
import { useState, useEffect } from 'react';
import { socket } from '@/lib/socket';

export function useQueue(barId: string) {
  const [queue, setQueue] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    socket.emit('join-bar', barId);

    socket.on('queue-updated', (data) => {
      setQueue(data.queue);
    });

    socket.on('now-playing', (data) => {
      setNowPlaying(data.song);
    });

    return () => {
      socket.off('queue-updated');
      socket.off('now-playing');
    };
  }, [barId]);

  return { queue, nowPlaying };
}
```

### `useDebounce`

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Uso en búsqueda de canciones (500ms debounce + caché sesión + AbortController)
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 500);
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  if (!debouncedQuery.trim()) return;

  // Verificar caché de sesión (sessionStorage, TTL 30 min)
  const cached = sessionStorage.getItem(`search_${debouncedQuery}`);
  if (cached) { setSongs(JSON.parse(cached).results); return; }

  // Cancelar búsqueda anterior
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;

  fetchSongs(debouncedQuery, controller.signal);
}, [debouncedQuery]);
```

> [!TIP] Server Components
> En Next.js 15, prioriza Server Components por defecto. Solo usa `'use client'` cuando necesites interactividad (useState, useEffect).

## Patrones de Componentes

### Early Return Pattern

```typescript
function UserProfile({ userId }: { userId?: string }) {
  // Early returns para casos edge
  if (!userId) return <div>No user</div>;
  
  // Lógica principal
  return <div>User profile...</div>;
}
```

### Compound Components

```typescript
function Tabs({ children }: { children: React.ReactNode }) {
  return <div className="tabs">{children}</div>;
}

Tabs.List = function TabsList({ children }: { children: React.ReactNode }) {
  return <div className="tabs-list">{children}</div>;
};

Tabs.Panel = function TabsPanel({ children }: { children: React.ReactNode }) {
  return <div className="tabs-panel">{children}</div>;
};

// Uso
<Tabs>
  <Tabs.List>
    <Tab>Tab 1</Tab>
  </Tabs.List>
  <Tabs.Panel>Content</Tabs.Panel>
</Tabs>
```

## Referencias

- Shadcn UI: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/
- Utilidades: [[31-Utilidades]]
- Stack tecnológico: [[11-Stack]]
