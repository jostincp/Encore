#!/bin/bash

# Encore Platform - Cloudflare CDN Deployment Script
# Script automatizado para desplegar y configurar Cloudflare CDN

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Función para verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."

    if ! command -v node >/dev/null 2>&1; then
        error "Node.js no está instalado"
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        error "npm no está instalado"
        exit 1
    fi

    if ! command -v wrangler >/dev/null 2>&1; then
        warning "Cloudflare Wrangler no está instalado. Instalando..."
        npm install -g wrangler
    fi

    if ! command -v gh >/dev/null 2>&1; then
        warning "GitHub CLI no está instalado. Algunas funciones estarán limitadas."
    fi

    success "Dependencias verificadas"
}

# Función para configurar autenticación de Cloudflare
setup_cloudflare_auth() {
    log "Configurando autenticación de Cloudflare..."

    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        warning "CLOUDFLARE_API_TOKEN no está configurado"
        read -p "Ingresa tu Cloudflare API Token: " cf_token
        export CLOUDFLARE_API_TOKEN="$cf_token"
    fi

    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        warning "CLOUDFLARE_ACCOUNT_ID no está configurado"
        read -p "Ingresa tu Cloudflare Account ID: " cf_account
        export CLOUDFLARE_ACCOUNT_ID="$cf_account"
    fi

    # Verificar autenticación
    if wrangler auth login --api-token "$CLOUDFLARE_API_TOKEN" 2>/dev/null; then
        success "Autenticación de Cloudflare configurada"
    else
        error "Error en autenticación de Cloudflare"
        exit 1
    fi
}

# Función para desplegar Cloudflare Pages
deploy_pages() {
    local environment=${1:-production}

    log "Desplegando Cloudflare Pages ($environment)..."

    # Cambiar al directorio del frontend
    cd frontend

    # Instalar dependencias si no existen
    if [ ! -d "node_modules" ]; then
        log "Instalando dependencias del frontend..."
        npm install
    fi

    # Configurar variables de entorno
    if [ "$environment" = "production" ]; then
        export NODE_ENV=production
        export API_BASE_URL=https://api.encore-platform.com
        export CDN_BASE_URL=https://encore-platform.pages.dev
    else
        export NODE_ENV=development
        export API_BASE_URL=https://api-staging.encore-platform.com
        export CDN_BASE_URL=https://encore-platform-staging.pages.dev
    fi

    # Build de la aplicación
    log "Construyendo aplicación..."
    npm run build

    # Desplegar a Cloudflare Pages
    if [ "$environment" = "production" ]; then
        npx wrangler pages deploy dist --project-name=encore-platform --branch=main
    else
        npx wrangler pages deploy dist --project-name=encore-platform-staging --branch=develop
    fi

    success "Cloudflare Pages desplegado ($environment)"
    cd ..
}

# Función para desplegar Workers
deploy_workers() {
    log "Desplegando Cloudflare Workers..."

    # Desplegar API Router Worker
    log "Desplegando API Router Worker..."
    cd cdn/workers

    # Crear wrangler.toml si no existe
    if [ ! -f "wrangler.toml" ]; then
        cat > wrangler.toml << EOF
name = "encore-api-router"
main = "api-router.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
API_BASE_URL = "https://api.encore-platform.com"
FRONTEND_URL = "https://encore-platform.pages.dev"

[[kv_namespaces]]
binding = "API_CACHE"
id = "api_cache_namespace_id"
preview_id = "api_cache_preview_id"

[[r2_buckets]]
binding = "R2_STORAGE"
bucket_name = "encore-assets"
preview_bucket_name = "encore-assets-preview"
EOF
    fi

    # Desplegar worker
    wrangler deploy api-router.js

    # Desplegar Image Optimizer Worker
    log "Desplegando Image Optimizer Worker..."
    wrangler deploy image-optimizer.js

    success "Cloudflare Workers desplegados"
    cd ../..
}

