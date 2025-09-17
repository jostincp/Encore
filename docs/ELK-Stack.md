# Encore Platform - ELK Stack para Logging Avanzado

Sistema completo de logging y monitoreo basado en ELK Stack (Elasticsearch, Logstash, Kibana) con Winston para logging estructurado y alertas automáticas.

## 🏗️ Arquitectura del Sistema de Logging

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Aplicaciones  │───▶│    Logstash     │───▶│  Elasticsearch  │
│   (Winston)     │    │   Procesador    │    │     Motor       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼──┐               ┌────▼──┐               ┌────▼──┐
    │ File  │               │ Beats │               │ Kibana│
    │ Logs  │               │Input  │               │  UI   │
    └───────┘               └───────┘               └───────┘
                                                        │
                                                    ┌───▼──┐
                                                    │ Dash- │
                                                    │boards │
                                                    └───────┘
```

## 📋 Componentes del Sistema

### 1. **Winston Logger** (`backend/shared/utils/logger.ts`)
Logger avanzado con múltiples transportes y niveles personalizados:

#### Niveles de Log
```typescript
const customLevels = {
  levels: {
    error: 0,        // Errores de aplicación
    warn: 1,         // Advertencias
    info: 2,         // Información general
    http: 3,         // Logs HTTP
    debug: 4,        // Debug detallado
    critical: 5,     // Errores críticos del sistema
    security: 6,     // Eventos de seguridad
    audit: 7         // Auditoría de acciones
  }
}
```

#### Transportes Configurados
- **Archivo**: Rotación diaria con compresión
- **Consola**: Formato coloreado para desarrollo
- **Elasticsearch**: Indexación automática en producción
- **HTTP**: Logs de requests/responses
- **Performance**: Métricas de rendimiento
- **Audit**: Logs de auditoría con retención extendida

### 2. **Logstash Pipeline** (`elk/logstash/pipeline/logstash.conf`)
Procesador de logs que enriquece y transforma los datos:

#### Inputs
```ruby
input {
  tcp { port => 5000 }           # Logs TCP de aplicaciones
  beats { port => 5044 }         # Logs de archivos via Filebeat
  http { port => 8080 }          # Logs HTTP directos
}
```

#### Filtros
```ruby
filter {
  # Parseo de timestamps
  date { match => ["timestamp", "YYYY-MM-DD HH:mm:ss.SSS"] }

  # Enriquecimiento geo
  geoip { source => "ip" }

  # Parseo de user agents
  useragent { source => "userAgent" }

  # Procesamiento específico de Encore
  if [service] { mutate { add_field => { "service.name" => "%{service}" } } }
  if [error] { mutate { add_field => { "error.name" => "%{[error][name]}" } } }
}
```

#### Outputs
```ruby
output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "encore-logs-%{+YYYY.MM.dd}"
  }

  # Outputs condicionales por tipo
  if [level] == "critical" {
    elasticsearch { index => "encore-errors-%{+YYYY.MM.dd}" }
  }
  if [type] == "audit" {
    elasticsearch { index => "encore-audit-%{+YYYY.MM.dd}" }
  }
}
```

### 3. **Elasticsearch Template** (`elk/logstash/config/elasticsearch-template.json`)
Template de indexación que define mappings optimizados:

#### Mappings Principales
```json
{
  "properties": {
    "@timestamp": { "type": "date" },
    "level": { "type": "keyword" },
    "service.name": { "type": "keyword" },
    "message": { "type": "text", "analyzer": "standard" },
    "error": {
      "properties": {
        "name": { "type": "keyword" },
        "message": { "type": "text" },
        "stack": { "type": "text" }
      }
    },
    "http": {
      "properties": {
        "method": { "type": "keyword" },
        "url": { "type": "text" },
        "status_code": { "type": "integer" },
        "response_time": { "type": "integer" }
      }
    }
  }
}
```

### 4. **Kibana Dashboards** (`elk/kibana/dashboards/`)
Dashboards preconfigurados para visualización:

#### Dashboard de Overview
- **Logs por nivel** (error, warn, info)
- **Errores por servicio**
- **Códigos HTTP**
- **Tiempos de respuesta**
- **Endpoints más usados**
- **Ubicaciones geográficas**

#### Dashboard de Errores
- **Tendencia de errores**
- **Errores por tipo**
- **Stack traces más comunes**
- **Tasa de error por endpoint**

#### Dashboard de Performance
- **Tiempos de respuesta**
- **Uso de CPU/Memoria**
- **Latencia de base de datos**
- **Throughput de requests**

### 5. **Sistema de Alertas** (`elk/elasticsearch/watcher/`)
Alertas automáticas basadas en Watcher:

#### Tipos de Alertas
- **Errores críticos**: > 10 errores en 5 minutos
- **Degradación de performance**: > 3s response time
- **Eventos de seguridad**: Intentos de login fallidos
- **Uso de recursos**: CPU/Memoria alta

## 🚀 Inicio Rápido

### 1. Levantar ELK Stack

```bash
# Levantar servicios ELK
docker-compose -f docker-compose.elk.yml up -d

