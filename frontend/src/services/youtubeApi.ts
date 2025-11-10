import axios from 'axios';

// Base del servicio de música (incluye /api/music)
const MUSIC_BASE = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_MUSIC_API_URL || 'http://localhost:3003')
  : process.env.NEXT_PUBLIC_MUSIC_API_URL || 'http://localhost:3003');

const API_BASE_URL = `${MUSIC_BASE}/api/music`;

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  channelTitle: string;
}

export interface YouTubePlaylist {
  id: string;
  name: string;
  description: string;
  barId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface YouTubePlaylistItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  position: number;
  addedAt: string;
  addedBy: string;
}

export interface CreatePlaylistRequest {
  name: string;
  description: string;
  barId: string;
}

export interface AddVideoToPlaylistRequest {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

export interface ReorderPlaylistItemsRequest {
  itemIds: string[];
}

class YouTubeApiService {
  private axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('encore_access_token') : null;
        if (token) {
          (config.headers as any).Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Search videos
  async searchVideos(query: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
    try {
      // Endpoint real en music-service: /api/music/songs/external/youtube/search
      const response = await this.axiosInstance.get('/songs/external/youtube/search', {
        params: { q: query, max_results: maxResults },
      });
      // El backend actual devuelve { success, data: [] }
      const data = response.data;
      return (data.videos || data.data || []) as YouTubeVideo[];
    } catch (error) {
      console.error('Error searching videos:', error);
      throw error;
    }
  }

  // Playlist operations
  async createPlaylist(data: CreatePlaylistRequest): Promise<YouTubePlaylist> {
    try {
      const response = await this.axiosInstance.post('/youtube/playlists', data);
      return response.data.playlist;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }

  async getBarPlaylists(barId: string): Promise<YouTubePlaylist[]> {
    try {
      const response = await this.axiosInstance.get(`/youtube/playlists/bar/${barId}`);
      return response.data.playlists;
    } catch (error) {
      console.error('Error getting bar playlists:', error);
      throw error;
    }
  }

  async getPlaylist(playlistId: string): Promise<{
    playlist: YouTubePlaylist;
    items: YouTubePlaylistItem[];
  }> {
    try {
      const response = await this.axiosInstance.get(`/youtube/playlists/${playlistId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting playlist:', error);
      throw error;
    }
  }

  async updatePlaylist(playlistId: string, data: Partial<CreatePlaylistRequest>): Promise<YouTubePlaylist> {
    try {
      const response = await this.axiosInstance.put(`/youtube/playlists/${playlistId}`, data);
      return response.data.playlist;
    } catch (error) {
      console.error('Error updating playlist:', error);
      throw error;
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/youtube/playlists/${playlistId}`);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      throw error;
    }
  }

  // Playlist items operations
  async addVideoToPlaylist(playlistId: string, data: AddVideoToPlaylistRequest): Promise<YouTubePlaylistItem> {
    try {
      const response = await this.axiosInstance.post(`/youtube/playlists/${playlistId}/items`, data);
      return response.data.item;
    } catch (error) {
      console.error('Error adding video to playlist:', error);
      throw error;
    }
  }

  async removeVideoFromPlaylist(playlistId: string, itemId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/youtube/playlists/${playlistId}/items/${itemId}`);
    } catch (error) {
      console.error('Error removing video from playlist:', error);
      throw error;
    }
  }

  async reorderPlaylistItems(playlistId: string, data: ReorderPlaylistItemsRequest): Promise<void> {
    try {
      await this.axiosInstance.put(`/youtube/playlists/${playlistId}/items/reorder`, data);
    } catch (error) {
      console.error('Error reordering playlist items:', error);
      throw error;
    }
  }

  // Queue operations
  async addToQueue(videoId: string, barId: string, userId?: string): Promise<void> {
    try {
      // Cola dentro del servicio de música: /api/music/queue/add
      await this.axiosInstance.post('/queue/add', {
        videoId,
        barId,
        userId,
      });
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  async getQueue(barId: string): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(`/queue/${barId}`);
      return response.data.queue;
    } catch (error) {
      console.error('Error getting queue:', error);
      throw error;
    }
  }
}

export const youtubeApiService = new YouTubeApiService();