# Función para configurar reglas de Cloudflare
configure_cloudflare_rules() {
    log "Configurando reglas de Cloudflare..."

    # Configurar Page Rules (legacy) o Rules (new)
    # Nota: Esto requiere API calls a Cloudflare

    local zone_id=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=encore-platform.com" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result[0].id')

    if [ -z "$zone_id" ] || [ "$zone_id" = "null" ]; then
        warning "No se pudo obtener Zone ID. Configuración manual requerida."
        return 1
    fi

    # Configurar reglas de cache
    configure_cache_rules "$zone_id"

    # Configurar reglas de seguridad
    configure_security_rules "$zone_id"

    # Configurar reglas de redireccionamiento
    configure_redirect_rules "$zone_id"

    success "Reglas de Cloudflare configuradas"
}

# Función para configurar reglas de cache
configure_cache_rules() {
    local zone_id=$1

    log "Configurando reglas de cache..."

    # Cache para assets estáticos
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/rulesets" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "Encore Static Assets Cache",
          "kind": "zone",
          "phase": "http_request_cache_settings",
          "rules": [
            {
              "expression": "(http.request.uri.path matches \"^/_next/static/.*|^/static/.*|^/assets/.*\")",
              "action": "set_cache_settings",
              "action_parameters": {
                "cache": true,
                "edge_ttl": {
                  "mode": "override_origin",
                  "duration": 31536000
                },
                "browser_ttl": {
                  "mode": "override_origin",
                  "duration": 31536000
                }
              }
            }
          ]
        }'

    # Cache para API responses
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/rulesets" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "Encore API Cache",
          "kind": "zone",
          "phase": "http_request_cache_settings",
          "rules": [
            {
              "expression": "(http.request.uri.path matches \"^/api/analytics/.*\") and (http.request.method eq \"GET\")",
              "action": "set_cache_settings",
              "action_parameters": {
                "cache": true,
                "edge_ttl": {
                  "mode": "override_origin",
                  "duration": 300
                }
              }
            }
          ]
        }'
}

# Función para configurar reglas de seguridad
configure_security_rules() {
    local zone_id=$1

    log "Configurando reglas de seguridad..."

    # Headers de seguridad
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/rulesets" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "Encore Security Headers",
          "kind": "zone",
          "phase": "http_response_headers_transform",
          "rules": [
            {
              "expression": "true",
              "action": "set_http_response_headers",
              "action_parameters": {
                "headers": {
                  "X-Frame-Options": {
                    "operation": "set",
                    "value": "DENY"
                  },
                  "X-Content-Type-Options": {
                    "operation": "set",
                    "value": "nosniff"
                  },
                  "Referrer-Policy": {
                    "operation": "set",
                    "value": "strict-origin-when-cross-origin"
                  },
                  "Permissions-Policy": {
                    "operation": "set",
                    "value": "geolocation=(), microphone=(), camera=()"
                  }
                }
              }
            }
          ]
        }'
}

# Función para configurar reglas de redireccionamiento
configure_redirect_rules() {
    local zone_id=$1

    log "Configurando reglas de redireccionamiento..."

    # HTTP a HTTPS
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/rulesets" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "Encore HTTPS Redirect",
          "kind": "zone",
          "phase": "http_request_redirect",
          "rules": [
            {
              "expression": "(http.request.scheme eq \"http\")",
              "action": "redirect",
              "action_parameters": {
                "from_value": {
                  "status_code": 301,
                  "target_url": {
                    "expression": "\"https://\" + http.request.host + http.request.uri"
                  }
                }
              }
            }
          ]
        }'

    # WWW redirect
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/rulesets" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "name": "Encore WWW Redirect",
          "kind": "zone",
          "phase": "http_request_redirect",
          "rules": [
            {
              "expression": "(http.request.host eq \"www.encore-platform.com\")",
              "action": "redirect",
              "action_parameters": {
                "from_value": {
                  "status_code": 301,
                  "target_url": {
                    "expression": "\"https://encore-platform.com\" + http.request.uri"
                  }
                }
              }
            }
          ]
        }'
}

# Función para configurar dominio personalizado
configure_custom_domain() {
    log "Configurando dominio personalizado..."

    # Esto requiere configuración manual en Cloudflare Dashboard
    warning "Configuración de dominio personalizado requiere pasos manuales:"
    echo "  1. Ve a Cloudflare Dashboard > Pages"
    echo "  2. Selecciona tu proyecto"
    echo "  3. Ve a Custom Domains"
    echo "  4. Añade encore-platform.com"
    echo "  5. Configura los registros DNS necesarios"
}

