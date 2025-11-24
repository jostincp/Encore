import { query, findById, update, deleteById } from '@shared/database';
import logger from '@shared/utils/logger';
import { ValidationError, NotFoundError } from '@shared/utils/errors';
import { validateRequired, validateUUID, validatePositiveInteger } from '@shared/utils/validation';

export interface QueueData {
  id: string;
  bar_id: string;
  song_id: string;
  user_id: string;
  position: number;
  status: 'pending' | 'playing' | 'played' | 'skipped' | 'rejected';
  priority_play: boolean;
  points_used: number;
  requested_at: Date;
  played_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Joined data
  song?: {
    id: string;
    title: string;
    artist: string;
    duration: number;
    youtube_id?: string;
    spotify_id?: string;
    thumbnail_url?: string;
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface CreateQueueData {
  bar_id: string;
  song_id: string;
  user_id: string;
  priority_play?: boolean;
  points_used?: number;
}

export interface UpdateQueueData {
  status?: 'pending' | 'playing' | 'played' | 'skipped' | 'rejected';
  position?: number;
  played_at?: Date;
}

export interface QueueFilters {
  bar_id?: string;
  user_id?: string;
  status?: string | string[];
  priority_play?: boolean;
  date_from?: Date;
  date_to?: Date;
}

export interface QueueStats {
  total_requests: number;
  pending_requests: number;
  played_requests: number;
  rejected_requests: number;
  priority_requests: number;
  total_points_used: number;
  average_wait_time: number; // in minutes
  most_requested_songs: Array<{
    song_id: string;
    title: string;
    artist: string;
    request_count: number;
  }>;
  top_requesters: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    request_count: number;
    points_used: number;
  }>;
}

export class QueueModel {
  static async create(data: CreateQueueData): Promise<QueueData> {
    try {
      // Validate required fields
      validateRequired(data.bar_id, 'bar_id');
      validateRequired(data.song_id, 'song_id');
      validateRequired(data.user_id, 'user_id');
      validateUUID(data.bar_id, 'bar_id');
      validateUUID(data.song_id, 'song_id');
      validateUUID(data.user_id, 'user_id');
      
      if (data.points_used !== undefined) {
        validatePositiveInteger(data.points_used, 'points_used');
      }
      
      // Get next position in queue for this bar
      const positionResult = await query(
        `SELECT COALESCE(MAX(position), 0) + 1 as next_position 
         FROM queue 
         WHERE bar_id = $1 AND status IN ('pending', 'playing')`,
        [data.bar_id]
      );
      
      const position = positionResult.rows[0].next_position;
      
      // If priority play, insert at the beginning of pending songs
      let finalPosition = position;
      if (data.priority_play) {
        // Get position after currently playing song
        const priorityPositionResult = await query(
          `SELECT COALESCE(MIN(position), 1) as priority_position 
           FROM queue 
           WHERE bar_id = $1 AND status = 'pending'`,
          [data.bar_id]
        );
        
        finalPosition = priorityPositionResult.rows[0].priority_position;
        
        // Shift other pending songs down
        await query(
          `UPDATE queue 
           SET position = position + 1, updated_at = CURRENT_TIMESTAMP 
           WHERE bar_id = $1 AND status = 'pending' AND position >= $2`,
          [data.bar_id, finalPosition]
        );
      }
      
      const result = await query(
        `INSERT INTO queue (
          bar_id, song_id, user_id, position, status, priority_play, points_used
        ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
        RETURNING *`,
        [
          data.bar_id,
          data.song_id,
          data.user_id,
          finalPosition,
          data.priority_play || false,
          data.points_used || 0
        ]
      );
      
      const queue = result.rows[0];
      
      logger.info('Queue entry created', {
        id: queue.id,
        bar_id: data.bar_id,
        song_id: data.song_id,
        user_id: data.user_id,
        position: finalPosition,
        priority_play: data.priority_play
      });
      
      return queue;
    } catch (error) {
      logger.error('Queue creation error:', error);
      throw error;
    }
  }
  
