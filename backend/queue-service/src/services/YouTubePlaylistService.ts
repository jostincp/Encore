import { getRedisClient } from '../../../shared/utils/redis';
import logger from '../../../shared/utils/logger';

export interface YouTubePlaylistItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  duration: number;
  thumbnailUrl: string;
  addedBy: string;
  addedAt: Date;
  position: number;
}

export interface YouTubePlaylist {
  id: string;
  barId: string;
  name: string;
  description?: string;
  items: YouTubePlaylistItem[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  totalDuration: number;
  itemCount: number;
}

export class YouTubePlaylistService {
  private static instance: YouTubePlaylistService;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): YouTubePlaylistService {
    if (!YouTubePlaylistService.instance) {
      YouTubePlaylistService.instance = new YouTubePlaylistService();
    }
    return YouTubePlaylistService.instance;
  }

  /**
   * Crear una nueva playlist de YouTube
   */
  async createPlaylist(
    barId: string,
    name: string,
    createdBy: string,
    description?: string,
    isPublic: boolean = true
  ): Promise<YouTubePlaylist> {
    const playlistId = `playlist:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    const playlist: YouTubePlaylist = {
      id: playlistId,
      barId,
      name,
      description,
      items: [],
      isPublic,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalDuration: 0,
      itemCount: 0
    };

    // Guardar en Redis
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.setex(key, 86400, JSON.stringify(playlist)); // 24 horas de TTL

    // Agregar a la lista de playlists del bar
    const barPlaylistsKey = `youtube:playlists:${barId}`;
    await this.redis.sadd(barPlaylistsKey, playlistId);
    await this.redis.expire(barPlaylistsKey, 86400);

    logger.info(`YouTube playlist created: ${playlistId} for bar ${barId}`);
    return playlist;
  }

  /**
   * Obtener una playlist por ID
   */
  async getPlaylist(playlistId: string): Promise<YouTubePlaylist | null> {
    const key = `youtube:playlist:${playlistId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Obtener todas las playlists de un bar
   */
  async getBarPlaylists(barId: string): Promise<YouTubePlaylist[]> {
    const barPlaylistsKey = `youtube:playlists:${barId}`;
    const playlistIds = await this.redis.smembers(barPlaylistsKey);
    
    const playlists: YouTubePlaylist[] = [];
    
    for (const playlistId of playlistIds) {
      const playlist = await this.getPlaylist(playlistId);
      if (playlist) {
        playlists.push(playlist);
      }
    }

    return playlists.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Agregar un video de YouTube a la playlist
   */
  async addVideoToPlaylist(
    playlistId: string,
    videoData: {
      videoId: string;
      title: string;
      channelTitle: string;
      duration: number;
      thumbnailUrl: string;
      addedBy: string;
    }
  ): Promise<YouTubePlaylistItem> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    const playlistItem: YouTubePlaylistItem = {
      id: `item:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      videoId: videoData.videoId,
      title: videoData.title,
      channelTitle: videoData.channelTitle,
      duration: videoData.duration,
      thumbnailUrl: videoData.thumbnailUrl,
      addedBy: videoData.addedBy,
      addedAt: new Date(),
      position: playlist.items.length
    };

    // Agregar el item a la playlist
    playlist.items.push(playlistItem);
    playlist.totalDuration += videoData.duration;
    playlist.itemCount = playlist.items.length;
    playlist.updatedAt = new Date();

    // Guardar en Redis
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.setex(key, 86400, JSON.stringify(playlist));

    // Agregar a la lista de videos de la playlist para búsqueda rápida
    const playlistVideosKey = `youtube:playlist:videos:${playlistId}`;
    await this.redis.sadd(playlistVideosKey, videoData.videoId);
    await this.redis.expire(playlistVideosKey, 86400);

    logger.info(`Video ${videoData.videoId} added to playlist ${playlistId}`);
    return playlistItem;
  }

  /**
   * Eliminar un video de la playlist
   */
  async removeVideoFromPlaylist(playlistId: string, itemId: string): Promise<boolean> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return false;
    }

    const itemIndex = playlist.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return false;
    }

    const removedItem = playlist.items[itemIndex];
    playlist.totalDuration -= removedItem.duration;
    playlist.items.splice(itemIndex, 1);
    playlist.itemCount = playlist.items.length;
    playlist.updatedAt = new Date();

    // Actualizar posiciones
    for (let i = itemIndex; i < playlist.items.length; i++) {
      playlist.items[i].position = i;
    }

    // Guardar en Redis
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.setex(key, 86400, JSON.stringify(playlist));

    // Eliminar de la lista de videos
    const playlistVideosKey = `youtube:playlist:videos:${playlistId}`;
    await this.redis.srem(playlistVideosKey, removedItem.videoId);

    logger.info(`Video ${removedItem.videoId} removed from playlist ${playlistId}`);
    return true;
  }

  /**
   * Reordenar videos en la playlist
   */
  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<boolean> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return false;
    }

    const newItems: YouTubePlaylistItem[] = [];
    
    for (let i = 0; i < itemIds.length; i++) {
      const item = playlist.items.find(item => item.id === itemIds[i]);
      if (item) {
        item.position = i;
        newItems.push(item);
      }
    }

    if (newItems.length !== itemIds.length) {
      return false; // Algunos items no fueron encontrados
    }

    playlist.items = newItems;
    playlist.updatedAt = new Date();

    // Guardar en Redis
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.setex(key, 86400, JSON.stringify(playlist));

    logger.info(`Playlist ${playlistId} reordered`);
    return true;
  }

  /**
   * Verificar si un video ya está en la playlist
   */
  async isVideoInPlaylist(playlistId: string, videoId: string): Promise<boolean> {
    const playlistVideosKey = `youtube:playlist:videos:${playlistId}`;
    const exists = await this.redis.sismember(playlistVideosKey, videoId);
    return exists === 1;
  }

  /**
   * Obtener videos de la playlist con paginación
   */
  async getPlaylistItems(
    playlistId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    items: YouTubePlaylistItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return {
        items: [],
        total: 0,
        page,
        totalPages: 0
      };
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = playlist.items.slice(startIndex, endIndex);
    const totalPages = Math.ceil(playlist.items.length / limit);

    return {
      items,
      total: playlist.items.length,
      page,
      totalPages
    };
  }

  /**
   * Eliminar una playlist completa
   */
  async deletePlaylist(playlistId: string): Promise<boolean> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return false;
    }

    // Eliminar la playlist
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.del(key);

    // Eliminar de la lista de playlists del bar
    const barPlaylistsKey = `youtube:playlists:${playlist.barId}`;
    await this.redis.srem(barPlaylistsKey, playlistId);

    // Eliminar la lista de videos
    const playlistVideosKey = `youtube:playlist:videos:${playlistId}`;
    await this.redis.del(playlistVideosKey);

    logger.info(`YouTube playlist deleted: ${playlistId}`);
    return true;
  }

  /**
   * Actualizar información de la playlist
   */
  async updatePlaylist(
    playlistId: string,
    updates: {
      name?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<YouTubePlaylist | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    if (updates.name) playlist.name = updates.name;
    if (updates.description !== undefined) playlist.description = updates.description;
    if (updates.isPublic !== undefined) playlist.isPublic = updates.isPublic;
    
    playlist.updatedAt = new Date();

    // Guardar en Redis
    const key = `youtube:playlist:${playlistId}`;
    await this.redis.setex(key, 86400, JSON.stringify(playlist));

    logger.info(`YouTube playlist updated: ${playlistId}`);
    return playlist;
  }
}