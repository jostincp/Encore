import { query } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { validateUUID } from '../../../shared/utils/validation';
import { Bar } from '../../../shared/types';

export interface BarSettings {
  max_songs_per_user?: number;
  song_request_cooldown?: number;
  priority_play_cost?: number;
  auto_approve_requests?: boolean;
  allow_explicit_content?: boolean;
  max_queue_size?: number;
}

export class BarService {
  static async findById(id: string): Promise<Bar | null> {
    try {
      validateUUID(id, 'id');
      
      const result = await query(
        'SELECT * FROM bars WHERE id = $1',
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Bar find by ID error:', error);
      throw error;
    }
  }
  
  static async getSettings(barId: string): Promise<BarSettings | null> {
    try {
      validateUUID(barId, 'barId');
      
      const result = await query(
        `SELECT 
          max_songs_per_user,
          song_request_cooldown,
          priority_play_cost,
          auto_approve_requests,
          allow_explicit_content,
          max_queue_size
        FROM bar_settings 
        WHERE bar_id = $1`,
        [barId]
      );
      
      if (result.rows.length === 0) {
        // Return default settings if no custom settings found
        return {
          max_songs_per_user: 3,
          song_request_cooldown: 0,
          priority_play_cost: 10,
          auto_approve_requests: true,
          allow_explicit_content: false,
          max_queue_size: 50
        };
      }
      
      const settings = result.rows[0];
      return {
        max_songs_per_user: settings.max_songs_per_user,
        song_request_cooldown: settings.song_request_cooldown,
        priority_play_cost: settings.priority_play_cost,
        auto_approve_requests: settings.auto_approve_requests,
        allow_explicit_content: settings.allow_explicit_content,
        max_queue_size: settings.max_queue_size
      };
    } catch (error) {
      logger.error('Bar get settings error:', error);
      // Return default settings on error
      return {
        max_songs_per_user: 3,
        song_request_cooldown: 0,
        priority_play_cost: 10,
        auto_approve_requests: true,
        allow_explicit_content: false,
        max_queue_size: 50
      };
    }
  }
}