  static async findById(id: string, includeDetails: boolean = false): Promise<QueueData | null> {
    try {
      validateUUID(id, 'id');
      
      let queryStr = 'SELECT * FROM queue WHERE id = $1';
      let params = [id];
      
      if (includeDetails) {
        queryStr = `
          SELECT 
            q.*,
            json_build_object(
              'id', s.id,
              'title', s.title,
              'artist', s.artist,
              'duration', s.duration,
              'youtube_id', s.youtube_id,
              'spotify_id', s.spotify_id,
              'thumbnail_url', s.thumbnail_url
            ) as song,
            json_build_object(
              'id', u.id,
              'first_name', u.first_name,
              'last_name', u.last_name
            ) as user
          FROM queue q
          LEFT JOIN songs s ON q.song_id = s.id
          LEFT JOIN users u ON q.user_id = u.id
          WHERE q.id = $1
        `;
      }
      
      const result = await query(queryStr, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Queue find by ID error:', error);
      throw error;
    }
  }
  
  static async findByBarId(
    barId: string,
    filters: QueueFilters = {},
    limit: number = 50,
    offset: number = 0,
    includeDetails: boolean = true
  ): Promise<{ items: QueueData[]; total: number }> {
    try {
      validateUUID(barId, 'barId');
      validatePositiveInteger(limit, 'limit');
      validatePositiveInteger(offset, 'offset');
      
      let whereConditions = ['q.bar_id = $1'];
      let params: any[] = [barId];
      let paramIndex = 2;
      
      // Apply filters
      if (filters.user_id) {
        validateUUID(filters.user_id, 'user_id');
        whereConditions.push(`q.user_id = $${paramIndex}`);
        params.push(filters.user_id);
        paramIndex++;
      }
      
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          const statusPlaceholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
          whereConditions.push(`q.status IN (${statusPlaceholders})`);
          params.push(...filters.status);
        } else {
          whereConditions.push(`q.status = $${paramIndex}`);
          params.push(filters.status);
          paramIndex++;
        }
      }
      
      if (filters.priority_play !== undefined) {
        whereConditions.push(`q.priority_play = $${paramIndex}`);
        params.push(filters.priority_play);
        paramIndex++;
      }
      
      if (filters.date_from) {
        whereConditions.push(`q.requested_at >= $${paramIndex}`);
        params.push(filters.date_from);
        paramIndex++;
      }
      
      if (filters.date_to) {
        whereConditions.push(`q.requested_at <= $${paramIndex}`);
        params.push(filters.date_to);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM queue q
        WHERE ${whereClause}
      `;
      
      const countResult = await query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);
      
      // Main query
      let selectClause = 'q.*';
      let joinClause = '';
      
      if (includeDetails) {
        selectClause = `
          q.*,
          json_build_object(
            'id', s.id,
            'title', s.title,
            'artist', s.artist,
            'duration', s.duration,
            'youtube_id', s.youtube_id,
            'spotify_id', s.spotify_id,
            'thumbnail_url', s.thumbnail_url
          ) as song,
          json_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name
          ) as user
        `;
        joinClause = `
          LEFT JOIN songs s ON q.song_id = s.id
          LEFT JOIN users u ON q.user_id = u.id
        `;
      }
      
      const queryStr = `
        SELECT ${selectClause}
        FROM queue q
        ${joinClause}
        WHERE ${whereClause}
        ORDER BY 
          CASE WHEN q.status = 'playing' THEN 1
               WHEN q.status = 'pending' THEN 2
               ELSE 3 END,
          q.position ASC,
          q.requested_at ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      
      const result = await query(queryStr, params);
      
      logger.debug('Queue entries retrieved', {
        barId,
        total,
        returned: result.rows.length,
        filters
      });
      
      return {
        items: result.rows,
        total
      };
    } catch (error) {
      logger.error('Queue find by bar ID error:', error);
      throw error;
    }
  }
  
