import { Request, Response, NextFunction } from 'express';
import AnalyticsService from '../services/analyticsService';
import { logger } from '../utils/logger';

export class GrafanaController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Endpoint para Grafana: Métricas de tiempo real
   * Compatible con Grafana JSON API
   */
  async getTimeSeriesMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { barId, metricName, from, to, interval = '1h' } = req.query;

      if (!barId || !metricName) {
        return res.status(400).json({
          error: 'barId and metricName are required'
        });
      }

      const startDate = new Date(parseInt(from as string));
      const endDate = new Date(parseInt(to as string));

      const timeSeries = await this.analyticsService.getTimeSeries(
        barId as string,
        metricName as string,
        startDate,
        endDate,
        interval as string
      );

      // Formato compatible con Grafana
      const grafanaData = timeSeries.map(point => ({
        target: metricName,
        datapoints: [[point.value, point.timestamp.getTime()]]
      }));

      res.json(grafanaData);
    } catch (error) {
      logger.error('Error getting time series for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Métricas agregadas
   */
  async getAggregatedMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { barId, metricType, from, to, groupBy } = req.query;

      if (!barId || !metricType) {
        return res.status(400).json({
          error: 'barId and metricType are required'
        });
      }

      const startDate = new Date(parseInt(from as string));
      const endDate = new Date(parseInt(to as string));

      const aggregated = await this.analyticsService.getAggregatedMetrics(
        barId as string,
        metricType as string,
        startDate,
        endDate,
        {
          group_by: groupBy ? [groupBy as string] : undefined
        }
      );

      // Formato compatible con Grafana
      const grafanaData = aggregated.map(item => ({
        target: `${metricType} - ${item._id || 'total'}`,
        datapoints: [[item.total_value, Date.now()]]
      }));

      res.json(grafanaData);
    } catch (error) {
      logger.error('Error getting aggregated metrics for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Top métricas
   */
  async getTopMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { barId, metricType, from, to, limit = 10 } = req.query;

      if (!barId || !metricType) {
        return res.status(400).json({
          error: 'barId and metricType are required'
        });
      }

      const startDate = new Date(parseInt(from as string));
      const endDate = new Date(parseInt(to as string));

      const topMetrics = await this.analyticsService.getTopMetrics(
        barId as string,
        metricType as string,
        startDate,
        endDate,
        parseInt(limit as string)
      );

      // Formato compatible con Grafana Table Panel
      const tableData = {
        columns: [
          { text: 'Métrica', type: 'string' },
          { text: 'Valor Total', type: 'number' },
          { text: 'Conteo', type: 'number' },
          { text: 'Promedio', type: 'number' }
        ],
        rows: topMetrics.map(metric => [
          metric._id.metric_name,
          metric.total_value,
          metric.count,
          metric.avg_value
        ]),
        type: 'table'
      };

      res.json([tableData]);
    } catch (error) {
      logger.error('Error getting top metrics for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Dashboard overview
   */
  async getDashboardOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const { barId, timeRange = '24h' } = req.query;

      if (!barId) {
        return res.status(400).json({
          error: 'barId is required'
        });
      }

      const overview = await this.analyticsService.getDashboardOverview(
        barId as string,
        timeRange as 'today' | 'week' | 'month' | 'year'
      );

      // Formato para múltiples paneles de Grafana
      const panels = [
        {
          target: 'Total Revenue',
          datapoints: [[overview.summary.total_revenue, Date.now()]]
        },
        {
          target: 'Total User Activities',
          datapoints: [[overview.summary.total_user_activities, Date.now()]]
        },
        {
          target: 'Total Song Plays',
          datapoints: [[overview.summary.total_song_plays, Date.now()]]
        },
        {
          target: 'Unique Users',
          datapoints: [[overview.summary.unique_users, Date.now()]]
        }
      ];

      res.json(panels);
    } catch (error) {
      logger.error('Error getting dashboard overview for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Annotations (eventos importantes)
   */
  async getAnnotations(req: Request, res: Response, next: NextFunction) {
    try {
      const { barId, from, to } = req.query;

      if (!barId) {
        return res.status(400).json({
          error: 'barId is required'
        });
      }

      const startDate = new Date(parseInt(from as string));
      const endDate = new Date(parseInt(to as string));

      // Obtener eventos importantes para anotaciones
      const importantEvents = await this.analyticsService.getAnalyticsByType('system_events', {
        barId: barId as string,
        startDate,
        endDate
      });

      // Formato de anotaciones para Grafana
      const annotations = importantEvents.data.map(event => ({
        annotation: {
          name: event.metric_name,
          enabled: true,
          datasource: 'Encore Analytics'
        },
        title: event.metric_name,
        time: event.created_at.getTime(),
        text: `Value: ${event.value}`,
        tags: event.tags || []
      }));

      res.json(annotations);
    } catch (error) {
      logger.error('Error getting annotations for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Health check
   */
  async healthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await this.analyticsService.healthCheck();

      res.json({
        status: health.status,
        message: 'Grafana datasource is healthy',
        details: health
      });
    } catch (error) {
      logger.error('Health check failed for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Search (lista de métricas disponibles)
   */
  async searchMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { target } = req.query;

      // Lista de métricas disponibles para Grafana
      const availableMetrics = [
        'revenue',
        'user_activity',
        'song_plays',
        'product_orders',
        'active_users',
        'queue_length',
        'system_errors',
        'api_requests',
        'cache_hits',
        'response_time'
      ];

      // Filtrar por target si se proporciona
      const filteredMetrics = target ?
        availableMetrics.filter(metric => metric.includes(target as string)) :
        availableMetrics;

      res.json(filteredMetrics);
    } catch (error) {
      logger.error('Error searching metrics for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Tag keys (para template variables)
   */
  async getTagKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const tagKeys = [
        { type: 'string', text: 'bar_id' },
        { type: 'string', text: 'metric_type' },
        { type: 'string', text: 'metric_category' },
        { type: 'string', text: 'user_id' },
        { type: 'string', text: 'session_id' }
      ];

      res.json(tagKeys);
    } catch (error) {
      logger.error('Error getting tag keys for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  }

  /**
   * Endpoint para Grafana: Tag values
   */
  async getTagValues(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;

      // Valores de ejemplo para tags
      const tagValues: { [key: string]: string[] } = {
        bar_id: ['bar_001', 'bar_002', 'bar_003'],
        metric_type: ['music', 'menu', 'user', 'payment', 'system'],
        metric_category: ['music_consumption', 'menu_performance', 'user_engagement', 'financial'],
        user_id: [], // Se poblaría dinámicamente
        session_id: [] // Se poblaría dinámicamente
      };

      const values = tagValues[key] || [];
      const result = values.map(value => ({ text: value }));

      res.json(result);
    } catch (error) {
      logger.error('Error getting tag values for Grafana', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key: req.params.key
      });
      next(error);
    }
  }
}

export default GrafanaController;