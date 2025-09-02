import { BaseEntity, ReportType, ReportFormat, ReportStatus, TimeInterval } from './common';
import { AnalyticsFilter } from './analytics';

// Report Types
export interface BaseReport extends BaseEntity {
  name: string;
  description?: string;
  reportType: ReportType;
  barId: string;
  userId: string;
  status: ReportStatus;
  format: ReportFormat;
  scheduledAt?: Date;
  generatedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  fileUrl?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  parameters: Record<string, any>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: ReportType;
  category: 'financial' | 'operational' | 'marketing' | 'music' | 'customer';
  parameters: ReportParameter[];
  defaultFilters: AnalyticsFilter;
  outputFormats: ReportFormat[];
  schedulable: boolean;
  estimatedGenerationTime: number; // minutes
  dataRetention: number; // days
  accessLevel: 'owner' | 'manager' | 'staff' | 'public';
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// Specific Report Types
export interface SalesReport extends BaseReport {
  reportType: 'sales';
  data: {
    summary: {
      totalRevenue: number;
      totalOrders: number;
      averageOrderValue: number;
      topSellingItems: {
        menuItemId: string;
        name: string;
        quantity: number;
        revenue: number;
      }[];
      revenueByHour: {
        hour: number;
        revenue: number;
        orderCount: number;
      }[];
      revenueByDay: {
        date: string;
        revenue: number;
        orderCount: number;
      }[];
    };
    details: {
      orderId: string;
      timestamp: Date;
      userId?: string;
      items: {
        name: string;
        quantity: number;
        price: number;
        total: number;
      }[];
      subtotal: number;
      tax: number;
      tip: number;
      total: number;
      paymentMethod: string;
    }[];
  };
}

export interface MusicReport extends BaseReport {
  reportType: 'music';
  data: {
    summary: {
      totalSongsPlayed: number;
      totalRequests: number;
      totalLikes: number;
      totalSkips: number;
      averageSongDuration: number;
      engagementRate: number;
      topSongs: {
        songId: string;
        title: string;
        artist: string;
        playCount: number;
        requestCount: number;
        likeCount: number;
        skipCount: number;
      }[];
      topArtists: {
        artist: string;
        playCount: number;
        songCount: number;
        likeCount: number;
      }[];
      topGenres: {
        genre: string;
        playCount: number;
        songCount: number;
        percentage: number;
      }[];
    };
    timeline: {
      timestamp: Date;
      songId: string;
      title: string;
      artist: string;
      duration: number;
      playedDuration?: number;
      source: 'queue' | 'auto' | 'dj';
      likes: number;
      skips: number;
    }[];
  };
}

export interface CustomerReport extends BaseReport {
  reportType: 'customer';
  data: {
    summary: {
      totalCustomers: number;
      newCustomers: number;
      returningCustomers: number;
      averageSessionDuration: number;
      customerRetentionRate: number;
      averageSpendPerCustomer: number;
      topCustomers: {
        userId: string;
        name?: string;
        visitCount: number;
        totalSpent: number;
        lastVisit: Date;
      }[];
    };
    demographics: {
      ageGroups: {
        range: string;
        count: number;
        percentage: number;
      }[];
      genderDistribution: {
        gender: string;
        count: number;
        percentage: number;
      }[];
      locationDistribution: {
        location: string;
        count: number;
        percentage: number;
      }[];
    };
    behavior: {
      peakHours: {
        hour: number;
        customerCount: number;
      }[];
      averageOrdersPerVisit: number;
      preferredPaymentMethods: {
        method: string;
        count: number;
        percentage: number;
      }[];
      musicPreferences: {
        genre: string;
        requestCount: number;
        likeCount: number;
      }[];
    };
  };
}

export interface OperationalReport extends BaseReport {
  reportType: 'operational';
  data: {
    summary: {
      totalOrders: number;
      averagePreparationTime: number;
      averageDeliveryTime: number;
      orderAccuracy: number;
      customerSatisfaction: number;
      staffEfficiency: number;
    };
    performance: {
      ordersByHour: {
        hour: number;
        orderCount: number;
        avgPreparationTime: number;
      }[];
      kitchenPerformance: {
        category: string;
        avgPreparationTime: number;
        orderCount: number;
        accuracy: number;
      }[];
      staffPerformance: {
        staffId: string;
        name?: string;
        ordersHandled: number;
        avgServiceTime: number;
        customerRating: number;
      }[];
    };
    issues: {
      timestamp: Date;
      type: 'delay' | 'error' | 'complaint' | 'cancellation';
      description: string;
      orderId?: string;
      resolution?: string;
      resolutionTime?: number;
    }[];
  };
}

export interface FinancialReport extends BaseReport {
  reportType: 'financial';
  data: {
    summary: {
      totalRevenue: number;
      totalCosts: number;
      grossProfit: number;
      netProfit: number;
      profitMargin: number;
      averageTransactionValue: number;
      totalTransactions: number;
    };
    breakdown: {
      revenueByCategory: {
        category: string;
        revenue: number;
        percentage: number;
        growth: number;
      }[];
      costBreakdown: {
        category: string;
        amount: number;
        percentage: number;
      }[];
      paymentMethods: {
        method: string;
        amount: number;
        transactionCount: number;
        fees: number;
      }[];
    };
    trends: {
      daily: {
        date: string;
        revenue: number;
        costs: number;
        profit: number;
        transactions: number;
      }[];
      monthly: {
        month: string;
        revenue: number;
        costs: number;
        profit: number;
        growth: number;
      }[];
    };
  };
}

// Report Scheduling
export interface ReportSchedule {
  id: string;
  reportTemplateId: string;
  name: string;
  barId: string;
  userId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // e.g., every 2 weeks
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
  parameters: Record<string, any>;
  format: ReportFormat;
  recipients: {
    userId: string;
    email: string;
    deliveryMethod: 'email' | 'dashboard' | 'both';
  }[];
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportDelivery {
  id: string;
  reportId: string;
  scheduleId?: string;
  recipient: {
    userId: string;
    email: string;
    deliveryMethod: 'email' | 'dashboard' | 'download';
  };
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

// Report Analytics
export interface ReportUsageAnalytics {
  reportTemplateId: string;
  reportType: ReportType;
  generationCount: number;
  averageGenerationTime: number;
  totalDataSize: number;
  popularParameters: {
    parameter: string;
    value: any;
    usage: number;
  }[];
  formatDistribution: {
    format: ReportFormat;
    count: number;
    percentage: number;
  }[];
  userEngagement: {
    userId: string;
    generationCount: number;
    lastGenerated: Date;
  }[];
  performanceMetrics: {
    date: string;
    generationCount: number;
    averageTime: number;
    errorRate: number;
  }[];
}

// Report Export
export interface ReportExportRequest {
  reportId: string;
  format: ReportFormat;
  options: {
    includeCharts?: boolean;
    includeRawData?: boolean;
    compression?: 'none' | 'zip' | 'gzip';
    password?: string;
    watermark?: string;
  };
  requestedBy: string;
  requestedAt: Date;
}

export interface ReportExportResult {
  exportId: string;
  reportId: string;
  format: ReportFormat;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  createdAt: Date;
}

// Report Comparison
export interface ReportComparison {
  id: string;
  name: string;
  reportIds: string[];
  comparisonType: 'period' | 'segment' | 'metric';
  metrics: string[];
  result: {
    summary: {
      metric: string;
      values: {
        reportId: string;
        value: number;
        change?: number;
        changePercentage?: number;
      }[];
    }[];
    charts: {
      type: 'line' | 'bar' | 'pie' | 'area';
      title: string;
      data: any[];
    }[];
  };
  createdAt: Date;
  createdBy: string;
}

// Report Alerts
export interface ReportAlert {
  id: string;
  name: string;
  reportTemplateId: string;
  barId: string;
  metric: string;
  condition: {
    operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
    value: number;
    threshold?: number;
  };
  frequency: 'realtime' | 'hourly' | 'daily';
  recipients: string[];
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export interface ReportAlertTrigger {
  id: string;
  alertId: string;
  reportId: string;
  metric: string;
  actualValue: number;
  thresholdValue: number;
  condition: string;
  triggeredAt: Date;
  notificationsSent: {
    userId: string;
    method: 'email' | 'push' | 'sms';
    status: 'sent' | 'delivered' | 'failed';
    sentAt: Date;
  }[];
}

// Union type for all report types
export type Report = SalesReport | MusicReport | CustomerReport | OperationalReport | FinancialReport;

// Report generation queue
export interface ReportGenerationJob {
  id: string;
  reportId: string;
  reportType: ReportType;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  parameters: Record<string, any>;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  estimatedCompletion?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}