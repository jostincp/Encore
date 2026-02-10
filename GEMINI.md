# Proyecto: Encore

## Propósito
Encore es una plataforma de gestión musical para bares y restaurantes que funciona como "rockola digital". Permite a clientes buscar y agregar música a una cola en tiempo real vía YouTube/Spotify, ver un menú 3D con Google `<model-viewer>`, ganar puntos por compras para pedir canciones, y realizar pedidos con Stripe. Los administradores controlan colas musicales, métricas y configuración del establecimiento.

### Stack Técnico
- **Frontend**: Next.js 15 (React 19), TypeScript, Tailwind CSS, Socket.IO Client, Google model-viewer
- **Backend**: Microservicios Node.js 20+ con Express.js y TypeScript
- **Bases de datos**: PostgreSQL (Supabase/Railway), Redis para caché y colas
- **APIs externas**: YouTube Data API v3, Spotify Web API, Stripe
- **Tiempo real**: Socket.IO para eventos de cola y "now-playing"

---

## Idioma y Documentación

### Idioma del Proyecto
- **Código**: Variables, funciones y clases en **inglés** (estándar internacional)
- **Comentarios**: En **español**
- **Mensajes de usuario**: En **español** (UI, errores, notificaciones)
- **Commits**: En **español**, formato: `tipo(alcance): descripción breve`
  - Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - Ejemplo: `feat(queue): agregar auto-start de canciones`

### Documentación Estratégica

> **Principio**: Documenta el "por qué", no el "qué". El código debe ser auto-explicativo.

**✅ SÍ documentar:**
- Funciones públicas/exportadas (JSDoc breve, 1-2 líneas)
- Lógica de negocio compleja (cálculo de puntos, prioridad de cola)
- Decisiones no obvias o workarounds
- TODOs con contexto: `// TODO(nombre): razón y fecha`

**❌ NO documentar:**
- Código auto-explicativo (`const userName = user.name`)
- Cada línea o bloque obvio
- Getters/Setters simples

**Ejemplo correcto:**
```typescript
/**
 * Calcula puntos según tipo de reproducción.
 * Priority cuesta más porque salta la cola.
 */
function calcularCostoPuntos(isPriority: boolean): number {
  return isPriority ? 25 : 10;
}

// ❌ Evitar comentarios obvios:
const total = precio * cantidad; // multiplica precio por cantidad
```

---

## Instrucciones Generales

- **Sigue el estilo existente** del proyecto (ver sección "Estilo de Código")
- **Prioriza seguridad**: Valida inputs, parametriza SQL, sanitiza datos
- **No expongas datos sensibles**: Nunca retornes API keys, JWT secrets o credenciales
- **Respeta la arquitectura**: Cada microservicio tiene responsabilidades específicas
- **Usa caché Redis**: Reduce llamadas a APIs externas (YouTube, Spotify)
- **WebSockets para tiempo real**: Cola musical y now-playing via Socket.IO

---

## Principios de Código Limpio

### Para Desarrolladores (Especialmente Principiantes)

1. **Funciones pequeñas**: Máximo 20-30 líneas, una sola responsabilidad
2. **Nombres descriptivos**: `obtenerCancionActual()` mejor que `get()` o `getData()`
3. **Evitar anidación**: Máximo 3 niveles, usar early returns
4. **DRY**: Si copias código 2+ veces, extraer a función
5. **Parámetros limitados**: Máximo 3-4, si hay más usar objeto de opciones

### Early Returns (Reducir Anidación)
```typescript
// ✅ CORRECTO: Early return, fácil de leer
async function agregarCancion(barId: string, songId: string) {
  if (!barId) return { success: false, message: 'Bar ID requerido' };
  if (!songId) return { success: false, message: 'Song ID requerido' };
  
  const result = await queueService.add(barId, songId);
  return { success: true, data: result };
}

// ❌ INCORRECTO: Anidación excesiva, difícil de seguir
async function agregarCancion(barId: string, songId: string) {
  if (barId) {
    if (songId) {
      // Lógica muy anidada...
    }
  }
}
```

### Manejo Seguro de Null/Undefined
```typescript
// ✅ Usar optional chaining (?.) y nullish coalescing (??)
const artista = cancion?.artist ?? 'Artista desconocido';
const thumbnail = data?.thumbnails?.medium?.url ?? '/default-thumb.jpg';

// ✅ Validar antes de usar
if (!response?.data?.videos) {
  return { success: false, message: 'No se encontraron resultados' };
}
```

### Nombres Descriptivos
```typescript
// ✅ CORRECTO: Nombres que explican intención
const cancionesEnCola = await obtenerColaPorBar(barId);
const esPrioridad = solicitud.tipoPago === 'premium';
const tiempoEsperaMs = calcularTiempoEstimado(posicionEnCola);

// ❌ INCORRECTO: Nombres crípticos o genéricos
const data = await get(id);
const flag = req.type === 'p';
const t = calc(pos);
```

---

## Estilo de Código

### TypeScript/JavaScript
- **Indentación**: 2 espacios (sin tabs)
- **Semicolons**: Siempre al final de statements
- **Comillas**: Single quotes `'` (JSX usa double `"`)
- **ES Modules**: `import`/`export`, no CommonJS
- **Async/Await**: Preferir sobre Promises encadenadas
- **Tipos explícitos**: Evitar `any`, definir interfaces claras

