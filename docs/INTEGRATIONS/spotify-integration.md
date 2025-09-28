# Integración con Spotify

## Descripción

Integración con Spotify Web API para búsqueda y reproducción de música.

## Configuración

### 1. Crear Aplicación en Spotify

1. Visita [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Crea una nueva aplicación
3. Obtén el Client ID y Client Secret
4. Configura las URLs de redirección

### 2. Variables de Entorno

```env
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback/spotify
```

## Funcionalidades Implementadas

- ✅ Búsqueda de canciones
- ✅ Obtener información de tracks
- ✅ Búsqueda de artistas
- ✅ Búsqueda de álbumes
- 🔄 Autenticación de usuario (en desarrollo)
- 🔄 Playlists (planificado)

## Endpoints Utilizados

### Search API
- `GET https://api.spotify.com/v1/search`

### Tracks API
- `GET https://api.spotify.com/v1/tracks/{id}`

## Limitaciones

- Rate limit: 100 requests por minuto
- Requiere autenticación para funciones avanzadas
- Solo preview de 30 segundos sin Spotify Premium

---

*Para más información técnica, consulte [Music Service](../SERVICES/music-service.md)*