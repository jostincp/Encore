# 🔧 Variables de Entorno - Guía Completa de Configuración

## 📋 Visión General

Esta guía documenta todas las variables de entorno necesarias para configurar Encore en diferentes entornos: **Development**, **Staging** y **Production**.

---

## 🏗️ Estructura de Entornos

### **🔧 Development (Local)**
- **Propósito:** Desarrollo y testing local
- **Base URLs:** `localhost:*`
- **Debug:** Habilitado
- **Logs:** Verbosos

### **🧪 Staging (Pre-producción)**
- **Propósito:** Testing antes de producción
- **Base URLs:** `staging.encore.com`
- **Debug:** Parcial
- **Logs:** Moderados

### **🚀 Production (Producción)**
- **Propósito:** Ambiente real para usuarios
- **Base URLs:** `api.encore.com`
- **Debug:** Deshabilitado
- **Logs:** Essenciales

---

## 📁 Archivos de Configuración por Servicio

### **🎵 Music Service (Puerto 3002)**

**Archivo:** `backend/music-service/.env.example`

```bash
# === CONFIGURACIÓN BÁSICA ===
PORT=3002
NODE_ENV=development          # development | staging | production
SERVICE_NAME=music-service

# === BASE DE DATOS ===
DB_HOST=localhost             # development: localhost | staging: db-staging | production: db-prod
DB_PORT=5432
DB_NAME=encore_music
DB_USER=encore_user
DB_PASSWORD=your_db_password
DB_SSL=false                  # production: true

# === REDIS CACHE ===
REDIS_HOST=localhost          # staging: redis-staging | production: redis-prod
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# === YOUTUBE API ===
YOUTUBE_API_KEY=AIzaSyDmB98_1mo0doDBWwETyd-4iOacHNu3avc
YOUTUBE_API_BASE_URL=https://www.googleapis.com/youtube/v3
YOUTUBE_MAX_RESULTS=25
YOUTUBE_REGION_CODE=US

# === SPOTIFY API ===
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_API_BASE_URL=https://api.spotify.com/v1

# === JWT ===
JWT_SECRET=your_jwt_secret_key_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_SEARCH_MAX_REQUESTS=100

# === LOGGING ===
LOG_LEVEL=info               # development: debug | production: info
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/music-service.log
```

### **🎵 Queue Service (Puerto 3003)**

**Archivo:** `backend/queue-service/.env.example`

```bash
# === CONFIGURACIÓN BÁSICA ===
PORT=3003
NODE_ENV=development
SERVICE_NAME=queue-service

# === BASE DE DATOS ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=encore
DB_USER=encore_user
DB_PASSWORD=your_db_password

# === REDIS (CRÍTICO PARA COLAS) ===
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=encore:queue:

# === JWT ===
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# === CONFIGURACIÓN DE COLA ===
QUEUE_MAX_SONGS_PER_USER=3
QUEUE_DEFAULT_PRIORITY_COST=10
QUEUE_MAX_QUEUE_SIZE=100
QUEUE_AUTO_APPROVE=false

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADD_SONG_RATE_LIMIT_WINDOW_MS=300000
```

### **🖥️ Frontend (Next.js)**

**Archivo:** `frontend/.env.example` (Ver `docs/SETUP/frontend_env_example.md`)

```bash
# === CONFIGURACIÓN BÁSICA ===
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development

# === URLs DE API - ESTANDARIZADAS ===
NEXT_PUBLIC_MUSIC_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_POINTS_SERVICE_URL=http://localhost:3004
NEXT_PUBLIC_MENU_SERVICE_URL=http://localhost:3005
NEXT_PUBLIC_ANALYTICS_SERVICE_URL=http://localhost:3006

# === CONFIGURACIÓN DE WEBSOCKET - UNIFICADO ===
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3003  # Queue Service
NEXT_PUBLIC_WEBSOCKET_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_WEBSOCKET_RECONNECT_DELAY=1000

# === CONFIGURACIÓN DE MÚSICA ===
NEXT_PUBLIC_YOUTUBE_API_KEY=AIzaSyDmB98_1mo0doDBWwETyd-4iOacHNu3avc
NEXT_PUBLIC_MAX_SEARCH_RESULTS=25
NEXT_PUBLIC_DEBOUNCE_DELAY=300

# === CONFIGURACIÓN DE COLA ===
NEXT_PUBLIC_QUEUE_UPDATE_INTERVAL=30000
NEXT_PUBLIC_PRIORITY_COST=25
NEXT_PUBLIC_STANDARD_COST=10

# === FEATURE FLAGS ===
NEXT_PUBLIC_FEATURE_SPOTIFY_ENABLED=false
NEXT_PUBLIC_FEATURE_MENU_3D_ENABLED=false
NEXT_PUBLIC_FEATURE_ANALYTICS_ENABLED=false
```

