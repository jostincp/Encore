import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { query as dbQuery, getPool } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { validateRequired, validateUUID, validateEnum } from '../../../shared/utils/validation';
import { QueueEventEmitter } from '../events/queueEvents';
import { getRedisClient } from '../../../shared/utils/redis';

// Interfaces
export interface QueueData {
  id: string;
  bar_id: string;
  song_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'playing' | 'played' | 'skipped';
  position: number;
  priority_play: boolean;
  points_used?: number;
  requested_at: Date;
  played_at?: Date;
  notes?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  // Joined data when includeDetails is true
  song?: {
    id: string;
    title: string;
    artist: string;
    duration?: number;
    youtube_id?: string;
    spotify_id?: string;
    thumbnail_url?: string;
  };
  user?: {
    id: string;
    username: string;
    display_name?: string;
  };
  bar?: {
    id: string;
    name: string;
  };
}

export interface CreateQueueData {
  bar_id: string;
  song_id: string;
  user_id: string;
  priority_play?: boolean;
  points_used?: number;
  notes?: string;
}

export interface UpdateQueueData {
  status?: 'pending' | 'approved' | 'rejected' | 'playing' | 'played' | 'skipped';
  position?: number;
  notes?: string;
  rejection_reason?: string;
  played_at?: Date;
}

export interface QueueFilters {
  status?: string | string[];
  user_id?: string;
  priority_play?: boolean;
  date_from?: Date;
  date_to?: Date;
  includeDetails?: boolean;
}

export interface QueueStats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  played_requests: number;
  rejected_requests: number;
  priority_requests: number;
  total_points_used: number;
  average_wait_time: number;
  most_requested_songs: Array<{
    song_id: string;
    title: string;
    artist: string;
    request_count: number;
  }>;
  top_requesters: Array<{
    user_id: string;
    username: string;
    request_count: number;
    points_used: number;
  }>;
}