  static async update(id: string, data: UpdateQueueData): Promise<QueueData | null> {
    try {
      validateUUID(id, 'id');
      
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (data.status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(data.status);
        paramIndex++;
      }
      
      if (data.position !== undefined) {
        validatePositiveInteger(data.position, 'position');
        updateFields.push(`position = $${paramIndex}`);
        params.push(data.position);
        paramIndex++;
      }
      
      if (data.played_at !== undefined) {
        updateFields.push(`played_at = $${paramIndex}`);
        params.push(data.played_at);
        paramIndex++;
      }
      
      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      
      const queryStr = `
        UPDATE queue 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      params.push(id);
      
      const result = await query(queryStr, params);

      if (result.rows.length === 0) {
        return null;
      }

      const queue = result.rows[0];
      
      logger.info('Queue entry updated', {
        id,
        updatedFields: Object.keys(data)
      });
      
      return queue;
    } catch (error) {
      logger.error('Queue update error:', error);
      throw error;
    }
  }
  
  static async delete(id: string): Promise<boolean> {
    try {
      validateUUID(id, 'id');
      
      const result = await query(
        'DELETE FROM queue WHERE id = $1 RETURNING id',
        [id]
      );
      
      const deleted = result.rows.length > 0;
      
      if (deleted) {
        logger.info('Queue entry deleted', { id });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Queue delete error:', error);
      throw error;
    }
  }
  
  static async getCurrentlyPlaying(barId: string): Promise<QueueData | null> {
    try {
      validateUUID(barId, 'barId');
      
      const result = await query(
        `SELECT 
          q.*,
          json_build_object(
            'id', s.id,
            'title', s.title,
            'artist', s.artist,
            'duration', s.duration,
            'youtube_id', s.youtube_id,
            'spotify_id', s.spotify_id,
            'thumbnail_url', s.thumbnail_url
          ) as song,
          json_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name
          ) as user
        FROM queue q
        LEFT JOIN songs s ON q.song_id = s.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.bar_id = $1 AND q.status = 'playing'
        ORDER BY q.position ASC
        LIMIT 1`,
        [barId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get currently playing error:', error);
      throw error;
    }
  }
  
  static async getNextInQueue(barId: string): Promise<QueueData | null> {
    try {
      validateUUID(barId, 'barId');
      
      const result = await query(
        `SELECT 
          q.*,
          json_build_object(
            'id', s.id,
            'title', s.title,
            'artist', s.artist,
            'duration', s.duration,
            'youtube_id', s.youtube_id,
            'spotify_id', s.spotify_id,
            'thumbnail_url', s.thumbnail_url
          ) as song,
          json_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name
          ) as user
        FROM queue q
        LEFT JOIN songs s ON q.song_id = s.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.bar_id = $1 AND q.status = 'pending'
        ORDER BY q.position ASC
        LIMIT 1`,
        [barId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get next in queue error:', error);
      throw error;
    }
  }
  
  static async reorderQueue(barId: string, queueIds: string[]): Promise<void> {
    try {
      validateUUID(barId, 'barId');
      
      if (queueIds.length === 0) {
        return;
      }
      
      // Validate all IDs are UUIDs
      queueIds.forEach((id, index) => {
        validateUUID(id, `queueIds[${index}]`);
      });
      
      // Start transaction
      await query('BEGIN');
      
      try {
        // Update positions for each queue entry
        for (let i = 0; i < queueIds.length; i++) {
          await query(
            `UPDATE queue 
             SET position = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND bar_id = $3 AND status = 'pending'`,
            [i + 1, queueIds[i], barId]
          );
        }
        
        await query('COMMIT');
        
        logger.info('Queue reordered', {
          barId,
          queueCount: queueIds.length
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Queue reorder error:', error);
      throw error;
    }
  }
  
  static async clearQueue(barId: string, status?: string[]): Promise<number> {
    try {
      validateUUID(barId, 'barId');
      
      let queryStr = 'DELETE FROM queue WHERE bar_id = $1';
      let params = [barId];
      
      if (status && status.length > 0) {
        const statusPlaceholders = status.map((_, index) => `$${index + 2}`).join(', ');
        queryStr += ` AND status IN (${statusPlaceholders})`;
        params.push(...status);
      }
      
      const result = await query(queryStr + ' RETURNING id', params);
      
      const deletedCount = result.rows.length;
      
      logger.info('Queue cleared', {
        barId,
        deletedCount,
        status
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Queue clear error:', error);
      throw error;
    }
  }
  
  static async getQueueStats(
    barId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<QueueStats> {
    try {
      validateUUID(barId, 'barId');
      
      let whereConditions = ['bar_id = $1'];
      let params: any[] = [barId];
      let paramIndex = 2;
      
      if (dateFrom) {
        whereConditions.push(`requested_at >= $${paramIndex}`);
        params.push(dateFrom);
        paramIndex++;
      }
      
      if (dateTo) {
        whereConditions.push(`requested_at <= $${paramIndex}`);
        params.push(dateTo);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Basic stats
      const statsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
          COUNT(*) FILTER (WHERE status = 'played') as played_requests,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_requests,
          COUNT(*) FILTER (WHERE priority_play = true) as priority_requests,
          COALESCE(SUM(points_used), 0) as total_points_used,
          COALESCE(AVG(
            CASE WHEN status = 'played' AND played_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (played_at - requested_at)) / 60 
            END
          ), 0) as average_wait_time
        FROM queue
        WHERE ${whereClause}
      `;
      
