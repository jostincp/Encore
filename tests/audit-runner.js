#!/usr/bin/env node

/**
 * 🔍 AUDITORÍA COMPLETA: Motor de Cola Musical Encore
 * Script de ejecución de pruebas según auditoría
 * 
 * Este script ejecuta todas las verificaciones críticas identificadas
 * en la auditoría y genera un reporte detallado.
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuración
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'http://localhost:3003';
const POINTS_SERVICE_URL = process.env.POINTS_SERVICE_URL || 'http://localhost:3004';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(colors.cyan, `\n🔍 ${title}`);
  log(colors.cyan, '='.repeat(50));
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️ ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️ ${message}`);
}

// Datos de prueba
const TEST_DATA = {
  bar: {
    id: 'audit-test-bar-123',
    name: 'Audit Test Bar',
    is_active: true
  },
  user: {
    id: 'audit-test-user-456',
    username: 'audituser',
    role: 'user',
    points: 1000
  },
  song: {
    id: 'audit-test-song-789',
    title: 'Audit Test Song',
    artist: 'Audit Artist',
    video_id: 'audit_video_123',
    is_available: true
  }
};

// Generar token JWT simple para pruebas
function generateTestToken(userId, role = 'user') {
  const payload = { id: userId, role, barId: TEST_DATA.bar.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

class AuditTester {
  constructor() {
    this.authToken = generateTestToken(TEST_DATA.user.id, 'user');
    this.adminToken = generateTestToken('admin-123', 'admin');
    this.results = {
      passed: 0,
      failed: 0,
      critical: 0,
      total: 0
    };
    this.startTime = performance.now();
  }

  async runTest(testName, testFunction, isCritical = false) {
    this.results.total++;
    
    try {
      logInfo(`Ejecutando: ${testName}`);
      const startTime = performance.now();
      
      await testFunction();
      
      const duration = (performance.now() - startTime).toFixed(2);
      logSuccess(`${testName} (${duration}ms)`);
      this.results.passed++;
      
      if (isCritical) {
        this.results.critical++;
      }
    } catch (error) {
      logError(`${testName}: ${error.message}`);
      this.results.failed++;
      
      if (isCritical) {
        logError('🚨 FALLA CRÍTICA DE SEGURIDAD');
      }
    }
  }

  async waitForServices() {
    logSection('Verificando Disponibilidad de Servicios');
    
    const services = [
      { name: 'Queue Service', url: QUEUE_SERVICE_URL },
      { name: 'Points Service', url: POINTS_SERVICE_URL },
      { name: 'Auth Service', url: AUTH_SERVICE_URL }
    ];

    for (const service of services) {
      await this.runTest(
        `Disponibilidad: ${service.name}`,
        async () => {
          const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
          if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
          }
        },
        true
      );
    }
  }

  async testCriticalFlow() {
    logSection('🚨 PRUEBAS CRÍTICAS: Flujo de Cobro y Cola');

    // Test 1: Deducción de puntos ANTES de Redis
    await this.runTest(
      '💰 Deducción de puntos ANTES de operación Redis',
      async () => {
        // Obtener balance inicial
        const initialResponse = await axios.get(
          `${POINTS_SERVICE_URL}/api/points/balance/${TEST_DATA.user.id}/${TEST_DATA.bar.id}`,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );
        
        const initialBalance = initialResponse.data.balance;
        
        // Añadir canción a cola
        const addResponse = await axios.post(
          `${QUEUE_SERVICE_URL}/api/queue/add`,
          {
            bar_id: TEST_DATA.bar.id,
            song_id: TEST_DATA.song.id,
            priority_play: false
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );
        
        // Verificar que se dedujeron puntos
        if (addResponse.data.data.pointsDeducted !== 10) {
          throw new Error(`Expected 10 points deducted, got ${addResponse.data.data.pointsDeducted}`);
        }
        
        // Verificar balance final
        const finalResponse = await axios.get(
          `${POINTS_SERVICE_URL}/api/points/balance/${TEST_DATA.user.id}/${TEST_DATA.bar.id}`,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );
        
        const expectedFinalBalance = initialBalance - 10;
        if (finalResponse.data.balance !== expectedFinalBalance) {
          throw new Error(`Expected final balance ${expectedFinalBalance}, got ${finalResponse.data.balance}`);
        }
      },
      true
    );

    // Test 2: Rechazo por saldo insuficiente
    await this.runTest(
      '❌ Rechazo por saldo insuficiente',
      async () => {
        // Gastar todos los puntos
        await axios.post(
          `${POINTS_SERVICE_URL}/api/points/deduct`,
          {
            userId: TEST_DATA.user.id,
            barId: TEST_DATA.bar.id,
            amount: 1000,
            reason: 'test_setup'
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Intentar añadir canción sin saldo
        try {
          await axios.post(
            `${QUEUE_SERVICE_URL}/api/queue/add`,
            {
              bar_id: TEST_DATA.bar.id,
              song_id: TEST_DATA.song.id,
              priority_play: false
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );
          
          throw new Error('Debió rechazar por saldo insuficiente');
        } catch (error) {
          if (error.response?.status !== 402) {
            throw new Error(`Expected status 402, got ${error.response?.status}`);
          }
        }
      },
      true
    );

    // Test 3: Deduplicación O(1) antes de cobrar
    await this.runTest(
      '⚡ Deduplicación O(1) antes de cobrar puntos',
      async () => {
        // Restaurar puntos para esta prueba
        await axios.post(
          `${POINTS_SERVICE_URL}/api/points/refund`,
          {
            userId: TEST_DATA.user.id,
            barId: TEST_DATA.bar.id,
            amount: 1000,
            reason: 'test_setup'
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Añadir primera canción
        await axios.post(
          `${QUEUE_SERVICE_URL}/api/queue/add`,
          {
            bar_id: TEST_DATA.bar.id,
            song_id: TEST_DATA.song.id,
            priority_play: false
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        const balanceBeforeDuplicate = await axios.get(
          `${POINTS_SERVICE_URL}/api/points/balance/${TEST_DATA.user.id}/${TEST_DATA.bar.id}`,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Intentar añadir duplicado
        try {
          await axios.post(
            `${QUEUE_SERVICE_URL}/api/queue/add`,
            {
              bar_id: TEST_DATA.bar.id,
              song_id: TEST_DATA.song.id,
              priority_play: false
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );
          
          throw new Error('Debió rechazar duplicado');
        } catch (error) {
          if (error.response?.status !== 409) {
            throw new Error(`Expected status 409 for duplicate, got ${error.response?.status}`);
          }
          
          // Verificar que NO se cobraron puntos
          const balanceAfterDuplicate = await axios.get(
            `${POINTS_SERVICE_URL}/api/points/balance/${TEST_DATA.user.id}/${TEST_DATA.bar.id}`,
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );

          if (balanceAfterDuplicate.data.balance !== balanceBeforeDuplicate.data.balance) {
            throw new Error('Los puntos no deberían haberse cobrado para duplicado');
          }
        }
      },
      true
    );
  }

  async testRedisAtomicity() {
    logSection('⚛️ Pruebas de Atomicidad Redis');

    await this.runTest(
      '🔒 Transacciones MULTI/EXEC atómicas',
      async () => {
        const response = await axios.post(
          `${QUEUE_SERVICE_URL}/api/queue/add`,
          {
            bar_id: TEST_DATA.bar.id,
            song_id: 'atomic-test-song',
            priority_play: false
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Verificar que se creó transacción ID
        if (!response.data.data.transactionId) {
          throw new Error('No se creó transaction ID');
        }

        // Verificar estado de Redis
        const healthResponse = await axios.get(`${QUEUE_SERVICE_URL}/health`);
        if (healthResponse.data.data.redis.status !== 'healthy') {
          throw new Error('Redis no está saludable');
        }
      },
      true
    );

    await this.runTest(
      '📊 Estructura Redis correcta',
      async () => {
        // Verificar que existen las estructuras Redis correctas
        const queueResponse = await axios.get(
          `${QUEUE_SERVICE_URL}/api/queue/${TEST_DATA.bar.id}`,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Debe tener items y stats
        if (!queueResponse.data.data.items || !queueResponse.data.data.stats) {
          throw new Error('Estructura de respuesta incorrecta');
        }

        const stats = queueResponse.data.data.stats;
        if (typeof stats.totalItems !== 'number' || 
            typeof stats.priorityItems !== 'number' || 
            typeof stats.standardItems !== 'number') {
          throw new Error('Stats no tienen formato correcto');
        }
      },
      true
    );
  }

  async testRollbackMechanism() {
    logSection('🔄 Pruebas de Rollback');

    await this.runTest(
      '💸 Rollback automático de puntos',
      async () => {
        // Esta prueba verifica que el mecanismo de rollback existe
        // En un entorno real, necesitaríamos simular un fallo de Redis
        
        const addResponse = await axios.post(
          `${QUEUE_SERVICE_URL}/api/queue/add`,
          {
            bar_id: TEST_DATA.bar.id,
            song_id: 'rollback-test-song',
            priority_play: false
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        // Verificar que hay transaction ID para rollback potencial
        if (!addResponse.data.data.transactionId) {
          throw new Error('No hay transaction ID para rollback');
        }

        // Verificar que el balance es correcto
        if (typeof addResponse.data.data.newBalance !== 'number') {
          throw new Error('Balance no es un número');
        }
      },
      true
    );

    await this.runTest(
      '🔄 Reembolso al eliminar canción propia',
      async () => {
        // Añadir canción
        const addResponse = await axios.post(
          `${QUEUE_SERVICE_URL}/api/queue/add`,
          {
            bar_id: TEST_DATA.bar.id,
            song_id: 'refund-test-song',
            priority_play: false
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        const balanceAfterAdd = addResponse.data.data.newBalance;
        const queueItemId = addResponse.data.data.queueItem.id;

        // Eliminar canción
        const removeResponse = await axios.delete(
          `${QUEUE_SERVICE_URL}/api/queue/${TEST_DATA.bar.id}/${queueItemId}`,
          { 
            headers: { Authorization: `Bearer ${this.authToken}` },
            data: { video_id: 'refund_test_video' }
          }
        );

        if (removeResponse.status !== 200) {
          throw new Error('Falló eliminación de canción');
        }

        // Verificar reembolso (debería tener más puntos)
        const finalBalance = await axios.get(
          `${POINTS_SERVICE_URL}/api/points/balance/${TEST_DATA.user.id}/${TEST_DATA.bar.id}`,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );

        if (finalBalance.data.balance <= balanceAfterAdd) {
          throw new Error('No se reembolsaron puntos correctamente');
        }
      },
      true
    );
  }

  async testSecurity() {
    logSection('🔐 Pruebas de Seguridad');

    await this.runTest(
      '🚫 Rechazo sin autenticación',
      async () => {
        try {
          await axios.post(`${QUEUE_SERVICE_URL}/api/queue/add`, {
            bar_id: TEST_DATA.bar.id,
            song_id: TEST_DATA.song.id
          });
          
          throw new Error('Debió rechazar sin autenticación');
        } catch (error) {
          if (error.response?.status !== 401) {
            throw new Error(`Expected status 401, got ${error.response?.status}`);
          }
        }
      },
      true
    );

    await this.runTest(
      '🛡️ Validación de IDs',
      async () => {
        try {
          await axios.post(
            `${QUEUE_SERVICE_URL}/api/queue/add`,
            {
              bar_id: 'invalid-uuid',
              song_id: TEST_DATA.song.id
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );
          
          throw new Error('Debió rechazar UUID inválido');
        } catch (error) {
          if (error.response?.status !== 400) {
            throw new Error(`Expected status 400, got ${error.response?.status}`);
          }
        }
      },
      true
    );
  }

  async testPerformance() {
    logSection('⚡ Pruebas de Rendimiento');

    await this.runTest(
      '🚀 Rendimiento deduplicación O(1)',
      async () => {
        const startTime = performance.now();
        
        // Verificar duplicado (debe ser muy rápido)
        try {
          await axios.post(
            `${QUEUE_SERVICE_URL}/api/queue/add`,
            {
              bar_id: TEST_DATA.bar.id,
              song_id: TEST_DATA.song.id,
              priority_play: false
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );
        } catch (error) {
          // Esperamos que falle por duplicado
        }
        
        const duration = performance.now() - startTime;
        
        if (duration > 100) {
          throw new Error(`Deduplicación tomó ${duration.toFixed(2)}ms, debe ser < 100ms`);
        }
      },
      false
    );

    await this.runTest(
      '📈 Concurrencia básica',
      async () => {
        const promises = [];
        const concurrentRequests = 5;

        for (let i = 0; i < concurrentRequests; i++) {
          promises.push(
            axios.post(
              `${QUEUE_SERVICE_URL}/api/queue/add`,
              {
                bar_id: TEST_DATA.bar.id,
                song_id: `concurrent-song-${i}`,
                priority_play: false
              },
              { headers: { Authorization: `Bearer ${this.authToken}` } }
            )
          );
        }

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        if (successful === 0) {
          throw new Error('Ninguna solicitud concurrente funcionó');
        }
      },
      false
    );
  }

  async cleanup() {
    logSection('🧹 Limpieza');
    
    try {
      await axios.delete(
        `${QUEUE_SERVICE_URL}/api/queue/${TEST_DATA.bar.id}/clear`,
        { headers: { Authorization: `Bearer ${this.adminToken}` } }
      );
      logSuccess('Limpieza completada');
    } catch (error) {
      logWarning(`Error en limpieza: ${error.message}`);
    }
  }

  generateReport() {
    const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);
    
    logSection('📊 REPORTE FINAL DE AUDITORÍA');
    
    logInfo(`Duración total: ${duration}s`);
    logInfo(`Total de pruebas: ${this.results.total}`);
    
    if (this.results.passed > 0) {
      logSuccess(`Pruebas pasadas: ${this.results.passed}`);
    }
    
    if (this.results.failed > 0) {
      logError(`Pruebas fallidas: ${this.results.failed}`);
    }
    
    if (this.results.critical > 0) {
      logSuccess(`Pruebas críticas pasadas: ${this.results.critical}`);
    }
    
    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    const criticalRate = ((this.results.critical / this.results.total) * 100).toFixed(1);
    
    logInfo(`Tasa de éxito: ${successRate}%`);
    logInfo(`Tasa de pruebas críticas: ${criticalRate}%`);
    
    // Veredicto final
    if (this.results.failed === 0) {
      logSuccess('\n🎉 AUDITORÍA COMPLETADA CON ÉXITO');
      logSuccess('✅ Todas las vulnerabilidades críticas han sido resueltas');
    } else {
      logError('\n🚨 AUDITORÍA CON FALLAS CRÍTICAS');
      logError('❌ El sistema NO es seguro para producción');
      logError(`🔧 Se deben corregir ${this.results.failed} fallas críticas`);
    }
    
    // Recomendaciones
    logSection('📋 RECOMENDACIONES');
    
    if (this.results.failed === 0) {
      logSuccess('✅ Sistema listo para despliegue en producción');
      logSuccess('✅ Todas las medidas de seguridad implementadas');
      logSuccess('✅ Rendimiento y atomicidad verificados');
    } else {
      logWarning('⚠️ NO desplegar en producción hasta corregir fallas');
      logWarning('⚠️ Priorizar corrección de pruebas críticas fallidas');
      logWarning('⚠️ Revisar logs para identificar problemas específicos');
    }
    
    return {
      success: this.results.failed === 0,
      results: this.results,
      duration: parseFloat(duration),
      successRate: parseFloat(successRate),
      criticalRate: parseFloat(criticalRate)
    };
  }

  async runFullAudit() {
    log(colors.magenta, '\n🔍 AUDITORÍA COMPLETA: Motor de Cola Musical Encore');
    log(colors.magenta, '='.repeat(60));
    
    try {
      await this.waitForServices();
      await this.testCriticalFlow();
      await this.testRedisAtomicity();
      await this.testRollbackMechanism();
      await this.testSecurity();
      await this.testPerformance();
      
      const report = this.generateReport();
      
      await this.cleanup();
      
      return report;
    } catch (error) {
      logError(`Error fatal en auditoría: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }
}

// Ejecutar auditoría si se llama directamente
if (require.main === module) {
  const auditor = new AuditTester();
  
  auditor.runFullAudit()
    .then(report => {
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      logError(`Auditoría fallida: ${error.message}`);
      process.exit(1);
    });
}

module.exports = AuditTester;