### Naming Conventions
| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Variables/Funciones | `camelCase` | `fetchQueue`, `nowPlayingSong` |
| Constantes | `UPPER_SNAKE_CASE` | `YOUTUBE_API_KEY`, `MAX_QUEUE_SIZE` |
| Componentes React | `PascalCase` | `AdminPage`, `MusicPlayer` |
| Tipos/Interfaces | `PascalCase` | `BarStats`, `QueueItem` |
| Archivos componentes | `PascalCase.tsx` | `SongCard.tsx` |
| Archivos utilidades | `camelCase.ts` | `formatTime.ts` |

### SQL y Base de Datos
```typescript
// ✅ SIEMPRE parametrizar queries (previene SQL injection)
const result = await pool.query('SELECT * FROM bars WHERE id = $1', [barId]);

// ❌ NUNCA concatenar strings en queries
const result = await pool.query(`SELECT * FROM bars WHERE id = '${barId}'`);
```
- **Transacciones**: Para operaciones críticas (agregar canción + restar puntos)
- **Errores**: Capturar y retornar mensajes genéricos al usuario

### Frontend (React/Next.js)
- **Componentes funcionales** con hooks
- **`'use client'`** cuando uses hooks de React o estado
- **Imports absolutos**: `@/components`, `@/services`
- **Estado**: Zustand para global, useState para local
- **Estilos**: Tailwind CSS + Shadcn UI

### Backend (Microservicios)
**Estructura de respuestas consistente:**
```typescript
// ✅ Éxito
res.json({
  success: true,
  data: { ... },
  message: 'Operación exitosa'
});

// ✅ Error
res.status(400).json({
  success: false,
  message: 'Descripción del error para el usuario',
  ...(process.env.NODE_ENV === 'development' && { error: error.message })
});
```

---

## Arquitectura del Proyecto

### Microservicios Backend
| Servicio | Puerto | Responsabilidad |
|----------|--------|-----------------|
| auth-service | 3001 | Autenticación JWT, usuarios |
| music-service | 3002 | Búsqueda música, caché Redis |
| queue-service | 3003 | Cola reproducción, WebSocket |
| points-service | 3004 | Puntos, pagos Stripe |
| menu-service | 3005 | Menú 3D, productos |
| analytics-service | 3006 | Métricas tiempo real |

### Frontend (Puerto 3004)
- **Ruta principal**: `/client/music-final`
- **Admin**: `/admin`
- **Login**: `/auth/login`
- **PWA**: Instalable como app nativa

### Flujo de Datos
```
Búsqueda:    Frontend → Music Service → YouTube API (con caché Redis)
Agregar:     Frontend → Music Service → Queue Service (Redis + WebSocket)
Now Playing: Queue Service emite WebSocket → Frontend actualiza UI
Auto-start:  Cola vacía → Queue Service inicia primer item automáticamente
```

---

## Patrones Comunes

### Manejo de Errores
```typescript
try {
  const result = await someAsyncOperation();
  return res.json({ success: true, data: result });
} catch (error: any) {
  log('❌ Error en operación:', error.message);
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
}
```

### WebSocket Events
```typescript
// Backend: emitir evento
io.to(`bar:${barId}`).emit('now-playing', songData);

// Frontend: escuchar evento
socket.on('now-playing', (data) => {
  setNowPlayingSong(data);
});
```

### Caché Redis
```typescript
// Verificar caché antes de llamar API
const cached = await redisClient.get(cacheKey);
if (cached) return JSON.parse(cached);

// Guardar con TTL (10 días)
await redisClient.setex(cacheKey, 864000, JSON.stringify(data));
```

---

## Recursos Importantes

### Documentación
- `README.md`: Instalación y scripts npm
- `docs/ARCHITECTURE/technical_architecture.md`: Arquitectura completa
- `docs/SETUP/environment_variables_guide.md`: Variables de entorno
- `docs/SERVICES/services_guide_complete.md`: Detalles de microservicios

### Variables de Entorno Críticas
```bash
# Music Service
YOUTUBE_API_KEY=<key>
REDIS_HOST=localhost

# Queue Service
JWT_SECRET=<secret>
REDIS_KEY_PREFIX=encore:queue:

# Frontend
NEXT_PUBLIC_MUSIC_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=http://localhost:3003
```

### Scripts de Desarrollo
```bash
npm run dev              # Todo el stack
npm run dev:frontend     # Solo frontend (3004)
npm run dev:backend      # Todos los microservicios
npm run dev:music        # Solo music-service (3002)
npm run dev:queue        # Solo queue-service (3003)
```

---

## Contexto Adicional
- **Estado**: Desarrollo activo, algunas funcionalidades parcialmente implementadas
- **Prioridad**: Estabilidad de cola musical, auto-start, sincronización WebSocket
- **Testing**: `npm run test:*` para validar servicios
- **Deploy**: Frontend en Vercel, Backend en Railway/Fly.io

---

## Sistema de Documentación (Obsidian Sync)

Este proyecto utiliza documentación sincronizada con Obsidian.
**Regla de Oro:** Todo cambio relevante debe documentarse en ambos lugares (`/docs` y `/obsidian_docs`).

**CONSULTAR REGLAS DETALLADAS EN:** `DOCS_RULES.md`

