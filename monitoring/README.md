# Encore Platform - Monitoring & Analytics

Este directorio contiene la configuración completa para el sistema de monitoreo y analytics en tiempo real de la plataforma Encore, utilizando Grafana y Kibana.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Encore APIs   │────│   Analytics     │────│   Grafana       │
│   (Services)    │    │   Service       │    │   Dashboards    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Kibana        │
                    │   (Log Analysis)│
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │ Elasticsearch   │
                    │   (Data Store)  │
                    └─────────────────┘
```

## 📊 Componentes

### 1. **Grafana** - Dashboards en Tiempo Real
- **URL**: http://localhost:3000
- **Usuario**: admin
- **Contraseña**: admin
- **Propósito**: Visualización en tiempo real de métricas y KPIs

### 2. **Kibana** - Análisis de Logs
- **URL**: http://localhost:5601
- **Propósito**: Análisis avanzado de logs y consultas complejas

### 3. **Elasticsearch** - Almacenamiento de Datos
- **URL**: http://localhost:9200
- **Propósito**: Base de datos para logs y métricas

### 4. **Analytics Service** - API de Métricas
- **URL**: http://localhost:3005
- **Propósito**: Provee datos para Grafana/Kibana

## 🚀 Inicio Rápido

### 1. Iniciar el Stack de Monitoreo

```bash
# Iniciar servicios de monitoreo
docker-compose -f docker-compose.monitoring.yml up -d

# Verificar estado
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Configurar Grafana

1. **Acceder a Grafana**: http://localhost:3000
2. **Login**: admin / admin
3. **Cambiar contraseña** en el primer login
4. **Verificar datasource**: Configuration → Data Sources → "Encore Analytics"

### 3. Configurar Kibana

1. **Acceder a Kibana**: http://localhost:5601
2. **Configurar índices**:
   - Management → Index Patterns
   - Crear patrón: `encore-*`
3. **Importar dashboards**:
   ```bash
   curl -X POST "localhost:5601/api/saved_objects/_import" \
     -H "kbn-xsrf: true" \
     --form file=@monitoring/kibana/dashboards/encore-analytics.ndjson
   ```

## 📈 Dashboards Disponibles

### Grafana Dashboards

#### **Encore Main Dashboard**
- **Revenue Overview**: Tendencias de ingresos en tiempo real
- **Active Users**: Usuarios activos por hora
- **Song Plays**: Reproducciones de música
- **Queue Length**: Longitud de cola de música
- **Top Songs/Products**: Rankings en tiempo real
- **System Health**: Estado de salud del sistema
- **API Response Time**: Tiempos de respuesta
- **Error Rate**: Tasa de errores

#### **Métricas Incluidas**
- **Usuarios**: Activos, registrados, engagement
- **Ingresos**: Total, promedio por transacción
- **Música**: Reproducciones, canciones populares
- **Sistema**: CPU, memoria, latencia, errores
- **APIs**: Tasa de éxito, tiempos de respuesta

### Kibana Dashboards

#### **Encore Analytics Dashboard**
- **User Activity Over Time**: Actividad de usuarios por hora
- **Revenue Trends**: Tendencias de ingresos
- **Error Analysis**: Análisis de errores por tipo
- **Performance Metrics**: Métricas de rendimiento

## 🔧 Configuración Avanzada

### Variables de Entorno para Analytics

```bash
# Analytics Service
ANALYTICS_PORT=3005
ANALYTICS_DB_URL=mongodb://localhost:27017/encore_analytics
ANALYTICS_CACHE_TTL=300

# Grafana
GF_SECURITY_ADMIN_PASSWORD=your_secure_password
GF_USERS_ALLOW_SIGN_UP=false

# Elasticsearch
ES_JAVA_OPTS=-Xms1g -Xmx1g
```

### Configuración de Alertas

#### Grafana Alerting
1. **Crear alertas** en los paneles
2. **Configurar notificaciones** (Email, Slack, etc.)
3. **Establecer umbrales** para métricas críticas

#### Alertas Recomendadas
- **Error Rate > 5%**: Notificar equipo de desarrollo
- **Response Time > 2s**: Alertar sobre performance
- **Revenue Drop > 20%**: Notificar equipo comercial
- **Active Users < threshold**: Alertar sobre engagement

### Métricas Personalizadas

#### Agregar Nueva Métrica
```typescript
// En tu servicio
import { AnalyticsService } from '@encore/shared';

const analytics = new AnalyticsService();

await analytics.createAnalytics({
  bar_id: 'bar_001',
  metric_type: 'custom',
  metric_name: 'new_metric',
  value: 100,
  dimensions: { custom_field: 'value' }
});
```

#### Visualizar en Grafana
1. **Agregar panel** al dashboard
2. **Seleccionar datasource** "Encore Analytics"
3. **Configurar query** con la nueva métrica
4. **Aplicar formato** y thresholds

## 📊 API Endpoints

### Grafana Integration
```
POST /api/v1/grafana/query          # Consultas de métricas
POST /api/v1/grafana/search         # Lista de métricas disponibles
POST /api/v1/grafana/annotations    # Eventos importantes
POST /api/v1/grafana/tag-keys       # Variables de template
POST /api/v1/grafana/tag-values     # Valores de variables
```