# Función para verificar despliegue
verify_deployment() {
    log "Verificando despliegue..."

    # Verificar Pages
    if curl -s -I https://encore-platform.pages.dev | grep -q "200 OK"; then
        success "Cloudflare Pages funcionando"
    else
        warning "Cloudflare Pages no responde"
    fi

    # Verificar Workers
    if curl -s -I https://encore-api-router.encore.workers.dev | grep -q "200 OK"; then
        success "API Router Worker funcionando"
    else
        warning "API Router Worker no responde"
    fi

    # Verificar dominio personalizado (si está configurado)
    if curl -s -I https://encore-platform.com | grep -q "200 OK"; then
        success "Dominio personalizado funcionando"
    else
        warning "Dominio personalizado no configurado o no responde"
    fi
}

# Función para mostrar información de despliegue
show_deployment_info() {
    echo
    echo "=================================================="
    echo "🎉 Cloudflare CDN Desplegado Exitosamente!"
    echo "=================================================="
    echo
    echo "📋 Información de Despliegue:"
    echo "   • Frontend (Pages):     https://encore-platform.pages.dev"
    echo "   • API Gateway:          https://encore-api-router.encore.workers.dev"
    echo "   • Image Optimizer:      https://encore-image-optimizer.encore.workers.dev"
    echo "   • Dominio Principal:    https://encore-platform.com"
    echo
    echo "🔧 URLs de Administración:"
    echo "   • Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "   • Pages Dashboard:      https://dash.cloudflare.com/pages"
    echo "   • Workers Dashboard:    https://dash.cloudflare.com/workers"
    echo
    echo "📊 Monitoreo:"
    echo "   • Analytics: https://dash.cloudflare.com/analytics"
    echo "   • Security:  https://dash.cloudflare.com/security"
    echo
    echo "📚 Próximos Pasos:"
    echo "   1. Configurar dominio personalizado en Cloudflare"
    echo "   2. Configurar SSL/TLS settings"
    echo "   3. Configurar WAF rules adicionales"
    echo "   4. Configurar monitoring y alertas"
    echo
    echo "📖 Documentación: cdn/README.md"
    echo "=================================================="
}

# Función principal
main() {
    local environment=${1:-production}
    local skip_rules=${2:-false}

    echo "=================================================="
    echo "🚀 Desplegando Cloudflare CDN - Encore Platform"
    echo "=================================================="
    echo "Environment: $environment"
    echo "Skip Rules: $skip_rules"
    echo

    # Verificar dependencias
    check_dependencies

    # Configurar autenticación
    setup_cloudflare_auth

    # Desplegar Pages
    deploy_pages "$environment"

    # Desplegar Workers
    deploy_workers

    # Configurar reglas (opcional)
    if [ "$skip_rules" != "true" ]; then
        configure_cloudflare_rules
    else
        warning "Saltando configuración de reglas"
    fi

    # Configurar dominio personalizado
    configure_custom_domain

    # Verificar despliegue
    verify_deployment

    # Mostrar información
    show_deployment_info

    success "Cloudflare CDN desplegado exitosamente!"
}

# Función de ayuda
show_help() {
    echo "Uso: $0 [environment] [skip-rules]"
    echo
    echo "Parámetros:"
    echo "  environment    - Entorno de despliegue (production|staging|preview) [default: production]"
    echo "  skip-rules     - Saltar configuración de reglas (true|false) [default: false]"
    echo
    echo "Variables de entorno requeridas:"
    echo "  CLOUDFLARE_API_TOKEN     - API Token de Cloudflare"
    echo "  CLOUDFLARE_ACCOUNT_ID    - Account ID de Cloudflare"
    echo
    echo "Ejemplos:"
    echo "  $0 production           # Despliegue completo de producción"
    echo "  $0 staging             # Despliegue de staging"
    echo "  $0 preview true        # Preview sin reglas"
    echo
    echo "Requisitos:"
    echo "  - Node.js y npm instalados"
    echo "  - Cloudflare Wrangler CLI"
    echo "  - Credenciales de Cloudflare configuradas"
}

# Manejar argumentos
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    production|staging|preview)
        main "$1" "$2"
        ;;
    *)
        main "production" "$1"
        ;;
esac