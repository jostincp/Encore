import axios from 'axios';
import { config } from '../../../shared/config';
import { logger } from '../../../shared/utils/logger';
import { cacheService } from '../../../shared/utils/cache';
import { ExternalServiceError } from '../../../shared/utils/errors';

export interface SpotifySearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  preview_url?: string;
  url: string;
  thumbnail_url: string;
  popularity: number;
  explicit: boolean;
  release_date?: string;
  genres?: string[];
  isrc?: string;
}

export interface SpotifyTrackDetails {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  preview_url?: string;
  url: string;
  thumbnail_url: string;
  popularity: number;
  explicit: boolean;
  release_date: string;
  genres: string[];
  isrc?: string;
  artists: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  album_details: {
    id: string;
    name: string;
    release_date: string;
    total_tracks: number;
    url: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  followers: number;
  genres: string[];
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  url: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  tracks_count: number;
  url: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  owner: {
    id: string;
    name: string;
  };
}

export class SpotifyService {
  private static readonly BASE_URL = 'https://api.spotify.com/v1';
  private static readonly AUTH_URL = 'https://accounts.spotify.com/api/token';
  private static readonly CLIENT_ID = config.spotify.clientId;
  private static readonly CLIENT_SECRET = config.spotify.clientSecret;
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly TOKEN_CACHE_KEY = 'spotify:access_token';
  
  private static async getAccessToken(): Promise<string> {
    try {
      // Check cache first
      const cachedToken = await cacheService.get(this.TOKEN_CACHE_KEY);
      if (cachedToken) {
        return cachedToken;
      }
      
      if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
        throw new ExternalServiceError('Spotify credentials not configured');
      }
      
      const credentials = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');
      
      const response = await axios.post(
        this.AUTH_URL,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const { access_token, expires_in } = response.data;
      
      // Cache token with expiration (subtract 5 minutes for safety)
      await cacheService.set(this.TOKEN_CACHE_KEY, access_token, expires_in - 300);
      
      logger.debug('Spotify access token obtained');
      return access_token;
    } catch (error) {
      logger.error('Spotify authentication error:', error);
      throw new ExternalServiceError('Failed to authenticate with Spotify');
    }
  }
  
