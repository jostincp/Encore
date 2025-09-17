#!/bin/bash

# Encore Platform - Test Runner Script
# Script automatizado para ejecutar la suite completa de pruebas

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

section() {
    echo -e "${PURPLE}🚀 $1${NC}"
    echo "=================================================="
}

# Función para verificar dependencias
check_dependencies() {
    section "Verificando dependencias"

    # Verificar Node.js
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js no está instalado"
        exit 1
    fi

    # Verificar npm
    if ! command -v npm >/dev/null 2>&1; then
        error "npm no está instalado"
        exit 1
    fi

    # Verificar Docker
    if ! command -v docker >/dev/null 2>&1; then
        warning "Docker no está instalado - algunas pruebas podrían fallar"
    fi

    # Verificar Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1; then
        warning "Docker Compose no está instalado - algunas pruebas podrían fallar"
    fi

    success "Dependencias verificadas"
}

# Función para instalar dependencias de pruebas
install_dependencies() {
    section "Instalando dependencias de pruebas"

    # Instalar dependencias del proyecto principal
    if [ ! -d "node_modules" ]; then
        log "Instalando dependencias del proyecto principal..."
        npm install
    fi

    # Instalar dependencias de tests
    if [ ! -d "tests/node_modules" ]; then
        log "Instalando dependencias de tests..."
        cd tests
        npm install
        cd ..
    fi

    # Instalar navegadores de Playwright
    log "Instalando navegadores de Playwright..."
    cd tests
    npx playwright install
    cd ..

    success "Dependencias instaladas"
}

# Función para iniciar servicios de test
start_test_services() {
    section "Iniciando servicios de prueba"

    # Iniciar base de datos de test
    log "Iniciando base de datos de test..."
    docker-compose -f docker-compose.test.yml up -d test-db 2>/dev/null || {
        warning "No se pudo iniciar base de datos de test con Docker Compose"
        info "Asegúrate de tener una base de datos PostgreSQL corriendo en localhost:5433"
    }

    # Iniciar Redis de test
    log "Iniciando Redis de test..."
    docker-compose -f docker-compose.test.yml up -d test-redis 2>/dev/null || {
        warning "No se pudo iniciar Redis de test con Docker Compose"
        info "Asegúrate de tener Redis corriendo en localhost:6380"
    }

    # Esperar a que los servicios estén listos
    log "Esperando a que los servicios estén listos..."
    sleep 5

    success "Servicios de prueba iniciados"
}

# Función para ejecutar tests unitarios
run_unit_tests() {
    section "Ejecutando Tests Unitarios"

    local coverage=""
    if [ "$GENERATE_COVERAGE" = "true" ]; then
        coverage="--coverage"
        info "Generando reporte de cobertura"
    fi

    cd tests
    npm run test:unit $coverage

    if [ $? -eq 0 ]; then
        success "Tests unitarios pasaron exitosamente"
    else
        error "Algunos tests unitarios fallaron"
        return 1
    fi

    cd ..
}

# Función para ejecutar tests de integración
run_integration_tests() {
    section "Ejecutando Tests de Integración"

    # Verificar que los servicios estén corriendo
    if ! nc -z localhost 5433 2>/dev/null; then
        warning "Base de datos de test no está disponible en localhost:5433"
        info "Ejecutando tests de integración sin base de datos..."
    fi

    cd tests
    npm run test:integration

    if [ $? -eq 0 ]; then
        success "Tests de integración pasaron exitosamente"
    else
        error "Algunos tests de integración fallaron"
        return 1
    fi

    cd ..
}

# Función para ejecutar tests e2e
run_e2e_tests() {
    section "Ejecutando Tests End-to-End"

    # Verificar que la aplicación esté corriendo
    if ! nc -z localhost 3000 2>/dev/null; then
        warning "Aplicación frontend no está corriendo en localhost:3000"
        info "Iniciando aplicación para tests e2e..."

        # Iniciar aplicación en background
        npm run dev &
        APP_PID=$!

        # Esperar a que la aplicación esté lista
        log "Esperando a que la aplicación esté lista..."
        local attempts=0
        while [ $attempts -lt 30 ]; do
            if curl -s http://localhost:3000 > /dev/null; then
                success "Aplicación lista para tests"
                break
            fi
            sleep 2
            ((attempts++))
        done

        if [ $attempts -eq 30 ]; then
            error "Aplicación no pudo iniciarse"
            return 1
        fi
    fi

    cd tests
    npm run test:e2e

    if [ $? -eq 0 ]; then
        success "Tests e2e pasaron exitosamente"
    else
        error "Algunos tests e2e fallaron"
        return 1
    fi

    cd ..

    # Detener aplicación si la iniciamos nosotros
    if [ -n "$APP_PID" ]; then
        kill $APP_PID 2>/dev/null || true
    fi
}