# Verificar estado
curl http://localhost:9200/_cluster/health
curl http://localhost:5601/api/status
```

### 2. Configurar Winston en Aplicación

```typescript
import { logInfo, logError, logSecurity, logAudit } from '@encore/shared';

// Logs informativos
logInfo('Usuario autenticado', {
  userId: '123',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Logs de error
logError('Error de base de datos', new Error('Connection timeout'), {
  userId: '123',
  operation: 'user_update'
});

// Logs de seguridad
logSecurity('Intento de login fallido', {
  ip: '10.0.0.1',
  username: 'admin',
  attempts: 5
});

// Logs de auditoría
logAudit('Usuario actualizado', {
  userId: '123',
  action: 'profile_update',
  changes: ['email', 'name']
});
```

### 3. Ver Dashboards en Kibana

```bash
# Importar dashboards
curl -X POST "localhost:5601/api/saved_objects/_import" \
  -H "kbn-xsrf: true" \
  --form file=@elk/kibana/dashboards/overview-dashboard.ndjson

# Acceder a Kibana
open http://localhost:5601
```

## 📊 Tipos de Logs

### 1. **Logs de Aplicación**
```json
{
  "@timestamp": "2025-01-16T10:30:00.000Z",
  "level": "INFO",
  "service": "auth-service",
  "message": "Usuario autenticado exitosamente",
  "userId": "user_123",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "sessionId": "sess_456",
  "requestId": "req_789"
}
```

### 2. **Logs HTTP**
```json
{
  "@timestamp": "2025-01-16T10:30:00.100Z",
  "level": "HTTP",
  "service": "auth-service",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 200,
  "responseTime": 245,
  "ip": "192.168.1.100",
  "userId": "user_123",
  "requestId": "req_789"
}
```

### 3. **Logs de Error**
```json
{
  "@timestamp": "2025-01-16T10:30:05.000Z",
  "level": "ERROR",
  "service": "auth-service",
  "message": "Database connection failed",
  "error": {
    "name": "SequelizeConnectionError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ...",
    "code": "ECONNRESET"
  },
  "userId": "user_123",
  "requestId": "req_789"
}
```

### 4. **Logs de Seguridad**
```json
{
  "@timestamp": "2025-01-16T10:30:10.000Z",
  "level": "SECURITY",
  "service": "auth-service",
  "message": "Multiple failed login attempts",
  "ip": "10.0.0.1",
  "username": "admin",
  "attempts": 5,
  "userAgent": "curl/7.68.0"
}
```

### 5. **Logs de Auditoría**
```json
{
  "@timestamp": "2025-01-16T10:30:15.000Z",
  "level": "AUDIT",
  "service": "auth-service",
  "message": "User profile updated",
  "userId": "user_123",
  "action": "profile_update",
  "resource": "user",
  "changes": ["email", "phone"],
  "ip": "192.168.1.100"
}
```

## 🔍 Consultas Comunes en Kibana

### Errores por Servicio (últimas 24h)
```kql
level: ERROR OR level: CRITICAL
AND @timestamp >= "now-24h"
| stats count() by service.name
| sort count() desc
```

### Tiempos de Respuesta Lentos
```kql
http.response_time > 3000
AND @timestamp >= "now-1h"
| stats avg(http.response_time) by http.url
| sort avg(http.response_time) desc
```

### Intentos de Login Fallidos
```kql
level: SECURITY
AND message: "login failed"
AND @timestamp >= "now-1h"
| stats count() by ip
| sort count() desc
```

### Actividad de Usuario
```kql
level: AUDIT
AND userId: "user_123"
AND @timestamp >= "now-7d"
| timeline
```

## 🚨 Sistema de Alertas

### Configuración de Watcher

#### Alerta de Errores Críticos
```json
{
  "trigger": { "schedule": { "interval": "5m" } },
  "input": {
    "search": {
      "request": {
        "indices": ["encore-errors-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                { "range": { "@timestamp": { "gte": "now-5m" } } },
                { "term": { "level": "CRITICAL" } }
              ]
            }
          },
          "size": 0,
          "aggs": {
            "error_count": { "value_count": { "field": "level" } }
          }
        }
      }
    }
  },
  "condition": {
    "compare": { "ctx.payload.aggregations.error_count.value": { "gt": 5 } }
  },
  "actions": {
    "slack": {
      "slack": {
        "message": {
          "text": "🚨 CRÍTICO: {{ctx.payload.aggregations.error_count.value}} errores detectados"
        }
      }
    }
  }
}
```

#### Alerta de Performance
```json
{
  "trigger": { "schedule": { "interval": "10m" } },
  "input": {
    "search": {
      "request": {
        "indices": ["encore-performance-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                { "range": { "@timestamp": { "gte": "now-10m" } } },
                { "range": { "http.response_time": { "gte": 5000 } } }
              ]
            }
          },
          "size": 0,
          "aggs": {
            "slow_requests": { "value_count": { "field": "http.response_time" } }
          }
        }
      }
    }
  },
  "condition": {
    "compare": { "ctx.payload.aggregations.slow_requests.value": { "gt": 10 } }
  }
}
```

## 📈 Métricas y KPIs

### Métricas de Logging
- **Volumen de logs**: Logs por minuto/hora
- **Tasa de error**: Errores vs requests totales
- **Performance**: Tiempos de respuesta promedio
- **Disponibilidad**: Uptime de servicios

### Métricas de ELK Stack
- **Throughput**: Logs procesados por segundo
- **Latencia**: Tiempo de indexación
- **Uso de recursos**: CPU/Memoria de Elasticsearch
- **Tamaño de índices**: Crecimiento diario

### Alertas Configuradas
- **Errores críticos**: > 5 en 5 minutos
- **Performance degradation**: > 3s response time
- **Security events**: > 3 intentos fallidos
- **Resource usage**: > 80% CPU/Memoria

## 🔧 Configuración Avanzada

### Rotación de Logs
```javascript
const fileTransport = new DailyRotateFile({
  filename: 'logs/encore-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true
});
```

### Compresión de Índices
```json
{
  "index.lifecycle.name": "encore-logs-policy",
  "index.lifecycle.rollover_alias": "encore-logs",
  "index.lifecycle.management": {
    "policies": {
      "encore-logs-policy": {
        "phases": {
          "hot": { "min_age": "0ms", "actions": { "rollover": { "max_size": "50gb" } } },
          "warm": { "min_age": "30d", "actions": { "shrink": { "number_of_shards": 1 } } },
          "cold": { "min_age": "60d", "actions": { "freeze": {} } },
          "delete": { "min_age": "90d", "actions": { "delete": {} } }
        }
      }
    }
  }
}
```

### Backup y Recovery
```bash
# Backup de índices
curl -X PUT "localhost:9200/_snapshot/encore-backup/snapshot_$(date +%Y%m%d)" \
  -H 'Content-Type: application/json' \
  -d '{"indices": "encore-*","ignore_unavailable": true}'

