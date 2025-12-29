import axios from 'axios';
import { API_URLS } from '@/utils/constants';

// Remove /api suffix because the methods add it
const MENU_SERVICE_URL = API_URLS.menuBase.replace(/\/api$/, '');

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
}

export interface DailySpecial {
  id: string;
  menu_item_id: string;
  special_price?: number;
  description?: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  menu_item?: MenuItem;
}

class MenuService {
  /**
   * 🍔 Get menu items for a bar
   */
  async getMenuItems(barId: string, categoryId?: string): Promise<MenuItem[]> {
    try {
      const response = await axios.get(`${MENU_SERVICE_URL}/api/bars/${barId}/menu`, {
        params: { category_id: categoryId },
        timeout: 5000
      });
      return response.data.data.items;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📂 Get categories for a bar
   */
  async getCategories(barId: string): Promise<Category[]> {
    try {
      const response = await axios.get(`${MENU_SERVICE_URL}/api/bars/${barId}/categories`, {
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw this.handleError(error);
    }
  }

  /**
   * ⭐ Get daily specials
   */
  async getSpecials(barId: string): Promise<DailySpecial[]> {
    try {
      const response = await axios.get(`${MENU_SERVICE_URL}/api/bars/${barId}/specials`, {
        params: { active_only: true },
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching specials:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🔧 Standard error handling
   */
  private handleError(error: any): Error {
    if (error.response) {
      return new Error(error.response.data?.message || 'Server error');
    }
    return new Error('Network error');
  }
}

export const menuService = new MenuService();