# Función para ejecutar tests de performance
run_performance_tests() {
    section "Ejecutando Tests de Performance"

    cd tests
    npm run test:performance

    if [ $? -eq 0 ]; then
        success "Tests de performance pasaron exitosamente"
    else
        warning "Algunos tests de performance fallaron"
    fi

    cd ..
}

# Función para ejecutar tests de accesibilidad
run_accessibility_tests() {
    section "Ejecutando Tests de Accesibilidad"

    cd tests
    npm run test:accessibility

    if [ $? -eq 0 ]; then
        success "Tests de accesibilidad pasaron exitosamente"
    else
        warning "Algunos tests de accesibilidad fallaron"
    fi

    cd ..
}

# Función para generar reportes
generate_reports() {
    section "Generando Reportes"

    # Crear directorio de reportes
    mkdir -p tests/reports

    # Copiar reportes de cobertura
    if [ -d "tests/coverage" ]; then
        cp -r tests/coverage/* tests/reports/ 2>/dev/null || true
        info "Reporte de cobertura generado: tests/reports/lcov-report/index.html"
    fi

    # Reporte de Playwright
    if [ -d "tests/test-results" ]; then
        info "Reporte de Playwright generado: tests/test-results/index.html"
    fi

    success "Reportes generados"
}

# Función para limpiar después de los tests
cleanup() {
    section "Limpiando recursos de prueba"

    # Detener servicios de test
    docker-compose -f docker-compose.test.yml down 2>/dev/null || true

    # Limpiar archivos temporales
    rm -rf tests/.nyc_output
    rm -rf tests/coverage
    rm -rf tests/test-results

    success "Limpieza completada"
}

# Función para mostrar resultados finales
show_results() {
    section "Resultados de Tests"

    echo
    echo "📊 Resumen de Ejecución:"
    echo "   • Tests Unitarios: $([ "$UNIT_TESTS_PASSED" = "true" ] && echo "✅ PASARON" || echo "❌ FALLARON")"
    echo "   • Tests de Integración: $([ "$INTEGRATION_TESTS_PASSED" = "true" ] && echo "✅ PASARON" || echo "❌ FALLARON")"
    echo "   • Tests E2E: $([ "$E2E_TESTS_PASSED" = "true" ] && echo "✅ PASARON" || echo "❌ FALLARON")"
    echo "   • Tests de Performance: $([ "$PERFORMANCE_TESTS_PASSED" = "true" ] && echo "✅ PASARON" || echo "❌ FALLARON")"
    echo "   • Tests de Accesibilidad: $([ "$ACCESSIBILITY_TESTS_PASSED" = "true" ] && echo "✅ PASARON" || echo "❌ FALLARON")"

    echo
    echo "📁 Reportes disponibles en:"
    echo "   • Cobertura: tests/reports/lcov-report/index.html"
    echo "   • Playwright: tests/test-results/index.html"
    echo "   • JUnit: tests/reports/junit.xml"

    echo
    if [ "$OVERALL_SUCCESS" = "true" ]; then
        success "🎉 Todos los tests pasaron exitosamente!"
        echo
        echo "💡 Próximos pasos:"
        echo "   • Revisar reportes de cobertura para identificar áreas sin testear"
        echo "   • Ejecutar tests regularmente en CI/CD"
        echo "   • Añadir más tests para nuevas funcionalidades"
    else
        warning "⚠️  Algunos tests fallaron"
        echo
        echo "🔧 Para depurar:"
        echo "   • Revisar logs detallados en tests/reports/"
        echo "   • Ejecutar tests individualmente: npm run test:unit"
        echo "   • Usar modo debug: npm run playwright:debug"
    fi
}

# Función principal
main() {
    local test_type=${1:-all}
    local generate_coverage=${2:-false}

    echo "=================================================="
    echo "🧪 Encore Platform - Suite de Pruebas"
    echo "=================================================="
    echo "Tipo de tests: $test_type"
    echo "Generar cobertura: $generate_coverage"
    echo

    # Variables de estado
    UNIT_TESTS_PASSED=false
    INTEGRATION_TESTS_PASSED=false
    E2E_TESTS_PASSED=false
    PERFORMANCE_TESTS_PASSED=false
    ACCESSIBILITY_TESTS_PASSED=false
    OVERALL_SUCCESS=false

    # Verificar dependencias
    check_dependencies

    # Instalar dependencias
    install_dependencies

    # Iniciar servicios de test
    start_test_services

    # Ejecutar tests según el tipo solicitado
    case $test_type in
        unit)
            run_unit_tests && UNIT_TESTS_PASSED=true
            ;;
        integration)
            run_integration_tests && INTEGRATION_TESTS_PASSED=true
            ;;
        e2e)
            run_e2e_tests && E2E_TESTS_PASSED=true
            ;;
        performance)
            run_performance_tests && PERFORMANCE_TESTS_PASSED=true
            ;;
        accessibility)
            run_accessibility_tests && ACCESSIBILITY_TESTS_PASSED=true
            ;;
        all)
            # Ejecutar todos los tests
            (run_unit_tests && UNIT_TESTS_PASSED=true) || true
            (run_integration_tests && INTEGRATION_TESTS_PASSED=true) || true
            (run_e2e_tests && E2E_TESTS_PASSED=true) || true
            (run_performance_tests && PERFORMANCE_TESTS_PASSED=true) || true
            (run_accessibility_tests && ACCESSIBILITY_TESTS_PASSED=true) || true
            ;;
        *)
            error "Tipo de test inválido: $test_type"
            echo "Tipos válidos: unit, integration, e2e, performance, accessibility, all"
            exit 1
            ;;
    esac

    # Generar reportes si se ejecutaron tests
    if [ "$test_type" != "none" ]; then
        generate_reports
    fi

    # Determinar éxito general
    if [ "$test_type" = "all" ]; then
        if [ "$UNIT_TESTS_PASSED" = "true" ] && [ "$INTEGRATION_TESTS_PASSED" = "true" ] && [ "$E2E_TESTS_PASSED" = "true" ]; then
            OVERALL_SUCCESS=true
        fi
    else
        OVERALL_SUCCESS=true  # Para tests individuales, consideramos éxito si no fallaron
    fi

    # Limpiar recursos
    cleanup

    # Mostrar resultados
    show_results

    # Exit code basado en el éxito
    if [ "$OVERALL_SUCCESS" = "true" ]; then
        exit 0
    else
        exit 1
    fi
}

# Función de ayuda
show_help() {
    echo "Uso: $0 [tipo-tests] [generar-cobertura]"
    echo
    echo "Parámetros:"
    echo "  tipo-tests          - Tipo de tests a ejecutar (unit|integration|e2e|performance|accessibility|all) [default: all]"
    echo "  generar-cobertura   - Generar reportes de cobertura (true|false) [default: false]"
    echo
    echo "Ejemplos:"
    echo "  $0 all true         # Ejecutar todos los tests con cobertura"
    echo "  $0 unit             # Solo tests unitarios"
    echo "  $0 e2e              # Solo tests end-to-end"
    echo "  $0 performance      # Solo tests de performance"
    echo
    echo "Requisitos:"
    echo "  - Node.js y npm instalados"
    echo "  - Docker y Docker Compose (opcional, para servicios de test)"
    echo "  - Navegadores instalados (para tests e2e)"
    echo
    echo "Variables de entorno:"
    echo "  CI=true             # Modo CI (deshabilita watch mode)"
    echo "  DEBUG=true          # Modo debug (más logs)"
}

# Manejar argumentos
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    unit|integration|e2e|performance|accessibility|all)
        main "$1" "$2"
        ;;
    *)
        main "all" "$1"
        ;;
esac