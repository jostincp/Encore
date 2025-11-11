# 🎵 Encore - Plataforma de Gestión Musical

<div align="center">
  <img src="https://img.shields.io/badge/React-18.x-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Node.js-18.x-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-14.x-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker" alt="Docker">
</div>

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características Principales](#-características-principales)
- [Arquitectura](#️-arquitectura)
- [Instalación y Desarrollo](#-instalación-y-desarrollo)
- [Funcionalidades](#-funcionalidades)
- [Tecnologías](#️-tecnologías)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Flujo de Trabajo](#-flujo-de-trabajo)
- [Despliegue](#-despliegue)
- [📚 Documentación Completa](#-documentación-completa)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

## 🎯 Descripción

**Encore** es una plataforma completa de gestión musical moderna que permite a los usuarios descubrir, organizar y disfrutar de música de múltiples proveedores. Construida con tecnologías de vanguardia, ofrece una experiencia fluida tanto para usuarios finales como para administradores.

### ✨ Propósito

Encore resuelve la fragmentación en el consumo de música digital al proporcionar:
- **Unificación**: Acceso centralizado a múltiples servicios de música
- **Personalización**: Experiencia adaptada a cada usuario
- **Gestión**: Herramientas administrativas completas
- **Escalabilidad**: Arquitectura preparada para crecimiento

## 🚀 Características Principales

### Para Usuarios Finales
- 🎵 **Búsqueda Universal**: Encuentra música en múltiples plataformas
- 📱 **PWA Nativa**: Experiencia de aplicación móvil
- 🔐 **Autenticación Segura**: Login con JWT y sesiones persistentes
- 📊 **Historial Inteligente**: Seguimiento de reproducción y recomendaciones
- ⭐ **Sistema de Favoritos**: Organiza tu música preferida
- 🎨 **UI/UX Moderna**: Interfaz responsive y accesible
- 🌙 **Modo Oscuro**: Tema adaptable
- 📴 **Soporte Offline**: Funcionalidad básica sin conexión

### Para Administradores
- 👥 **Gestión de Usuarios**: Panel completo de administración
- 📈 **Analytics Avanzados**: Métricas detalladas de uso
- 🎵 **Gestión de Contenido**: Control de catálogo musical
- ⚙️ **Configuración Global**: Ajustes del sistema
- 📊 **Dashboard en Tiempo Real**: Monitoreo de la plataforma
- 🔒 **Control de Acceso**: Roles y permisos granulares

## 🏗️ Arquitectura

### Frontend
- **Framework**: React 18 + Next.js 14
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS + Shadcn UI
- **3D**: Three.js + React Three Fiber
- **Estado**: Zustand
- **Animaciones**: Framer Motion
- **PWA**: next-pwa
- **Tiempo Real**: Socket.IO Client

### Backend (Microservicios)
- **Runtime**: Node.js 20+ con TypeScript
- **Framework**: Express.js
- **Base de Datos**: PostgreSQL (Supabase/Railway)
- **Cache**: Redis
- **Tiempo Real**: Socket.IO
- **Pagos**: Stripe
- **APIs Externas**: YouTube Data API v3, Spotify Web API

#### Microservicios:
1. **auth-service**: Autenticación y autorización
2. **music-service**: Gestión de música (YouTube/Spotify)
3. **queue-service**: Cola de reproducción en tiempo real
4. **points-service**: Sistema de puntos y pagos
5. **menu-service**: Menú digital y gestión de productos
6. **analytics-service**: Analíticas y reportes

## 🚀 Instalación y Desarrollo

### Prerrequisitos
- Node.js 20+
- npm 9+
- PostgreSQL
- Redis

### ⚙️ Configuración de Variables de Entorno

**📋 IMPORTANTE:** Cada servicio requiere configuración específica de variables de entorno.

#### 1. Configurar Music Service
```bash
# Copiar y configurar variables
cp backend/music-service/.env.example backend/music-service/.env
# Editar backend/music-service/.env con tus credenciales
```

**Variables clave para Music Service:**
```bash
# YouTube API (requerido)
YOUTUBE_API_KEY=AIzaSyDmB98_1mo0doDBWwETyd-4iOacHNu3avc

# Base de datos
DB_HOST=localhost
DB_PASSWORD=your_db_password

# Redis
REDIS_HOST=localhost
```

#### 2. Configurar Queue Service
```bash
# Copiar y configurar variables
cp backend/queue-service/.env.example backend/queue-service/.env
# Editar backend/queue-service/.env
```

**Variables clave para Queue Service:**
```bash
# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Redis (crítico para colas)
REDIS_HOST=localhost
REDIS_KEY_PREFIX=encore:queue:
```

#### 3. Configurar Frontend
```bash
# Copiar variables de entorno (ver docs/SETUP/frontend_env_example.md)
cp docs/SETUP/frontend_env_example.md frontend/.env.local
```

**Variables clave para Frontend:**
```bash
# URLs de APIs
NEXT_PUBLIC_MUSIC_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_QUEUE_SERVICE_URL=http://localhost:3003

# YouTube API
NEXT_PUBLIC_YOUTUBE_API_KEY=AIzaSyDmB98_1mo0doDBWwETyd-4iOacHNu3avc
```

### 📖 Documentación Completa de Variables

Para configuración completa por entorno (development/staging/production):
```bash
📚 Ver: docs/SETUP/environment_variables_guide.md
```

### Instalación
```bash
# Clonar el repositorio
git clone <repository-url>
cd encore

# Configurar variables de entorno (ver sección arriba)
# Configurar cada servicio según su .env.example

# Instalar dependencias
npm install

# Iniciar servicios base
docker-compose up -d postgres redis

# Iniciar desarrollo
npm run dev:backend   # Todos los microservicios
npm run dev:frontend  # Next.js application
```

### 🌐 Acceso a la Aplicación

Una vez iniciados los servicios:
```bash
🌐 Frontend:      http://localhost:3004/client/music-final
🎵 Music API:     http://localhost:3002/health
🎵 Queue API:     http://localhost:3003/health
🔐 Auth API:      http://localhost:3001/health
```

### 📋 Estructura del Proyecto

```
encore/
├── frontend/                 # Next.js 15 App Router
│   ├── src/
│   │   ├── app/             # Páginas y layouts
│   │   ├── components/      # Componentes React
│   │   ├── services/        # API clients
│   │   └── utils/           # Utilidades
│   └── .env.local           # Variables de entorno
├── backend/
│   ├── music-service/       # Puerto 3002 - YouTube API
│   ├── queue-service/       # Puerto 3003 - Redis colas
│   ├── auth-service/        # Puerto 3001 - JWT auth
│   ├── points-service/      # Puerto 3004 - Stripe pagos
│   ├── menu-service/        # Puerto 3005 - Menú 3D
│   ├── analytics-service/   # Puerto 3006 - Métricas
│   └── shared/              # Código compartido
├── docs/                    # Documentación completa
│   ├── ARCHITECTURE/        # Arquitectura técnica
│   ├── SETUP/               # Guías de configuración
│   ├── SERVICES/            # Documentación de servicios
│   └── environment_variables_guide.md  # Variables de entorno
└── docker-compose.yml       # PostgreSQL + Redis
```

### 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev                  # Todo el stack
npm run dev:frontend         # Solo frontend (puerto 3004)
npm run dev:backend          # Todos los microservicios
npm run dev:music            # Music service (3002)
npm run dev:queue            # Queue service (3003)
npm run dev:auth             # Auth service (3001)

# Construcción
npm run build                # Build completo
npm run build:frontend       # Solo frontend
npm run build:backend        # Solo backend

# Testing
npm run test                 # Todas las pruebas
npm run test:unit            # Unit tests
npm run test:e2e             # End-to-end tests

# Producción
npm run start                # Iniciar producción
npm run deploy               # Despliegue a staging
```

## 📱 Funcionalidades

### Para Clientes
- ✅ Acceso vía código QR
- 🎵 Búsqueda y selección de música
- 📱 Cola personal de reproducción
- 🍽️ Menú digital 3D interactivo
- 🎯 Sistema de puntos gamificado
- 💳 Pagos integrados con Stripe
- 📱 PWA (instalable como app)

### Para Administradores
- 📊 Dashboard de gestión
- 🎵 Control de cola global
- 📈 Estadísticas en tiempo real
- 🍽️ Gestión de menú y productos
- ⚙️ Configuración del establecimiento
- 📱 Interfaz responsive

## 🛠️ Tecnologías

### Frontend
- React 18
- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI / Radix UI
- Framer Motion
- Zustand
- Three.js / React Three Fiber
- Socket.IO Client
- next-pwa

### Backend
- Node.js 20+
- Express.js
- TypeScript
- PostgreSQL
- Redis
- Socket.IO
- Stripe
- JWT
- bcryptjs
- Helmet
- CORS

### DevOps & Hosting
- **Frontend**: Vercel
- **Backend**: Railway / Fly.io
- **Base de Datos**: Supabase / Railway
- **CI/CD**: GitHub Actions
- **Monitoreo**: Sentry

## 📂 Estructura del Proyecto

```
encore/
├── frontend/                 # Aplicación Next.js
│   ├── src/
│   │   ├── app/             # App Router de Next.js 14
│   │   ├── components/      # Componentes React
│   │   ├── lib/            # Utilidades y configuración
│   │   ├── stores/         # Estados de Zustand
│   │   └── types/          # Tipos de TypeScript
│   ├── public/             # Archivos estáticos
│   └── package.json
├── backend/                 # Microservicios
│   ├── auth-service/       # Autenticación
│   ├── music-service/      # Gestión de música
│   ├── queue-service/      # Cola de reproducción
│   ├── points-service/     # Puntos y pagos
│   ├── menu-service/       # Menú digital
│   ├── analytics-service/  # Analíticas
│   └── shared/            # Código compartido
├── docs/                   # Documentación
├── package.json           # Configuración principal
└── README.md
```

## 🔄 Flujo de Trabajo

1. **Cliente escanea QR** → Accede a la aplicación PWA
2. **Selecciona música** → Se añade a cola personal y global
3. **Navega por menú 3D** → Visualiza productos interactivamente
4. **Realiza pedidos** → Gana puntos por cada compra
5. **Administrador gestiona** → Controla cola, menú y estadísticas

## 🚀 Despliegue

### Frontend (Vercel)
```bash
# Conectar con Vercel
vercel --prod
```

### Backend (Railway)
```bash
# Cada microservicio se despliega independientemente
railway deploy
```

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📚 Documentación Completa

Para información detallada sobre el proyecto, consulta nuestra documentación organizada:

### 🎯 Visión y Producto
- **[Visión del Producto](docs/VISION.md)** - Objetivos, características principales y roadmap
- **[Índice de Documentación](docs/master_documentation_index.md)** - Guía completa de toda la documentación

### 🏗️ Arquitectura y Diseño
- **[Arquitectura Técnica](docs/ARCHITECTURE/technical_architecture.md)** - Diseño del sistema, microservicios y APIs
- **[Plan de Unificación](docs/ARCHITECTURE/unification_cleanup_plan.md)** - Estrategia de migración y limpieza

### ⚙️ Configuración y Despliegue
- **[Guías de Configuración](docs/SETUP/)** - Instrucciones detalladas de instalación
- **[Documentación de Servicios](docs/SERVICES/)** - Guías específicas por microservicio

### 🔌 Integraciones
- **[APIs Externas](docs/INTEGRATIONS/)** - Spotify, YouTube, Stripe y otras integraciones

### 📖 Guías de Desarrollo
- **[Guías para Desarrolladores](docs/GUIDES/)** - Best practices y patrones de desarrollo

---

**Encore Platform** - Transformando la experiencia gastronómica con tecnología 🎵🍺
