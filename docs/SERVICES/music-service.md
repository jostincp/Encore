# Music Service - Servicio de Música

## Descripción

El servicio de música gestiona la búsqueda y reproducción de contenido musical desde múltiples proveedores (Spotify, YouTube).

## Características

- Búsqueda en YouTube Data API v3 con categoría Music (`videoCategoryId: 10`)
- **Priorización de canales oficiales** (VEVO, Topic channels) sobre re-uploads
- Cache de resultados en Redis (TTL 10 días) con normalización de queries
- Query normalization: acentos, emojis, caracteres especiales
- Proxy transparente hacia Queue Service (3003)
- Rate limiting por IP y por bar
- Circuit breaker para protección de cuota YouTube

## Endpoints Principales

### GET /api/youtube/search
Búsqueda de canciones en YouTube. Resultados ordenados por canales oficiales (VEVO > Topic > resto).

### GET /api/queue/:barId
Obtener cola de reproducción (proxy a Queue Service)

### POST /api/queue/:barId/add
Agregar canción a la cola (proxy a Queue Service)

### GET /api/cache/stats
Estadísticas de caché (hits, misses, cuota usada)

## Variables de Entorno

```env
YOUTUBE_API_KEY=your-youtube-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
REDIS_URL=redis://localhost:6379
```

## Puerto por Defecto

3002

---

*Para más información sobre integraciones, consulte [Integraciones](../INTEGRATIONS/)*