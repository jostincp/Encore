/**
 * Services module exports
 * Centralized export point for all service classes
 */

export { EventService } from './eventService';
export { AnalyticsService } from './analyticsService';
export { ReportService } from './reportService';

// Re-export types and interfaces
export type {
  ProcessingResult,
  ValidationResult,
  EventFilters,
  EventQueryOptions,
  EventResult,
  EventData
} from './eventService';

export type {
  DashboardData,
  AnalyticsQueryOptions,
  AnalyticsResult,
  MetricData
} from './analyticsService';

export type {
  GenerationResult,
  ReportFilters,
  ReportQueryOptions,
  ReportResult,
  ReportData
} from './reportService';