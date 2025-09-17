/**
 * HashiCorp Vault Service - Self-hosted OSS Secret Management
 * PCI DSS compliant secret management with automatic rotation
 */

import Vault from 'node-vault';
import crypto from 'crypto';
import logger from '../../../shared/utils/logger';
import { getPool } from '../../../shared/database';

interface VaultConfig {
  endpoint: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  ssl?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  };
}

interface SecretData {
  [key: string]: any;
}

interface SecretMetadata {
  created_time: string;
  deletion_time: string;
  destroyed: boolean;
  version: number;
}

class VaultService {
  private vault: Vault.client;
  private config: VaultConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      endpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      namespace: process.env.VAULT_NAMESPACE || 'encore',
      ssl: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };

    this.initializeVault();
  }

  /**
   * Initialize Vault client with authentication
   */
  private async initializeVault(): Promise<void> {
    try {
      // Initialize Vault client
      this.vault = Vault({
        endpoint: this.config.endpoint,
        token: this.config.token,
        namespace: this.config.namespace
      });

      // Authenticate if using AppRole
      if (this.config.roleId && this.config.secretId) {
        await this.authenticateWithAppRole();
      }

      // Verify connection
      await this.healthCheck();

      logger.info('Vault service initialized successfully', {
        service: 'vault-service',
        endpoint: this.config.endpoint,
        namespace: this.config.namespace
      });
    } catch (error) {
      logger.error('Failed to initialize Vault service', {
        service: 'vault-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Authenticate using AppRole method
   */
  private async authenticateWithAppRole(): Promise<void> {
    try {
      const authResponse = await this.vault.approleLogin({
        role_id: this.config.roleId!,
        secret_id: this.config.secretId!
      });

      this.token = authResponse.auth.client_token;
      this.tokenExpiry = new Date(Date.now() + (authResponse.auth.lease_duration * 1000));

      // Update client with new token
      this.vault = Vault({
        endpoint: this.config.endpoint,
        token: this.token,
        namespace: this.config.namespace
      });

      logger.info('Vault AppRole authentication successful', {
        service: 'vault-service',
        lease_duration: authResponse.auth.lease_duration
      });
    } catch (error) {
      logger.error('Vault AppRole authentication failed', {
        service: 'vault-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Health check for Vault connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.vault.health();
      return health.initialized && !health.sealed;
    } catch (error) {
      logger.error('Vault health check failed', {
        service: 'vault-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Read secret from Vault
   */
  async getSecret(path: string, version?: number): Promise<SecretData> {
    try {
      const options: any = {};
      if (version) {
        options.version = version;
      }

      const result = await this.vault.read(`secret/data/${path}`, options);

      if (!result || !result.data || !result.data.data) {
        throw new Error(`Secret not found at path: ${path}`);
      }

      logger.info('Secret retrieved successfully', {
        service: 'vault-service',
        path,
        version: result.data.metadata?.version
      });

      return result.data.data;
    } catch (error) {
      logger.error('Failed to retrieve secret', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Write secret to Vault
   */
  async setSecret(path: string, data: SecretData, options: { cas?: number } = {}): Promise<void> {
    try {
      const payload = {
        data,
        options: {
          cas: options.cas || 0
        }
      };

      await this.vault.write(`secret/data/${path}`, payload);

      logger.info('Secret stored successfully', {
        service: 'vault-service',
        path,
        keys: Object.keys(data)
      });
    } catch (error) {
      logger.error('Failed to store secret', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update existing secret
   */
  async updateSecret(path: string, data: SecretData): Promise<void> {
    try {
      // Read current version for CAS
      const current = await this.vault.read(`secret/data/${path}`);
      const cas = current.data.metadata.version;

      await this.setSecret(path, data, { cas });
    } catch (error) {
      logger.error('Failed to update secret', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete secret from Vault
   */
  async deleteSecret(path: string, versions?: number[]): Promise<void> {
    try {
      const options: any = {};
      if (versions) {
        options.versions = versions;
      }

      await this.vault.delete(`secret/data/${path}`, options);

      logger.info('Secret deleted successfully', {
        service: 'vault-service',
        path,
        versions
      });
    } catch (error) {
      logger.error('Failed to delete secret', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List secrets at path
   */
  async listSecrets(path: string): Promise<string[]> {
    try {
      const result = await this.vault.list(`secret/metadata/${path}`);
      return result.data.keys || [];
    } catch (error) {
      logger.error('Failed to list secrets', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get secret metadata
   */
  async getSecretMetadata(path: string): Promise<SecretMetadata> {
    try {
      const result = await this.vault.read(`secret/metadata/${path}`);
      return result.data;
    } catch (error) {
      logger.error('Failed to get secret metadata', {
        service: 'vault-service',
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Enable secret engine
   */
  async enableSecretEngine(path: string, type: string = 'kv-v2'): Promise<void> {
    try {
      await this.vault.mount({
        mount_point: path,
        type,
        description: `Secret engine for ${path}`
      });

      logger.info('Secret engine enabled', {
        service: 'vault-service',
        path,
        type
      });
    } catch (error) {
      logger.error('Failed to enable secret engine', {
        service: 'vault-service',
        path,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create/update policy
   */
  async createPolicy(name: string, policy: string): Promise<void> {
    try {
      await this.vault.createPolicy({
        name,
        policy
      });

      logger.info('Policy created successfully', {
        service: 'vault-service',
        policyName: name
      });
    } catch (error) {
      logger.error('Failed to create policy', {
        service: 'vault-service',
        policyName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate new secret value (for rotation)
   */
  generateSecret(type: 'jwt' | 'stripe' | 'database' | 'api'): SecretData {
    switch (type) {
      case 'jwt':
        return {
          secret: crypto.randomBytes(64).toString('hex'),
          algorithm: 'HS256',
          expiresIn: '24h',
          refreshExpiresIn: '7d',
          rotatedAt: new Date().toISOString()
        };

      case 'stripe':
        return {
          webhookSecret: crypto.randomBytes(32).toString('hex'),
          rotatedAt: new Date().toISOString()
        };

      case 'database':
        const password = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
        return {
          password,
          rotatedAt: new Date().toISOString()
        };

      case 'api':
        return {
          key: crypto.randomBytes(32).toString('hex'),
          rotatedAt: new Date().toISOString()
        };

      default:
        return {
          value: crypto.randomBytes(32).toString('hex'),
          rotatedAt: new Date().toISOString()
        };
    }
  }

  /**
   * Rotate secret automatically
   */
  async rotateSecret(path: string, type: 'jwt' | 'stripe' | 'database' | 'api'): Promise<void> {
    try {
      const newSecret = this.generateSecret(type);
      await this.updateSecret(path, newSecret);

      logger.info('Secret rotated successfully', {
        service: 'vault-service',
        path,
        type,
        rotatedAt: newSecret.rotatedAt
      });
    } catch (error) {
      logger.error('Failed to rotate secret', {
        service: 'vault-service',
        path,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get Vault status
   */
  async getStatus(): Promise<any> {
    try {
      return await this.vault.status();
    } catch (error) {
      logger.error('Failed to get Vault status', {
        service: 'vault-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Renew token if close to expiry
   */
  async renewTokenIfNeeded(): Promise<void> {
    if (!this.tokenExpiry) return;

    const now = new Date();
    const timeUntilExpiry = this.tokenExpiry.getTime() - now.getTime();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

    if (timeUntilExpiry < oneHour) {
      try {
        await this.vault.tokenRenewSelf();
        this.tokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Extend 24 hours

        logger.info('Vault token renewed successfully', {
          service: 'vault-service'
        });
      } catch (error) {
        logger.error('Failed to renew Vault token', {
          service: 'vault-service',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  }
}

// Export singleton instance
export const vaultService = new VaultService();
export default vaultService;