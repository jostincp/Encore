import { query, findById, findByField, findOne, update, deleteById } from '@shared/database';
import logger from '@shared/utils/logger';
import { ValidationError, NotFoundError } from '@shared/utils/errors';
import { validateRequired, validateString, validateNumber, validateUrl } from '@shared/utils/validation';
import { ID, Timestamp } from '@shared/types';

export interface SongData {
  id: ID;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  youtube_id?: string;
  spotify_id?: string;
  youtube_url?: string;
  spotify_url?: string;
  thumbnail_url?: string;
  preview_url?: string;
  genre?: string;
  release_year?: number;
  popularity_score: number;
  explicit: boolean;
  is_available: boolean;
  metadata?: Record<string, any>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateSongData {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  youtube_id?: string;
  spotify_id?: string;
  youtube_url?: string;
  spotify_url?: string;
  thumbnail_url?: string;
  preview_url?: string;
  genre?: string;
  release_year?: number;
  popularity_score?: number;
  explicit?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateSongData {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  youtube_id?: string;
  spotify_id?: string;
  youtube_url?: string;
  spotify_url?: string;
  thumbnail_url?: string;
  preview_url?: string;
  genre?: string;
  release_year?: number;
  popularity_score?: number;
  explicit?: boolean;
  is_available?: boolean;
  metadata?: Record<string, any>;
}

export interface SongSearchFilters {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  release_year?: number;
  explicit?: boolean;
  is_available?: boolean;
  has_youtube?: boolean;
  has_spotify?: boolean;
}

export class SongModel {
  static async create(songData: CreateSongData): Promise<SongData> {
    try {
      // Validate required fields
      validateRequired(songData.title, 'title');
      validateRequired(songData.artist, 'artist');
      validateRequired(songData.duration, 'duration');
      
      // Validate field types and formats
      validateString(songData.title, 'title', { minLength: 1, maxLength: 255 });
      validateString(songData.artist, 'artist', { minLength: 1, maxLength: 255 });
      validateNumber(songData.duration, 'duration', { min: 1 });
      
      if (songData.album) {
        validateString(songData.album, 'album', { maxLength: 255 });
      }
      
      if (songData.youtube_url) {
        validateUrl(songData.youtube_url, 'youtube_url');
      }
      
      if (songData.spotify_url) {
        validateUrl(songData.spotify_url, 'spotify_url');
      }
      
      if (songData.thumbnail_url) {
        validateUrl(songData.thumbnail_url, 'thumbnail_url');
      }
      
      if (songData.preview_url) {
        validateUrl(songData.preview_url, 'preview_url');
      }
      
      if (songData.release_year) {
        validateNumber(songData.release_year, 'release_year', { min: 1900, max: new Date().getFullYear() + 1 });
      }
      
      if (songData.popularity_score !== undefined) {
        validateNumber(songData.popularity_score, 'popularity_score', { min: 0, max: 100 });
      }
      
      // Check for duplicate songs (same title and artist)
      const existingSong = await findOne(
        'songs',
        'title = $1 AND artist = $2',
        [songData.title.trim(), songData.artist.trim()]
      );
      
      if (existingSong) {
        throw new ValidationError('A song with this title and artist already exists');
      }
      
      const queryStr = `
        INSERT INTO songs (
          title, artist, album, duration, youtube_id, spotify_id,
          youtube_url, spotify_url, thumbnail_url, preview_url,
          genre, release_year, popularity_score, explicit, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `;
      
      const values = [
        songData.title.trim(),
        songData.artist.trim(),
        songData.album?.trim() || null,
        songData.duration,
        songData.youtube_id || null,
        songData.spotify_id || null,
        songData.youtube_url || null,
        songData.spotify_url || null,
        songData.thumbnail_url || null,
        songData.preview_url || null,
        songData.genre?.trim() || null,
        songData.release_year || null,
        songData.popularity_score || 0,
        songData.explicit || false,
        songData.metadata ? JSON.stringify(songData.metadata) : null
      ];
      
      const result = await query(queryStr, values);
      const song = result.rows[0] as SongData;
      
      logger.info(`Song created: ${song.title} by ${song.artist}`, { songId: song.id });
      return song;
    } catch (error) {
      logger.error('Error creating song:', error);
      throw error;
    }
  }
  
  static async findById(id: ID): Promise<SongData | null> {
    try {
      return await findById('songs', id) as SongData | null;
    } catch (error) {
      logger.error('Error finding song by ID:', error);
      throw error;
    }
  }
  
  static async findByYouTubeId(youtubeId: string): Promise<SongData | null> {
    try {
      return await findByField('songs', 'youtube_id', youtubeId) as SongData | null;
    } catch (error) {
      logger.error('Error finding song by YouTube ID:', error);
      throw error;
    }
  }
  
  static async findBySpotifyId(spotifyId: string): Promise<SongData | null> {
    try {
      return await findByField('songs', 'spotify_id', spotifyId) as SongData | null;
    } catch (error) {
      logger.error('Error finding song by Spotify ID:', error);
      throw error;
    }
  }
  
  static async search(
    query: string,
    filters: SongSearchFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<{ songs: SongData[]; total: number }> {
    try {
      let whereClause = 'is_available = true';
      const values: any[] = [];
      let paramCount = 0;
      
      // Add search query
      if (query.trim()) {
        paramCount++;
        whereClause += ` AND (title ILIKE $${paramCount} OR artist ILIKE $${paramCount} OR album ILIKE $${paramCount})`;
        values.push(`%${query.trim()}%`);
      }
      
      // Add filters
      if (filters.title) {
        paramCount++;
        whereClause += ` AND title ILIKE $${paramCount}`;
        values.push(`%${filters.title}%`);
      }
      
      if (filters.artist) {
        paramCount++;
        whereClause += ` AND artist ILIKE $${paramCount}`;
        values.push(`%${filters.artist}%`);
      }
      
      if (filters.album) {
        paramCount++;
        whereClause += ` AND album ILIKE $${paramCount}`;
        values.push(`%${filters.album}%`);
      }
      
      if (filters.genre) {
        paramCount++;
        whereClause += ` AND genre ILIKE $${paramCount}`;
        values.push(`%${filters.genre}%`);
      }
      
      if (filters.release_year) {
        paramCount++;
        whereClause += ` AND release_year = $${paramCount}`;
        values.push(filters.release_year);
      }
      
      if (filters.explicit !== undefined) {
        paramCount++;
        whereClause += ` AND explicit = $${paramCount}`;
        values.push(filters.explicit);
      }
      
      if (filters.is_available !== undefined) {
        paramCount++;
        whereClause += ` AND is_available = $${paramCount}`;
        values.push(filters.is_available);
      }
      
      if (filters.has_youtube !== undefined) {
        if (filters.has_youtube) {
          whereClause += ' AND youtube_id IS NOT NULL';
        } else {
          whereClause += ' AND youtube_id IS NULL';
        }
      }
      
      if (filters.has_spotify !== undefined) {
        if (filters.has_spotify) {
          whereClause += ' AND spotify_id IS NOT NULL';
        } else {
          whereClause += ' AND spotify_id IS NULL';
        }
      }
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM songs WHERE ${whereClause}`;
      const countResult = await query(countQuery, values);
      const total = parseInt(countResult.rows[0]?.count || '0');
      
      // Get songs with pagination
      paramCount++;
      const limitParam = paramCount;
      paramCount++;
      const offsetParam = paramCount;
      
      const songsQuery = `
        SELECT * FROM songs 
        WHERE ${whereClause}
        ORDER BY popularity_score DESC, created_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `;
      
      values.push(limit, offset);
      const songsResult = await query(songsQuery, values);
      const songs = songsResult.rows as SongData[];
      
      return { songs, total };
    } catch (error) {
      logger.error('Error searching songs:', error);
      throw error;
    }
  }
  
  static async update(id: ID, updateData: UpdateSongData): Promise<SongData> {
    try {
      const existingSong = await this.findById(id);
      if (!existingSong) {
        throw new NotFoundError('Song not found');
      }
      
      // Validate update data
      if (updateData.title !== undefined) {
        validateString(updateData.title, 'title', { minLength: 1, maxLength: 255 });
      }
      
      if (updateData.artist !== undefined) {
        validateString(updateData.artist, 'artist', { minLength: 1, maxLength: 255 });
      }
      
      if (updateData.duration !== undefined) {
        validateNumber(updateData.duration, 'duration', { min: 1 });
      }
      
      if (updateData.album !== undefined) {
        validateString(updateData.album, 'album', { maxLength: 255 });
      }
      
      if (updateData.youtube_url !== undefined) {
        validateUrl(updateData.youtube_url, 'youtube_url');
      }
      
      if (updateData.spotify_url !== undefined) {
        validateUrl(updateData.spotify_url, 'spotify_url');
      }
      
      if (updateData.thumbnail_url !== undefined) {
        validateUrl(updateData.thumbnail_url, 'thumbnail_url');
      }
      
      if (updateData.preview_url !== undefined) {
        validateUrl(updateData.preview_url, 'preview_url');
      }
      
      if (updateData.release_year !== undefined) {
        validateNumber(updateData.release_year, 'release_year', { min: 1900, max: new Date().getFullYear() + 1 });
      }
      
      if (updateData.popularity_score !== undefined) {
        validateNumber(updateData.popularity_score, 'popularity_score', { min: 0, max: 100 });
      }
      
      const updatedSong = await update('songs', id, updateData) as SongData;
      
      logger.info(`Song updated: ${updatedSong.title} by ${updatedSong.artist}`, { songId: id });
      return updatedSong;
    } catch (error) {
      logger.error('Error updating song:', error);
      throw error;
    }
  }
  
  static async delete(id: ID): Promise<void> {
    try {
      const song = await this.findById(id);
      if (!song) {
        throw new NotFoundError('Song not found');
      }
      
      await deleteById('songs', id);
      
      logger.info(`Song deleted: ${song.title} by ${song.artist}`, { songId: id });
    } catch (error) {
      logger.error('Error deleting song:', error);
      throw error;
    }
  }
  
  static async updatePopularityScore(id: ID, score: number): Promise<void> {
    try {
      validateNumber(score, 'popularity_score', { min: 0, max: 100 });
      
      await this.update(id, { popularity_score: score });
      
      logger.info(`Song popularity score updated`, { songId: id, score });
    } catch (error) {
      logger.error('Error updating song popularity score:', error);
      throw error;
    }
  }
  
  static async markAsUnavailable(id: ID): Promise<void> {
    try {
      await this.update(id, { is_available: false });
      
      logger.info(`Song marked as unavailable`, { songId: id });
    } catch (error) {
      logger.error('Error marking song as unavailable:', error);
      throw error;
    }
  }
  
  static async markAsAvailable(id: ID): Promise<void> {
    try {
      await this.update(id, { is_available: true });
      
      logger.info(`Song marked as available`, { songId: id });
    } catch (error) {
      logger.error('Error marking song as available:', error);
      throw error;
    }
  }
  
  static async getPopularSongs(limit: number = 50): Promise<SongData[]> {
    try {
      const queryStr = `
        SELECT * FROM songs 
        WHERE is_available = true
        ORDER BY popularity_score DESC, created_at DESC
        LIMIT $1
      `;
      
      const result = await query(queryStr, [limit]);
      return result.rows as SongData[];
    } catch (error) {
      logger.error('Error getting popular songs:', error);
      throw error;
    }
  }
  
  static async getRecentSongs(limit: number = 50): Promise<SongData[]> {
    try {
      const queryStr = `
        SELECT * FROM songs 
        WHERE is_available = true
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      const result = await query(queryStr, [limit]);
      return result.rows as SongData[];
    } catch (error) {
      logger.error('Error getting recent songs:', error);
      throw error;
    }
  }
}