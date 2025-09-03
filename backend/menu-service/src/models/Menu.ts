import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarn, CreateDailySpecialData, UpdateDailySpecialData, DailySpecialData } from '../types/shared';

// Interfaces
export interface MenuItemData {
  id: string;
  bar_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number; // in minutes
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  tags?: string[];
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryData {
  id: string;
  bar_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMenuItemData {
  bar_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  tags?: string[];
  sort_order?: number;
}

export interface CreateCategoryData {
  bar_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  tags?: string[];
  sort_order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface MenuFilters {
  category_id?: string;
  is_available?: boolean;
  min_price?: number;
  max_price?: number;
  tags?: string[];
  allergens?: string[];
  search?: string;
}

export interface PaginatedMenuResult {
  items: MenuItemData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}



export interface MenuStats {
  total_items: number;
  total_categories: number;
  available_items: number;
  unavailable_items: number;
  average_price: number;
  price_range: {
    min: number;
    max: number;
  };
  items_by_category: {
    category_name: string;
    count: number;
  }[];
  popular_tags: {
    tag: string;
    count: number;
  }[];
}

export class MenuModel {
  private static pool: Pool;

  static async initialize(pool: Pool) {
    this.pool = pool;
  }

  // Menu Items Methods
  static async createMenuItem(data: CreateMenuItemData): Promise<MenuItemData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const id = uuidv4();
      const now = new Date();
      
      // Verify bar exists and user has permission
      const barCheck = await client.query(
        'SELECT id FROM bars WHERE id = $1',
        [data.bar_id]
      );
      
      if (barCheck.rows.length === 0) {
        throw new Error('Bar not found');
      }
      
      // Verify category exists and belongs to the bar
      const categoryCheck = await client.query(
        'SELECT id FROM menu_categories WHERE id = $1 AND bar_id = $2',
        [data.category_id, data.bar_id]
      );
      
      if (categoryCheck.rows.length === 0) {
        throw new Error('Category not found or does not belong to this bar');
      }
      
      // Get next sort order if not provided
      let sortOrder = data.sort_order;
      if (sortOrder === undefined) {
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM menu_items WHERE bar_id = $1 AND category_id = $2',
          [data.bar_id, data.category_id]
        );
        sortOrder = maxOrderResult.rows[0].next_order;
      }
      
      const query = `
        INSERT INTO menu_items (
          id, bar_id, category_id, name, description, price, image_url,
          is_available, preparation_time, ingredients, allergens,
          nutritional_info, tags, sort_order, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;
      
      const values = [
        id,
        data.bar_id,
        data.category_id,
        data.name,
        data.description || null,
        data.price,
        data.image_url || null,
        data.is_available !== false,
        data.preparation_time || null,
        data.ingredients ? JSON.stringify(data.ingredients) : null,
        data.allergens ? JSON.stringify(data.allergens) : null,
        data.nutritional_info ? JSON.stringify(data.nutritional_info) : null,
        data.tags ? JSON.stringify(data.tags) : null,
        sortOrder,
        now,
        now
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const menuItem = this.formatMenuItem(result.rows[0]);
      
      // Clear cache
      await this.clearMenuCache(data.bar_id);
      
      logInfo('Menu item created:', { id, bar_id: data.bar_id, name: data.name });
      
      return menuItem;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error creating menu item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMenuItem(id: string): Promise<MenuItemData | null> {
    try {
      // Cache disabled for now
      
      const query = `
        SELECT mi.*, mc.name as category_name
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = $1
      `;
      
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const menuItem = this.formatMenuItem(result.rows[0]);
      
      // Cache disabled for now
      
      return menuItem;
    } catch (error) {
      logError('Error getting menu item:', error);
      throw error;
    }
  }

  static async updateMenuItem(id: string, data: UpdateMenuItemData): Promise<MenuItemData | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if item exists
      const existingItem = await client.query(
        'SELECT * FROM menu_items WHERE id = $1',
        [id]
      );
      
      if (existingItem.rows.length === 0) {
        return null;
      }
      
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (['ingredients', 'allergens', 'nutritional_info', 'tags'].includes(key)) {
            updateFields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else {
            updateFields.push(`${key} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      });
      
      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return this.getMenuItem(id);
      }
      
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      values.push(id); // for WHERE clause
      
      const query = `
        UPDATE menu_items 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const menuItem = this.formatMenuItem(result.rows[0]);
      
      // Clear cache
      await this.clearMenuItemCache(id);
      await this.clearMenuCache(existingItem.rows[0].bar_id);
      
      logInfo('Menu item updated:', { id });
      
      return menuItem;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error updating menu item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteMenuItem(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get item info before deletion
      const itemResult = await client.query(
        'SELECT bar_id FROM menu_items WHERE id = $1',
        [id]
      );
      
      if (itemResult.rows.length === 0) {
        return false;
      }
      
      const barId = itemResult.rows[0].bar_id;
      
      // Delete the item
      const deleteResult = await client.query(
        'DELETE FROM menu_items WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        // Clear cache
        await this.clearMenuItemCache(id);
        await this.clearMenuCache(barId);
        
        logInfo('Menu item deleted:', { id });
        return true;
      }
      
      return false;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error deleting menu item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMenuItems(
    barId: string,
    filters: MenuFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedMenuResult> {
    try {
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      const conditions: string[] = ['mi.bar_id = $1'];
      const values: any[] = [barId];
      let paramCount = 2;
      
      if (filters.category_id) {
        conditions.push(`mi.category_id = $${paramCount}`);
        values.push(filters.category_id);
        paramCount++;
      }
      
      if (filters.is_available !== undefined) {
        conditions.push(`mi.is_available = $${paramCount}`);
        values.push(filters.is_available);
        paramCount++;
      }
      
      if (filters.min_price !== undefined) {
        conditions.push(`mi.price >= $${paramCount}`);
        values.push(filters.min_price);
        paramCount++;
      }
      
      if (filters.max_price !== undefined) {
        conditions.push(`mi.price <= $${paramCount}`);
        values.push(filters.max_price);
        paramCount++;
      }
      
      if (filters.search) {
        conditions.push(`(mi.name ILIKE $${paramCount} OR mi.description ILIKE $${paramCount})`);
        values.push(`%${filters.search}%`);
        paramCount++;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        conditions.push(`mi.tags::jsonb ?| $${paramCount}`);
        values.push(filters.tags);
        paramCount++;
      }
      
      if (filters.allergens && filters.allergens.length > 0) {
        conditions.push(`NOT (mi.allergens::jsonb ?| $${paramCount})`);
        values.push(filters.allergens);
        paramCount++;
      }
      
      const whereClause = conditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE ${whereClause}
      `;
      
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);
      
      // Get items
      const itemsQuery = `
        SELECT mi.*, mc.name as category_name
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE ${whereClause}
        ORDER BY mc.sort_order, mi.sort_order, mi.name
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      values.push(limit, offset);
      
      const itemsResult = await this.pool.query(itemsQuery, values);
      const items = itemsResult.rows.map(row => this.formatMenuItem(row));
      
      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logError('Error getting menu items:', error);
      throw error;
    }
  }

  // Category Methods
  static async createCategory(data: CreateCategoryData): Promise<CategoryData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const id = uuidv4();
      const now = new Date();
      
      // Verify bar exists
      const barCheck = await client.query(
        'SELECT id FROM bars WHERE id = $1',
        [data.bar_id]
      );
      
      if (barCheck.rows.length === 0) {
        throw new Error('Bar not found');
      }
      
      // Get next sort order if not provided
      let sortOrder = data.sort_order;
      if (sortOrder === undefined) {
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM menu_categories WHERE bar_id = $1',
          [data.bar_id]
        );
        sortOrder = maxOrderResult.rows[0].next_order;
      }
      
      const query = `
        INSERT INTO menu_categories (
          id, bar_id, name, description, image_url, is_active, sort_order, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        id,
        data.bar_id,
        data.name,
        data.description || null,
        data.image_url || null,
        data.is_active !== false,
        sortOrder,
        now,
        now
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const category = this.formatCategory(result.rows[0]);
      
      // Clear cache
      await this.clearMenuCache(data.bar_id);
      
      logInfo('Menu category created:', { id, bar_id: data.bar_id, name: data.name });
      
      return category;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error creating menu category:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getCategories(barId: string): Promise<CategoryData[]> {
    try {
      // Cache disabled for now
      
      const query = `
        SELECT * FROM menu_categories
        WHERE bar_id = $1 AND is_active = true
        ORDER BY sort_order, name
      `;
      
      const result = await this.pool.query(query, [barId]);
      const categories = result.rows.map(row => this.formatCategory(row));
      
      // Cache disabled for now
      
      return categories;
    } catch (error) {
      logError('Error getting menu categories:', error);
      throw error;
    }
  }

  static async updateCategory(id: string, data: UpdateCategoryData): Promise<CategoryData | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if category exists
      const existingCategory = await client.query(
        'SELECT * FROM menu_categories WHERE id = $1',
        [id]
      );
      
      if (existingCategory.rows.length === 0) {
        return null;
      }
      
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });
      
      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return this.formatCategory(existingCategory.rows[0]);
      }
      
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      values.push(id); // for WHERE clause
      
      const query = `
        UPDATE menu_categories 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const category = this.formatCategory(result.rows[0]);
      
      // Clear cache
      await this.clearMenuCache(existingCategory.rows[0].bar_id);
      
      logInfo('Menu category updated:', { id });
      
      return category;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error updating menu category:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteCategory(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get category info before deletion
      const categoryResult = await client.query(
        'SELECT bar_id FROM menu_categories WHERE id = $1',
        [id]
      );
      
      if (categoryResult.rows.length === 0) {
        return false;
      }
      
      const barId = categoryResult.rows[0].bar_id;
      
      // Check if category has items
      const itemsCheck = await client.query(
        'SELECT COUNT(*) as count FROM menu_items WHERE category_id = $1',
        [id]
      );
      
      if (parseInt(itemsCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete category with existing items');
      }
      
      // Delete the category
      const deleteResult = await client.query(
        'DELETE FROM menu_categories WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        // Clear cache
        await this.clearMenuCache(barId);
        
        logInfo('Menu category deleted:', { id });
        return true;
      }
      
      return false;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error deleting menu category:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Statistics Methods
  static async getMenuStats(barId: string): Promise<MenuStats> {
    try {
      // Cache disabled for now
      
      // Get basic stats
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE is_available = true) as available_items,
          COUNT(*) FILTER (WHERE is_available = false) as unavailable_items,
          AVG(price) as average_price,
          MIN(price) as min_price,
          MAX(price) as max_price
        FROM menu_items 
        WHERE bar_id = $1
      `;
      
      const basicStats = await this.pool.query(basicStatsQuery, [barId]);
      
      // Get category count
      const categoryCountQuery = `
        SELECT COUNT(*) as total_categories
        FROM menu_categories 
        WHERE bar_id = $1 AND is_active = true
      `;
      
      const categoryCount = await this.pool.query(categoryCountQuery, [barId]);
      
      // Get items by category
      const itemsByCategoryQuery = `
        SELECT mc.name as category_name, COUNT(mi.id) as count
        FROM menu_categories mc
        LEFT JOIN menu_items mi ON mc.id = mi.category_id
        WHERE mc.bar_id = $1 AND mc.is_active = true
        GROUP BY mc.id, mc.name
        ORDER BY count DESC
      `;
      
      const itemsByCategory = await this.pool.query(itemsByCategoryQuery, [barId]);
      
      // Get popular tags
      const popularTagsQuery = `
        SELECT tag, COUNT(*) as count
        FROM (
          SELECT jsonb_array_elements_text(tags) as tag
          FROM menu_items 
          WHERE bar_id = $1 AND tags IS NOT NULL
        ) t
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const popularTags = await this.pool.query(popularTagsQuery, [barId]);
      
      const stats: MenuStats = {
        total_items: parseInt(basicStats.rows[0].total_items) || 0,
        total_categories: parseInt(categoryCount.rows[0].total_categories) || 0,
        available_items: parseInt(basicStats.rows[0].available_items) || 0,
        unavailable_items: parseInt(basicStats.rows[0].unavailable_items) || 0,
        average_price: parseFloat(basicStats.rows[0].average_price) || 0,
        price_range: {
          min: parseFloat(basicStats.rows[0].min_price) || 0,
          max: parseFloat(basicStats.rows[0].max_price) || 0
        },
        items_by_category: itemsByCategory.rows.map(row => ({
          category_name: row.category_name,
          count: parseInt(row.count)
        })),
        popular_tags: popularTags.rows.map(row => ({
          tag: row.tag,
          count: parseInt(row.count)
        }))
      };
      
      // Cache disabled for now
      
      return stats;
    } catch (error) {
      logError('Error getting menu stats:', error);
      throw error;
    }
  }

  // Utility Methods
  private static formatMenuItem(row: any): MenuItemData {
    return {
      id: row.id,
      bar_id: row.bar_id,
      category_id: row.category_id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      image_url: row.image_url,
      is_available: row.is_available,
      preparation_time: row.preparation_time,
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : null,
      allergens: row.allergens ? JSON.parse(row.allergens) : null,
      nutritional_info: row.nutritional_info ? JSON.parse(row.nutritional_info) : null,
      tags: row.tags ? JSON.parse(row.tags) : null,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private static formatCategory(row: any): CategoryData {
    return {
      id: row.id,
      bar_id: row.bar_id,
      name: row.name,
      description: row.description,
      image_url: row.image_url,
      is_active: row.is_active,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Cache Management
  private static async clearMenuCache(barId: string): Promise<void> {
    // Cache disabled for now
  }

  private static async clearMenuItemCache(itemId: string): Promise<void> {
    // Cache disabled for now
  }

  // Bulk Operations
  static async updateItemsAvailability(
    barId: string,
    itemIds: string[],
    isAvailable: boolean
  ): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        UPDATE menu_items 
        SET is_available = $1, updated_at = $2
        WHERE bar_id = $3 AND id = ANY($4)
      `;
      
      const result = await client.query(query, [
        isAvailable,
        new Date(),
        barId,
        itemIds
      ]);
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearMenuCache(barId);
      for (const itemId of itemIds) {
        await this.clearMenuItemCache(itemId);
      }
      
      logInfo('Bulk availability update:', { 
        barId, 
        itemIds: itemIds.length, 
        isAvailable 
      });
      
      return result.rowCount || 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error updating items availability:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async reorderItems(
    barId: string,
    categoryId: string,
    itemOrders: { id: string; sort_order: number }[]
  ): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const item of itemOrders) {
        await client.query(
          'UPDATE menu_items SET sort_order = $1, updated_at = $2 WHERE id = $3 AND bar_id = $4 AND category_id = $5',
          [item.sort_order, new Date(), item.id, barId, categoryId]
        );
      }
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearMenuCache(barId);
      
      logInfo('Menu items reordered:', { barId, categoryId, items: itemOrders.length });
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error reordering menu items:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Daily Specials Methods
  static async createDailySpecial(data: CreateDailySpecialData): Promise<DailySpecialData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const id = uuidv4();
      const now = new Date();
      
      // Verify menu item exists and belongs to the bar
      const itemCheck = await client.query(
        'SELECT id, name, description, price, image_url FROM menu_items WHERE id = $1 AND bar_id = $2',
        [data.menu_item_id, data.bar_id]
      );
      
      if (itemCheck.rows.length === 0) {
        throw new Error('Menu item not found or does not belong to this bar');
      }
      
      const menuItem = itemCheck.rows[0];
      
      // Create daily special
      const query = `
        INSERT INTO daily_specials (
          id, bar_id, menu_item_id, special_price, description,
          valid_from, valid_until, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        id,
        data.bar_id,
        data.menu_item_id,
        data.special_price || null,
        data.description || null,
        data.start_date,
        data.end_date,
        true, // is_active
        now,
        now
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const special = this.formatDailySpecial({
        ...result.rows[0],
        item_name: menuItem.name,
        item_description: menuItem.description,
        original_price: menuItem.price,
        item_image_url: menuItem.image_url
      });
      
      // Clear cache
      await this.clearDailySpecialsCache(data.bar_id);
      
      logInfo('Daily special created:', { id, barId: data.bar_id, menuItemId: data.menu_item_id });
      
      return special;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error creating daily special:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getDailySpecials(barId: string, activeOnly: boolean = true): Promise<DailySpecialData[]> {
    try {
      // Cache disabled for now
      
      let query = `
        SELECT 
          ds.*,
          mi.name as item_name,
          mi.description as item_description,
          mi.price as original_price,
          mi.image_url as item_image_url
        FROM daily_specials ds
        JOIN menu_items mi ON ds.menu_item_id = mi.id
        WHERE ds.bar_id = $1
      `;
      
      const values = [barId];
      
      if (activeOnly) {
        query += ` AND ds.is_active = true AND ds.valid_from <= NOW() AND ds.valid_until >= NOW()`;
      }
      
      query += ` ORDER BY ds.valid_from DESC`;
      
      const result = await this.pool.query(query, values);
      const specials = result.rows.map(row => this.formatDailySpecial(row));
      
      // Cache disabled for now
      
      return specials;
    } catch (error) {
      logError('Error getting daily specials:', error);
      throw error;
    }
  }

  static async getDailySpecial(id: string): Promise<DailySpecialData | null> {
    try {
      // Cache disabled for now
      
      const query = `
        SELECT 
          ds.*,
          mi.name as item_name,
          mi.description as item_description,
          mi.price as original_price,
          mi.image_url as item_image_url
        FROM daily_specials ds
        JOIN menu_items mi ON ds.menu_item_id = mi.id
        WHERE ds.id = $1
      `;
      
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const special = this.formatDailySpecial(result.rows[0]);
      
      // Cache disabled for now
      
      return special;
    } catch (error) {
      logError('Error getting daily special:', error);
      throw error;
    }
  }

  static async updateDailySpecial(id: string, data: UpdateDailySpecialData): Promise<DailySpecialData | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if special exists
      const existingSpecial = await client.query(
        'SELECT * FROM daily_specials WHERE id = $1',
        [id]
      );
      
      if (existingSpecial.rows.length === 0) {
        return null;
      }
      
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (data.special_price !== undefined) {
        updateFields.push(`special_price = $${paramCount}`);
        values.push(data.special_price);
        paramCount++;
      }
      
      if (data.description !== undefined) {
        updateFields.push(`description = $${paramCount}`);
        values.push(data.description);
        paramCount++;
      }
      
      if (data.start_date !== undefined) {
        updateFields.push(`valid_from = $${paramCount}`);
        values.push(data.start_date);
        paramCount++;
      }
      
      if (data.end_date !== undefined) {
        updateFields.push(`valid_until = $${paramCount}`);
        values.push(data.end_date);
        paramCount++;
      }
      
      if (data.is_active !== undefined) {
        updateFields.push(`is_active = $${paramCount}`);
        values.push(data.is_active);
        paramCount++;
      }
      
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      paramCount++;
      
      values.push(id);
      
      const query = `
        UPDATE daily_specials 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      // Get updated special with menu item data
      const updatedSpecial = await this.getDailySpecial(id);
      
      // Clear cache
      await this.clearDailySpecialCache(id);
      await this.clearDailySpecialsCache(existingSpecial.rows[0].bar_id);
      
      logInfo('Daily special updated:', { id });
      
      return updatedSpecial;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error updating daily special:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteDailySpecial(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get special info before deletion
      const specialInfo = await client.query(
        'SELECT bar_id FROM daily_specials WHERE id = $1',
        [id]
      );
      
      if (specialInfo.rows.length === 0) {
        return false;
      }
      
      const barId = specialInfo.rows[0].bar_id;
      
      const result = await client.query(
        'DELETE FROM daily_specials WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      // Clear cache
      await this.clearDailySpecialCache(id);
      await this.clearDailySpecialsCache(barId);
      
      logInfo('Daily special deleted:', { id });
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Error deleting daily special:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Daily Specials Utility Methods
  private static formatDailySpecial(row: any): DailySpecialData {
    return {
      id: row.id,
      bar_id: row.bar_id,
      menu_item_id: row.menu_item_id,
      special_price: row.special_price ? parseFloat(row.special_price) : undefined,
      description: row.description,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_name: row.item_name,
      item_description: row.item_description,
      original_price: row.original_price ? parseFloat(row.original_price) : undefined,
      item_image_url: row.item_image_url
    };
  }

  private static async clearDailySpecialsCache(barId: string): Promise<void> {
    // Cache disabled for now
  }

  private static async clearDailySpecialCache(specialId: string): Promise<void> {
    // Cache disabled for now
  }
}