      const statsResult = await query(statsQuery, params);
      const stats = statsResult.rows[0];
      
      // Most requested songs
      const songsQuery = `
        SELECT 
          s.id as song_id,
          s.title,
          s.artist,
          COUNT(*) as request_count
        FROM queue q
        JOIN songs s ON q.song_id = s.id
        WHERE ${whereClause}
        GROUP BY s.id, s.title, s.artist
        ORDER BY request_count DESC
        LIMIT 10
      `;
      
      const songsResult = await query(songsQuery, params);
      
      // Top requesters
      const usersQuery = `
        SELECT 
          u.id as user_id,
          u.first_name,
          u.last_name,
          COUNT(*) as request_count,
          COALESCE(SUM(q.points_used), 0) as points_used
        FROM queue q
        JOIN users u ON q.user_id = u.id
        WHERE ${whereClause}
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY request_count DESC
        LIMIT 10
      `;
      
      const usersResult = await query(usersQuery, params);
      
      const queueStats: QueueStats = {
        total_requests: parseInt(stats.total_requests),
        pending_requests: parseInt(stats.pending_requests),
        played_requests: parseInt(stats.played_requests),
        rejected_requests: parseInt(stats.rejected_requests),
        priority_requests: parseInt(stats.priority_requests),
        total_points_used: parseInt(stats.total_points_used),
        average_wait_time: parseFloat(stats.average_wait_time),
        most_requested_songs: songsResult.rows,
        top_requesters: usersResult.rows
      };
      
      logger.debug('Queue stats retrieved', {
        barId,
        totalRequests: queueStats.total_requests
      });
      
      return queueStats;
    } catch (error) {
      logger.error('Queue stats error:', error);
      throw error;
    }
  }
  
  static async getUserQueuePosition(barId: string, userId: string): Promise<number | null> {
    try {
      validateUUID(barId, 'barId');
      validateUUID(userId, 'userId');
      
      const result = await query(
        `SELECT position
         FROM queue
         WHERE bar_id = $1 AND user_id = $2 AND status = 'pending'
         ORDER BY position ASC
         LIMIT 1`,
        [barId, userId]
      );
      
      return result.rows[0]?.position || null;
    } catch (error) {
      logger.error('Get user queue position error:', error);
      throw error;
    }
  }
  
  static async canUserAddSong(
    barId: string,
    userId: string,
    maxSongsPerUser: number = 3
  ): Promise<{ canAdd: boolean; currentCount: number; reason?: string }> {
    try {
      validateUUID(barId, 'barId');
      validateUUID(userId, 'userId');
      validatePositiveInteger(maxSongsPerUser, 'maxSongsPerUser');
      
      const result = await query(
        `SELECT COUNT(*) as current_count
         FROM queue
         WHERE bar_id = $1 AND user_id = $2 AND status IN ('pending', 'playing')`,
        [barId, userId]
      );
      
      const currentCount = parseInt(result.rows[0].current_count);
      const canAdd = currentCount < maxSongsPerUser;
      
      return {
        canAdd,
        currentCount,
        reason: canAdd ? undefined : `Maximum ${maxSongsPerUser} songs per user in queue`
      };
    } catch (error) {
      logger.error('Check user can add song error:', error);
      throw error;
    }
  }
}