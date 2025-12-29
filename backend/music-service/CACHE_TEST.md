# Script de Prueba - Sistema de Caché

## Verificar que Redis está corriendo

```bash
# Verificar Redis en puerto 6380
redis-cli -p 6380 ping
# Debe responder: PONG
```

Si no responde, iniciar Redis:
```bash
# Windows (si tienes Redis instalado)
redis-server --port 6380

# O usar Docker
docker run -d -p 6380:6379 redis:alpine
```

## Probar el Sistema de Caché

### 1. Verificar Health del Caché
```bash
curl http://localhost:3002/api/cache/health
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "healthy",
  "details": {
    "connection": "ok",
    "operations": "ok",
    "stats": { ... }
  }
}
```

### 2. Primera Búsqueda (Cache MISS)
```bash
curl "http://localhost:3002/api/youtube/search?q=shakira"
```

**Consola del servidor mostrará:**
```
❌ CACHE MISS: "shakira" → Consumiendo 100 unidades
✅ YouTube search completed and cached
```

**Respuesta incluirá:**
```json
{
  "success": true,
  "data": { ... },
  "_cached": false,
  "_quotaSaved": 100
}
```

### 3. Segunda Búsqueda Igual (Cache HIT)
```bash
curl "http://localhost:3002/api/youtube/search?q=shakira"
```

**Consola del servidor mostrará:**
```
✅ CACHE HIT: "shakira" → Ahorró 100 unidades (Total hoy: 100)
```

**Respuesta incluirá:**
```json
{
  "success": true,
  "data": { ... },
  "_cached": true,
  "_quotaSaved": 100
}
```

### 4. Búsqueda con Variaciones (Normalización)
```bash
# Todas estas deberían dar CACHE HIT
curl "http://localhost:3002/api/youtube/search?q=SHAKIRA"
curl "http://localhost:3002/api/youtube/search?q=shakira%20"
curl "http://localhost:3002/api/youtube/search?q=%20Shakira"
```

### 5. Ver Estadísticas de Caché
```bash
curl http://localhost:3002/api/cache/stats
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "hits": 3,
    "misses": 1,
    "hitRate": 75.0,
    "totalKeys": 5,
    "memoryUsage": "2.5MB",
    "quotaSavedToday": 300,
    "estimatedMonthlySavings": 9000
  }
}
```

### 6. Pre-calentar Caché con Canciones Populares
```bash
curl -X POST http://localhost:3002/api/cache/warmup
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Cache warmed up successfully",
  "data": {
    "warmedUp": 15,
    "alreadyCached": 0,
    "total": 15,
    "queries": ["shakira", "bad bunny", ...]
  }
}
```

### 7. Probar Endpoint de Video (Dashboard)
```bash
curl http://localhost:3002/api/youtube/video/fJ9rUzIMcZQ
```

**Primera llamada (MISS):**
```
❌ VIDEO CACHE MISS: fJ9rUzIMcZQ → Consumiendo 1 unidad
```

**Segunda llamada (HIT):**
```
✅ VIDEO CACHE HIT: fJ9rUzIMcZQ → Ahorró 1 unidad (Total hoy: 301)
```

### 8. Limpiar Caché (Admin)
```bash
curl -X DELETE http://localhost:3002/api/cache/clear
```

## Monitoreo en Tiempo Real

### Ver logs del servidor
```bash
# En la terminal donde corre npm run dev
# Verás logs como:
✅ CACHE HIT: "bad bunny" → Ahorró 100 unidades (Total hoy: 500)
❌ CACHE MISS: "new artist" → Consumiendo 100 unidades
```

### Ver keys en Redis
```bash
redis-cli -p 6380 KEYS "youtube:*"
```

### Ver estadísticas de Redis
```bash
redis-cli -p 6380 INFO memory
```

## Prueba Completa del Dashboard

1. **Abrir dashboard**: http://localhost:3004/admin
2. **Agregar canciones** desde el cliente
3. **Ver consola del music-service**:
   - Primera carga: Múltiples "VIDEO CACHE MISS"
   - Siguientes actualizaciones (cada 10 seg): Todos "VIDEO CACHE HIT"

## Resultados Esperados

### Sin Caché (Antes)
```
10 canciones en cola × 1 actualización cada 10 seg = 6 actualizaciones/min
6 actualizaciones × 10 canciones = 60 llamadas/min
60 llamadas × 60 min = 3,600 llamadas/hora
3,600 unidades/hora × 24 horas = 86,400 unidades/día
```

### Con Caché (Después)
```
Primera carga: 10 llamadas (10 unidades)
Siguientes 8,639 actualizaciones: 0 llamadas (0 unidades)
Total: 10 unidades/día (99.99% reducción)
```

## Troubleshooting

### Error: "Cache health check: UNHEALTHY"
```bash
# Verificar que Redis esté corriendo
redis-cli -p 6380 ping

# Verificar puerto en .env
cat backend/.env | grep REDIS_URL
# Debe ser: REDIS_URL=redis://localhost:6380
```

### Error: "Failed to connect to Redis"
```bash
# Reiniciar Redis
redis-server --port 6380

# O con Docker
docker restart <redis-container-id>
```

### Caché no funciona
```bash
# Verificar imports en serverUltraSimple.ts
grep "CacheService" backend/music-service/src/serverUltraSimple.ts

# Verificar que el servicio se reinició
# Debe mostrar: "✅ Cache Service: ENABLED"
```
