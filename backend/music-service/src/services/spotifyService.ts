import axios, { AxiosInstance } from 'axios';
import { redisHelpers } from '../config/redis';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  audio_features?: {
    energy: number;
    danceability: number;
    valence: number;
    tempo: number;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface SpotifyRecommendationsResponse {
  tracks: SpotifyTrack[];
}

export class SpotifyService {
  private static instance: SpotifyService;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private constructor() {
    this.client = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  public static getInstance(): SpotifyService {
    if (!SpotifyService.instance) {
      SpotifyService.instance = new SpotifyService();
    }
    return SpotifyService.instance;
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if current token is still valid
      if (this.accessToken && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      // Check cache first
      const cachedToken = await redisHelpers.get('spotify:access_token');
      if (cachedToken && cachedToken.expires_at > Date.now()) {
        this.accessToken = cachedToken.token;
        this.tokenExpiresAt = cachedToken.expires_at;
        return this.accessToken;
      }

      // Get new token using client credentials flow
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('Spotify credentials not configured');
        return null;
      }

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
        }
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in * 1000) - 60000; // 1 minute buffer

      this.accessToken = access_token;
      this.tokenExpiresAt = expiresAt;

      // Cache the token
      await redisHelpers.set(
        'spotify:access_token',
        { token: access_token, expires_at: expiresAt },
        expires_in - 60 // Cache for slightly less time
      );

      return access_token;
    } catch (error) {
      console.error('Failed to get Spotify access token:', error);
      return null;
    }
  }

  public static async searchTracks(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const instance = SpotifyService.getInstance();
    const { limit = 20, offset = 0 } = options;

    try {
      const cacheKey = `spotify:search:${query}:${limit}:${offset}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await instance.client.get<SpotifySearchResponse>('/search', {
        params: {
          q: query,
          type: 'track',
          limit,
          offset,
          market: 'US',
        },
      });

      const tracks = response.data.tracks.items.map(track => ({
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
      }));

      // Cache results for 5 minutes
      await redisHelpers.set(cacheKey, tracks, 300);

      return tracks;
    } catch (error) {
      console.error('Spotify search error:', error);
      throw new Error('Failed to search Spotify tracks');
    }
  }

  public static async getTrackDetails(trackId: string): Promise<any> {
    const instance = SpotifyService.getInstance();

    try {
      const cacheKey = `spotify:track:${trackId}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const [trackResponse, featuresResponse] = await Promise.all([
        instance.client.get<SpotifyTrack>(`/tracks/${trackId}`),
        instance.client.get(`/audio-features/${trackId}`).catch(() => null),
      ]);

      const track = trackResponse.data;
      const features = featuresResponse?.data;

      const trackDetails = {
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
        audio_features: features ? {
          energy: features.energy,
          danceability: features.danceability,
          valence: features.valence,
          tempo: features.tempo,
        } : undefined,
      };

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, trackDetails, 3600);

      return trackDetails;
    } catch (error) {
      console.error('Spotify track details error:', error);
      throw new Error('Failed to get Spotify track details');
    }
  }

  public static async getRecommendations(
    seedTracks?: string[],
    seedArtists?: string[],
    seedGenres?: string[],
    audioFeatures?: Record<string, number>,
    limit: number = 20
  ): Promise<any[]> {
    const instance = SpotifyService.getInstance();

    try {
      const params: any = { limit };

      if (seedTracks?.length) {
        params.seed_tracks = seedTracks.slice(0, 5).join(',');
      }
      if (seedArtists?.length) {
        params.seed_artists = seedArtists.slice(0, 5).join(',');
      }
      if (seedGenres?.length) {
        params.seed_genres = seedGenres.slice(0, 5).join(',');
      }

      // Add audio feature targets
      if (audioFeatures) {
        Object.entries(audioFeatures).forEach(([key, value]) => {
          params[`target_${key}`] = value;
        });
      }

      const response = await instance.client.get<SpotifyRecommendationsResponse>(
        '/recommendations',
        { params }
      );

      return response.data.tracks.map(track => ({
        id: `spotify:track:${track.id}`,
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        thumbnail_url: track.album.images[0]?.url,
        source: 'spotify',
        release_date: track.album.release_date,
      }));
    } catch (error) {
      console.error('Spotify recommendations error:', error);
      throw new Error('Failed to get Spotify recommendations');
    }
  }

  public static async getFeaturedPlaylists(limit: number = 20): Promise<any[]> {
    const instance = SpotifyService.getInstance();

    try {
      const cacheKey = `spotify:featured:${limit}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await instance.client.get('/browse/featured-playlists', {
        params: { limit, country: 'US' },
      });

      const playlists = response.data.playlists.items.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        external_url: playlist.external_urls.spotify,
        thumbnail_url: playlist.images[0]?.url,
        tracks_count: playlist.tracks.total,
      }));

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, playlists, 3600);

      return playlists;
    } catch (error) {
      console.error('Spotify featured playlists error:', error);
      throw new Error('Failed to get Spotify featured playlists');
    }
  }

  public static async getNewReleases(limit: number = 20): Promise<any[]> {
    const instance = SpotifyService.getInstance();

    try {
      const cacheKey = `spotify:new_releases:${limit}`;
      const cached = await redisHelpers.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await instance.client.get('/browse/new-releases', {
        params: { limit, country: 'US' },
      });

      const albums = response.data.albums.items.map((album: any) => ({
        id: album.id,
        name: album.name,
        artist: album.artists.map((a: any) => a.name).join(', '),
        external_url: album.external_urls.spotify,
        thumbnail_url: album.images[0]?.url,
        release_date: album.release_date,
        total_tracks: album.total_tracks,
      }));

      // Cache for 1 hour
      await redisHelpers.set(cacheKey, albums, 3600);

      return albums;
    } catch (error) {
      console.error('Spotify new releases error:', error);
      throw new Error('Failed to get Spotify new releases');
    }
  }
}

export default SpotifyService;