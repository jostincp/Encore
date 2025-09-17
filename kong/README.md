# Encore Platform - Kong API Gateway

Sistema completo de API Gateway utilizando Kong para enrutamiento centralizado, autenticación JWT y gestión de tráfico avanzada.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│   Kong Gateway  │────│ Microservicios  │
│   (React)       │    │   (API Gateway) │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │  JWT    │             │ Plugins │             │  Auth   │
    │  Auth   │             │  CORS   │             │ Service │
    │         │             │ Rate    │             │         │
    │         │             │ Limit   │             │         │
    └─────────┘             └─────────┘             └─────────┘
                                                        │
                                                   ┌────▼────┐
                                                   │  AWS    │
                                                   │ Secrets │
                                                   │ Manager │
                                                   └─────────┘
```

## 📋 Características Principales

### 🔐 **Autenticación JWT**
- **Plugin personalizado** integrado con AWS Secrets Manager
- **Validación automática** de tokens JWT
- **Cache inteligente** de claves públicas
- **Claims personalizables** por servicio

### 🛡️ **Seguridad Avanzada**
- **CORS restrictivo** con orígenes específicos
- **Rate limiting** configurable por servicio
- **Headers de seguridad** automáticos
- **Detección de bots** integrada

### ⚡ **Rendimiento**
- **Load balancing** automático
- **Health checks** para upstreams
- **Circuit breaker** para fallos
- **Response caching** opcional

### 📊 **Monitoreo**
- **Métricas detalladas** vía Prometheus
- **Logs estructurados** a Elasticsearch
- **Dashboard de Kong** para administración
- **Alertas automáticas** de rendimiento

## 🚀 Inicio Rápido

### 1. Iniciar Kong con Docker

```bash
# Iniciar stack completo de monitoreo (incluye Kong)
docker-compose -f docker-compose.monitoring.yml up -d kong kong-database

# Verificar estado
docker-compose -f docker-compose.monitoring.yml logs kong
```

### 2. Verificar Instalación

```bash
# Verificar que Kong esté corriendo
curl http://localhost:8001/status

# Acceder al Admin GUI
open http://localhost:8002
```

### 3. Probar API Gateway

```bash
# Probar ruta sin autenticación (debería fallar)
curl http://localhost:8000/api/music/songs

# Probar health check
curl http://localhost:8000/api/auth/health
```

## ⚙️ Configuración

### Variables de Entorno

```bash
# Kong Configuration
KONG_DATABASE=postgres
KONG_PG_HOST=kong-database
KONG_PG_USER=kong
KONG_PG_PASSWORD=kong_password
KONG_PG_DATABASE=kong

# JWT Plugin Configuration
JWT_SECRET_NAME=encore/jwt
JWT_ALGORITHM=RS256
JWT_CLAIMS_TO_VERIFY=exp,iat,nbf

# AWS Configuration (para JWT plugin)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### Archivos de Configuración

#### **kong-simple.yml** - Configuración básica
- Sin autenticación JWT
- Plugins básicos (CORS, rate limiting)
- Ideal para desarrollo

#### **kong-auth.yml** - Configuración completa
- Autenticación JWT integrada
- Plugins avanzados
- Ideal para producción

#### **kong.yml** - Configuración avanzada
- Health checks complejos
- Múltiples upstreams
- Configuración enterprise

## 🔧 Plugin de Autenticación JWT

### Instalación del Plugin

```javascript
// El plugin se carga automáticamente desde kong/jwt-auth-plugin.js
// Configuración en kong-auth.yml
plugins:
  - name: encore-jwt-auth
    config:
      secret_name: encore/jwt
      algorithm: RS256
      claims_to_verify: [exp, iat, nbf]
      required_claims: [sub, email]
```

### Uso del Plugin

```javascript
// Headers requeridos para autenticación
const headers = {
  'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Content-Type': 'application/json'
};

// Ejemplo de request autenticado
fetch('http://localhost:8000/api/music/songs', {
  method: 'GET',
  headers: headers
});
```

### Claims del Token JWT

```javascript
// Estructura esperada del token
{
  "sub": "user_123",           // ID del usuario (requerido)
  "email": "user@example.com", // Email del usuario
  "role": "user",              // Rol del usuario
  "bar_id": "bar_001",         // ID del bar (opcional)
  "iat": 1640995200,           // Issued at
  "exp": 1641081600,           // Expiration
  "iss": "encore-auth"         // Issuer
}
```

## 🛡️ Seguridad

### Configuración CORS

```yaml
plugins:
  - name: cors
    config:
      origins:
        - http://localhost:3000
        - https://encore-platform.com
      methods: [GET, POST, PUT, DELETE, PATCH, OPTIONS]
      headers: [Authorization, Content-Type, X-Auth-Token]
      credentials: true
      max_age: 3600
```

### Rate Limiting

```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 100    # 100 requests por minuto
      hour: 1000     # 1000 requests por hora
      policy: local  # Almacenamiento local
```

### Headers de Seguridad

