# Encore Analytics Service

🎵 **Servicio de Analíticas para Encore** - Sistema completo de recopilación, procesamiento y análisis de datos para la plataforma Encore.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Eventos](#eventos)
- [Reportes](#reportes)
- [Métricas](#métricas)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contribución](#contribución)

## 🎯 Descripción

El **Analytics Service** es un microservicio especializado en la recopilación, procesamiento y análisis de datos de la plataforma Encore. Proporciona insights valiosos sobre el comportamiento de usuarios, preferencias musicales, ventas del menú y patrones de actividad.

### Funcionalidades Principales

- **Recopilación de Eventos**: Captura eventos de música, menú, usuarios y cola en tiempo real
- **Procesamiento de Datos**: Análisis automático y generación de métricas
- **Dashboard en Tiempo Real**: Métricas actualizadas vía WebSockets
- **Reportes Automatizados**: Generación de reportes diarios, semanales y mensuales
- **Exportación de Datos**: Soporte para CSV, JSON, PDF y Excel
- **Cache Inteligente**: Optimización de rendimiento con Redis
- **Monitoreo**: Métricas de sistema y logging completo

## ✨ Características

### 🎵 Análisis Musical
- Canciones más populares por período
- Géneros musicales preferidos
- Análisis de cola de reproducción
- Patrones de votación
- Estadísticas de priority play

### 🍔 Análisis de Menú
- Productos más vendidos
- Análisis de ingresos
- Patrones de consumo
- Tendencias por horario
- Análisis de puntos gastados

### 👥 Análisis de Usuarios
- Comportamiento de usuarios
- Patrones de actividad
- Análisis de registros y logins
- Segmentación de usuarios
- Análisis de retención

### 📊 Dashboard y Reportes
- Métricas en tiempo real
- Reportes programados
- Filtros avanzados
- Exportación múltiple
- Visualizaciones interactivas

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Other Services │
│   Dashboard     │◄──►│                 │◄──►│  (User, Music,  │
└─────────────────┘    └─────────────────┘    │   Menu, etc.)   │
                                ▲              └─────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │  Analytics Service  │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ Controllers   │  │
                    │  └───────────────┘  │
                    │  ┌───────────────┐  │
                    │  │   Services    │  │
                    │  └───────────────┘  │
                    │  ┌───────────────┐  │
                    │  │    Models     │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
            ┌─────────────┐ ┌─────────┐ ┌─────────┐
            │ PostgreSQL  │ │  Redis  │ │ Bull    │
            │  Database   │ │  Cache  │ │ Queue   │
            └─────────────┘ └─────────┘ └─────────┘
```

### Componentes Principales

- **Controllers**: Manejo de requests HTTP
- **Services**: Lógica de negocio y procesamiento
- **Models**: Definición de entidades y esquemas
- **Queue**: Procesamiento asíncrono con Bull
- **Cache**: Optimización con Redis
- **WebSockets**: Actualizaciones en tiempo real
- **Metrics**: Monitoreo con Prometheus

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- npm o yarn

### Instalación Local

```bash
# Clonar el repositorio
git clone <repository-url>
cd analytics-service

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Ejecutar migraciones
npm run migrate

# Poblar datos iniciales (opcional)
npm run seed

# Iniciar en modo desarrollo
npm run dev
```

### Docker

```bash
# Construir imagen
docker build -t encore-analytics-service .

# Ejecutar con docker-compose
docker-compose up -d
```

## ⚙️ Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
# Servidor
SERVER_PORT=3003
NODE_ENV=development

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=encore_analytics
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret
```

### Configuración de Base de Datos

```bash
# Crear base de datos
createdb encore_analytics

# Ejecutar migraciones
npm run migrate

# Poblar datos de prueba
npm run seed
```

## 📖 Uso

### Iniciar el Servicio

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start

# Con PM2
npm run pm2:start
```

### Verificar Estado

```bash
# Health check
curl http://localhost:3003/health

# Métricas
curl http://localhost:3003/metrics
```

## 🔌 API Endpoints

### Analytics

```http
GET    /api/analytics              # Obtener datos analíticos
GET    /api/analytics/:id          # Obtener analítica por ID
GET    /api/analytics/dashboard     # Datos del dashboard
GET    /api/analytics/trends        # Análisis de tendencias
GET    /api/analytics/realtime      # Métricas en tiempo real
POST   /api/analytics/compare       # Comparar períodos
```

### Events

```http
POST   /api/events                 # Crear evento
POST   /api/events/batch           # Crear eventos en lote
GET    /api/events                 # Listar eventos
GET    /api/events/:id             # Obtener evento por ID
GET    /api/events/recent          # Eventos recientes
GET    /api/events/statistics      # Estadísticas de eventos
```

### Reports

```http
POST   /api/reports                # Generar reporte
GET    /api/reports                # Listar reportes
GET    /api/reports/:id            # Obtener reporte por ID
GET    /api/reports/:id/download   # Descargar reporte
DELETE /api/reports/:id            # Eliminar reporte
POST   /api/reports/schedule       # Programar reporte
```

### Ejemplos de Uso

#### Crear Evento

```javascript
const response = await fetch('/api/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    type: 'song_played',
    userId: '123',
    barId: '456',
    data: {
      songId: '789',
      genre: 'rock',
      duration: 240
    }
  })
});
```

#### Obtener Métricas del Dashboard

```javascript
const response = await fetch('/api/analytics/dashboard?period=7d', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

const data = await response.json();
console.log(data.metrics);
```

## 📊 Eventos

### Tipos de Eventos Soportados

#### Eventos Musicales
- `song_requested` - Canción solicitada
- `song_played` - Canción reproducida
- `song_voted` - Voto en canción
- `song_skipped` - Canción saltada
- `priority_play` - Reproducción prioritaria
- `queue_added` - Añadido a cola
- `queue_removed` - Removido de cola

#### Eventos de Menú
- `product_ordered` - Producto pedido
- `product_sold` - Producto vendido
- `points_spent` - Puntos gastados
- `payment_completed` - Pago completado

#### Eventos de Usuario
- `user_registered` - Usuario registrado
- `user_login` - Usuario logueado
- `user_logout` - Usuario deslogueado
- `profile_updated` - Perfil actualizado

### Estructura de Eventos

```typescript
interface Event {
  id: string;
  type: string;
  userId?: string;
  barId: string;
  sessionId?: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    source?: string;
  };
}
```

## 📈 Reportes

### Tipos de Reportes

- **Daily Reports**: Resumen diario de actividad
- **Weekly Reports**: Análisis semanal de tendencias
- **Monthly Reports**: Reporte mensual completo
- **Custom Reports**: Reportes personalizados

### Formatos de Exportación

- **CSV**: Para análisis en Excel/Sheets
- **JSON**: Para integración con APIs
- **PDF**: Para presentaciones
- **XLSX**: Excel nativo

### Programación de Reportes

```javascript
// Programar reporte semanal
const response = await fetch('/api/reports/schedule', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    name: 'Weekly Music Report',
    type: 'music_analytics',
    schedule: '0 9 * * 1', // Lunes a las 9 AM
    format: 'pdf',
    filters: {
      period: '7d',
      barId: '456'
    }
  })
});
```

## 📊 Métricas

### Métricas de Sistema

- Request rate y latencia
- Error rate por endpoint
- Uso de memoria y CPU
- Conexiones de base de datos
- Cache hit/miss ratio

### Métricas de Negocio

- Eventos procesados por minuto
- Reportes generados
- Usuarios activos
- Canciones más populares
- Ingresos por período

### Monitoreo

```bash
# Métricas Prometheus
curl http://localhost:3003/metrics