### Kibana Integration
```
POST /api/v1/grafana/_search        # Búsquedas Elasticsearch
GET  /api/v1/grafana/_mapping       # Mappings de índices
```

### Analytics API
```
GET  /api/v1/analytics/dashboard/data    # Datos del dashboard
GET  /api/v1/analytics/realtime/metrics  # Métricas en tiempo real
GET  /api/v1/analytics/statistics        # Estadísticas generales
POST /api/v1/analytics/events            # Registrar eventos
```

## 🔍 Consultas Kibana

### Búsquedas Comunes
```kql
# Errores del último día
level: error AND @timestamp: > now-1d

# Actividad de usuario específico
user_id: "user_123" AND @timestamp: > now-24h

# Ingresos por hora
metric_name: revenue AND @timestamp: > now-24h
```

### Filtros Avanzados
```kql
# Errores por servicio
level: error AND service: (auth-service OR music-service)

# Métricas de performance
metric_type: performance AND value: > 1000

# Eventos de usuario
event_type: user AND event_name: login
```

## 📋 Monitoreo y Alertas

### Métricas de Sistema
- **CPU Usage**: Utilización de CPU por servicio
- **Memory Usage**: Consumo de memoria
- **Disk I/O**: Operaciones de disco
- **Network I/O**: Tráfico de red

### Métricas de Aplicación
- **Request Rate**: Solicitudes por segundo
- **Error Rate**: Porcentaje de errores
- **Response Time**: Latencia promedio
- **Throughput**: Rendimiento del sistema

### Alertas Configuradas
- **High Error Rate**: > 5% en 5 minutos
- **Slow Response Time**: > 2s promedio
- **Low Disk Space**: < 10% disponible
- **High Memory Usage**: > 90%

## 🛠️ Troubleshooting

### Problemas Comunes

#### Grafana no conecta al datasource
```bash
# Verificar conectividad
curl http://analytics-service:3005/api/v1/grafana/health

# Revisar logs
docker-compose -f docker-compose.monitoring.yml logs grafana
```

#### Kibana no muestra datos
```bash
# Verificar Elasticsearch
curl http://localhost:9200/_cluster/health

# Recrear índices
curl -X DELETE http://localhost:9200/encore-*
```

#### Métricas no aparecen
```bash
# Verificar Analytics Service
curl http://analytics-service:3005/health

# Revisar configuración de caché
docker-compose -f docker-compose.monitoring.yml logs analytics-service
```

### Comandos Útiles

```bash
# Reiniciar stack completo
docker-compose -f docker-compose.monitoring.yml down
docker-compose -f docker-compose.monitoring.yml up -d

# Ver logs en tiempo real
docker-compose -f docker-compose.monitoring.yml logs -f

# Backup de datos
docker run --rm -v encore-monitoring_elasticsearch-data:/data alpine tar czf - /data > backup.tar.gz

# Limpiar datos
docker-compose -f docker-compose.monitoring.yml down -v
```

## 📈 Escalabilidad

### Configuración para Producción

#### Elasticsearch Cluster
```yaml
# docker-compose.prod.yml
elasticsearch:
  environment:
    - cluster.name=encore-cluster
    - discovery.seed_hosts=elasticsearch-1,elasticsearch-2
    - cluster.initial_master_nodes=elasticsearch-1
  deploy:
    replicas: 3
```

#### Grafana HA
```yaml
grafana:
  environment:
    - GF_DATABASE_TYPE=postgres
    - GF_DATABASE_HOST=grafana-db
  deploy:
    replicas: 2
```

### Optimizaciones

#### Índices Elasticsearch
```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "30s"
  }
}
```

#### Cache Analytics
```typescript
// Configuración de caché avanzada
const cacheConfig = {
  ttl: 300, // 5 minutos
  maxSize: 1000, // Máximo 1000 entradas
  strategy: 'LRU'
};
```

## 🔐 Seguridad

### Configuración de Seguridad

#### Grafana Security
```ini
# grafana.ini
[security]
admin_user = admin
admin_password = ${GF_SECURITY_ADMIN_PASSWORD}

[auth]
disable_login_form = false
oauth_auto_login = false

[users]
allow_sign_up = false
```

#### Kibana Security
```yaml
# kibana.yml
xpack.security.enabled: true
xpack.security.authc.realms.native.native1.order: 0
```

### Encriptación de Datos
- **En tránsito**: TLS/SSL habilitado
- **En reposo**: Encriptación de disco
- **Credenciales**: AWS Secrets Manager

## 📚 Recursos Adicionales

### Documentación
- [Grafana Documentation](https://grafana.com/docs/)
- [Kibana Documentation](https://www.elastic.co/guide/en/kibana/)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/)

### Comunidad
- [Grafana Community](https://community.grafana.com/)
- [Elastic Community](https://discuss.elastic.co/)

### Plugins Recomendados
- **Grafana**: Worldmap, Status Panel, Pie Chart
- **Kibana**: Vega visualizations, Machine Learning

---

**Nota**: Este sistema de monitoreo proporciona observabilidad completa de la plataforma Encore, permitiendo identificar problemas, optimizar performance y tomar decisiones basadas en datos en tiempo real.