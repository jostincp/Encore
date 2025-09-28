# Music Service - Servicio de Música

## Descripción

El servicio de música gestiona la búsqueda y reproducción de contenido musical desde múltiples proveedores (Spotify, YouTube).

## Características

- Búsqueda unificada en múltiples plataformas
- Integración con Spotify Web API
- Integración con YouTube Data API
- Cache de resultados de búsqueda
- Gestión de metadatos musicales

## Endpoints Principales

### GET /music/search
Búsqueda de canciones

### GET /music/track/:id
Obtener información de una canción específica

### GET /music/providers
Listar proveedores disponibles

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