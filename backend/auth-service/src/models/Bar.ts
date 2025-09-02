import { query, dbOperations, transaction } from '../../../shared/database';
import { Bar, BarSettings } from '../../../shared/types';
import { validateBarCreation } from '../../../shared/utils/validation';
import { v4 as uuidv4 } from 'uuid';

export interface CreateBarData {
  name: string;
  description?: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  ownerId: string;
  timezone?: string;
}

export interface UpdateBarData {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface UpdateBarSettingsData {
  maxSongsPerUser?: number;
  songRequestCost?: number;
  priorityPlayCost?: number;
  autoApproveSongs?: boolean;
  allowExplicitContent?: boolean;
  maxQueueSize?: number;
  pointsPerEuro?: number;
  welcomeMessage?: string;
}

export class BarModel {
  /**
   * Create a new bar with default settings
   */
  static async create(barData: CreateBarData): Promise<Bar> {
    // Validate bar data
    const validation = validateBarCreation({
      name: barData.name,
      address: barData.address,
      city: barData.city,
      country: barData.country,
      ownerId: barData.ownerId
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if owner exists and is a bar_admin
    const owner = await query(
      'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
      [barData.ownerId]
    );

    if (owner.rows.length === 0) {
      throw new Error('Owner not found or inactive');
    }

    if (owner.rows[0].role !== 'bar_admin' && owner.rows[0].role !== 'super_admin') {
      throw new Error('Owner must have bar_admin or super_admin role');
    }

    return await transaction(async (client) => {
      // Create bar
      const barId = uuidv4();
      const barResult = await client.query<Bar>(
        `INSERT INTO bars (id, name, description, address, city, country, phone, email, website_url, logo_url, cover_image_url, owner_id, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          barId,
          barData.name,
          barData.description || null,
          barData.address,
          barData.city,
          barData.country,
          barData.phone || null,
          barData.email || null,
          barData.websiteUrl || null,
          barData.logoUrl || null,
          barData.coverImageUrl || null,
          barData.ownerId,
          barData.timezone || 'UTC'
        ]
      );

      // Create default bar settings
      await client.query(
        `INSERT INTO bar_settings (bar_id) VALUES ($1)`,
        [barId]
      );

      return barResult.rows[0];
    });
  }

  /**
   * Find bar by ID
   */
  static async findById(id: string): Promise<Bar | null> {
    return await dbOperations.findById<Bar>('bars', id);
  }

  /**
   * Find bar by ID with settings
   */
  static async findByIdWithSettings(id: string): Promise<(Bar & { settings: BarSettings }) | null> {
    const result = await query<Bar & BarSettings>(
      `SELECT b.*, 
              bs.max_songs_per_user, bs.song_request_cost, bs.priority_play_cost,
              bs.auto_approve_songs, bs.allow_explicit_content, bs.max_queue_size,
              bs.points_per_euro, bs.welcome_message
       FROM bars b
       LEFT JOIN bar_settings bs ON b.id = bs.bar_id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const {
      max_songs_per_user,
      song_request_cost,
      priority_play_cost,
      auto_approve_songs,
      allow_explicit_content,
      max_queue_size,
      points_per_euro,
      welcome_message,
      ...bar
    } = row;

    return {
      ...bar,
      settings: {
        maxSongsPerUser: max_songs_per_user,
        songRequestCost: song_request_cost,
        priorityPlayCost: priority_play_cost,
        autoApproveSongs: auto_approve_songs,
        allowExplicitContent: allow_explicit_content,
        maxQueueSize: max_queue_size,
        pointsPerEuro: points_per_euro,
        welcomeMessage: welcome_message
      }
    } as Bar & { settings: BarSettings };
  }

  /**
   * Find bars by owner ID
   */
  static async findByOwnerId(ownerId: string): Promise<Bar[]> {
    return await dbOperations.findByField<Bar>('bars', 'owner_id', ownerId);
  }

  /**
   * Update bar
   */
  static async update(id: string, barData: UpdateBarData): Promise<Bar | null> {
    const updateData: Record<string, any> = {};
    
    if (barData.name) updateData.name = barData.name;
    if (barData.description !== undefined) updateData.description = barData.description;
    if (barData.address) updateData.address = barData.address;
    if (barData.city) updateData.city = barData.city;
    if (barData.country) updateData.country = barData.country;
    if (barData.phone !== undefined) updateData.phone = barData.phone;
    if (barData.email !== undefined) updateData.email = barData.email;
    if (barData.websiteUrl !== undefined) updateData.website_url = barData.websiteUrl;
    if (barData.logoUrl !== undefined) updateData.logo_url = barData.logoUrl;
    if (barData.coverImageUrl !== undefined) updateData.cover_image_url = barData.coverImageUrl;
    if (barData.timezone) updateData.timezone = barData.timezone;
    if (barData.isActive !== undefined) updateData.is_active = barData.isActive;

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    return await dbOperations.update<Bar>('bars', id, updateData);
  }

  /**
   * Update bar settings
   */
  static async updateSettings(barId: string, settingsData: UpdateBarSettingsData): Promise<BarSettings | null> {
    const updateData: Record<string, any> = {};
    
    if (settingsData.maxSongsPerUser !== undefined) updateData.max_songs_per_user = settingsData.maxSongsPerUser;
    if (settingsData.songRequestCost !== undefined) updateData.song_request_cost = settingsData.songRequestCost;
    if (settingsData.priorityPlayCost !== undefined) updateData.priority_play_cost = settingsData.priorityPlayCost;
    if (settingsData.autoApproveSongs !== undefined) updateData.auto_approve_songs = settingsData.autoApproveSongs;
    if (settingsData.allowExplicitContent !== undefined) updateData.allow_explicit_content = settingsData.allowExplicitContent;
    if (settingsData.maxQueueSize !== undefined) updateData.max_queue_size = settingsData.maxQueueSize;
    if (settingsData.pointsPerEuro !== undefined) updateData.points_per_euro = settingsData.pointsPerEuro;
    if (settingsData.welcomeMessage !== undefined) updateData.welcome_message = settingsData.welcomeMessage;

    if (Object.keys(updateData).length === 0) {
      return this.getSettings(barId);
    }

    const result = await query<BarSettings>(
      `UPDATE bar_settings SET ${Object.keys(updateData).map((key, index) => `${key} = $${index + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE bar_id = $${Object.keys(updateData).length + 1}
       RETURNING *`,
      [...Object.values(updateData), barId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      maxSongsPerUser: row.max_songs_per_user,
      songRequestCost: row.song_request_cost,
      priorityPlayCost: row.priority_play_cost,
      autoApproveSongs: row.auto_approve_songs,
      allowExplicitContent: row.allow_explicit_content,
      maxQueueSize: row.max_queue_size,
      pointsPerEuro: row.points_per_euro,
      welcomeMessage: row.welcome_message
    };
  }

  /**
   * Get bar settings
   */
  static async getSettings(barId: string): Promise<BarSettings | null> {
    const result = await query<any>(
      'SELECT * FROM bar_settings WHERE bar_id = $1',
      [barId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      maxSongsPerUser: row.max_songs_per_user,
      songRequestCost: row.song_request_cost,
      priorityPlayCost: row.priority_play_cost,
      autoApproveSongs: row.auto_approve_songs,
      allowExplicitContent: row.allow_explicit_content,
      maxQueueSize: row.max_queue_size,
      pointsPerEuro: row.points_per_euro,
      welcomeMessage: row.welcome_message
    };
  }

  /**
   * Get bars with pagination and filters
   */
  static async findMany(options: {
    limit?: number;
    offset?: number;
    ownerId?: string;
    isActive?: boolean;
    search?: string;
    city?: string;
    country?: string;
  } = {}): Promise<{ bars: Bar[]; total: number }> {
    const { limit = 50, offset = 0, ownerId, isActive, search, city, country } = options;
    
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (ownerId) {
      whereConditions.push(`owner_id = $${paramIndex}`);
      params.push(ownerId);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR address ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (city) {
      whereConditions.push(`city ILIKE $${paramIndex}`);
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (country) {
      whereConditions.push(`country ILIKE $${paramIndex}`);
      params.push(`%${country}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM bars ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const barsResult = await query<Bar>(
      `SELECT * FROM bars ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      bars: barsResult.rows,
      total
    };
  }

  /**
   * Deactivate bar
   */
  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE bars SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Delete bar (hard delete)
   */
  static async delete(id: string): Promise<boolean> {
    return await dbOperations.deleteById('bars', id);
  }

  /**
   * Check if user owns bar
   */
  static async isOwner(barId: string, userId: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM bars WHERE id = $1 AND owner_id = $2',
      [barId, userId]
    );
    
    return result.rows.length > 0;
  }
}