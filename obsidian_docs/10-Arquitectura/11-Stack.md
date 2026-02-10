---
tags:
  - arquitectura
  - tech-stack
last_updated: 2026-02-09
status: stable
---

# Stack Tecnológico

Descripción de las tecnologías principales utilizadas en Encore.

## Frontend

### Core Framework
- **Framework**: [[Next.js]] 15.5.2 (App Router con Turbopack experimental)
- **React**: 19.1.0 (Server Components + Server Actions)
- **Lenguaje**: TypeScript 5.x (strict mode)
- **Node.js**: 20.x LTS (Iron) - Mínimo 20.0.0

### UI/Estilos
- **CSS Framework**: Tailwind CSS v4.x
- **Component Library**: Shadcn UI (basado en Radix UI + Tailwind v4)
- **Icons**: Lucide React ^0.542.0

### Visualización 3D
- **3D Viewer**: Google `<model-viewer>` Web Component
- **Formatos**: GLB (optimizado para web)
- **Características**: Rotación 360°, zoom, carga nativa sin librerías pesadas

> [!INFO] Decisión de Diseño
> Se usa Google model-viewer en lugar de Three.js para reducir bundle size y aprovechar renderizado nativo del navegador.

### Tiempo Real
- **WebSocket Client**: Socket.IO Client 4.8.1
- **State Management**: Zustand 5.0.8 (cola musical)
- **HTTP Client**: Axios 1.6.0

### PWA
- **Service Worker**: next-pwa 5.6.0
- **QR Code**: qrcode.react 4.2.0
- **Animations**: Framer Motion 12.23.12

---

## Backend (Microservicios)

### Runtime & Framework
- **Runtime**: Node.js 20.x LTS (Active hasta abril 2026)
- **Framework**: Express.js 4.18.2
- **Lenguaje**: TypeScript 5.3.3 (strict mode)

### Comunicación
- **API REST**: Express.js
- **WebSocket**: Socket.IO Server 4.8.1 (eventos [[Queue-Service]])
- **Validación**: express-validator 7.0.1

### Database Access
- **PostgreSQL Client**: pg 8.11.3
- **Redis Client**: redis 4.6.10 + ioredis 5.7.0
- **Type Safety**: TypeScript interfaces

> [!NOTE] ORM
> Actualmente se usa SQL directo con queries parametrizadas. Prisma está considerado para futuras iteraciones.

---

## Bases de Datos y Almacenamiento

### Base de Datos Principal
- **RDBMS**: [[PostgreSQL]] 17.x
- **Características**: ACID, transacciones, índices optimizados
- **Hosting**: Supabase / Railway (managed PostgreSQL)

### Caché y Colas
- **Cache & Queue**: [[Redis]] 7.x
  - Caching de YouTube Data API responses
  - Gestión de colas de reproducción en tiempo real
  - Session storage
  - Rate limiting
- **Hosting**: Upstash Redis (serverless) / Railway Redis

### Object Storage (Planeado)
- **CDN/Storage**: Cloudinary
  - Modelos 3D (.glb)
  - Imágenes de productos
  - Assets estáticos

---

## APIs Externas

### Música
- **YouTube Data API v3**: 
  - Fuente principal de música
  - Cuota: 10,000 units/día (tier gratuito)
  - Búsqueda, metadata, streaming
- **Spotify Web API**: 
  - Planeado como fuente complementaria
  - Fallback cuando YouTube quota se agota

### Pagos (Planeado)
- **Colombia**: Mercado Pago (recomendado para COP)
- **Internacional**: Stripe (alternativa)
- **Uso**: Procesamiento de pagos, créditos/puntos

### Autenticación
- **Auth Manual**: JWT con jsonwebtoken 9.0.2
- **Hashing**: Bcrypt (integrado en [[Auth-Service]])

---

## DevTools & Quality

### Linting & Formatting
- **Frontend Linter**: ESLint 9.x + eslint-config-next
- **Backend Linter**: ESLint 8.55.0 + TypeScript ESLint

### Testing
- **Frontend Unit**: Vitest 2.1.4 (más rápido que Jest)
- **Backend Unit**: Jest 29.7.0
- **Integration**: Supertest 6.3.4

> [!TIP] Testing Planeado
> Playwright para E2E y @testing-library/react para component testing están en roadmap.

### Monitoring (Planeado para Producción)
- **Error Tracking**: Sentry
- **Analytics**: Vercel Analytics / PostHog
- **Logs**: Winston (backend) / Console (desarrollo)

---

## Infraestructura & Deployment

### Hosting Actual

```yaml
Frontend:
  Provider: Vercel
  Framework: Next.js 15 (native)
  Build: Turbopack experimental
  CDN: Vercel Edge Network
  Puerto Dev: 3004

Backend API:
  Provider: Railway / Local
  Runtime: Node.js 20
  Servicios: 6 microservicios (puertos 3001-3006)

Database:
  Provider: Local PostgreSQL / Supabase
  Version: PostgreSQL 17.x

Cache:
  Provider: Local Redis / Upstash
  Version: Redis 7.x
```

### Puertos de Desarrollo

| Servicio | Puerto | Stack |
|----------|--------|-------|
| Frontend | 3004 | Next.js + React |
| [[Auth-Service]] | 3001 | Express + JWT |
| [[Music-Service]] | 3002 | Express + YouTube API |
| [[Queue-Service]] | 3003 | Express + Socket.IO |
| [[Points-Service]] | 3004 | Express + Stripe |
| [[Menu-Service]] | 3005 | Express + PostgreSQL |
| [[Analytics-Service]] | 3006 | Express + Agregación |

---

## Stack Planeado (Roadmap)

Tecnologías evaluadas para futuras iteraciones:

### State Management
- **TanStack Query**: Para server state con caché automático
- **React Query DevTools**: Debugging de queries

### Testing
- **Playwright**: E2E testing cross-browser
- **Testing Library**: Component testing

### Monitoring
- **Sentry**: Error tracking y performance monitoring
- **PostHog**: Product analytics y feature flags
- **OpenTelemetry**: APM distribuido

### ORM
- **Prisma**: Migración desde queries SQL directas

---

## Comandos de Desarrollo

```bash
# Iniciar todo el stack
npm run dev

# Solo frontend (puerto 3004)
npm run dev:frontend

# Solo backend (todos los servicios)
npm run dev:backend

# Servicio específico
npm run dev:music
npm run dev:queue

# Testing
npm run test              # Tests del proyecto
npm run test:unit         # Solo unit tests
npm run test:integration  # Solo integration tests
```

> [!WARNING] Requisitos Mínimos
> - Node.js >= 20.0.0
> - npm >= 9.0.0
> - PostgreSQL 17.x
> - Redis 7.x

---

## Referencias

- Configuración detallada: [[02-Configuracion]]
- Mapa de servicios: [[21-Mapa-Servicios]]
- Guía de desarrollo: `GEMINI.md` (raíz del proyecto)