# Restore de índices
curl -X POST "localhost:9200/_snapshot/encore-backup/snapshot_20250116/_restore"
```

## 🐛 Troubleshooting

### Problemas Comunes

#### Logs no aparecen en Kibana
```bash
# Verificar conectividad
curl http://localhost:9200/_cluster/health

# Verificar índices
curl http://localhost:9200/_cat/indices/encore-*

# Verificar Logstash
docker logs encore-logstash
```

#### Alto uso de CPU/Memoria
```bash
# Verificar configuración de JVM
docker exec encore-elasticsearch ps aux

# Ajustar heap size
export ES_JAVA_OPTS="-Xms1g -Xmx1g"
```

#### Índices no se rotan
```bash
# Verificar política de lifecycle
curl http://localhost:9200/_ilm/policy/encore-logs-policy

# Forzar rollover
curl -X POST "localhost:9200/encore-logs/_rollover"
```

## 📚 Recursos Adicionales

### Documentación Oficial
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Logstash Documentation](https://www.elastic.co/guide/en/logstash/current/index.html)
- [Kibana User Guide](https://www.elastic.co/guide/en/kibana/current/index.html)

### Librerías Utilizadas
- **winston**: Logger principal
- **winston-daily-rotate-file**: Rotación de archivos
- **@elastic/elasticsearch**: Cliente ES
- **logform**: Formateo de logs

### Comandos Útiles
```bash
# Ver estado del cluster
curl http://localhost:9200/_cluster/health?pretty

# Ver índices
curl http://localhost:9200/_cat/indices/encore-*?v

# Ver logs de Logstash
docker logs -f encore-logstash

# Ver métricas de Elasticsearch
curl http://localhost:9200/_nodes/stats
```

---

**Nota**: Este sistema ELK proporciona una base sólida para logging, monitoreo y alertas en Encore Platform. Está diseñado para escalar con el crecimiento de la aplicación y proporcionar insights valiosos para la resolución de problemas y optimización de performance.