---

## 🌍 Configuración por Entorno

### **Development (.env.development)**

```bash
# Music Service
NODE_ENV=development
DB_HOST=localhost
REDIS_HOST=localhost
LOG_LEVEL=debug
DEBUG_ENABLED=true

# Queue Service
NODE_ENV=development
REDIS_HOST=localhost
LOG_LEVEL=debug

# Frontend
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_MUSIC_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_DEBUG_MODE=true
```

### **Staging (.env.staging)**

```bash
# Music Service
NODE_ENV=staging
DB_HOST=db-staging.encore.com
REDIS_HOST=redis-staging.encore.com
LOG_LEVEL=info
DEBUG_ENABLED=false

# Queue Service
NODE_ENV=staging
DB_HOST=db-staging.encore.com
REDIS_HOST=redis-staging.encore.com
LOG_LEVEL=info

# Frontend
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_MUSIC_SERVICE_URL=https://staging-api.encore.com:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=https://staging-api.encore.com:3003
NEXT_PUBLIC_DEBUG_MODE=false
```

### **Production (.env.production)**

```bash
# Music Service
NODE_ENV=production
DB_HOST=db-prod.encore.com
REDIS_HOST=redis-prod.encore.com
DB_SSL=true
LOG_LEVEL=warn
DEBUG_ENABLED=false

# Queue Service
NODE_ENV=production
DB_HOST=db-prod.encore.com
REDIS_HOST=redis-prod.encore.com
DB_SSL=true
LOG_LEVEL=warn

# Frontend
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_MUSIC_SERVICE_URL=https://api.encore.com:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=https://api.encore.com:3003
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

---

## 🔐 Variables Críticas de Seguridad

### **🔑 JWT Secrets**
```bash
# Development (pueden ser simples)
JWT_SECRET=dev_jwt_secret_key_123
JWT_REFRESH_SECRET=dev_refresh_secret_key_123

# Staging (más robustos)
JWT_SECRET=staging_jwt_super_secret_key_abc123def456
JWT_REFRESH_SECRET=staging_refresh_super_secret_key_xyz789uvw012

# Production (muy seguros)
JWT_SECRET=prod_jwt_super_secure_key_$(openssl rand -hex 32)
JWT_REFRESH_SECRET=prod_refresh_super_secure_key_$(openssl rand -hex 32)
```

### **🔐 Database Credentials**
```bash
# Development
DB_PASSWORD=dev_password_123

# Staging
DB_PASSWORD=staging_secure_password_abc123

# Production (usar secrets manager)
DB_PASSWORD=${DATABASE_PASSWORD_FROM_VAULT}
```

### **🌐 API Keys**
```bash
# YouTube API (misma key en todos los entornos)
YOUTUBE_API_KEY=AIzaSyDmB98_1mo0doDBWwETyd-4iOacHNu3avc

# Spotify API
SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID_FROM_VAULT}
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET_FROM_VAULT}
```

---

## 🚀 Configuración de Despliegue

### **Docker Compose (Development)**
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  music-service:
    env_file:
      - ./backend/music-service/.env.development
    
  queue-service:
    env_file:
      - ./backend/queue-service/.env.development
    
  frontend:
    env_file:
      - ./frontend/.env.development
```

### **Kubernetes (Production)**
```yaml
# k8s/music-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: music-service
spec:
  template:
    spec:
      containers:
      - name: music-service
        envFrom:
        - secretRef:
            name: music-service-secrets
        - configMapRef:
            name: music-service-config
```

---

## 📊 Variables de Monitoreo

### **Development**
```bash
MONITORING_ENABLED=true
DEBUG_EXTERNAL_APIS=true
VERBOSE_LOGGING=true
ERROR_REPORTING_ENABLED=false
```

### **Staging**
```bash
MONITORING_ENABLED=true
DEBUG_EXTERNAL_APIS=false
VERBOSE_LOGGING=false
ERROR_REPORTING_ENABLED=true
```

