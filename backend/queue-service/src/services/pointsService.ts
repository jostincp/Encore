import axios from 'axios';
import logger from '../../../shared/utils/logger';

export interface PointsDeductRequest {
  userId: string;
  barId: string;
  amount: number;
  reason: 'song_request' | 'priority_song' | 'skip_request';
  metadata?: {
    songId?: string;
    videoId?: string;
    title?: string;
  };
}

export interface PointsDeductResponse {
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
  insufficientFunds?: boolean;
}

export interface PointsRefundRequest {
  userId: string;
  barId: string;
  amount: number;
  reason: 'queue_duplicate' | 'queue_error' | 'system_error';
  originalTransactionId?: string;
  metadata?: {
    songId?: string;
    videoId?: string;
    errorReason?: string;
  };
}

export interface PointsRefundResponse {
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}

export interface PointsBalanceResponse {
  success: boolean;
  balance?: number;
  error?: string;
}

class PointsServiceClient {
  private client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly timeout: number = 5000; // 5 segundos timeout

  constructor() {
    this.baseUrl = process.env.POINTS_SERVICE_URL || 'http://localhost:3006';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'queue-service/1.0.0'
      }
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Points Service Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Points Service Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.info(`Points Service Response: ${response.status} ${response.config.url}`, {
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Points Service Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Verificar salud del Points Service
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      const response = await this.client.get('/health');
      const latency = Date.now() - start;

      return {
        healthy: response.status === 200,
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deducir puntos de usuario (LLAMADA SÍNCRONA CRÍTICA)
   * Esta función DEBE ser llamada ANTES de cualquier operación en Redis
   */
  async deductPoints(request: PointsDeductRequest): Promise<PointsDeductResponse> {
    try {
      logger.info('🔥 CRITICAL: Deducting points BEFORE Redis operation', {
        userId: request.userId,
        barId: request.barId,
        amount: request.amount,
        reason: request.reason
      });

      const response = await this.client.post('/api/points/deduct', request);

      if (response.data.success) {
        logger.info('✅ Points deducted successfully', {
          userId: request.userId,
          amount: request.amount,
          newBalance: response.data.newBalance,
          transactionId: response.data.transactionId
        });
      } else {
        logger.error('❌ Points deduction failed', {
          userId: request.userId,
          error: response.data.error
        });
      }

      return response.data;
    } catch (error) {
      logger.error('💥 CRITICAL ERROR: Points deduction failed', {
        userId: request.userId,
        amount: request.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Si falla la comunicación con Points Service, devolver error
      return {
        success: false,
        error: 'Points service unavailable'
      };
    }
  }

  /**
   * Reembolsar puntos (rollback)
   */
  async refundPoints(request: PointsRefundRequest): Promise<PointsRefundResponse> {
    try {
      logger.info('🔄 Refunding points (rollback)', {
        userId: request.userId,
        barId: request.barId,
        amount: request.amount,
        reason: request.reason,
        originalTransactionId: request.originalTransactionId
      });

      const response = await this.client.post('/api/points/refund', request);

      if (response.data.success) {
        logger.info('✅ Points refunded successfully', {
          userId: request.userId,
          amount: request.amount,
          newBalance: response.data.newBalance,
          transactionId: response.data.transactionId
        });
      } else {
        logger.error('❌ Points refund failed', {
          userId: request.userId,
          error: response.data.error
        });
      }

      return response.data;
    } catch (error) {
      logger.error('💥 Points refund failed', {
        userId: request.userId,
        amount: request.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Points service unavailable'
      };
    }
  }

  /**
   * Obtener balance de puntos de usuario
   */
  async getBalance(userId: string, barId: string): Promise<PointsBalanceResponse> {
    try {
      const response = await this.client.get(`/api/points/balance/${userId}/${barId}`);
      return response.data;
    } catch (error) {
      logger.error('Error getting points balance:', {
        userId,
        barId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Points service unavailable'
      };
    }
  }

  /**
   * Validar si usuario tiene suficientes puntos
   */
  async hasSufficientPoints(userId: string, barId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balanceResponse = await this.getBalance(userId, barId);

      if (!balanceResponse.success || balanceResponse.balance === undefined) {
        return false;
      }

      return balanceResponse.balance >= requiredAmount;
    } catch (error) {
      logger.error('Error validating points:', {
        userId,
        barId,
        requiredAmount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  /**
   * Obtener configuración de costos
   */
  async getCosts(barId: string): Promise<{
    standardSong: number;
    prioritySong: number;
    skipRequest: number;
  }> {
    try {
      const response = await this.client.get(`/api/points/costs/${barId}`);

      return response.data.costs || {
        standardSong: 10,
        prioritySong: 25,
        skipRequest: 5
      };
    } catch (error) {
      logger.error('Error getting points costs:', {
        barId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Valores por defecto
      return {
        standardSong: 10,
        prioritySong: 25,
        skipRequest: 5
      };
    }
  }

  /**
   * Crear transacción de puntos para auditoría
   */
  async createTransaction(transaction: {
    userId: string;
    barId: string;
    type: 'deduct' | 'refund';
    amount: number;
    reason: string;
    metadata?: any;
  }): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await this.client.post('/api/points/transaction', transaction);
      return response.data;
    } catch (error) {
      logger.error('Error creating points transaction:', {
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Points service unavailable'
      };
    }
  }

  /**
   * Obtener historial de transacciones de usuario
   */
  async getTransactionHistory(userId: string, barId: string, limit: number = 50): Promise<{
    success: boolean;
    transactions?: any[];
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/points/history/${userId}/${barId}?limit=${limit}`);
      return response.data;
    } catch (error) {
      logger.error('Error getting transaction history:', {
        userId,
        barId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Points service unavailable'
      };
    }
  }
}

// Singleton
const pointsServiceClient = new PointsServiceClient();
export default pointsServiceClient;
