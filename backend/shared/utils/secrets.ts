import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import logger from './logger';

interface SecretConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

class SecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();

  constructor(config: SecretConfig) {
    this.client = new SecretsManagerClient({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      } : undefined,
    });
  }

  /**
   * Obtiene un secreto de AWS Secrets Manager con caché
   */
  async getSecret<T = any>(secretName: string, cacheTtl: number = 300000): Promise<T> {
    // Verificar caché
    const cached = this.cache.get(secretName);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} no contiene SecretString`);
      }

      const secretValue = JSON.parse(response.SecretString);

      // Cachear el secreto
      this.cache.set(secretName, {
        value: secretValue,
        expiresAt: Date.now() + cacheTtl,
      });

      logger.info(`Secreto ${secretName} obtenido exitosamente`, { service: 'secrets-manager' });
      return secretValue;
    } catch (error) {
      logger.error(`Error obteniendo secreto ${secretName}`, {
        service: 'secrets-manager',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Actualiza un secreto en AWS Secrets Manager
   */
  async updateSecret(secretName: string, secretValue: any): Promise<void> {
    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue),
      });

      await this.client.send(command);

      // Limpiar caché
      this.cache.delete(secretName);

      logger.info(`Secreto ${secretName} actualizado exitosamente`, { service: 'secrets-manager' });
    } catch (error) {
      logger.error(`Error actualizando secreto ${secretName}`, {
        service: 'secrets-manager',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Obtiene múltiples secretos en paralelo
   */
  async getSecrets(secretNames: string[], cacheTtl: number = 300000): Promise<Record<string, any>> {
    const promises = secretNames.map(name => this.getSecret(name, cacheTtl));
    const results = await Promise.all(promises);

    return secretNames.reduce((acc, name, index) => {
      acc[name] = results[index];
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Limpia el caché de un secreto específico
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.cache.delete(secretName);
    } else {
      this.cache.clear();
    }
  }
}

// Configuración por defecto
const defaultConfig: SecretConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

// Instancia singleton
let secretsManagerInstance: SecretsManager | null = null;

export function getSecretsManager(config: SecretConfig = defaultConfig): SecretsManager {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager(config);
  }
  return secretsManagerInstance;
}

export { SecretsManager };
export type { SecretConfig };