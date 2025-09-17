# Encore Platform - AWS Infrastructure

Este directorio contiene la infraestructura AWS para la plataforma Encore, incluyendo gestión de secretos con rotación automática.

## Gestión de Secretos

### Descripción
Se ha implementado un sistema completo de gestión de secretos utilizando AWS Secrets Manager con las siguientes características:

- **Almacenamiento seguro**: Todos los secretos sensibles (JWT, base de datos, APIs externas) se almacenan en AWS Secrets Manager
- **Rotación automática**: Los secretos se rotan automáticamente cada 30 días
- **Caché inteligente**: Los secretos se cachean en memoria para mejorar el rendimiento
- **Validación**: Los secretos se validan antes de su uso
- **Auditoría**: Todos los accesos y rotaciones se registran

### Componentes

#### 1. Secrets Manager Utility (`backend/shared/utils/secrets.ts`)
- Cliente para acceder a AWS Secrets Manager
- Caché automático con TTL configurable
- Manejo de errores robusto
- Soporte para múltiples secretos en paralelo

#### 2. Configuración Integrada (`backend/shared/config/index.ts`)
- Función `loadSecretsFromAWS()` para cargar secretos en producción
- Fallback a variables de entorno para desarrollo
- Validación automática de configuración

#### 3. Función Lambda de Rotación (`aws/lambda/rotation/`)
- Maneja la rotación automática de secretos
- Genera nuevos valores seguros (JWT, contraseñas, etc.)
- Valida el formato de los nuevos secretos
- Soporte para diferentes tipos de secretos

#### 4. CloudFormation Template (`aws/cloudformation/secrets-manager.yaml`)
- Despliega toda la infraestructura necesaria
- Crea secretos con valores iniciales
- Configura rotación automática
- Define permisos IAM apropiados

### Secretos Gestionados

| Secreto | Descripción | Rotación |
|---------|-------------|----------|
| `encore/jwt-{env}` | Secretos JWT para autenticación | 30 días |
| `encore/database-{env}` | Credenciales de base de datos | 30 días |
| `encore/redis-{env}` | Credenciales Redis | 30 días |
| `encore/youtube-api-{env}` | API Key de YouTube | Manual |
| `encore/spotify-api-{env}` | Credenciales Spotify | Manual |
| `encore/stripe-api-{env}` | Credenciales Stripe | Manual |

### Despliegue

#### 1. Preparar Variables de Entorno
```bash
export JWT_SECRET="tu_jwt_secret_inicial"
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export DB_PASSWORD="tu_password_inicial"
export REDIS_URL="redis://host:6379"
export REDIS_PASSWORD="tu_redis_password"
export YOUTUBE_API_KEY="tu_api_key"
export SPOTIFY_CLIENT_ID="tu_client_id"
export SPOTIFY_CLIENT_SECRET="tu_client_secret"
export STRIPE_PUBLISHABLE_KEY="pk_..."
export STRIPE_SECRET_KEY="sk_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
```

#### 2. Desplegar con CloudFormation
```bash
aws cloudformation deploy \
  --template-file aws/cloudformation/secrets-manager.yaml \
  --stack-name encore-secrets-production \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM
```

#### 3. Configurar Servicios
En producción, los servicios cargarán automáticamente los secretos:

```typescript
import { loadSecretsFromAWS } from '@encore/shared';

// En el startup del servicio
await loadSecretsFromAWS();
```

### Seguridad

#### Mejores Prácticas Implementadas
- **Principio de menor privilegio**: La función Lambda solo tiene permisos para los secretos necesarios
- **Rotación automática**: Reduce el riesgo de exposición prolongada
- **Auditoría completa**: Todos los accesos se registran en CloudTrail
- **Validación**: Los secretos se validan antes de usar
- **Cifrado**: Todos los secretos están cifrados en reposo y en tránsito

#### Monitoreo
- Los logs de rotación se envían a CloudWatch
- Métricas de Secrets Manager disponibles en CloudWatch
- Alertas configurables para fallos de rotación

### Desarrollo Local

En desarrollo, el sistema usa variables de entorno como fallback:

```bash
# .env
NODE_ENV=development
JWT_SECRET=dev_jwt_secret
DATABASE_URL=postgresql://localhost:5432/encore_dev
```

### Rotación Manual

Para forzar una rotación manual:

```bash
aws secretsmanager rotate-secret \
  --secret-id encore/jwt-production \
  --rotation-lambda-arn arn:aws:lambda:region:account:function:encore-secret-rotation-production
```

### Monitoreo y Alertas

#### CloudWatch Alarms Recomendados
- Rotación fallida
- Acceso denegado a secretos
- Uso excesivo de API de Secrets Manager

#### Logs a Monitorear
- `/aws/lambda/encore-secret-rotation-{env}`
- `/aws/secretsmanager/*`

### Costos

#### Estimación Mensual (producción)
- Secrets Manager: ~$0.40 por secreto
- Lambda (rotación): ~$0.20 por rotación
- CloudWatch Logs: ~$1.00
- **Total aproximado**: $2-3 por mes

### Troubleshooting

#### Problemas Comunes
1. **Error de permisos**: Verificar que el rol IAM tenga los permisos correctos
2. **Rotación fallida**: Revisar los logs de CloudWatch de la función Lambda
3. **Secretos no encontrados**: Verificar que los nombres de secretos sean correctos

#### Comandos Útiles
```bash
# Ver estado de un secreto
aws secretsmanager describe-secret --secret-id encore/jwt-production

# Ver versiones de un secreto
aws secretsmanager list-secret-version-ids --secret-id encore/jwt-production

# Forzar rotación
aws secretsmanager rotate-secret --secret-id encore/jwt-production
```

### Próximos Pasos

1. **Integración con CI/CD**: Automatizar el despliegue de infraestructura
2. **Monitoreo avanzado**: Dashboards en CloudWatch para métricas de seguridad
3. **Backup de secretos**: Estrategia de respaldo para recuperación de desastres
4. **Multi-región**: Replicación de secretos en múltiples regiones

---

**Nota**: Esta implementación cumple con las mejores prácticas de seguridad de AWS y proporciona una base sólida para la gestión de secretos en la plataforma Encore.