# Health check detallado
curl http://localhost:3003/health/detailed

# Estado de la cola
curl http://localhost:3003/api/events/queue/status
```

## 🛠️ Desarrollo

### Estructura del Proyecto

```
src/
├── controllers/          # Controladores HTTP
├── services/            # Lógica de negocio
├── models/              # Modelos de datos
├── routes/              # Definición de rutas
├── middleware/          # Middleware personalizado
├── database/            # Configuración de DB
├── cache/               # Gestión de cache
├── queue/               # Procesamiento de colas
├── websocket/           # WebSocket handlers
├── metrics/             # Recolección de métricas
├── utils/               # Utilidades
├── types/               # Definiciones TypeScript
└── config/              # Configuración
```

### Scripts Disponibles

```bash
npm run dev              # Desarrollo con hot reload
npm run build            # Compilar TypeScript
npm run start            # Iniciar producción
npm run test             # Ejecutar tests
npm run test:watch       # Tests en modo watch
npm run test:coverage    # Coverage de tests
npm run lint             # Linting con ESLint
npm run format           # Formatear con Prettier
npm run migrate          # Ejecutar migraciones
npm run migrate:rollback # Revertir migración
npm run seed             # Poblar datos
npm run typecheck        # Verificar tipos
```

### Agregar Nuevos Tipos de Eventos

1. **Definir el tipo en `src/types/events.ts`**:

```typescript
export interface SongLikedEvent extends BaseEvent {
  type: 'song_liked';
  data: {
    songId: string;
    genre: string;
    artist: string;
  };
}
```

2. **Agregar procesamiento en `src/services/eventService.ts`**:

```typescript
private async processSongLikedEvent(event: SongLikedEvent) {
  // Lógica de procesamiento
}
```

3. **Actualizar validaciones en `src/middleware/validation.ts`**

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- --grep "EventService"

# Coverage
npm run test:coverage

# Tests de integración
npm run test:integration
```

