---
tags:
  - servicio
  - backend
  - analytics
  - metricas
last_updated: 2026-02-09
puerto: 3007
status: planned
---

# Analytics Service

Microservicio para métricas, estadísticas y analíticas del sistema (Planeado).

## Propósito

- Recopilar métricas de uso en tiempo real
- Generar reportes de canciones más pedidas
- Estadísticas de usuarios activos
- Dashboard para administradores

> [!WARNING] Estado
> Este servicio está **en fase de diseño**. La recopilación básica de datos se realiza en otros servicios.

## Endpoints Planeados

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/analytics/top-songs/:barId` | Top 10 canciones | ✅ Admin |
| GET | `/api/analytics/active-users/:barId` | Usuarios activos hoy | ✅ Admin |
| GET | `/api/analytics/revenue/:barId` | Ingresos del mes | ✅ Admin |
| GET | `/api/analytics/queue-stats/:barId` | Stats de cola | ✅ Admin |

## Variables de Entorno (Planeadas)

```bash
# .env en backend/analytics-service/
DB_HOST=localhost
DB_PASSWORD=<password>
REDIS_HOST=localhost
JWT_SECRET=<secret>
```

## Stack Tecnológico

- **Framework**: Express.js 4.18.2
- **Database**: [[PostgreSQL]] (agregaciones SQL)
- **Cache**: [[Redis]] (contadores en tiempo real)
- **Visualización**: Recharts (frontend)

## Métricas a Recopilar

### Tiempo Real (Redis)

```typescript
// Contadores incrementales
await redis.incr(`analytics:bar:${barId}:songs_played:${date}`);
await redis.incr(`analytics:bar:${barId}:active_users:${date}`);
await redis.sadd(`analytics:bar:${barId}:unique_users`, userId);
```

### Histórico (PostgreSQL)

```sql
-- Tabla de eventos
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER REFERENCES bars(id),
  event_type VARCHAR(50),  -- 'song_played', 'user_login', 'purchase'
  user_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para queries rápidas
CREATE INDEX idx_events_bar_date ON analytics_events(bar_id, created_at);
CREATE INDEX idx_events_type ON analytics_events(event_type);
```

## Dashboard de Métricas

### KPIs Principales

| Métrica | Descripción | Fuente |
|---------|-------------|--------|
| **Canciones/día** | Total reproducidas | `analytics_events` |
| **Usuarios activos** | Usuarios únicos del día | Redis Set |
| **Revenue** | Ingresos por puntos | `points_transactions` |
| **Canción top** | Más pedida del mes | Agregación SQL |

### Query de Top Songs

```sql
SELECT 
  metadata->>'songId' as song_id,
  metadata->>'title' as title,
  COUNT(*) as play_count
FROM analytics_events
WHERE 
  bar_id = $1 
  AND event_type = 'song_played'
  AND created_at >= NOW() - INTERVAL '30 days'
 GROUP BY song_id, title
ORDER BY play_count DESC
LIMIT 10;
```

## Integración con Otros Servicios

### Queue Service → Analytics

```typescript
// Cuando una canción termina
await queueService.on('song-ended', async (songData) => {
  await analyticsService.trackEvent({
    type: 'song_played',
    barId: songData.barId,
    metadata: {
      songId: songData.id,
      title: songData.title,
      duration: songData.duration
    }
  });
});
```

## Dependencias con Otros Servicios

- **[[Queue-Service]]**: Eventos de reproducción
- **[[Points-Service]]**: Datos de transacciones
- **[[Auth-Service]]**: Datos de usuarios activos
- **[[PostgreSQL]]**: Almacenamiento histórico
- **[[Redis]]**: Contadores en tiempo real

## Herramientas de Visualización (Frontend)

```typescript
import { BarChart, LineChart } from 'recharts';

// Top songs chart
<BarChart data={topSongs}>
  <Bar dataKey="playCount" fill="#8884d8" />
</BarChart>

// Revenue trend
<LineChart data={revenue}>
  <Line dataKey="amount" stroke="#82ca9d" />
</LineChart>
```

## Estado Actual

| Funcionalidad | Estado |
|---------------|--------|
| Tracking de eventos | 🔜 Planeado |
| Dashboard admin | 🔜 Planeado |
| Reportes exportables | 🔜 Planeado |
| Alertas automáticas | 🔜 Planeado |

## Alternativas de Herramientas

### Opción 1: Custom (Actual Plan)

- Control total de datos
- Sin costos adicionales
- Requiere desarrollo

### Opción 2: PostHog (Terceros)

```typescript
import posthog from 'posthog-js';

posthog.capture('song_played', {
  songId: 'abc123',
  barId: 'bar123'
});
```

**Pros**: Product analytics + feature flags
**Cons**: $0-450/mes según volumen

## Referencias

- Recharts Docs: https://recharts.org/
- PostHog: https://posthog.com/
- Mapa de servicios: [[21-Mapa-Servicios]]
