import axios from 'axios';

const POINTS_SERVICE_URL = 'http://localhost:3007';

export interface PointsBalance {
  points_balance: number;
  lifetime_points: number;
}

export interface PointsTransaction {
  id: string;
  amount: number;
  type: 'earned' | 'spent' | 'purchased' | 'refunded' | 'bonus';
  description: string;
  created_at: string;
}

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  currency: string;
  description?: string;
  is_featured: boolean;
}

class PointsService {
  /**
   * 💰 Get user points balance
   */
  async getUserBalance(barId: string, token: string): Promise<PointsBalance> {
    try {
      const response = await axios.get(`${POINTS_SERVICE_URL}/api/points/bars/${barId}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching points balance:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📜 Get transaction history
   */
  async getTransactions(barId: string, token: string): Promise<PointsTransaction[]> {
    try {
      const response = await axios.get(`${POINTS_SERVICE_URL}/api/points/bars/${barId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📦 Get available points packages
   */
  async getPackages(): Promise<PointsPackage[]> {
    try {
      const response = await axios.get(`${POINTS_SERVICE_URL}/api/payments/packages`, {
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 💳 Create payment intent for points purchase
   */
  async createPaymentIntent(packageId: string, barId: string, token: string): Promise<{ clientSecret: string, paymentIntentId: string }> {
    try {
      const response = await axios.post(`${POINTS_SERVICE_URL}/api/payments/intent`, 
        { package_id: packageId, bar_id: barId },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response) {
      return new Error(error.response.data?.message || 'Server error');
    }
    return new Error('Network error');
  }
}

export const pointsService = new PointsService();
