#!/usr/bin/env node

/**
 * Script principal para ejecutar todos los tests del proyecto Encore
 * Ejecuta tests unitarios e integración para todos los servicios
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Configuración de servicios
const services = [
  {
    name: 'auth-service',
    path: './backend/auth-service',
    description: 'Servicio de Autenticación'
  },
  {
    name: 'points-service', 
    path: './backend/points-service',
    description: 'Servicio de Puntos y Recompensas'
  },
  {
    name: 'music-service',
    path: './backend/music-service', 
    description: 'Servicio de Música y Recomendaciones'
  }
];

// Función para logging con colores
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para ejecutar comando
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });

    child.on('error', (error) => {
      reject({ error: error.message, code: -1 });
    });
  });
}

// Función para verificar si existe package.json
function hasPackageJson(servicePath) {
  return fs.existsSync(path.join(servicePath, 'package.json'));
}

// Función para verificar si existen tests
function hasTests(servicePath) {
  const testsPath = path.join(servicePath, 'tests');
  return fs.existsSync(testsPath);
}

// Función para instalar dependencias
async function installDependencies(service) {
  log(`\n📦 Instalando dependencias para ${service.description}...`, 'yellow');
  
  try {
    await runCommand('npm', ['install'], service.path);
    log(`✅ Dependencias instaladas para ${service.name}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error instalando dependencias para ${service.name}:`, 'red');
    log(error.stderr || error.error, 'red');
    return false;
  }
}

// Función para ejecutar tests de un servicio
async function runServiceTests(service) {
  log(`\n🧪 Ejecutando tests para ${service.description}...`, 'cyan');
  
  if (!hasPackageJson(service.path)) {
    log(`⚠️  No se encontró package.json en ${service.path}`, 'yellow');
    return { success: false, skipped: true };
  }

  if (!hasTests(service.path)) {
    log(`⚠️  No se encontraron tests en ${service.path}`, 'yellow');
    return { success: false, skipped: true };
  }

  try {
    const result = await runCommand('npm', ['test'], service.path);
    
    log(`✅ Tests completados para ${service.name}`, 'green');
    
    // Extraer información de coverage si está disponible
    const coverageMatch = result.stdout.match(/All files\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)/); 
    let coverage = null;
    if (coverageMatch) {
      coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }

    // Extraer número de tests
    const testsMatch = result.stdout.match(/(\d+) passing/);
    const testsCount = testsMatch ? parseInt(testsMatch[1]) : 0;

    return {
      success: true,
      testsCount,
      coverage,
      output: result.stdout
    };
  } catch (error) {
    log(`❌ Tests fallaron para ${service.name}:`, 'red');
    log(error.stderr || error.stdout || error.error, 'red');
    return {
      success: false,
      error: error.stderr || error.stdout || error.error
    };
  }
}

// Función para generar reporte de resultados
function generateReport(results) {
  log('\n' + '='.repeat(60), 'bright');
  log('📊 REPORTE DE TESTING - PROYECTO ENCORE', 'bright');
  log('='.repeat(60), 'bright');

  let totalTests = 0;
  let passedServices = 0;
  let failedServices = 0;
  let skippedServices = 0;
  let totalCoverage = { statements: 0, branches: 0, functions: 0, lines: 0 };
  let servicesWithCoverage = 0;

  results.forEach((result, index) => {
    const service = services[index];
    log(`\n🔧 ${service.description} (${service.name}):`, 'blue');
    
    if (result.skipped) {
      log('   ⚠️  OMITIDO - No configurado', 'yellow');
      skippedServices++;
    } else if (result.success) {
      log(`   ✅ EXITOSO - ${result.testsCount || 0} tests`, 'green');
      totalTests += result.testsCount || 0;
      passedServices++;
      
      if (result.coverage) {
        log(`   📈 Coverage:`, 'cyan');
        log(`      - Statements: ${result.coverage.statements}%`, 'cyan');
        log(`      - Branches: ${result.coverage.branches}%`, 'cyan');
        log(`      - Functions: ${result.coverage.functions}%`, 'cyan');
        log(`      - Lines: ${result.coverage.lines}%`, 'cyan');
        
        totalCoverage.statements += result.coverage.statements;
        totalCoverage.branches += result.coverage.branches;
        totalCoverage.functions += result.coverage.functions;
        totalCoverage.lines += result.coverage.lines;
        servicesWithCoverage++;
      }
    } else {
      log('   ❌ FALLIDO', 'red');
      failedServices++;
    }
  });

  // Resumen general
  log('\n' + '-'.repeat(40), 'bright');
  log('📋 RESUMEN GENERAL:', 'bright');
  log(`   • Total de servicios: ${services.length}`, 'blue');
  log(`   • Servicios exitosos: ${passedServices}`, 'green');
  log(`   • Servicios fallidos: ${failedServices}`, 'red');
  log(`   • Servicios omitidos: ${skippedServices}`, 'yellow');
  log(`   • Total de tests: ${totalTests}`, 'cyan');
  
  if (servicesWithCoverage > 0) {
    log('\n📊 COVERAGE PROMEDIO:', 'bright');
    log(`   • Statements: ${(totalCoverage.statements / servicesWithCoverage).toFixed(1)}%`, 'cyan');
    log(`   • Branches: ${(totalCoverage.branches / servicesWithCoverage).toFixed(1)}%`, 'cyan');
    log(`   • Functions: ${(totalCoverage.functions / servicesWithCoverage).toFixed(1)}%`, 'cyan');
    log(`   • Lines: ${(totalCoverage.lines / servicesWithCoverage).toFixed(1)}%`, 'cyan');
  }

  // Estado final
  log('\n' + '='.repeat(60), 'bright');
  if (failedServices === 0) {
    log('🎉 TODOS LOS TESTS COMPLETADOS EXITOSAMENTE', 'green');
  } else {
    log(`⚠️  ${failedServices} SERVICIO(S) CON ERRORES`, 'red');
  }
  log('='.repeat(60), 'bright');

  return failedServices === 0;
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const installDeps = args.includes('--install') || args.includes('-i');
  const skipInstall = args.includes('--skip-install');
  const serviceFilter = args.find(arg => arg.startsWith('--service='))?.split('=')[1];
  
  log('🚀 INICIANDO TESTING DEL PROYECTO ENCORE', 'bright');
  log('==========================================', 'bright');
  
  // Filtrar servicios si se especifica
  let servicesToTest = services;
  if (serviceFilter) {
    servicesToTest = services.filter(s => s.name === serviceFilter);
    if (servicesToTest.length === 0) {
      log(`❌ Servicio '${serviceFilter}' no encontrado`, 'red');
      log(`Servicios disponibles: ${services.map(s => s.name).join(', ')}`, 'yellow');
      process.exit(1);
    }
    log(`🎯 Ejecutando tests solo para: ${serviceFilter}`, 'yellow');
  }

  const results = [];

  // Instalar dependencias si es necesario
  if (installDeps && !skipInstall) {
    log('\n📦 INSTALANDO DEPENDENCIAS...', 'bright');
    for (const service of servicesToTest) {
      if (hasPackageJson(service.path)) {
        await installDependencies(service);
      }
    }
  }

  // Ejecutar tests para cada servicio
  log('\n🧪 EJECUTANDO TESTS...', 'bright');
  for (const service of servicesToTest) {
    const result = await runServiceTests(service);
    results.push(result);
  }

  // Generar reporte final
  const allPassed = generateReport(results);
  
  // Salir con código apropiado
  process.exit(allPassed ? 0 : 1);
}

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  log('❌ Error no manejado:', 'red');
  log(reason, 'red');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('❌ Excepción no capturada:', 'red');
  log(error.message, 'red');
  process.exit(1);
});

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { runServiceTests, generateReport };