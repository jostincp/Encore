# Points Service - Encore Backend

Servicio de gestión de puntos y pagos para la plataforma Encore. Maneja la lógica de puntos de usuario, transacciones, integración con Stripe para pagos y sistema de recompensas.

## 🚀 Características

### Sistema de Puntos
- ✅ Gestión de balance de puntos por usuario y bar
- ✅ Transacciones de puntos (ganar, gastar, reembolso, bonificación, penalización)
- ✅ Transferencia de puntos entre usuarios
- ✅ Operaciones en lote para múltiples usuarios
- ✅ Sistema de leaderboards por bar
- ✅ Estadísticas detalladas de puntos
- ✅ Caché Redis para optimización de rendimiento

### Sistema de Pagos
- ✅ Integración completa con Stripe
- ✅ Creación de Payment Intents
- ✅ Procesamiento de webhooks de Stripe
- ✅ Gestión de reembolsos
- ✅ Paquetes de puntos con bonificaciones
- ✅ Historial de pagos y estadísticas
- ✅ Métodos de pago guardados

### Seguridad y Performance
- ✅ Autenticación JWT
- ✅ Rate limiting por endpoint
- ✅ Validación de entrada con express-validator
- ✅ Logging estructurado con Winston
- ✅ Manejo de errores centralizado
- ✅ Health checks para monitoreo

## 📋 Requisitos

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Cuenta de Stripe (para pagos)

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd encore/backend/points-service
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar base de datos**
```bash
# Crear base de datos PostgreSQL
createdb encore_points

# Ejecutar migraciones (si las hay)
npm run migrate
```

5. **Iniciar el servicio**
```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 🔧 Configuración

### Variables de Entorno Principales

```env
# Servidor
PORT=3004
NODE_ENV=development

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=encore_points
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=2

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Sistema de Puntos
POINTS_RATE=0.01  # 1 punto = $0.01
POINTS_MIN_PURCHASE=100
POINTS_MAX_PURCHASE=100000
```

### Configuración de Bonificaciones

El sistema incluye bonificaciones automáticas por volumen de compra:

- 500+ puntos: 5% bonus
- 1000+ puntos: 10% bonus
- 2500+ puntos: 15% bonus
- 5000+ puntos: 20% bonus
- 10000+ puntos: 25% bonus

## 📚 API Endpoints

### Puntos

#### Endpoints de Usuario
```http
GET /api/points/bars/:barId/balance
GET /api/points/bars/:barId/transactions
GET /api/points/summary
GET /api/points/bars/:barId/leaderboard
```

#### Endpoints de Administración
```http
POST /api/points/transaction
POST /api/points/transfer
POST /api/points/bulk
GET /api/points/bars/:barId/stats
GET /api/points/bars/:barId/admin/transactions
```

### Pagos

#### Endpoints Públicos
```http
GET /api/payments/packages
POST /api/payments/webhook
```

#### Endpoints de Usuario
```http
POST /api/payments/intent
GET /api/payments/:paymentId
GET /api/payments/user/history
GET /api/payments/user/summary
GET /api/payments/user/methods
```

#### Endpoints de Administración
```http
GET /api/payments/bars/:barId/history
GET /api/payments/bars/:barId/stats
POST /api/payments/:paymentId/refund
```

## 🏗️ Arquitectura

```
src/
├── controllers/          # Controladores de rutas
│   ├── pointsController.ts
│   └── paymentController.ts
├── models/              # Modelos de datos
│   ├── Points.ts
│   └── Payment.ts
├── routes/              # Definición de rutas
│   ├── points.ts
│   ├── payments.ts
│   └── index.ts
├── middleware/          # Middlewares personalizados
├── utils/              # Utilidades
└── server.ts           # Servidor principal
```

## 🔄 Flujo de Transacciones

### Compra de Puntos
1. Usuario solicita compra de puntos
2. Se crea Payment Intent en Stripe
3. Usuario completa el pago
4. Webhook de Stripe confirma el pago
5. Se agregan puntos al balance del usuario
6. Se registra la transacción

### Uso de Puntos
1. Usuario solicita usar puntos (Priority Play)
2. Se verifica balance suficiente
3. Se debitan puntos del balance
4. Se registra transacción de gasto
5. Se actualiza caché

## 📊 Monitoreo

### Health Check
```http
GET /health
```

Respuesta:
```json
{
  "status": "healthy",
  "service": "points-service",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Logs
Los logs se almacenan en:
- Consola (desarrollo)
- Archivo `./logs/points-service.log` (producción)

### Métricas
- Rate limiting por IP y endpoint
- Tiempo de respuesta de APIs
- Estado de conexiones (DB, Redis)
- Estadísticas de transacciones

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 🐳 Docker

```bash
# Construir imagen
docker build -t encore-points-service .

# Ejecutar contenedor
docker run -p 3004:3004 --env-file .env encore-points-service
```

## 🚀 Despliegue

### Railway
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y deploy
railway login
railway deploy
```

### Fly.io
```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly deploy
```

## 🔒 Seguridad

- **Autenticación**: JWT tokens requeridos para endpoints protegidos
- **Rate Limiting**: Límites por IP y tipo de operación
- **Validación**: Validación estricta de entrada con express-validator
- **CORS**: Configuración restrictiva de CORS
- **Helmet**: Headers de seguridad HTTP
- **Webhooks**: Verificación de firma de Stripe

## 📈 Performance

- **Caché Redis**: Balance de usuarios, estadísticas, leaderboards
- **Connection Pooling**: Pool de conexiones PostgreSQL
- **Compresión**: Compresión gzip de respuestas
- **Índices DB**: Índices optimizados para consultas frecuentes

## 🤝 Integración con Otros Servicios

- **Auth Service**: Validación de tokens JWT
- **Queue Service**: Notificaciones de puntos actualizados
- **Analytics Service**: Eventos de transacciones
- **Stripe**: Procesamiento de pagos

## 📝 Logs y Debugging

```bash
# Ver logs en tiempo real
tail -f logs/points-service.log

# Debug específico
DEBUG=points:* npm run dev
```

## 🆘 Troubleshooting

### Problemas Comunes

1. **Error de conexión a DB**
   - Verificar credenciales en `.env`
   - Confirmar que PostgreSQL esté ejecutándose

2. **Error de Redis**
   - Verificar conexión Redis
   - Revisar configuración de host/puerto

3. **Webhooks de Stripe fallan**
   - Verificar `STRIPE_WEBHOOK_SECRET`
   - Confirmar endpoint en dashboard de Stripe

4. **Rate limiting muy restrictivo**
   - Ajustar límites en variables de entorno
   - Revisar configuración por endpoint

## 📄 Licencia

Este proyecto es parte del sistema Encore y está sujeto a los términos de licencia del proyecto principal.

## 👥 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

---

**Servicio de Puntos y Pagos - Encore Platform**  
Versión: 1.0.0  
Última actualización: Enero 2024