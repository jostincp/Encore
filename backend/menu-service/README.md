# Encore Menu Service

Servicio de gestión de menús para la plataforma Encore. Maneja elementos del menú y categorías para bares con funcionalidades CRUD completas, gestión en tiempo real y integración con otros microservicios.

## 🚀 Características

- **Gestión de Elementos del Menú**: CRUD completo para elementos del menú
- **Gestión de Categorías**: Organización jerárquica de elementos
- **Validación Robusta**: Validación de datos con express-validator
- **Autenticación JWT**: Integración con el servicio de autenticación
- **Cache Redis**: Optimización de rendimiento con cache distribuido
- **Subida de Imágenes**: Procesamiento y optimización de imágenes
- **Rate Limiting**: Protección contra abuso de API
- **Logging Avanzado**: Sistema de logging estructurado con Winston
- **Health Checks**: Monitoreo de salud del servicio
- **Documentación API**: Endpoints autodocumentados

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL
- **Cache**: Redis
- **Validación**: express-validator
- **Autenticación**: JWT
- **Logging**: Winston
- **Testing**: Jest + Supertest
- **Containerización**: Docker

## 📋 Prerrequisitos

- Node.js 18.0.0 o superior
- PostgreSQL 13+ 
- Redis 6+
- npm 8.0.0 o superior

## 🔧 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd encore/backend/menu-service
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
   createdb encore_menu
   
   # Ejecutar migraciones (si están disponibles)
   npm run migrate
   ```

5. **Iniciar Redis**
   ```bash
   redis-server
   ```

## 🚀 Uso

### Desarrollo
```bash
# Modo desarrollo con hot reload
npm run dev

# Compilar TypeScript
npm run build

# Verificar tipos
npm run typecheck
```

### Producción
```bash
# Compilar para producción
npm run build

# Iniciar servidor de producción
npm start
```

### Testing
```bash
# Ejecutar tests
npm test

# Tests en modo watch
npm run test:watch

# Coverage de tests
npm run test:coverage
```

### Linting
```bash
# Verificar código
npm run lint

# Corregir automáticamente
npm run lint:fix
```

## 🐳 Docker

### Construcción
```bash
# Construir imagen
docker build -t encore-menu-service .

# Ejecutar contenedor
docker run -p 3004:3004 --env-file .env encore-menu-service
```

### Docker Compose
```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f menu-service

# Detener servicios
docker-compose down
```

## 📚 API Endpoints

### Health Check
- `GET /health` - Estado del servicio
- `GET /info` - Información del servicio
- `GET /docs` - Documentación de la API

### Menu Items
- `GET /api/menu/items` - Listar elementos del menú
- `GET /api/menu/items/:id` - Obtener elemento específico
- `POST /api/menu/items` - Crear nuevo elemento
- `PUT /api/menu/items/:id` - Actualizar elemento
- `DELETE /api/menu/items/:id` - Eliminar elemento
- `PATCH /api/menu/items/bulk/availability` - Actualización masiva de disponibilidad
- `PUT /api/menu/items/reorder` - Reordenar elementos
- `GET /api/menu/items/stats` - Estadísticas de elementos

### Categories
- `GET /api/menu/categories` - Listar categorías
- `GET /api/menu/categories/:id` - Obtener categoría específica
- `POST /api/menu/categories` - Crear nueva categoría
- `PUT /api/menu/categories/:id` - Actualizar categoría
- `DELETE /api/menu/categories/:id` - Eliminar categoría
- `PUT /api/menu/categories/reorder` - Reordenar categorías
- `PATCH /api/menu/categories/:id/toggle` - Alternar estado de categoría

## 🔐 Autenticación

El servicio utiliza JWT para autenticación. Los tokens deben incluirse en el header:

```
Authorization: Bearer <jwt-token>
```

### Roles de Usuario
- **Admin**: Acceso completo a todos los bares
- **Bar Owner**: Acceso a su propio bar
- **Customer**: Solo lectura (GET requests)

## 📊 Estructura de Datos

### Menu Item
```typescript
{
  id: string;
  bar_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: object;
  tags?: string[];
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}
```

### Category
```typescript
{
  id: string;
  bar_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}
```

## 🔧 Configuración

### Variables de Entorno Principales

```env
# Servidor
PORT=3004
NODE_ENV=development

# Base de Datos
DATABASE_URL=postgresql://user:pass@localhost:5432/encore_menu

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Subida de Archivos
UPLOAD_MAX_SIZE=5242880
UPLOAD_DEST=uploads/menu
```

## 📝 Logging

El servicio utiliza Winston para logging estructurado:

- **Consola**: Logs formateados para desarrollo
- **Archivos**: Logs JSON para producción
- **Niveles**: error, warn, info, debug

### Ubicación de Logs
- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores
- `logs/debug.log` - Logs de debug

## 🚨 Manejo de Errores

- **Validación**: Errores 400 con detalles específicos
- **Autenticación**: Errores 401 para tokens inválidos
- **Autorización**: Errores 403 para permisos insuficientes
- **No Encontrado**: Errores 404 para recursos inexistentes
- **Servidor**: Errores 500 para fallos internos

## 🔄 Cache

El servicio utiliza Redis para cache:

- **Menu Items**: TTL de 30 minutos
- **Categories**: TTL de 1 hora
- **Stats**: TTL de 5 minutos

### Invalidación de Cache
- Automática al crear/actualizar/eliminar
- Manual mediante endpoints específicos

## 📈 Monitoreo

### Health Checks
- **Database**: Verificación de conexión PostgreSQL
- **Redis**: Verificación de conexión Redis
- **Memory**: Uso de memoria del proceso
- **Uptime**: Tiempo de actividad del servicio

### Métricas
- Requests por segundo
- Tiempo de respuesta promedio
- Errores por tipo
- Uso de cache

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests específicos
npm test -- --testNamePattern="Menu Items"

# Coverage
npm run test:coverage
```

### Estructura de Tests
- **Unit Tests**: Funciones individuales
- **Integration Tests**: Endpoints completos
- **E2E Tests**: Flujos completos de usuario

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

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es parte del sistema Encore y está sujeto a los términos de licencia del proyecto principal.

## 📞 Soporte

Para soporte técnico:
- 📧 Email: support@encore.com
- 📱 Slack: #menu-service
- 🐛 Issues: GitHub Issues

## 🔄 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para historial de cambios.

---

**Servicio de Menús - Encore Platform** - Desarrollado con ❤️ por el equipo de Encore