export interface PaginatedQueueResult {
  data: QueueData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class QueueModel {
  // Find queue entries by bar ID and song ID with specific statuses
  static async findByBarIdAndSongId(
    barId: string,
    songId: string,
    statuses: string[] = ['pending', 'playing']
  ): Promise<QueueData[]> {
    try {
      validateUUID(barId, 'barId');
      validateUUID(songId, 'songId');

      const placeholders = statuses.map((_, index) => `$${index + 3}`).join(', ');
      const query = `
        SELECT * FROM queue 
        WHERE bar_id = $1 AND song_id = $2 AND status IN (${placeholders})
        ORDER BY position ASC
      `;

      const result = await dbQuery(query, [barId, songId, ...statuses]);
      return result.rows.map(row => this.formatQueueData(row));

    } catch (error) {
      logger.error('Error finding queue entries by bar ID and song ID:', error);
      throw error;
    }
  }
  // Create a new queue entry
  static async create(data: CreateQueueData): Promise<QueueData> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate required fields
      validateRequired(data.bar_id, 'bar_id');
      validateRequired(data.song_id, 'song_id');
      validateRequired(data.user_id, 'user_id');
      validateUUID(data.bar_id, 'bar_id');
      validateUUID(data.song_id, 'song_id');
      validateUUID(data.user_id, 'user_id');

      const id = uuidv4();
      const now = new Date();
      
      // Determine position based on priority_play
      let position: number;
      if (data.priority_play) {
        // Priority songs go to the front (after currently playing song)
        const currentlyPlayingResult = await client.query(
          'SELECT position FROM queue WHERE bar_id = $1 AND status = $2',
          [data.bar_id, 'playing']
        );
        
        const basePosition = currentlyPlayingResult.rows.length > 0 ? currentlyPlayingResult.rows[0].position : 0;
        position = basePosition + 1;
        
        // Shift other songs down
        await client.query(
          'UPDATE queue SET position = position + 1 WHERE bar_id = $1 AND position >= $2 AND status IN ($3, $4)',
          [data.bar_id, position, 'pending', 'approved']
        );
      } else {
        // Regular songs go to the end
        const maxPositionResult = await client.query(
          'SELECT COALESCE(MAX(position), 0) as max_position FROM queue WHERE bar_id = $1',
          [data.bar_id]
        );
        position = maxPositionResult.rows[0].max_position + 1;
      }

      // Insert the queue entry
      const result = await client.query(
        `INSERT INTO queue (
          id, bar_id, song_id, user_id, status, position, priority_play, 
          points_used, requested_at, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          id, data.bar_id, data.song_id, data.user_id, 'pending', position,
          data.priority_play || false, data.points_used, now, data.notes, now, now
        ]
      );

      await client.query('COMMIT');
      
      const queueEntry = result.rows[0];
      
      // Clear cache
      await this.clearQueueCache(data.bar_id);
      
      // Emit event
      QueueEventEmitter.emitSongAdded({
        barId: data.bar_id,
        queueId: id,
        userId: data.user_id,
        songId: data.song_id,
        position,
        priorityPlay: data.priority_play || false,
        pointsUsed: data.points_used,
        timestamp: now.toISOString()
      });
      
      logger.info(`Queue entry created: ${id} for bar ${data.bar_id}`);
      return queueEntry;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating queue entry:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find queue entry by ID
  static async findById(id: string, includeDetails: boolean = false): Promise<QueueData | null> {
    try {
      validateUUID(id, 'id');
      
      let query = 'SELECT q.* FROM queue q WHERE q.id = $1';
      let selectFields = 'q.*';
      
      if (includeDetails) {
        selectFields = `
          q.*,
          s.title as song_title, s.artist as song_artist, s.duration as song_duration,
          s.youtube_id as song_youtube_id, s.spotify_id as song_spotify_id, s.thumbnail_url as song_thumbnail_url,
          u.username as user_username, u.display_name as user_display_name,
          b.name as bar_name
        `;
        query = `
          SELECT ${selectFields}
          FROM queue q
          LEFT JOIN songs s ON q.song_id = s.id
          LEFT JOIN users u ON q.user_id = u.id
          LEFT JOIN bars b ON q.bar_id = b.id
          WHERE q.id = $1
        `;
      }
      
      const result = await dbQuery(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return this.formatQueueData(row, includeDetails);
      
    } catch (error) {
      logger.error('Error finding queue entry by ID:', error);
      throw error;
    }
  }

  // Find queue entries by bar ID with filters and pagination
  static async findByBarId(
    barId: string,
    filters: QueueFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedQueueResult> {
    try {
      validateUUID(barId, 'barId');
      
      // Check cache first
      const cacheKey = `queue:${barId}:${JSON.stringify(filters)}:${page}:${limit}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const offset = (page - 1) * limit;
      const params: any[] = [barId];
      let paramIndex = 2;
      
      let whereClause = 'WHERE q.bar_id = $1';
      let selectFields = 'q.*';
      let joinClause = '';
      
      if (filters.includeDetails) {
        selectFields = `
          q.*,
          s.title as song_title, s.artist as song_artist, s.duration as song_duration,
          s.youtube_id as song_youtube_id, s.spotify_id as song_spotify_id, s.thumbnail_url as song_thumbnail_url,
          u.username as user_username, u.display_name as user_display_name,
          b.name as bar_name
        `;
        joinClause = `
          LEFT JOIN songs s ON q.song_id = s.id
          LEFT JOIN users u ON q.user_id = u.id
          LEFT JOIN bars b ON q.bar_id = b.id
        `;
      }
      
      // Add filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          const statusPlaceholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
          whereClause += ` AND q.status IN (${statusPlaceholders})`;
          params.push(...filters.status);
        } else {
          whereClause += ` AND q.status = $${paramIndex++}`;
          params.push(filters.status);
        }
      }
      
      if (filters.user_id) {
        whereClause += ` AND q.user_id = $${paramIndex++}`;
        params.push(filters.user_id);
      }
      
      if (filters.priority_play !== undefined) {
        whereClause += ` AND q.priority_play = $${paramIndex++}`;
        params.push(filters.priority_play);
      }
      
      if (filters.date_from) {
        whereClause += ` AND q.requested_at >= $${paramIndex++}`;
        params.push(filters.date_from);
      }
      
      if (filters.date_to) {
        whereClause += ` AND q.requested_at <= $${paramIndex++}`;
        params.push(filters.date_to);
      }
      