### **Production**
```bash
MONITORING_ENABLED=true
DEBUG_EXTERNAL_APIS=false
VERBOSE_LOGGING=false
ERROR_REPORTING_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
```

---

## 🔧 Comandos de Gestión

### **Copiar Variables de Entorno**
```bash
# Development
cp backend/music-service/.env.example backend/music-service/.env.development
cp backend/queue-service/.env.example backend/queue-service/.env.development
cp docs/SETUP/frontend_env_example.md frontend/.env.development

# Staging
cp backend/music-service/.env.example backend/music-service/.env.staging
cp backend/queue-service/.env.example backend/queue-service/.env.staging
cp docs/SETUP/frontend_env_example.md frontend/.env.staging

# Production
cp backend/music-service/.env.example backend/music-service/.env.production
cp backend/queue-service/.env.example backend/queue-service/.env.production
cp docs/SETUP/frontend_env_example.md frontend/.env.production
```

### **Validar Configuración**
```bash
# Verificar variables requeridas
npm run config:validate

# Verificar conexión a servicios
npm run config:check-connections

# Generar secrets para producción
npm run config:generate-secrets
```

---

## 📋 Checklist de Configuración

### **✅ Antes de Desplegar:**

- [ ] **Copiar .env.example a .env.{entorno}**
- [ ] **Configurar URLs de API por entorno**
- [ ] **Establecer JWT secrets seguros**
- [ ] **Configurar credenciales de base de datos**
- [ ] **Verificar API keys de servicios externos**
- [ ] **Ajustar niveles de logging**
- [ ] **Configurar rate limits por entorno**
- [ ] **Habilitar/deshabilitar feature flags**
- [ ] **Verificar configuración de CORS**
- [ ] **Configurar monitoreo y analytics**

### **🔐 Seguridad Requerida:**

- [ ] **JWT secrets con >32 caracteres**
- [ ] **Database passwords con >16 caracteres**
- [ ] **API keys en variables de entorno**
- [ ] **HTTPS en producción**
- [ ] **CORS configurado correctamente**
- [ ] **Rate limiting activado**
- [ ] **Security headers configurados**

---

## 🚨 Problemas Comunes y Soluciones

### **❌ "Database connection failed"**
```bash
# Verificar
DB_HOST=localhost
DB_PORT=5432
DB_USER=encore_user
DB_PASSWORD=correct_password

# Solución: Asegurar que PostgreSQL está corriendo
docker-compose up -d postgres
```

### **❌ "Redis connection refused"**
```bash
# Verificar
REDIS_HOST=localhost
REDIS_PORT=6379

# Solución: Iniciar Redis
docker-compose up -d redis
```

### **❌ "YouTube API quota exceeded"**
```bash
# Verificar
YOUTUBE_API_KEY=valid_api_key
YOUTUBE_CACHE_TTL=3600

# Solución: Habilitar cache y verificar quota
```

---

## 📝 Mejores Prácticas

1. **🔒 Nunca commitear .env files** - Solo .env.example
2. **🔐 Usar secrets managers en producción** - AWS Secrets Manager, Vault
3. **🌍 Separar configuración por entorno** - development/staging/production
4. **📊 Monitorear variables críticas** - JWT secrets, API keys
5. **🔄 Rotar secrets regularmente** - Cada 90 días
6. **📋 Documentar cambios** - Mantener .env.example actualizado
7. **🧪 Validar configuración** - Scripts de validación antes de deploy

---

## 🎯 Conclusión

Este sistema de variables de entorno proporciona:

- **✅ Configuración clara** por entorno
- **🔐 Seguridad robusta** con secrets management
- **🚀 Despliegue simplificado** con scripts automatizados
- **📊 Monitoreo integrado** de configuración crítica
- **🔄 Mantenimiento fácil** con documentación completa

**Para empezar:** Copia los archivos `.env.example` a `.env.{entorno}` y configura las variables según tu ambiente.

---

## 🔌 **Configuración de WebSocket - Guía Específica**

### **📋 Arquitectura Unificada**

Después de la migración, Encore usa una **arquitectura WebSocket unificada**:

```bash
🏗️ Queue Service (Puerto 3003)
├── API REST: /api/queue/*
├── WebSocket: Socket.IO Server
├── Redis: Pub/Sub para eventos
└── Autenticación: JWT + Roles
```