Kong añade automáticamente headers de seguridad:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
X-API-Version: 1.0
X-Powered-By: Encore Platform
```

## 📊 Monitoreo y Logs

### Métricas Disponibles

```bash
# Métricas de Kong vía Prometheus
curl http://localhost:8001/metrics

# Estadísticas de requests
curl http://localhost:8001/status

# Logs de Kong
docker-compose -f docker-compose.monitoring.yml logs kong
```

### Dashboard de Administración

```bash
# Acceder al Admin GUI
open http://localhost:8002

# Ver servicios configurados
curl http://localhost:8001/services

# Ver rutas configuradas
curl http://localhost:8001/routes

# Ver plugins activos
curl http://localhost:8001/plugins
```

## 🔄 Health Checks y Load Balancing

### Configuración de Upstream

```yaml
upstreams:
  - name: auth-service
    algorithm: round-robin
    targets:
      - target: auth-service:3001
        weight: 100
```

### Health Checks

```yaml
healthchecks:
  active:
    type: http
    http_path: /health
    healthy:
      interval: 10
      successes: 2
    unhealthy:
      interval: 5
      http_failures: 3
```

## 🧪 Testing

### Pruebas de Autenticación

```bash
# 1. Obtener token (sin autenticación requerida)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Usar token para acceder a rutas protegidas
curl http://localhost:8000/api/music/songs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. Probar rate limiting
for i in {1..150}; do
  curl http://localhost:8000/api/music/songs \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
done
```

### Pruebas de CORS

```bash
# Probar preflight request
curl -X OPTIONS http://localhost:8000/api/music/songs \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

## 🚀 Despliegue en Producción

### 1. Preparar Secrets en AWS

```bash
# Crear secreto JWT en AWS Secrets Manager
aws secretsmanager create-secret \
  --name encore/jwt \
  --secret-string '{"secret":"your-jwt-secret-here"}'
```

### 2. Configurar Kong para Producción

```yaml
# kong-prod.yml
services:
  - name: encore-auth-service
    url: http://auth-service.production.internal:3001
    plugins:
      - name: encore-jwt-auth
        config:
          secret_name: encore/jwt
          algorithm: RS256
```

### 3. Desplegar con Docker Compose

```bash
# Producción
docker-compose -f docker-compose.prod.yml up -d

# Con health checks
docker-compose -f docker-compose.prod.yml ps
```

## 🔧 Troubleshooting

### Problemas Comunes

#### Kong no inicia
```bash
# Ver logs detallados
docker-compose -f docker-compose.monitoring.yml logs kong

# Verificar conectividad a base de datos
docker-compose -f docker-compose.monitoring.yml exec kong-database pg_isready -U kong
```

#### Plugin JWT no carga
```bash
# Verificar que el plugin esté en el contenedor
docker-compose -f docker-compose.monitoring.yml exec kong ls /usr/local/share/lua/5.1/kong/plugins/

# Verificar configuración
curl http://localhost:8001/plugins | jq .
```

#### Autenticación falla
```bash
# Verificar token JWT
echo "YOUR_JWT_TOKEN" | jwt decode -

# Verificar secreto en AWS
aws secretsmanager get-secret-value --secret-id encore/jwt
```

#### Rate limiting no funciona
```bash
# Verificar configuración del plugin
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="rate-limiting")'

# Verificar headers de respuesta
curl -I http://localhost:8000/api/music/songs
```

### Comandos Útiles

```bash
# Reiniciar Kong
docker-compose -f docker-compose.monitoring.yml restart kong

# Recargar configuración
curl -X POST http://localhost:8001/config

# Ver configuración actual
curl http://localhost:8001/config | jq .

# Limpiar base de datos de Kong
docker-compose -f docker-compose.monitoring.yml exec kong-database psql -U kong -d kong -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Backup de configuración
curl http://localhost:8001/config > kong-backup-$(date +%Y%m%d).json
```

## 📚 API Reference

### Endpoints de Kong

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/auth/*` | GET, POST, PUT, DELETE | Servicio de autenticación |
| `/api/music/*` | GET, POST, PUT, DELETE | Servicio de música |
| `/api/queue/*` | GET, POST, PUT, DELETE | Servicio de cola |
| `/api/points/*` | GET, POST, PUT, DELETE | Servicio de puntos |
| `/api/analytics/*` | GET, POST, PUT, DELETE | Servicio de analytics |
| `/api/menu/*` | GET, POST, PUT, DELETE | Servicio de menú |

### Headers Requeridos

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-API-Key: <api_key>  # Para algunos endpoints
```

### Códigos de Error

| Código | Descripción |
|--------|-------------|
| 401 | Token JWT inválido o expirado |
| 403 | Claims requeridos faltantes |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

## 🎯 Próximos Pasos

1. **API Versioning**: Implementar versionado de APIs
2. **GraphQL Support**: Añadir soporte para GraphQL
3. **WebSocket Proxy**: Proxy para conexiones WebSocket
4. **Service Mesh**: Integración con service mesh
5. **Multi-Region**: Despliegue multi-región

---

**Nota**: Esta implementación de Kong proporciona una base sólida para el API Gateway de Encore, con seguridad avanzada, monitoreo completo y escalabilidad automática.