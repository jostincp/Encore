---
tags:
  - setup
  - instalacion
  - devops
last_updated: 2026-02-09
---

# Configuración y Despliegue

Guía paso a paso para configurar el entorno de desarrollo de Encore.

## Prerrequisitos
- **Node.js**: v20.0.0 o superior
- **Docker**: Para bases de datos y servicios auxiliares
- **npm**: v9.0.0 o superior

## 1. Variables de Entorno
El proyecto utiliza múltiples servicios, cada uno con su configuración.
Copia el archivo base `.env.example` en la raíz (y en cada sub-servicio si es necesario, ver `GEMINI.md`).

```bash
cp .env.example .env
```

> [!WARNING] Importante
> Asegúrate de configurar las claves de API (YouTube, Spotify, Stripe) en tu archivo `.env` local. No subas credenciales reales al repositorio.

## 2. Instalación de Dependencias
Utiliza el script unificado para instalar dependencias en el root, frontend y todos los microservicios backend.

```bash
npm run install:all
```

## 3. Levantar Servicios Auxiliares
Usa Docker Compose para iniciar PostgreSQL, Redis y otros servicios de infraestructura.

```bash
docker-compose up -d
```

## 4. Iniciar Desarrollo
Para levantar todo el stack (Frontend + todos los Microservicios) en modo desarrollo:

```bash
npm run dev
```

### Comandos Específicos
Si solo necesitas trabajar en una parte del sistema:

| Comando | Descripción |
| :--- | :--- |
| `npm run dev:frontend` | Inicia solo el cliente Next.js (Puerto 3004) |
| `npm run dev:backend` | Inicia todos los microservicios |
| `npm run dev:music` | Solo Music Service |
| `npm run dev:queue` | Solo Queue Service |

> [!TIP] Testing
> Para ejecutar las pruebas, utiliza `npm run test` o `npm run test:unit` para pruebas unitarias rápidas.

## 5. Verificar que Todo Funcione

Una vez levantado el stack, utiliza estos scripts de PowerShell para validar que los servicios responden correctamente.

### Verificación rápida
Comprueba el estado de **todos** los servicios (Auth, Music, Queue, Points, Menu, Analytics, Frontend) y los contenedores Docker (Redis, PostgreSQL):

```powershell
.\check-services.ps1
```

Salida esperada: lista de servicios con ✅ OK o ❌ No responde, más resumen final.

### Diagnóstico detallado
Si algún servicio no responde, este script revisa la causa raíz servicio por servicio:

```powershell
.\diagnose-services.ps1
```

Verifica para cada servicio:
- ✅ Directorio y archivos (`src/server.ts`, `package.json`, `.env`)
- ✅ Dependencias instaladas (`node_modules`)
- ✅ Puerto escuchando
- ✅ Dependencias compartidas (`backend/shared`)

> [!NOTE] Ambos scripts están en la raíz del proyecto
> Ejecútalos desde `C:\www\Encore` con PowerShell.
