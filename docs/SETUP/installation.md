# Guía de Instalación - Encore

## Prerrequisitos

- Node.js 20+
- npm 9+
- PostgreSQL 14+
- Redis 6+

## Instalación Rápida

```bash
# Clonar el repositorio
git clone <repository-url>
cd encore

# Instalar todas las dependencias
npm run install:all
```

## Configuración de Variables de Entorno

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Backend Services (.env)
```env
# Común para todos los servicios
DATABASE_URL=postgresql://user:password@localhost:5432/encore
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret

# Específicos por servicio
# music-service
YOUTUBE_API_KEY=your-youtube-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# points-service
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Desarrollo

```bash
# Ejecutar todo el stack de desarrollo
npm run dev

# O ejecutar servicios individualmente
npm run dev:frontend    # Frontend en puerto 3000
npm run dev:backend     # Todos los microservicios
```

---

*Para más detalles, consulte la [Arquitectura Técnica](../ARCHITECTURE/technical_architecture.md)*