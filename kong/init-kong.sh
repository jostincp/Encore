#!/bin/bash

# Encore Platform - Kong API Gateway Initialization Script
# Script para inicializar y configurar Kong API Gateway

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para esperar a que un servicio esté disponible
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1

    log "Esperando a que $service_name esté disponible en $host:$port..."

    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            success "$service_name está disponible"
            return 0
        fi

        log "Intento $attempt/$max_attempts - $service_name no está disponible aún..."
        sleep 2
        ((attempt++))
    done

    error "$service_name no está disponible después de $max_attempts intentos"
    return 1
}

# Función para verificar Kong
check_kong() {
    log "Verificando estado de Kong..."

    if ! curl -s http://localhost:8001/status > /dev/null; then
        error "Kong no está respondiendo"
        return 1
    fi

    success "Kong está funcionando correctamente"
    return 0
}

# Función para inicializar base de datos de Kong
init_kong_database() {
    log "Inicializando base de datos de Kong..."

    # Ejecutar migraciones de Kong
    docker-compose -f docker-compose.monitoring.yml exec -T kong kong migrations bootstrap

    if [ $? -eq 0 ]; then
        success "Base de datos de Kong inicializada correctamente"
    else
        error "Error inicializando base de datos de Kong"
        return 1
    fi
}

# Función para cargar configuración de Kong
load_kong_config() {
    local config_file=$1
    local config_name=$2

    log "Cargando configuración $config_name desde $config_file..."

    if [ ! -f "$config_file" ]; then
        error "Archivo de configuración $config_file no encontrado"
        return 1
    fi

    # Cargar configuración usando la API de Kong
    curl -X POST http://localhost:8001/config \
         -H "Content-Type: application/json" \
         -d @"$config_file"

    if [ $? -eq 0 ]; then
        success "Configuración $config_name cargada correctamente"
    else
        error "Error cargando configuración $config_name"
        return 1
    fi
}

# Función para verificar configuración cargada
verify_kong_config() {
    log "Verificando configuración de Kong..."

    # Verificar servicios
    local services_count=$(curl -s http://localhost:8001/services | jq '.data | length')
    log "Servicios configurados: $services_count"

    # Verificar rutas
    local routes_count=$(curl -s http://localhost:8001/routes | jq '.data | length')
    log "Rutas configuradas: $routes_count"

    # Verificar plugins
    local plugins_count=$(curl -s http://localhost:8001/plugins | jq '.data | length')
    log "Plugins configurados: $plugins_count"

    if [ "$services_count" -gt 0 ] && [ "$routes_count" -gt 0 ]; then
        success "Configuración verificada correctamente"
    else
        warning "Configuración podría estar incompleta"
    fi
}

# Función para probar API Gateway
test_api_gateway() {
    log "Probando API Gateway..."

    # Probar health check (sin autenticación)
    if curl -s http://localhost:8000/api/auth/health | grep -q "ok"; then
        success "Health check de auth service funciona"
    else
        warning "Health check de auth service falló"
    fi

    # Probar ruta protegida (debería fallar sin token)
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/music/songs)
    if [ "$response" -eq 401 ]; then
        success "Autenticación JWT funciona correctamente"
    else
        warning "Autenticación JWT podría no estar funcionando (código: $response)"
    fi
}

# Función para mostrar información de acceso
show_access_info() {
    echo
    echo "=================================================="
    echo "🎉 Kong API Gateway inicializado correctamente!"
    echo "=================================================="
    echo
    echo "📋 Información de acceso:"
    echo "   • API Gateway:     http://localhost:8000"
    echo "   • Admin API:       http://localhost:8001"
    echo "   • Admin GUI:       http://localhost:8002"
    echo
    echo "🔧 Servicios disponibles:"
    echo "   • Auth Service:    http://localhost:8000/api/auth"
    echo "   • Music Service:   http://localhost:8000/api/music"
    echo "   • Queue Service:   http://localhost:8000/api/queue"
    echo "   • Points Service:  http://localhost:8000/api/points"
    echo "   • Analytics:       http://localhost:8000/api/analytics"
    echo "   • Menu Service:    http://localhost:8000/api/menu"
    echo
    echo "🧪 Para probar autenticación:"
    echo "   curl http://localhost:8000/api/auth/health"
    echo
    echo "📚 Documentación: kong/README.md"
    echo "=================================================="
}

# Función principal
main() {
    local config_type=${1:-simple}

    echo "=================================================="
    echo "🚀 Inicializando Kong API Gateway - Encore Platform"
    echo "=================================================="
    echo

    # Verificar dependencias
    if ! command_exists docker; then
        error "Docker no está instalado"
        exit 1
    fi

    if ! command_exists docker-compose; then
        error "Docker Compose no está instalado"
        exit 1
    fi

    if ! command_exists curl; then
        error "curl no está instalado"
        exit 1
    fi

    if ! command_exists jq; then
        warning "jq no está instalado - algunas verificaciones estarán limitadas"
    fi

    # Iniciar servicios de monitoreo
    log "Iniciando servicios de monitoreo..."
    docker-compose -f docker-compose.monitoring.yml up -d kong-database

    # Esperar a que la base de datos esté disponible
    wait_for_service localhost 5432 "Kong Database"

    # Iniciar Kong
    log "Iniciando Kong API Gateway..."
    docker-compose -f docker-compose.monitoring.yml up -d kong

    # Esperar a que Kong esté disponible
    wait_for_service localhost 8001 "Kong Admin API"
    wait_for_service localhost 8000 "Kong Proxy"

    # Verificar Kong
    check_kong

    # Inicializar base de datos
    init_kong_database

    # Reiniciar Kong para aplicar cambios
    log "Reiniciando Kong para aplicar configuración..."
    docker-compose -f docker-compose.monitoring.yml restart kong

    # Esperar a que Kong esté disponible nuevamente
    sleep 5
    wait_for_service localhost 8001 "Kong Admin API"

    # Determinar archivo de configuración
    local config_file
    case $config_type in
        simple)
            config_file="kong/kong-simple.yml"
            ;;
        auth)
            config_file="kong/kong-auth.yml"
            ;;
        full)
            config_file="kong/kong.yml"
            ;;
        *)
            error "Tipo de configuración inválido: $config_type"
            echo "Opciones válidas: simple, auth, full"
            exit 1
            ;;
    esac

    # Cargar configuración
    load_kong_config "$config_file" "$config_type"

    # Verificar configuración
    verify_kong_config

    # Probar API Gateway
    test_api_gateway

    # Mostrar información de acceso
    show_access_info

    success "Kong API Gateway inicializado exitosamente!"
}

# Función de ayuda
show_help() {
    echo "Uso: $0 [tipo-configuracion]"
    echo
    echo "Tipos de configuración disponibles:"
    echo "  simple    - Configuración básica sin autenticación (por defecto)"
    echo "  auth      - Configuración completa con autenticación JWT"
    echo "  full      - Configuración avanzada con health checks"
    echo
    echo "Ejemplos:"
    echo "  $0                    # Configuración simple"
    echo "  $0 auth              # Configuración con autenticación"
    echo "  $0 full              # Configuración completa"
    echo
    echo "Requisitos:"
    echo "  - Docker y Docker Compose instalados"
    echo "  - curl instalado"
    echo "  - jq instalado (opcional)"
}

# Manejar argumentos
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    simple|auth|full)
        main "$1"
        ;;
    *)
        main "simple"
        ;;
esac