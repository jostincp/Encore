import { query, dbOperations } from '../../../shared/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface RefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

export class RefreshTokenModel {
  /**
   * Create a new refresh token
   */
  static async create(userId: string, expiresAt: Date): Promise<{ id: string; token: string }> {
    // Generate a secure random token
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenId = uuidv4();

    await dbOperations.create('refresh_tokens', {
      id: tokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      is_revoked: false
    });

    return {
      id: tokenId,
      token
    };
  }

  /**
   * Find refresh token by token string
   */
  static async findByToken(token: string): Promise<RefreshTokenData | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const result = await query<any>(
      `SELECT id, user_id, token_hash, expires_at, is_revoked, created_at 
       FROM refresh_tokens 
       WHERE token_hash = $1 AND is_revoked = false AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      isRevoked: row.is_revoked,
      createdAt: row.created_at
    };
  }

  /**
   * Find refresh token by ID
   */
  static async findById(id: string): Promise<RefreshTokenData | null> {
    const result = await query<any>(
      `SELECT id, user_id, token_hash, expires_at, is_revoked, created_at 
       FROM refresh_tokens 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      isRevoked: row.is_revoked,
      createdAt: row.created_at
    };
  }

  /**
   * Revoke refresh token
   */
  static async revoke(tokenId: string): Promise<boolean> {
    const result = await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE id = $1',
      [tokenId]
    );
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllForUser(userId: string): Promise<number> {
    const result = await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );
    
    return result.rowCount || 0;
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpired(): Promise<number> {
    const result = await query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true'
    );
    
    return result.rowCount || 0;
  }

  /**
   * Get all active tokens for a user
   */
  static async findActiveByUserId(userId: string): Promise<RefreshTokenData[]> {
    const result = await query<any>(
      `SELECT id, user_id, token_hash, expires_at, is_revoked, created_at 
       FROM refresh_tokens 
       WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      isRevoked: row.is_revoked,
      createdAt: row.created_at
    }));
  }

  /**
   * Count active tokens for a user
   */
  static async countActiveForUser(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM refresh_tokens 
       WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()`,
      [userId]
    );
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Validate token and check if it's still valid
   */
  static async validateToken(token: string): Promise<{ isValid: boolean; userId?: string; tokenId?: string }> {
    const tokenData = await this.findByToken(token);
    
    if (!tokenData) {
      return { isValid: false };
    }

    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      return { isValid: false };
    }

    // Check if token is revoked
    if (tokenData.isRevoked) {
      return { isValid: false };
    }

    return {
      isValid: true,
      userId: tokenData.userId,
      tokenId: tokenData.id
    };
  }

  /**
   * Rotate refresh token (revoke old and create new)
   */
  static async rotate(oldToken: string, userId: string, expiresAt: Date): Promise<{ id: string; token: string } | null> {
    const tokenData = await this.findByToken(oldToken);
    
    if (!tokenData || tokenData.userId !== userId) {
      return null;
    }

    // Revoke old token
    await this.revoke(tokenData.id);

    // Create new token
    return await this.create(userId, expiresAt);
  }

  /**
   * Delete refresh token (hard delete)
   */
  static async delete(id: string): Promise<boolean> {
    return await dbOperations.deleteById('refresh_tokens', id);
  }
}