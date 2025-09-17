#!/usr/bin/env node

/**
 * Encore Analytics Demo Script
 *
 * Este script demuestra cómo usar el sistema de analytics
 * para generar métricas de ejemplo y probar la integración
 * con Grafana/Kibana.
 */

const axios = require('axios');

const ANALYTICS_URL = 'http://localhost:3005';
const GRAFANA_URL = 'http://localhost:3000';

// Datos de ejemplo
const sampleData = {
  bars: ['bar_001', 'bar_002', 'bar_003'],
  users: ['user_001', 'user_002', 'user_003', 'user_004', 'user_005'],
  songs: [
    { id: 'song_001', title: 'Bohemian Rhapsody', artist: 'Queen' },
    { id: 'song_002', title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
    { id: 'song_003', title: 'Hotel California', artist: 'Eagles' },
    { id: 'song_004', title: 'Imagine', artist: 'John Lennon' },
    { id: 'song_005', title: 'Hey Jude', artist: 'The Beatles' }
  ],
  products: [
    { id: 'prod_001', name: 'Cerveza Corona', category: 'bebidas' },
    { id: 'prod_002', name: 'Hamburguesa Clásica', category: 'comida' },
    { id: 'prod_003', name: 'Nachos', category: 'comida' },
    { id: 'prod_004', name: 'Agua Mineral', category: 'bebidas' }
  ]
};

/**
 * Genera métricas de ejemplo
 */
function generateSampleMetrics() {
  const metrics = [];
  const now = new Date();

  // Métricas de música (últimas 24 horas)
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);

    // Reproducciones de canciones
    sampleData.songs.forEach(song => {
      const plays = Math.floor(Math.random() * 10) + 1;
      metrics.push({
        bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
        metric_type: 'music',
        metric_name: 'song_plays',
        value: plays,
        date: timestamp,
        dimensions: {
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          genre: ['rock', 'pop', 'classic'][Math.floor(Math.random() * 3)]
        }
      });
    });

    // Usuarios activos
    const activeUsers = Math.floor(Math.random() * 20) + 5;
    metrics.push({
      bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
      metric_type: 'user',
      metric_name: 'active_users',
      value: activeUsers,
      date: timestamp,
      dimensions: {
        session_type: 'music_session'
      }
    });
  }

  // Métricas de ventas (últimos 7 días)
  for (let i = 0; i < 7; i++) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Ventas de productos
    sampleData.products.forEach(product => {
      const sales = Math.floor(Math.random() * 15) + 1;
      const revenue = sales * (Math.random() * 10 + 5); // Precio entre 5-15

      metrics.push({
        bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
        metric_type: 'menu',
        metric_name: 'product_sales',
        value: sales,
        date: timestamp,
        dimensions: {
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          revenue: revenue
        }
      });

      // Ingresos
      metrics.push({
        bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
        metric_type: 'financial',
        metric_name: 'revenue',
        value: revenue,
        date: timestamp,
        dimensions: {
          transaction_type: 'product_sale',
          payment_method: ['cash', 'card', 'digital'][Math.floor(Math.random() * 3)]
        }
      });
    });
  }

  // Métricas de sistema
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);

    // Tiempos de respuesta API
    metrics.push({
      bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
      metric_type: 'system',
      metric_name: 'api_response_time',
      value: Math.floor(Math.random() * 500) + 50, // 50-550ms
      date: timestamp,
      dimensions: {
        endpoint: ['/api/music', '/api/menu', '/api/auth'][Math.floor(Math.random() * 3)],
        method: ['GET', 'POST', 'PUT'][Math.floor(Math.random() * 3)]
      }
    });

    // Errores del sistema
    if (Math.random() < 0.05) { // 5% de probabilidad de error
      metrics.push({
        bar_id: sampleData.bars[Math.floor(Math.random() * sampleData.bars.length)],
        metric_type: 'system',
        metric_name: 'error_count',
        value: Math.floor(Math.random() * 5) + 1,
        date: timestamp,
        dimensions: {
          error_type: ['api_error', 'db_error', 'auth_error'][Math.floor(Math.random() * 3)],
          severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        }
      });
    }
  }

  return metrics;
}

