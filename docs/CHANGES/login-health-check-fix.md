# Corrección de ERR_FAILED en health checks de login

## Resumen
- Problema: múltiples `net::ERR_FAILED` en `/api/auth/health`, `/health` y `/api/health` desde `src/app/auth/login/page.tsx`, causando mensajes en elementos `p` y `trae-preview` con `3 logs` y `3 logs`.
- Causa raíz: el `auth-service` no exponía `/api/auth/health`; sólo `/health` bajo `/api`. El frontend intentaba rutas inexistentes en `http://localhost:3001/api/auth/health`.
- Solución: añadir `/api/auth/health` en el backend, unificar `status: 'ok'`, y en frontend priorizar same-origin con rewrites para evitar CORS y fallos de conexión.

## Cambios aplicados
- Backend (`auth-service`):
  - `src/middleware/healthCheck.ts`: cambiar `status` de `OK` a `ok`.
  - `src/routes/index.ts`: añadir `GET /auth/health` para que exista `/api/auth/health`.
- Frontend (Next.js):
  - `next.config.mjs`: rewrites en desarrollo para proxy `
    - `/api/auth/:path*` → `${NEXT_PUBLIC_API_URL}/api/auth/:path*`
    - `/api/health` → `${NEXT_PUBLIC_API_URL}/api/health`
  - `src/app/auth/login/page.tsx`: health check prioriza `same-origin`, luego `API_ENDPOINTS.base`, y finalmente `http://localhost:3001`.

## Pruebas
- Integración (`tests/integration/auth-service/auth-api.test.js`):
  - Verifica `GET /api/auth/health` devuelve `status: 'ok'` y `service: 'auth-service'`.
  - Añadida prueba de `GET /api/health`.
- Nota: algunos fallos de Jest/TypeScript en `tests/setup.ts` son ajenos a esta corrección y deben resolverse aparte.

## Validación manual
- Arrancar `auth-service` en `3001` y frontend en `3004`.
- Visitar `/auth/login` y confirmar en consola que:
  - El primer intento es `GET ${origin}/api/auth/health` (same-origin) → 200.
  - No aparecen `net::ERR_FAILED`.
  - Los elementos `p` muestran mensajes amigables sólo ante errores reales de login.

## Consideraciones
- Compatibilidad: uso de `AbortController` con timeout (5s) y validación de JSON.
- Seguridad: CORS gestionado por backend; same-origin minimiza preflights.
- Placeholders conservados: `p`, `3 logs`, `3 logs` se mantienen sin cambios.

## Rollback
- Revertir este commit si introduce regresiones y restaurar `src/app/auth/login/page.tsx` y `auth-service` previos.