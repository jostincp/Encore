/**
 * Models index file
 * Exports all models for easy importing
 */

// Event model
export { Event } from './Event';
export type { IEvent } from './Event';

// Analytics model
export { Analytics } from './Analytics';
export type {
  IAnalytics,
  IAnalyticsDocument,
  IAnalyticsModel
} from './Analytics';

// Report model
export { Report } from './Report';
export type { IReport } from './Report';

// Re-export default exports
export { default as EventModel } from './Event';
export { default as AnalyticsModel } from './Analytics';
export { default as ReportModel } from './Report';