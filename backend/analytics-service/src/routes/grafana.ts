import { Router } from 'express';
import { GrafanaController } from '../controllers/grafanaController';

const router = Router();
const grafanaController = new GrafanaController();

// ==============================================
// GRAFANA/KIBANA INTEGRATION ROUTES
// ==============================================

// Endpoint principal para queries de Grafana (JSON API)
router.post('/query', grafanaController.getTimeSeriesMetrics.bind(grafanaController));

// Endpoint para búsqueda de métricas disponibles
router.post('/search', grafanaController.searchMetrics.bind(grafanaController));

// Endpoint para annotations (eventos importantes)
router.post('/annotations', grafanaController.getAnnotations.bind(grafanaController));

// Endpoint para tag keys (variables de template)
router.post('/tag-keys', grafanaController.getTagKeys.bind(grafanaController));

// Endpoint para tag values
router.post('/tag-values', grafanaController.getTagValues.bind(grafanaController));

// ==============================================
// ADDITIONAL ENDPOINTS FOR GRAFANA
// ==============================================

// Métricas agregadas
router.get('/metrics/aggregated', grafanaController.getAggregatedMetrics.bind(grafanaController));

// Top métricas
router.get('/metrics/top', grafanaController.getTopMetrics.bind(grafanaController));

// Dashboard overview
router.get('/dashboard/overview', grafanaController.getDashboardOverview.bind(grafanaController));

// Health check para Grafana
router.get('/health', grafanaController.healthCheck.bind(grafanaController));

// ==============================================
// KIBANA SPECIFIC ENDPOINTS
// ==============================================

// Endpoint para Elasticsearch queries (compatible con Kibana)
router.post('/_search', async (req, res) => {
  try {
    // Aquí iría la lógica para procesar queries de Elasticsearch
    // Por ahora, redirigir a la query normal de Grafana
    return grafanaController.getTimeSeriesMetrics(req, res, () => {});
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Endpoint para mappings de Elasticsearch
router.get('/_mapping', (req, res) => {
  res.json({
    analytics: {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          bar_id: { type: 'keyword' },
          metric_type: { type: 'keyword' },
          metric_name: { type: 'keyword' },
          metric_category: { type: 'keyword' },
          value: { type: 'double' },
          dimensions: { type: 'object' },
          tags: { type: 'keyword' },
          metadata: { type: 'object' }
        }
      }
    }
  });
});

export default router;