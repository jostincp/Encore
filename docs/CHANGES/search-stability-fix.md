# Estabilización de búsqueda y priorización de canales oficiales

## Resumen
- **Problema**: Los resultados de búsqueda de canciones cambiaban de posición constantemente, dificultando la selección. Además, cuentas que re-subían canciones aparecían antes que los canales oficiales.
- **Causas**:
  1. Sin AbortController: búsquedas lentas sobreescribían resultados más recientes
  2. Sin caché del lado del cliente: cada cambio debounced disparaba una llamada al API
  3. Bug en pestaña "Sorpréndeme": usaba `sort(Math.random)` que re-ordenaba en cada re-render
  4. Sin priorización de canales oficiales (VEVO, Topic) en el backend

## Cambios aplicados

### Frontend (`/client/music/page.tsx`)
- **Debounce 300ms → 500ms**: Mayor estabilidad al escribir
- **AbortController**: Cancela búsquedas en progreso cuando la query cambia, evitando race conditions
- **Caché sessionStorage** (TTL 30 min): Búsquedas repetidas son instantáneas sin llamar al API
- **Fix "Sorpréndeme"**: Eliminado `sort(() => Math.random() - 0.5)` que causaba re-renders constantes

### Frontend (`SongSearchSimple.tsx`)
- Debounce 500ms con `useDebounce` hook + búsqueda automática al escribir
- Caché sessionStorage + AbortController
- Botón X para limpiar búsqueda

### Backend (`serverUltraSimple.ts`)
- **Nueva función `sortByOfficialChannel()`**: Reordena resultados priorizando canales oficiales
  - VEVO (score 3) > YouTube Music Topic (score 2) > resto (score 0)
- Se aplica antes de cachear en Redis, así el caché también tiene el orden correcto

## Archivos modificados
- `frontend/src/app/client/music/page.tsx`
- `frontend/src/components/SongSearchSimple.tsx`
- `backend/music-service/src/serverUltraSimple.ts`

## Validación
- Frontend compila sin errores (HTTP 200 en `/client/music?barId=...&table=1`)
- Backend health check OK (HTTP 200 en `/health`)
- Probado manualmente por el usuario: funciona correctamente

## Fecha
2026-02-11