      // Count query
      const countQuery = `SELECT COUNT(*) FROM queue q ${joinClause} ${whereClause}`;
      const countResult = await dbQuery(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      // Data query with pagination
      const dataQuery = `
        SELECT ${selectFields}
        FROM queue q
        ${joinClause}
        ${whereClause}
        ORDER BY q.position ASC, q.requested_at ASC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      params.push(limit, offset);
      
      const dataResult = await dbQuery(dataQuery, params);
      
      const data = dataResult.rows.map(row => this.formatQueueData(row, filters.includeDetails));
      
      const result = {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
      
      // Cache result
      await redis.setex(cacheKey, 60, JSON.stringify(result)); // Cache for 1 minute
      
      return result;
      
    } catch (error) {
      logger.error('Error finding queue entries by bar ID:', error);
      throw error;
    }
  }

  // Update queue entry
  static async update(id: string, data: UpdateQueueData): Promise<QueueData | null> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      validateUUID(id, 'id');
      
      // Get current entry
      const currentResult = await client.query('SELECT * FROM queue WHERE id = $1', [id]);
      if (currentResult.rows.length === 0) {
        throw new Error('Queue entry not found');
      }
      
      const currentEntry = currentResult.rows[0];
      const oldStatus = currentEntry.status;
      
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      if (data.status !== undefined) {
        validateEnum(data.status, ['pending', 'approved', 'rejected', 'playing', 'played', 'skipped'], 'status');
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(data.status);
      }
      
      if (data.position !== undefined) {
        updateFields.push(`position = $${paramIndex++}`);
        updateValues.push(data.position);
      }
      
      if (data.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        updateValues.push(data.notes);
      }
      
      if (data.rejection_reason !== undefined) {
        updateFields.push(`rejection_reason = $${paramIndex++}`);
        updateValues.push(data.rejection_reason);
      }
      
      if (data.played_at !== undefined) {
        updateFields.push(`played_at = $${paramIndex++}`);
        updateValues.push(data.played_at);
      }
      
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());
      
      updateValues.push(id);
      
      const query = `
        UPDATE queue 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(query, updateValues);
      
      await client.query('COMMIT');
      
      const updatedEntry = result.rows[0];
      
      // Clear cache
      await this.clearQueueCache(currentEntry.bar_id);
      
      // Emit event if status changed
      if (data.status && data.status !== oldStatus) {
        QueueEventEmitter.emitSongStatusChanged({
          barId: currentEntry.bar_id,
          queueId: id,
          userId: currentEntry.user_id,
          songId: currentEntry.song_id,
          oldStatus,
          newStatus: data.status,
          reason: data.rejection_reason,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info(`Queue entry updated: ${id}`);
      return updatedEntry;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating queue entry:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete queue entry
  static async delete(id: string): Promise<boolean> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      validateUUID(id, 'id');
      
      // Get entry details before deletion
      const entryResult = await client.query('SELECT * FROM queue WHERE id = $1', [id]);
      if (entryResult.rows.length === 0) {
        return false;
      }
      
      const entry = entryResult.rows[0];
      
      // Delete the entry
      const result = await client.query('DELETE FROM queue WHERE id = $1', [id]);
      
      // Reorder remaining entries
      await client.query(
        'UPDATE queue SET position = position - 1 WHERE bar_id = $1 AND position > $2',
        [entry.bar_id, entry.position]
      );
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearQueueCache(entry.bar_id);
      
      logger.info(`Queue entry deleted: ${id}`);
      return result.rowCount > 0;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting queue entry:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get currently playing song
  static async getCurrentlyPlaying(barId: string): Promise<QueueData | null> {
    try {
      validateUUID(barId, 'barId');
      
      const cacheKey = `queue:current:${barId}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const query = `
        SELECT q.*,
               s.title as song_title, s.artist as song_artist, s.duration as song_duration,
               s.youtube_id as song_youtube_id, s.spotify_id as song_spotify_id, s.thumbnail_url as song_thumbnail_url,
               u.username as user_username, u.display_name as user_display_name
        FROM queue q
        LEFT JOIN songs s ON q.song_id = s.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.bar_id = $1 AND q.status = 'playing'
        ORDER BY q.position ASC
        LIMIT 1
      `;
      
      const result = await dbQuery(query, [barId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const currentSong = this.formatQueueData(result.rows[0], true);
      
      // Cache for 30 seconds
      await redis.setex(cacheKey, 30, JSON.stringify(currentSong));
      
      return currentSong;
      
    } catch (error) {
      logger.error('Error getting currently playing song:', error);
      throw error;
    }
  }

  // Get next song in queue
  static async getNextInQueue(barId: string): Promise<QueueData | null> {
    try {
      validateUUID(barId, 'barId');
      
      const query = `
        SELECT q.*,
               s.title as song_title, s.artist as song_artist, s.duration as song_duration,
               s.youtube_id as song_youtube_id, s.spotify_id as song_spotify_id, s.thumbnail_url as song_thumbnail_url,
               u.username as user_username, u.display_name as user_display_name
        FROM queue q
        LEFT JOIN songs s ON q.song_id = s.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.bar_id = $1 AND q.status IN ('pending', 'approved')
        ORDER BY q.position ASC
        LIMIT 1
      `;
      
      const result = await dbQuery(query, [barId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.formatQueueData(result.rows[0], true);
      
    } catch (error) {
      logger.error('Error getting next song in queue:', error);
      throw error;
    }
  }

  // Reorder queue
  static async reorderQueue(barId: string, queueIds: string[]): Promise<boolean> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      validateUUID(barId, 'barId');
      
      const affectedPositions: { queueId: string; oldPosition: number; newPosition: number }[] = [];
      
      // Update positions
      for (let i = 0; i < queueIds.length; i++) {
        const queueId = queueIds[i];
        validateUUID(queueId, 'queueId');
        
        // Get old position
        const oldPosResult = await client.query(
          'SELECT position FROM queue WHERE id = $1 AND bar_id = $2',
          [queueId, barId]
        );
        
        if (oldPosResult.rows.length > 0) {
          const oldPosition = oldPosResult.rows[0].position;
          const newPosition = i + 1;
          
          await client.query(
            'UPDATE queue SET position = $1, updated_at = $2 WHERE id = $3 AND bar_id = $4',
            [newPosition, new Date(), queueId, barId]
          );
          
          affectedPositions.push({ queueId, oldPosition, newPosition });
        }
      }
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearQueueCache(barId);
      
      // Emit event
      QueueEventEmitter.emitQueueReordered({
        barId,
        newOrder: queueIds,
        affectedPositions,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Queue reordered for bar ${barId}`);
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reordering queue:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clear queue
  static async clearQueue(barId: string, status?: string[]): Promise<number> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      validateUUID(barId, 'barId');
      
      let query = 'DELETE FROM queue WHERE bar_id = $1';
      const params: any[] = [barId];
      
      if (status && status.length > 0) {
        const statusPlaceholders = status.map((_, index) => `$${index + 2}`).join(', ');
        query += ` AND status IN (${statusPlaceholders})`;
        params.push(...status);
      }
      
      const result = await client.query(query, params);
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearQueueCache(barId);
      
      // Emit event
      QueueEventEmitter.emitQueueCleared({
        barId,
        timestamp: new Date().toISOString(),
        metadata: { clearedStatuses: status, clearedCount: result.rowCount }
      });
      
      logger.info(`Queue cleared for bar ${barId}, ${result.rowCount} entries removed`);
      return result.rowCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error clearing queue:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get queue statistics
  static async getQueueStats(barId: string, dateFrom?: Date, dateTo?: Date): Promise<QueueStats> {
    try {
      validateUUID(barId, 'barId');
      
      const cacheKey = `queue:stats:${barId}:${dateFrom?.toISOString()}:${dateTo?.toISOString()}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const params: any[] = [barId];
      let paramIndex = 2;
      let dateFilter = '';
      
      if (dateFrom) {
        dateFilter += ` AND q.requested_at >= $${paramIndex++}`;
        params.push(dateFrom);
      }
      
      if (dateTo) {
        dateFilter += ` AND q.requested_at <= $${paramIndex++}`;
        params.push(dateTo);
      }
      
      // Basic stats
      const statsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN status = 'played' THEN 1 END) as played_requests,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests,
          COUNT(CASE WHEN priority_play = true THEN 1 END) as priority_requests,
          COALESCE(SUM(points_used), 0) as total_points_used,
          COALESCE(AVG(EXTRACT(EPOCH FROM (played_at - requested_at))/60), 0) as average_wait_time
        FROM queue q
        WHERE q.bar_id = $1 ${dateFilter}
      `;
      
      const statsResult = await dbQuery(statsQuery, params);
      const stats = statsResult.rows[0];
      
      // Most requested songs
      const songsQuery = `
        SELECT s.id as song_id, s.title, s.artist, COUNT(*) as request_count
        FROM queue q
        JOIN songs s ON q.song_id = s.id
        WHERE q.bar_id = $1 ${dateFilter}
        GROUP BY s.id, s.title, s.artist
        ORDER BY request_count DESC
        LIMIT 10
      `;
      
      const songsResult = await dbQuery(songsQuery, params);
      
      // Top requesters
      const usersQuery = `
        SELECT u.id as user_id, u.username, COUNT(*) as request_count, COALESCE(SUM(q.points_used), 0) as points_used
        FROM queue q
        JOIN users u ON q.user_id = u.id
        WHERE q.bar_id = $1 ${dateFilter}
        GROUP BY u.id, u.username
        ORDER BY request_count DESC
        LIMIT 10
      `;
      
      const usersResult = await dbQuery(usersQuery, params);
      
      const result: QueueStats = {
        total_requests: parseInt(stats.total_requests),
        pending_requests: parseInt(stats.pending_requests),
        approved_requests: parseInt(stats.approved_requests),
        played_requests: parseInt(stats.played_requests),
        rejected_requests: parseInt(stats.rejected_requests),
        priority_requests: parseInt(stats.priority_requests),
        total_points_used: parseInt(stats.total_points_used),
        average_wait_time: parseFloat(stats.average_wait_time),
        most_requested_songs: songsResult.rows,
        top_requesters: usersResult.rows
      };
      
      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(result));
      
      return result;
      
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      throw error;
    }
  }

  // Get user's position in queue
  static async getUserQueuePosition(barId: string, userId: string): Promise<number | null> {
    try {
      validateUUID(barId, 'barId');
      validateUUID(userId, 'userId');
      
      const query = `
        SELECT position
        FROM queue
        WHERE bar_id = $1 AND user_id = $2 AND status IN ('pending', 'approved')
        ORDER BY position ASC
        LIMIT 1
      `;
      
      const result = await dbQuery(query, [barId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].position;
      
    } catch (error) {
      logger.error('Error getting user queue position:', error);
      throw error;
    }
  }

  // Check if user can add song (based on limits)
  static async canUserAddSong(barId: string, userId: string, maxSongsPerUser: number = 3): Promise<boolean> {
    try {
      validateUUID(barId, 'barId');
      validateUUID(userId, 'userId');
      
      const query = `
        SELECT COUNT(*) as current_songs
        FROM queue
        WHERE bar_id = $1 AND user_id = $2 AND status IN ('pending', 'approved', 'playing')
      `;
      
      const result = await dbQuery(query, [barId, userId]);
      const currentSongs = parseInt(result.rows[0].current_songs);
      
      return currentSongs < maxSongsPerUser;
      
    } catch (error) {
      logger.error('Error checking if user can add song:', error);
      throw error;
    }
  }

  // Helper method to format queue data
  private static formatQueueData(row: any, includeDetails: boolean = false): QueueData {
    const queueData: QueueData = {
      id: row.id,
      bar_id: row.bar_id,
      song_id: row.song_id,
      user_id: row.user_id,
      status: row.status,
      position: row.position,
      priority_play: row.priority_play,
      points_used: row.points_used,
      requested_at: row.requested_at,
      played_at: row.played_at,
      notes: row.notes,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
    if (includeDetails) {
      if (row.song_title) {
        queueData.song = {
          id: row.song_id,
          title: row.song_title,
          artist: row.song_artist,
          duration: row.song_duration,
          youtube_id: row.song_youtube_id,
          spotify_id: row.song_spotify_id,
          thumbnail_url: row.song_thumbnail_url
        };
      }
      
      if (row.user_username) {
        queueData.user = {
          id: row.user_id,
          username: row.user_username,
          display_name: row.user_display_name
        };
      }
      
      if (row.bar_name) {
        queueData.bar = {
          id: row.bar_id,
          name: row.bar_name
        };
      }
    }
    
    return queueData;
  }

  // Helper method to clear cache
  private static async clearQueueCache(barId: string): Promise<void> {
    try {
      const pattern = `queue:${barId}:*`;
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await (redis as any).del(...keys);
      }
      
      // Also clear current song cache
    await redis.del(`queue:current:${barId}`);
      
    } catch (error) {
      logger.error('Error clearing queue cache:', error);
    }
  }
}