### Estructura de Tests

```
tests/
├── unit/                # Tests unitarios
├── integration/         # Tests de integración
├── e2e/                # Tests end-to-end
├── fixtures/           # Datos de prueba
└── helpers/            # Utilidades de testing
```

### Ejemplo de Test

```typescript
describe('EventService', () => {
  it('should process song played event', async () => {
    const event = {
      type: 'song_played',
      userId: '123',
      barId: '456',
      data: { songId: '789' }
    };

    const result = await eventService.processEvent(event);
    expect(result.success).toBe(true);
  });
});
```

## 🚀 Deployment

### Docker

```dockerfile
# Dockerfile incluido en el proyecto
docker build -t encore-analytics .
docker run -p 3003:3003 encore-analytics-service
```

### Docker Compose

```yaml
# docker-compose.yml incluido
docker-compose up -d
```

### Kubernetes

```bash
# Aplicar manifiestos
kubectl apply -f k8s/
```

### Variables de Entorno de Producción

```env
NODE_ENV=production
SERVER_PORT=3003
DB_SSL=true
REDIS_PASSWORD=secure_password
JWT_SECRET=super_secure_secret
LOG_LEVEL=info
```

## 🤝 Contribución

### Proceso de Contribución

1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Estándares de Código

- **TypeScript**: Tipado estricto
- **ESLint**: Linting automático
- **Prettier**: Formateo consistente
- **Conventional Commits**: Mensajes de commit estandarizados
- **Tests**: Coverage mínimo del 80%

### Reportar Issues

Usa las plantillas de GitHub Issues para:
- 🐛 Bug reports
- 💡 Feature requests
- 📚 Mejoras de documentación

## 📄 Licencia

Este proyecto es parte del ecosistema Encore y está sujeto a los términos de licencia del proyecto principal.

## 📞 Soporte

- **Documentación**: [Wiki del proyecto]
- **Issues**: [GitHub Issues]
- **Discussions**: [GitHub Discussions]
- **Email**: support@encore.com

---

**Analytics Service - Encore Platform** - Potenciando decisiones basadas en datos 🎵📊