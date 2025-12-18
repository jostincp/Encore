import axios from 'axios';

const ANALYTICS_SERVICE_URL = 'http://localhost:3005';

export interface DashboardMetrics {
  activeUsers: number;
  songsInQueue: number;
  totalPointsSpent: number;
  revenue: number;
}

export interface SongTrend {
  songId: string;
  title: string;
  artist: string;
  playCount: number;
  upvotes: number;
}

class AnalyticsService {
  /**
   * 📊 Get real-time dashboard metrics
   */
  async getDashboardMetrics(barId: string, token: string, period: string = 'today'): Promise<DashboardMetrics> {
    try {
      const response = await axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/dashboard/overview`, {
        params: { bar_id: barId, period },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🎵 Get trending songs
   */
  async getTrendingSongs(barId: string, token: string): Promise<SongTrend[]> {
    try {
      const response = await axios.get(`${ANALYTICS_SERVICE_URL}/api/analytics/trending/metrics`, {
        params: { bar_id: barId, type: 'songs' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching trending songs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📝 Track custom event
   */
  async trackEvent(eventType: string, data: any, token?: string): Promise<void> {
    try {
      await axios.post(`${ANALYTICS_SERVICE_URL}/api/events`, 
        { type: eventType, data },
        { 
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 3000 
        }
      );
    } catch (error) {
      // Analytics errors should be non-blocking
      console.warn('Error tracking event:', error);
    }
  }

  private handleError(error: any): Error {
    if (error.response) {
      return new Error(error.response.data?.message || 'Server error');
    }
    return new Error('Network error');
  }
}

export const analyticsService = new AnalyticsService();
