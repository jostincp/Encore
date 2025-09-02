<<<<<<< HEAD
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
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#️-configuración)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Troubleshooting](#-troubleshooting)
- [Contribuciones](#-contribuciones)
- [Roadmap](#️-roadmap)
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

### Instalación
```bash
# Clonar el repositorio
git clone <repository-url>
cd encore

# Instalar todas las dependencias
npm run install:all
```

### Variables de Entorno
Crea los archivos `.env` necesarios en cada servicio:

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Backend Services (.env)
```env
# Común para todos los servicios
DATABASE_URL=postgresql://user:password@localhost:5432/encore
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret

# Específicos por servicio
# music-service
YOUTUBE_API_KEY=your-youtube-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# points-service
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Desarrollo
```bash
# Ejecutar todo el stack de desarrollo
npm run dev

# O ejecutar servicios individualmente
npm run dev:frontend    # Frontend en puerto 3000
npm run dev:backend     # Todos los microservicios

# Servicios individuales
npm run dev:auth        # Puerto 3001
npm run dev:music       # Puerto 3002
npm run dev:queue       # Puerto 3003
npm run dev:points      # Puerto 3004
npm run dev:menu        # Puerto 3005
npm run dev:analytics   # Puerto 3006
```

### Construcción
```bash
# Construir todo el proyecto
npm run build

# Construir solo frontend o backend
npm run build:frontend
npm run build:backend
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

---

**Encore Platform** - Transformando la experiencia gastronómica con tecnología 🎵🍺
=======
# Encore
>>>>>>> 4d05167cbc4f13e6999b048f163ea2b20e73ea6f
