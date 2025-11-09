# Script de Sembrado de Administrador

Este script permite crear o actualizar un usuario administrador de forma segura en el entorno de desarrollo local.

## 🎯 Objetivo

Configurar un mecanismo seguro para simular un usuario con rol de ADMIN en el entorno de desarrollo local, sin modificar el código fuente de los controladores ni comprometer la seguridad de la aplicación.

## 🔒 Seguridad

- **NO modifica** el código de los controladores de autenticación
- **NO compromete** la seguridad de la aplicación
- **NO expone** credenciales en el código fuente
- **NO permite** la creación de administradores en producción

## 📋 Requisitos Previos

1. Docker y PostgreSQL deben estar ejecutándose
2. Las migraciones de base de datos deben estar aplicadas
3. El servicio de autenticación debe estar configurado

## 🚀 Instrucciones de Uso

### 1. Iniciar los servicios de base de datos

```bash
# Desde la raíz del proyecto
docker-compose up -d postgresdb
```

### 2. Ejecutar el script de sembrado

```bash
cd backend/auth-service
npm run seed:admin
```

### 3. Validar el inicio de sesión

Una vez ejecutado el script, puedes probar el inicio de sesión con:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@encore.com", "password": "Password123!"}'
```

## 📊 Resultado Esperado

El script creará o actualizará un usuario con las siguientes características:

- **Email**: `admin@encore.com`
- **Contraseña**: `Password123!`
- **Rol**: `ADMIN`
- **Verificado**: Sí
- **Activo**: Sí

## 🔧 Características del Script

- **Idempotente**: Puede ejecutarse múltiples veces sin problemas
- **Seguro**: Usa bcrypt para hashear contraseñas
- **Auditado**: Registra todas las operaciones en consola
- **Flexible**: Actualiza usuarios existentes o crea nuevos

## 🚨 Advertencias

- **SOLO para desarrollo**: Este script está diseñado exclusivamente para entornos de desarrollo
- **NO usar en producción**: Nunca ejecutes este script en un entorno de producción
- **Cambiar credenciales**: Considera cambiar las credenciales predeterminadas en desarrollo

## 🛠️ Solución de Problemas

### Error de conexión a base de datos

Asegúrate de que PostgreSQL esté ejecutándose:
```bash
docker-compose ps
```

### Error de permisos

Verifica que el usuario de base de datos tenga los permisos necesarios:
```bash
# Conéctate a la base de datos y ejecuta:
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tu_usuario;
```

### Error de dependencias faltantes

Si faltan dependencias, instálalas:
```bash
cd backend/auth-service
npm install
```

## 📞 Soporte

Para problemas o preguntas relacionadas con este script, contacta al equipo de desarrollo.