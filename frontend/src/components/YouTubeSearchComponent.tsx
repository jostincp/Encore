'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { youtubeMusicAPI, YouTubeVideo, YouTubeSearchResponse } from '../services/youtubeMusicAPI';

interface YouTubeSearchComponentProps {
  onVideoSelect?: (video: YouTubeVideo) => void;
  maxResults?: number;
  placeholder?: string;
  showTrending?: boolean;
  className?: string;
}

export const YouTubeSearchComponent: React.FC<YouTubeSearchComponentProps> = ({
  onVideoSelect,
  maxResults = 10,
  placeholder = "Search for music...",
  showTrending = true,
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [trending, setTrending] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    cached: boolean;
    cacheSource: 'client' | 'server' | 'none';
  }>({ cached: false, cacheSource: 'none' });

  // Load trending videos on component mount
  useEffect(() => {
    if (showTrending) {
      loadTrendingVideos();
    }
  }, [showTrending]);

  const loadTrendingVideos = useCallback(async () => {
    try {
      setTrendingLoading(true);
      setError(null);
      
      const response = await youtubeMusicAPI.getTrendingMusic();
      
      if (response.success) {
        setTrending(response.data.videos.slice(0, 5)); // Show only top 5
      }
    } catch (err) {
      console.error('Failed to load trending videos:', err);
      // Don't set error for trending, just fail silently
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await youtubeMusicAPI.searchVideos(searchQuery, {
        maxResults,
        useClientCache: true
      });
      
      if (response.success) {
        setResults(response.data.videos);
        setCacheInfo({
          cached: response.cached,
          cacheSource: response.cacheSource
        });
      } else {
        throw new Error(response.message || 'Search failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleVideoClick = (video: YouTubeVideo) => {
    if (onVideoSelect) {
      onVideoSelect(video);
    }
  };

  const formatDuration = (duration?: string): string => {
    if (!duration) return '';
    
    // Parse ISO 8601 duration (PT4M13S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (viewCount?: number): string => {
    if (!viewCount) return '';
    
    if (viewCount >= 1000000) {
      return `${(viewCount / 1000000).toFixed(1)}M views`;
    } else if (viewCount >= 1000) {
      return `${(viewCount / 1000).toFixed(1)}K views`;
    }
    return `${viewCount} views`;
  };

  return (
    <div className={`youtube-search-component ${className}`}>
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Cache Info */}
      {cacheInfo.cached && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          ⚡ Results from {cacheInfo.cacheSource} cache
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Trending Videos */}
      {showTrending && !query && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            🔥 Trending Music
            {trendingLoading && (
              <div className="ml-2 animate-spin h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full"></div>
            )}
          </h3>
          {trending.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trending.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleVideoClick(video)}
                  className="cursor-pointer bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {video.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {video.channel}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !trendingLoading && (
              <p className="text-gray-500 text-sm">No trending videos available</p>
            )
          )}
        </div>
      )}

      {/* Search Results */}
      {query && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Search Results ({results.length})
          </h3>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleVideoClick(video)}
                  className="cursor-pointer bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-blue-300"
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate mb-1">
                        {video.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {video.channel}
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        {video.duration && (
                          <span>⏱️ {formatDuration(video.duration)}</span>
                        )}
                        {video.viewCount && (
                          <span>👁️ {formatViewCount(video.viewCount)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVideoClick(video);
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition-colors text-sm"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-gray-500 text-center py-8">
                No videos found for "{query}"
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeSearchComponent;
