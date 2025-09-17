# HashiCorp Vault - Encore Platform

Configuración completa de HashiCorp Vault OSS auto-hospedado para gestión segura de secretos en Encore Platform.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Points Service│───▶│   HashiCorp     │    │   Stripe API    │
│   (Node.js)     │    │   Vault OSS     │    │   (External)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼──┐               ┌────▼──┐               ┌────▼──┐
    │AppRole │               │ Secrets│               │Webhook│
    │Auth    │               │ Engine │               │Secrets│
    └───────┘               └───────┘               └───────┘
                                                        │
                                                    ┌───▼──┐
                                                    │ Auto  │
                                                    │Rotation│
                                                    └───────┘
```

## 🚀 Inicio Rápido

### 1. Levantar Vault
```bash
# Desde el directorio raíz del proyecto
docker-compose -f docker-compose.vault.yml up -d

# Verificar que esté ejecutándose
docker-compose -f docker-compose.vault.yml logs vault
```

### 2. Inicializar Vault
```bash
# Acceder al contenedor
docker exec -it encore-vault /bin/sh

# Verificar estado
vault status

# Si no está inicializado, inicializar (solo la primera vez)
vault operator init
# Guardar las 5 claves de unseal y el token root
```

### 3. Unseal Vault
```bash
# Unseal con 3 de las 5 claves (threshold mínimo)
vault operator unseal <clave-1>
vault operator unseal <clave-2>
vault operator unseal <clave-3>
```

### 4. Configurar Autenticación
```bash
# Configurar token root (solo para configuración inicial)
export VAULT_TOKEN=<token-root>

# Ejecutar script de inicialización
/vault/scripts/init-vault.sh
```

### 5. Configurar Aplicación
```bash
# Copiar las credenciales generadas al points-service
cp vault/.env.vault backend/points-service/

# O configurar variables de entorno manualmente
export VAULT_ENDPOINT=http://localhost:8200
export VAULT_ROLE_ID=<role-id-generado>
export VAULT_SECRET_ID=<secret-id-generado>
export VAULT_NAMESPACE=encore
```

## 📋 Secrets Gestionados

### Estructura de Secrets
```
secret/encore/
├── stripe/           # Credenciales de Stripe
│   ├── secretKey
│   ├── webhookSecret
│   ├── publishableKey
│   └── rotatedAt
├── database/         # Credenciales de base de datos
│   ├── url
│   ├── password
│   └── rotatedAt
├── jwt/             # Secrets JWT
│   ├── secret
│   ├── algorithm
│   ├── expiresIn
│   └── rotatedAt
└── redis/           # Credenciales Redis
    ├── url
    ├── password
    └── rotatedAt
```

### Acceso a Secrets
```bash
# Ver todos los secrets
vault kv list secret/encore/

# Leer secret de Stripe
vault kv get secret/encore/stripe

# Leer secret de base de datos
vault kv get secret/encore/database

# Ver versiones de un secret
vault kv get -versions secret/encore/stripe
```

## 🔐 Políticas de Seguridad

### Política de Points Service
```hcl
# Permisos de lectura para secrets operativos
path "secret/data/encore/stripe" {
  capabilities = ["read"]
}

path "secret/data/encore/database" {
  capabilities = ["read"]
}

path "secret/data/encore/jwt" {
  capabilities = ["read"]
}

# Permisos de escritura para rotación
path "secret/data/encore/stripe" {
  capabilities = ["update", "create"]
}

path "secret/data/encore/database" {
  capabilities = ["update", "create"]
}

path "secret/data/encore/jwt" {
  capabilities = ["update", "create"]
}

# Renovación de tokens
path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

### AppRole Authentication
```bash
# Crear rol con política
vault write auth/approle/role/points-service \
  secret_id_ttl=24h \
  token_ttl=1h \
  token_max_ttl=24h \
  policies=points-service-policy

# Obtener credenciales
ROLE_ID=$(vault read auth/approle/role/points-service/role-id -format=json | jq -r '.data.role_id')
SECRET_ID=$(vault write -f auth/approle/role/points-service/secret-id -format=json | jq -r '.data.secret_id')
```

## 🔄 Rotación Automática

### Script de Rotación
```bash
# Ejecutar rotación manual
docker exec encore-vault /vault/scripts/rotate-secrets.sh

# Ver logs de rotación
docker exec encore-vault tail -f /vault/logs/rotation.log
```

### Programar Rotación Automática
```bash
# Añadir a crontab del contenedor
0 2 * * * /vault/scripts/rotate-secrets.sh

# O desde el host
0 2 * * * docker exec encore-vault /vault/scripts/rotate-secrets.sh
```

### Monitoreo de Rotación
```bash
# Ver estado de rotación
vault kv get secret/encore/stripe | grep rotatedAt

# Ver todas las versiones
vault kv get -versions secret/encore/stripe

# Ver metadata
vault kv metadata get secret/encore/stripe
```

## 📊 Monitoreo y Alertas

### Health Checks
```bash
# Verificar estado de Vault
curl http://localhost:8200/v1/sys/health

# Verificar inicialización
vault status

# Ver métricas
vault read sys/metrics
```

### Logs de Auditoría
```bash
# Ver logs de acceso
vault audit list

# Ver logs de requests
docker exec encore-vault tail -f /vault/logs/audit.log
```