  private static async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${this.BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          // Token expired, clear cache and retry once
          await cacheService.delete(this.TOKEN_CACHE_KEY);
          const token = await this.getAccessToken();
          
          const response = await axios.get(`${this.BASE_URL}${endpoint}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            params
          });
          
          return response.data;
        }
        
        if (error.response?.status === 429) {
          throw new ExternalServiceError('Spotify API rate limit exceeded');
        }
        
        if (error.response?.status === 400) {
          throw new ExternalServiceError('Invalid Spotify API request');
        }
      }
      
      throw error;
    }
  }
  
  static async searchTracks(
    query: string,
    limit: number = 25,
    offset: number = 0
  ): Promise<{ tracks: SpotifySearchResult[]; total: number }> {
    try {
      const cacheKey = `spotify:search:tracks:${query}:${limit}:${offset}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify search results retrieved from cache', { query });
        return JSON.parse(cached);
      }
      
      logger.debug('Searching Spotify tracks', { query, limit, offset });
      
      const data = await this.makeRequest('/search', {
        q: query,
        type: 'track',
        limit,
        offset,
        market: 'US' // Can be made configurable
      });
      
      if (!data.tracks || !data.tracks.items) {
        logger.info('No Spotify tracks found', { query });
        return { tracks: [], total: 0 };
      }
      
      const tracks: SpotifySearchResult[] = data.tracks.items.map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url || '',
        popularity: track.popularity,
        explicit: track.explicit,
        release_date: track.album.release_date,
        isrc: track.external_ids?.isrc
      }));
      
      const result = {
        tracks,
        total: data.tracks.total
      };
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
      
      logger.info(`Spotify search completed`, { 
        query, 
        totalResults: tracks.length, 
        totalAvailable: data.tracks.total 
      });
      
      return result;
    } catch (error) {
      logger.error('Spotify search error:', error);
      throw new ExternalServiceError('Spotify search failed');
    }
  }
  
  static async getTrackDetails(trackId: string): Promise<SpotifyTrackDetails | null> {
    try {
      const cacheKey = `spotify:track:${trackId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify track details retrieved from cache', { trackId });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify track details', { trackId });
      
      const track = await this.makeRequest(`/tracks/${trackId}`, {
        market: 'US'
      });
      
      if (!track) {
        logger.warn('Spotify track not found', { trackId });
        return null;
      }
      
      // Get additional album details
      const album = await this.makeRequest(`/albums/${track.album.id}`, {
        market: 'US'
      });
      
      const trackDetails: SpotifyTrackDetails = {
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url || '',
        popularity: track.popularity,
        explicit: track.explicit,
        release_date: track.album.release_date,
        genres: album.genres || [],
        isrc: track.external_ids?.isrc,
        artists: track.artists.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          url: artist.external_urls.spotify
        })),
        album_details: {
          id: track.album.id,
          name: track.album.name,
          release_date: track.album.release_date,
          total_tracks: track.album.total_tracks,
          url: track.album.external_urls.spotify
        }
      };
      
      // Cache track details
      await cacheService.set(cacheKey, JSON.stringify(trackDetails), this.CACHE_TTL);
      
      logger.info('Spotify track details retrieved', { trackId, title: track.name });
      return trackDetails;
    } catch (error) {
      logger.error('Spotify track details error:', error);
      
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      throw new ExternalServiceError('Failed to get Spotify track details');
    }
  }
  
  static async getArtistDetails(artistId: string): Promise<SpotifyArtist | null> {
    try {
      const cacheKey = `spotify:artist:${artistId}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify artist details retrieved from cache', { artistId });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify artist details', { artistId });
      
      const artist = await this.makeRequest(`/artists/${artistId}`);
      
      if (!artist) {
        logger.warn('Spotify artist not found', { artistId });
        return null;
      }
      
      const artistDetails: SpotifyArtist = {
        id: artist.id,
        name: artist.name,
        popularity: artist.popularity,
        followers: artist.followers.total,
        genres: artist.genres,
        images: artist.images,
        url: artist.external_urls.spotify
      };
      
      // Cache artist details
      await cacheService.set(cacheKey, JSON.stringify(artistDetails), this.CACHE_TTL);
      
      logger.info('Spotify artist details retrieved', { artistId, name: artist.name });
      return artistDetails;
    } catch (error) {
      logger.error('Spotify artist details error:', error);
      
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      throw new ExternalServiceError('Failed to get Spotify artist details');
    }
  }
  
  static async getArtistTopTracks(artistId: string, market: string = 'US'): Promise<SpotifySearchResult[]> {
    try {
      const cacheKey = `spotify:artist:${artistId}:top_tracks:${market}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify artist top tracks retrieved from cache', { artistId });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify artist top tracks', { artistId, market });
      
      const data = await this.makeRequest(`/artists/${artistId}/top-tracks`, {
        market
      });
      
      if (!data.tracks) {
        logger.info('No top tracks found for Spotify artist', { artistId });
        return [];
      }
      
      const tracks: SpotifySearchResult[] = data.tracks.map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url || '',
        popularity: track.popularity,
        explicit: track.explicit,
        release_date: track.album.release_date,
        isrc: track.external_ids?.isrc
      }));
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(tracks), this.CACHE_TTL);
      
      logger.info(`Spotify artist top tracks retrieved`, { 
        artistId, 
        tracksCount: tracks.length 
      });
      
      return tracks;
    } catch (error) {
      logger.error('Spotify artist top tracks error:', error);
      throw new ExternalServiceError('Failed to get Spotify artist top tracks');
    }
  }
  
  static async getPlaylistTracks(
    playlistId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ tracks: SpotifySearchResult[]; total: number }> {
    try {
      const cacheKey = `spotify:playlist:${playlistId}:tracks:${limit}:${offset}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify playlist tracks retrieved from cache', { playlistId });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify playlist tracks', { playlistId, limit, offset });
      
      const data = await this.makeRequest(`/playlists/${playlistId}/tracks`, {
        limit,
        offset,
        market: 'US'
      });
      
      if (!data.items) {
        logger.info('No tracks found in Spotify playlist', { playlistId });
        return { tracks: [], total: 0 };
      }
      
      const tracks: SpotifySearchResult[] = data.items
        .filter((item: any) => item.track && item.track.type === 'track')
        .map((item: any) => {
          const track = item.track;
          return {
            id: track.id,
            title: track.name,
            artist: track.artists.map((artist: any) => artist.name).join(', '),
            album: track.album.name,
            duration: Math.floor(track.duration_ms / 1000),
            preview_url: track.preview_url,
            url: track.external_urls.spotify,
            thumbnail_url: track.album.images[0]?.url || '',
            popularity: track.popularity,
            explicit: track.explicit,
            release_date: track.album.release_date,
            isrc: track.external_ids?.isrc
          };
        });
      
      const result = {
        tracks,
        total: data.total
      };
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
      
      logger.info(`Spotify playlist tracks retrieved`, { 
        playlistId, 
        tracksCount: tracks.length, 
        totalAvailable: data.total 
      });
      
      return result;
    } catch (error) {
      logger.error('Spotify playlist tracks error:', error);
      throw new ExternalServiceError('Failed to get Spotify playlist tracks');
    }
  }
  
  static async getFeaturedPlaylists(
    limit: number = 20,
    offset: number = 0,
    country: string = 'US'
  ): Promise<{ playlists: SpotifyPlaylist[]; total: number }> {
    try {
      const cacheKey = `spotify:featured_playlists:${limit}:${offset}:${country}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify featured playlists retrieved from cache', { country });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify featured playlists', { limit, offset, country });
      
      const data = await this.makeRequest('/browse/featured-playlists', {
        limit,
        offset,
        country
      });
      
      if (!data.playlists || !data.playlists.items) {
        logger.info('No featured playlists found on Spotify', { country });
        return { playlists: [], total: 0 };
      }
      
      const playlists: SpotifyPlaylist[] = data.playlists.items.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        tracks_count: playlist.tracks.total,
        url: playlist.external_urls.spotify,
        images: playlist.images,
        owner: {
          id: playlist.owner.id,
          name: playlist.owner.display_name
        }
      }));
      
      const result = {
        playlists,
        total: data.playlists.total
      };
      
      // Cache results for shorter time (featured playlists change frequently)
      await cacheService.set(cacheKey, JSON.stringify(result), 1800); // 30 minutes
      
      logger.info(`Spotify featured playlists retrieved`, { 
        country, 
        playlistsCount: playlists.length, 
        totalAvailable: data.playlists.total 
      });
      
      return result;
    } catch (error) {
      logger.error('Spotify featured playlists error:', error);
      throw new ExternalServiceError('Failed to get Spotify featured playlists');
    }
  }
  
  static async getNewReleases(
    limit: number = 20,
    offset: number = 0,
    country: string = 'US'
  ): Promise<SpotifySearchResult[]> {
    try {
      const cacheKey = `spotify:new_releases:${limit}:${offset}:${country}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify new releases retrieved from cache', { country });
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify new releases', { limit, offset, country });
      
      const data = await this.makeRequest('/browse/new-releases', {
        limit,
        offset,
        country
      });
      
      if (!data.albums || !data.albums.items) {
        logger.info('No new releases found on Spotify', { country });
        return [];
      }
      
      // Get tracks from each album
      const tracks: SpotifySearchResult[] = [];
      
      for (const album of data.albums.items.slice(0, 10)) { // Limit to first 10 albums
        try {
          const albumTracks = await this.makeRequest(`/albums/${album.id}/tracks`, {
            limit: 3, // Get first 3 tracks from each album
            market: country
          });
          
          if (albumTracks.items) {
            const albumTrackResults = albumTracks.items.map((track: any) => ({
              id: track.id,
              title: track.name,
              artist: track.artists.map((artist: any) => artist.name).join(', '),
              album: album.name,
              duration: Math.floor(track.duration_ms / 1000),
              preview_url: track.preview_url,
              url: track.external_urls.spotify,
              thumbnail_url: album.images[0]?.url || '',
              popularity: 0, // Not available for album tracks endpoint
              explicit: track.explicit,
              release_date: album.release_date,
              isrc: track.external_ids?.isrc
            }));
            
            tracks.push(...albumTrackResults);
          }
        } catch (error) {
          logger.warn('Error getting tracks for album', { albumId: album.id, error });
        }
      }
      
      // Cache results for shorter time (new releases change frequently)
      await cacheService.set(cacheKey, JSON.stringify(tracks), 1800); // 30 minutes
      
      logger.info(`Spotify new releases retrieved`, { 
        country, 
        tracksCount: tracks.length 
      });
      
      return tracks;
    } catch (error) {
      logger.error('Spotify new releases error:', error);
      throw new ExternalServiceError('Failed to get Spotify new releases');
    }
  }
  
  static async validateTrackId(trackId: string): Promise<boolean> {
    try {
      const details = await this.getTrackDetails(trackId);
      return details !== null;
    } catch (error) {
      logger.error('Spotify track validation error:', error);
      return false;
    }
  }
  
  static async getRecommendations(
    seedTracks?: string[],
    seedArtists?: string[],
    seedGenres?: string[],
    limit: number = 20,
    market: string = 'US'
  ): Promise<SpotifySearchResult[]> {
    try {
      const seeds = [
        ...(seedTracks || []).map(id => `seed_tracks=${id}`),
        ...(seedArtists || []).map(id => `seed_artists=${id}`),
        ...(seedGenres || []).map(genre => `seed_genres=${genre}`)
      ];
      
      if (seeds.length === 0) {
        throw new ExternalServiceError('At least one seed is required for recommendations');
      }
      
      if (seeds.length > 5) {
        throw new ExternalServiceError('Maximum 5 seeds allowed for recommendations');
      }
      
      const cacheKey = `spotify:recommendations:${seeds.join(':')}:${limit}:${market}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        logger.debug('Spotify recommendations retrieved from cache');
        return JSON.parse(cached);
      }
      
      logger.debug('Getting Spotify recommendations', { seeds: seeds.length, limit, market });
      
      const params: Record<string, any> = {
        limit,
        market
      };
      
      if (seedTracks && seedTracks.length > 0) {
        params.seed_tracks = seedTracks.join(',');
      }
      if (seedArtists && seedArtists.length > 0) {
        params.seed_artists = seedArtists.join(',');
      }
      if (seedGenres && seedGenres.length > 0) {
        params.seed_genres = seedGenres.join(',');
      }
      
      const data = await this.makeRequest('/recommendations', params);
      
      if (!data.tracks) {
        logger.info('No Spotify recommendations found');
        return [];
      }
      
      const tracks: SpotifySearchResult[] = data.tracks.map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url || '',
        popularity: track.popularity,
        explicit: track.explicit,
        release_date: track.album.release_date,
        isrc: track.external_ids?.isrc
      }));
      
      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(tracks), this.CACHE_TTL);
      
      logger.info(`Spotify recommendations retrieved`, { 
        tracksCount: tracks.length 
      });
      
      return tracks;
    } catch (error) {
      logger.error('Spotify recommendations error:', error);
      throw new ExternalServiceError('Failed to get Spotify recommendations');
    }
  }
}