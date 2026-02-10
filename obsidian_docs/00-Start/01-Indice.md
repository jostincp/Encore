---
tags:
  - indice
  - encore
  - navegacion
last_updated: 2026-02-09
---

# Índice Maestro: Encore

Bienvenido a la documentación central del proyecto **Encore**, la plataforma de gestión musical para bares y restaurantes.

> [!INFO] Propósito
> Encore permite a los clientes interactuar con la música del local (Rockola Digital), ver menús en 3D y gestionar pedidos, todo integrado con una arquitectura de microservicios moderna.

---

## 🚀 Inicio Rápido

- [[02-Configuracion|Configuración y Despliegue]]: Guía para levantar el entorno de desarrollo
- Reglas de Documentación: Ver `DOCS_RULES.md` en raíz

---

## 🏗 Arquitectura y Tecnología

### Stack y Diseño
- [[11-Stack|Stack Tecnológico]]: Next.js 15, React 19, Node.js 20, Google model-viewer

### Microservicios Backend
- [[21-Mapa-Servicios|Mapa General]]: Visión general de puertos y responsabilidades

#### Servicios Individuales
1. [[Auth-Service|Auth Service]] (puerto 3001): Autenticación JWT
2. [[Music-Service|Music Service]] (puerto 3002): Búsqueda YouTube + Caché Redis  
3. [[Queue-Service|Queue Service]] (puerto 3003): Cola musical + WebSocket
4. [[Points-Service|Points Service]] (puerto 3004): Puntos y pagos (planeado)
5. [[Menu-Service|Menu Service]] (puerto 3005): Menú 3D (planeado)
6. [[Analytics-Service|Analytics Service]] (puerto 3006): Métricas (planeado)

---

## 🧩 Componentes y Utilidades

- [[31-Utilidades|Funciones Helper]]: formatTime, debounce, apiClient, etc.
- [[32-Componentes-React|Componentes UI]]: SongCard, QueueList, SearchBar, hooks personalizados

---

## 🗄️ Bases de Datos

- **[[PostgreSQL]]**: Base de datos principal (usuarios, bars, productos)
- **[[Redis]]**: Caché de YouTube API + colas de reproducción

---

## 📊 Estado del Proyecto

| Módulo | Estado |
|--------|--------|
| **Frontend** | ✅ Implementado (Next.js 15) |
| **Auth Service** | ✅ Implementado |
| **Music Service** | ✅ Implementado |
| **Queue Service** | ✅ Implementado (con auto-start) |
| **Points Service** | 🔜 En desarrollo |
| **Menu Service** | 🔜 Planeado |
| **Analytics Service** | 🔜 Planeado |

---

## 📂 Enlaces Externos

- **Repositorio**: `C:\www\Encore`
- **Documentación técnica**: `GEMINI.md` (raíz del proyecto)
- **Reglas de sync**: `DOCS_RULES.md`

---

## 🔗 Referencias Rápidas

### Para Desarrolladores
- Instalar dependencias: `npm run install:all`
- Iniciar desarrollo: `npm run dev`
- Solo frontend: `npm run dev:frontend`
- Solo backend: `npm run dev:backend`

### Para Administradores
- Dashboard admin: http://localhost:3004/admin
- Rockola digital: http://localhost:3004/client/music-final

> [!TIP] Navegación
> Usa los enlaces `[[...]]` para navegar entre notas en Obsidian. Los vínculos backlinks aparecen automáticamente al final de cada nota.
