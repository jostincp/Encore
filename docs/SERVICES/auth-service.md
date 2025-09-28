# Auth Service - Servicio de Autenticación

## Descripción

El servicio de autenticación maneja el registro, login y autorización de usuarios en la plataforma Encore.

## Características

- Autenticación JWT
- Registro de usuarios
- Gestión de roles (Guest, Member, Bar Owner, Super Admin)
- Sesiones persistentes
- Validación de tokens

## Endpoints Principales

### POST /auth/register
Registro de nuevos usuarios

### POST /auth/login
Inicio de sesión

### POST /auth/logout
Cierre de sesión

### GET /auth/me
Obtener información del usuario actual

### POST /auth/refresh
Renovar token de acceso

## Variables de Entorno

```env
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
DATABASE_URL=postgresql://...
```

## Puerto por Defecto

3001

---

*Para más información sobre la arquitectura, consulte [Arquitectura Técnica](../ARCHITECTURE/technical_architecture.md)*