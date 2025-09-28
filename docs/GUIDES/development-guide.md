# Guía de Desarrollo - Encore

## Configuración del Entorno de Desarrollo

### Prerrequisitos
- Node.js 20+
- npm 9+
- Git
- PostgreSQL 14+
- Redis 6+
- Editor de código (recomendado: VS Code)

### Extensiones Recomendadas para VS Code
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint

## Estructura del Proyecto

```
encore/
├── frontend/                 # Aplicación Next.js
│   ├── src/
│   │   ├── app/             # App Router de Next.js 14
│   │   ├── components/      # Componentes React
│   │   ├── lib/            # Utilidades y configuración
│   │   ├── stores/         # Estados de Zustand
│   │   └── types/          # Tipos de TypeScript
├── backend/                 # Microservicios
│   ├── auth-service/       # Autenticación
│   ├── music-service/      # Gestión de música
│   ├── queue-service/      # Cola de reproducción
│   ├── points-service/     # Puntos y pagos
│   ├── menu-service/       # Menú digital
│   ├── analytics-service/  # Analíticas
│   └── shared/            # Código compartido
└── docs/                   # Documentación
```

## Convenciones de Código

### TypeScript
- Usar tipos explícitos siempre que sea posible
- Interfaces para objetos, types para uniones
- Nombres en PascalCase para interfaces y types
- Nombres en camelCase para variables y funciones

### React
- Componentes funcionales con hooks
- Props tipadas con interfaces
- Usar Zustand para estado global
- Componentes en PascalCase

### Estilos
- Tailwind CSS para estilos
- Componentes de Shadcn UI cuando sea posible
- Responsive design mobile-first

## Flujo de Trabajo Git

### Ramas
- `main`: Código de producción
- `develop`: Código de desarrollo
- `feature/nombre-feature`: Nuevas funcionalidades
- `fix/nombre-fix`: Correcciones de bugs
- `hotfix/nombre-hotfix`: Correcciones urgentes

### Commits
Usar conventional commits:
```
feat: agregar búsqueda de música
fix: corregir error en autenticación
docs: actualizar README
style: formatear código
refactor: reorganizar componentes
test: agregar tests unitarios
```

## Testing

### Frontend
- Jest + React Testing Library
- Tests unitarios para componentes
- Tests de integración para flujos críticos

### Backend
- Jest + Supertest
- Tests unitarios para servicios
- Tests de integración para APIs
- Tests de carga para endpoints críticos

## Comandos Útiles

```bash
# Desarrollo
npm run dev                 # Todo el stack
npm run dev:frontend        # Solo frontend
npm run dev:backend         # Solo backend

# Testing
npm run test               # Todos los tests
npm run test:frontend      # Tests del frontend
npm run test:backend       # Tests del backend

# Linting y Formateo
npm run lint               # ESLint
npm run format             # Prettier

# Build
npm run build              # Build completo
npm run build:frontend     # Build del frontend
npm run build:backend      # Build del backend
```

## Debugging

### Frontend
- React Developer Tools
- Redux DevTools (para Zustand)
- Browser DevTools

### Backend
- VS Code Debugger
- Console logs estructurados
- Postman/Insomnia para APIs

## Performance

### Frontend
- Lazy loading de componentes
- Optimización de imágenes
- Code splitting
- Memoización con React.memo

### Backend
- Cache con Redis
- Paginación en APIs
- Índices en base de datos
- Rate limiting

---

*Para más información sobre la arquitectura, consulte [Arquitectura Técnica](../ARCHITECTURE/technical_architecture.md)*