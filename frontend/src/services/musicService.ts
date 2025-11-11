import axios from 'axios';

// Configuración base del API client
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MUSIC_SERVICE_URL = 'http://localhost:3002';
const QUEUE_SERVICE_URL = 'http://localhost:3003';

// Interfaces TypeScript
export interface YouTubeVideo {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  channel: string;
  publishedAt: string;
  description: string;
  source: 'youtube';
}

export interface SearchResponse {
  success: boolean;
  data: {
    videos: YouTubeVideo[];
    totalResults: number;
    nextPageToken?: string;
    regionCode?: string;
  };
  query: {
    q: string;
    maxResults: number;
    type: string;
  };
}

export interface VideoDetailsResponse {
  success: boolean;
  data: YouTubeVideo & {
    duration?: string;
  };
}

// Cliente API para Música
class MusicService {
  /**
   * 🔍 Buscar canciones en YouTube
   */
  async searchSongs(query: string, maxResults: number = 10): Promise<SearchResponse> {
    try {
      const response = await axios.get(`${MUSIC_SERVICE_URL}/api/youtube/search`, {
        params: {
          q: query,
          maxResults,
          type: 'video'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Error searching songs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🎵 Obtener detalles de un video específico
   */
  async getVideoDetails(videoId: string): Promise<VideoDetailsResponse> {
    try {
      const response = await axios.get(`${MUSIC_SERVICE_URL}/api/youtube/video/${videoId}`, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Error getting video details:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📈 Obtener tendencias musicales
   */
  async getTrending(regionCode: string = 'US'): Promise<SearchResponse> {
    try {
      const response = await axios.get(`${MUSIC_SERVICE_URL}/api/youtube/trending`, {
        params: { regionCode },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Error getting trending music:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🏥 Health check del servicio
   */
  async healthCheck(): Promise<{ success: boolean; service: string; status: string }> {
    try {
      const response = await axios.get(`${MUSIC_SERVICE_URL}/health`, {
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      console.error('Music service health check failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🎵 Añadir canción a la cola (integración con Queue Service)
   */
  async addToQueue(song: YouTubeVideo, barId: string, userToken: string, priority: boolean = false): Promise<any> {
    try {
      const response = await axios.post(
        `${QUEUE_SERVICE_URL}/api/queue/add`,
        {
          bar_id: barId,
          song_id: song.id,
          video_id: song.id,
          title: song.title,
          artist: song.artist,
          thumbnail: song.thumbnail,
          priority_play: priority
        },
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error adding song to queue:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 📋 Obtener cola actual
   */
  async getQueue(barId: string): Promise<any> {
    try {
      const response = await axios.get(`${QUEUE_SERVICE_URL}/api/queue/${barId}`, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Error getting queue:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 🔧 Manejo de errores estandarizado
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Error del servidor
      const status = error.response.status;
      const message = error.response.data?.message || 'Server error';

      switch (status) {
        case 400:
          return new Error(`Bad request: ${message}`);
        case 401:
          return new Error('Unauthorized: Please log in again');
        case 403:
          return new Error('Forbidden: Insufficient permissions');
        case 404:
          return new Error('Not found: The requested resource does not exist');
        case 429:
          return new Error('Too many requests: Please try again later');
        case 500:
          return new Error('Server error: Please try again later');
        default:
          return new Error(`Error ${status}: ${message}`);
      }
    } else if (error.request) {
      // Error de red
      return new Error('Network error: Unable to connect to the server');
    } else {
      // Error desconocido
      return new Error(`Unknown error: ${error.message}`);
    }
  }

  /**
   * ⚡ Utilidad: Formatear duración de YouTube (PT4M13S -> 4:13)
   */
  formatDuration(duration: string): string {
    if (!duration) return 'Unknown';
    
    const match = duration.match(/PT(\d+M)?(\d+S)?/);
    if (!match) return duration;

    const minutes = parseInt(match[1]?.replace('M', '') || '0');
    const seconds = parseInt(match[2]?.replace('S', '') || '0');

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * 🔍 Utilidad: Generar URL de YouTube
   */
  getYouTubeUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * 🎨 Utilidad: Obtener thumbnail de alta calidad
   */
  getHighQualityThumbnail(thumbnail: string): string {
    if (!thumbnail) return '';
    
    // Convertir thumbnail de calidad media a alta
    return thumbnail.replace('/mqdefault.jpg', '/hqdefault.jpg')
                    .replace('/default.jpg', '/hqdefault.jpg');
  }
}

// Exportar instancia singleton
export const musicService = new MusicService();

// Exportar tipos por separado
export type { YouTubeVideo, SearchResponse, VideoDetailsResponse };