/**
 * Envía métricas al servicio de analytics
 */
async function sendMetrics(metrics) {
  console.log(`📊 Enviando ${metrics.length} métricas de ejemplo...`);

  let successCount = 0;
  let errorCount = 0;

  for (const metric of metrics) {
    try {
      const response = await axios.post(`${ANALYTICS_URL}/api/v1/analytics`, metric, {
        timeout: 5000
      });

      if (response.status === 201) {
        successCount++;
      } else {
        console.warn(`⚠️  Respuesta inesperada: ${response.status}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error enviando métrica:`, error.message);
      errorCount++;
    }

    // Pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  console.log(`✅ ${successCount} métricas enviadas exitosamente`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} métricas fallaron`);
  }
}

/**
 * Verifica la conectividad con los servicios
 */
async function checkConnectivity() {
  console.log('🔍 Verificando conectividad...');

  const services = [
    { name: 'Analytics Service', url: `${ANALYTICS_URL}/health` },
    { name: 'Grafana', url: `${GRAFANA_URL}/api/health` }
  ];

  for (const service of services) {
    try {
      const response = await axios.get(service.url, { timeout: 5000 });
      console.log(`✅ ${service.name}: ${response.status === 200 ? 'OK' : 'WARN'}`);
    } catch (error) {
      console.log(`❌ ${service.name}: ${error.code || error.message}`);
    }
  }
}

/**
 * Consulta métricas de ejemplo
 */
async function querySampleMetrics() {
  console.log('\n📈 Consultando métricas de ejemplo...');

  try {
    // Obtener dashboard data
    const dashboardResponse = await axios.get(`${ANALYTICS_URL}/api/v1/analytics/dashboard/data?barId=bar_001&timeRange=24h`);
    console.log('📊 Dashboard data:', {
      total_events: dashboardResponse.data.summary?.total_events || 0,
      active_users: dashboardResponse.data.summary?.active_users || 0,
      revenue: dashboardResponse.data.summary?.revenue || 0
    });

    // Obtener métricas en tiempo real
    const realtimeResponse = await axios.get(`${ANALYTICS_URL}/api/v1/analytics/realtime/metrics?barId=bar_001`);
    console.log('⚡ Real-time metrics:', realtimeResponse.data.length, 'registros');

    // Obtener estadísticas
    const statsResponse = await axios.get(`${ANALYTICS_URL}/api/v1/analytics/statistics?barId=bar_001`);
    console.log('📋 Statistics:', {
      total_metrics: statsResponse.data.total_metrics,
      data_freshness: statsResponse.data.data_freshness?.latest_metric ?
        new Date(statsResponse.data.data_freshness.latest_metric).toLocaleString() : 'N/A'
    });

  } catch (error) {
    console.error('❌ Error consultando métricas:', error.message);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🎵 Encore Analytics Demo');
  console.log('========================\n');

  // Verificar conectividad
  await checkConnectivity();
  console.log('');

  // Generar métricas de ejemplo
  const metrics = generateSampleMetrics();
  console.log(`🎯 Generadas ${metrics.length} métricas de ejemplo\n`);

  // Enviar métricas
  await sendMetrics(metrics);
  console.log('');

  // Consultar métricas
  await querySampleMetrics();
  console.log('');

  console.log('🎉 Demo completada!');
  console.log('\n📊 Visualiza los resultados en:');
  console.log(`   Grafana: ${GRAFANA_URL}`);
  console.log(`   Kibana: http://localhost:5601`);
  console.log(`   Analytics API: ${ANALYTICS_URL}/api/v1/analytics`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error en demo:', error);
    process.exit(1);
  });
}

module.exports = { generateSampleMetrics, sendMetrics, checkConnectivity, querySampleMetrics };