### **🔧 Variables de Entorno WebSocket**

```bash
# Frontend (.env.local)
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3003     # Queue Service
NEXT_PUBLIC_WEBSOCKET_RECONNECT_ATTEMPTS=5          # Reconexiones
NEXT_PUBLIC_WEBSOCKET_RECONNECT_DELAY=1000         # Delay entre reconexiones

# Backend (Queue Service)
PORT=3003                                           # Puerto del servicio
WEBSOCKET_CORS_ORIGIN=http://localhost:3004         # Frontend URL
WEBSOCKET_TRANSPORTS=websocket,polling             # Transportes habilitados
```

### **🎯 Eventos WebSocket Implementados**

#### **Client Events (Frontend → Backend)**
```typescript
'join_bar'           → Unirse a sala del bar
'leave_bar'          → Salir de sala del bar
'get_queue_position' → Obtener posición en cola
'get_queue_stats'    → Obtener estadísticas (admin)
'ping'               → Health check
```

#### **Server Events (Backend → Frontend)**
```typescript
'queue_state'        → Estado actual de la cola
'queue_updated'      → Cambios en la cola
'song_approved'      → Canción aprobada
'song_rejected'      → Canción rechazada
'now_playing'        → Canción actual
'user_joined'        → Usuario se unió
'user_left'          → Usuario se salió
'pong'               → Respuesta a ping
'error'              → Errores del servidor
```

### **🔐 Autenticación WebSocket**

```typescript
// Conexión con token JWT
const socket = io('http://localhost:3003', {
  auth: { token: 'your_jwt_token_here' },
  transports: ['websocket', 'polling']
});

// El servidor verifica automáticamente:
// - Validez del token JWT
// - Rol del usuario (admin, bar_owner, staff, user)
// - Acceso al bar solicitado
```

### **🧪 Testing de Conexión WebSocket**

```bash
# Ejecutar script de prueba
node test-websocket-connection.js

# Salida esperada:
🔍 Testing Encore WebSocket Connection...
📡 Connecting to WebSocket server at http://localhost:3003...
✅ WebSocket connected successfully!
🆔 Socket ID: abc123...
🏠 Attempting to join bar: default-bar
✅ Successfully joined bar: { barId: 'default-bar', ... }
✅ Queue state received: { queueLength: 0, ... }
✅ Ping/pong successful: { timestamp: '...' }
✅ Test completed successfully!
```

### **🚨 Solución de Problemas WebSocket**

#### **❌ "WebSocket connection failed"**
```bash
# Verificar que Queue Service está corriendo:
curl http://localhost:3003/health

# Respuesta esperada:
{
  "success": true,
  "service": "queue-service",
  "websocket": { "connected_clients": 0, "status": "active" }
}
```

#### **❌ "Authentication token required"**
```bash
# Verificar token JWT en localStorage:
localStorage.getItem('encore_access_token')

# Asegurar que el token no esté expirado
```

#### **❌ "Access denied to this bar"**
```bash
# Verificar rol del usuario y acceso al bar:
# - admin: acceso a todos los bares
# - bar_owner: acceso solo a sus bares
# - staff: acceso a bares asignados
# - user: acceso limitado
```

### **📊 Monitoreo WebSocket**

```bash
# Health check del servicio
curl http://localhost:3003/health

# Verificar clientes conectados
curl http://localhost:3003/health | jq '.websocket.connected_clients'

# Logs de conexión WebSocket
tail -f logs/queue-service.log | grep "Socket"
```

---

## 🎉 **Resumen de la Migración WebSocket**

### **✅ Cambios Realizados:**
1. **Eliminado** Simple WebSocket Server redundante
2. **Unificado** WebSocket en Queue Service (puerto 3003)
3. **Estandarizado** variables de entorno en frontend
4. **Corregidos** eventos y URLs en componentes
5. **Actualizada** documentación completa

### **🚀 Beneficios:**
- **Arquitectura limpia** - Un solo servicio WebSocket
- **Eventos consistentes** - Bien definidos y documentados
- **Seguridad real** - JWT + roles + autenticación
- **Escalabilidad** - Redis + rooms + pub/sub
- **Mantenibilidad** - Código único y centralizado

**🎊 El sistema WebSocket de Encore está completamente migrado y optimizado!**