### Alertas Recomendadas
- 🚨 **Vault Sealed**: Requiere unseal manual
- 🚨 **Token Expirado**: Renovar credenciales de aplicación
- 🚨 **Rotación Fallida**: Verificar script de rotación
- 🚨 **Acceso Denegado**: Revisar políticas de seguridad

## 🔧 Configuración Avanzada

### Configuración de Producción
```hcl
# vault/config/vault.hcl
storage "raft" {
  path = "/vault/data"
  node_id = "vault-prod-01"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_cert_file = "/vault/tls/vault.crt"
  tls_key_file = "/vault/tls/vault.key"
  tls_min_version = "tls12"
}

# Clustering
cluster_addr = "https://vault-prod-01.encore.com:8201"
api_addr = "https://vault.encore.com:8200"

# Seal con AWS KMS
seal "awskms" {
  region = "us-east-1"
  kms_key_id = "your-kms-key-id"
}
```

### Backup y Recuperación
```bash
# Crear snapshot
vault operator raft snapshot save /vault/backups/vault-$(date +%Y%m%d-%H%M%S).snap

# Restaurar snapshot
vault operator raft snapshot restore /vault/backups/vault-20231201.snap

# Backup automático
0 3 * * * vault operator raft snapshot save /vault/backups/daily-$(date +\%Y\%m\%d).snap
```

### Clustering
```bash
# Unir nodo al cluster
vault operator raft join https://vault-prod-01.encore.com:8200

# Ver estado del cluster
vault operator raft list-peers

# Remover nodo
vault operator raft remove-peer vault-prod-02
```

## 🧪 Testing y Desarrollo

### Ambiente de Desarrollo
```bash
# Levantar solo Vault para desarrollo
docker run --rm -d \
  --name vault-dev \
  -p 8200:8200 \
  -e VAULT_DEV_ROOT_TOKEN_ID=encore-dev-token \
  -e VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200 \
  hashicorp/vault:latest
```

### Tests de Integración
```typescript
// Test de conectividad con Vault
describe('Vault Service', () => {
  test('should connect to Vault', async () => {
    const health = await vaultService.healthCheck();
    expect(health).toBe(true);
  });

  test('should retrieve Stripe secrets', async () => {
    const secrets = await vaultService.getSecret('encore/stripe');
    expect(secrets.secretKey).toBeDefined();
    expect(secrets.webhookSecret).toBeDefined();
  });

  test('should rotate secrets', async () => {
    const oldSecret = await vaultService.getSecret('encore/stripe');
    await vaultService.rotateSecret('encore/stripe', 'stripe');
    const newSecret = await vaultService.getSecret('encore/stripe');

    expect(oldSecret.webhookSecret).not.toBe(newSecret.webhookSecret);
    expect(new Date(newSecret.rotatedAt)).toBeGreaterThan(new Date(oldSecret.rotatedAt));
  });
});
```

## 🚨 Troubleshooting

### Problemas Comunes

#### Vault no inicia
```bash
# Verificar Docker
docker ps | grep vault

# Ver logs
docker logs encore-vault

# Verificar configuración
docker exec encore-vault vault status
```

#### Error de autenticación
```bash
# Verificar AppRole
vault read auth/approle/role/points-service/role-id

# Verificar política
vault policy read points-service-policy

# Regenerar secret ID
vault write -f auth/approle/role/points-service/secret-id
```

#### Secrets no se actualizan
```bash
# Verificar conectividad
curl -H "X-Vault-Token: $VAULT_TOKEN" http://localhost:8200/v1/sys/health

# Verificar permisos
vault token lookup $VAULT_TOKEN

# Ver logs de aplicación
tail -f /var/log/encore/points-service.log
```

#### Rotación falla
```bash
# Verificar script
docker exec encore-vault /vault/scripts/rotate-secrets.sh

# Ver logs de rotación
docker exec encore-vault cat /vault/logs/rotation.log

# Verificar permisos de escritura
vault token capabilities secret/data/encore/stripe
```

## 📈 Métricas de Performance

### Recursos Recomendados
- **CPU**: 1-2 cores
- **RAM**: 512MB - 2GB
- **Storage**: 10GB - 100GB SSD
- **Red**: 100Mbps - 1Gbps

### Escalabilidad
- **Horizontal**: Clustering con Raft
- **Vertical**: Aumentar recursos según carga
- **Caching**: Implementado en aplicación
- **Load Balancing**: Nginx/Kong como proxy

## 🔒 Seguridad

### Mejores Prácticas
- ✅ **TLS Everywhere**: Encriptación en tránsito
- ✅ **AppRole**: Autenticación sin credenciales fijas
- ✅ **Policies**: Control de acceso granular
- ✅ **Auditoría**: Logs completos de acceso
- ✅ **Rotación**: Secrets frescos regularmente
- ✅ **Backup**: Recuperación en caso de desastre

### Compliance
- ✅ **PCI DSS**: Cumple con estándares de pago
- ✅ **SOX**: Controles internos adecuados
- ✅ **GDPR**: Protección de datos personales
- ✅ **ISO 27001**: Gestión de seguridad

## 📚 Referencias

- [Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [AppRole Auth](https://developer.hashicorp.com/vault/docs/auth/approle)
- [KV Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/kv)
- [Policies](https://developer.hashicorp.com/vault/docs/concepts/policies)
- [Raft Storage](https://developer.hashicorp.com/vault/docs/concepts/storage)

---

**🎯 Vault proporciona una base sólida para la gestión segura de secretos en Encore Platform, con rotación automática, auditoría completa y cumplimiento enterprise-grade.**