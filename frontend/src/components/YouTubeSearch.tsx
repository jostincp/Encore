import React, { useState, useEffect, useCallback } from 'react';
import { Search, Play, Plus, Clock, Eye, ThumbsUp, Music } from 'lucide-react';
import { cn } from '../lib/utils';
import { debounce } from '../lib/utils';
import { youtubeApiService, YouTubeVideo } from '../services/youtubeApi';

// YouTubeVideo interface now imported from youtubeApi service

interface YouTubeSearchProps {
  onVideoSelect?: (video: YouTubeVideo) => void;
  onAddToQueue?: (video: YouTubeVideo) => void;
  onAddToPlaylist?: (video: YouTubeVideo, playlistId: string) => void;
  className?: string;
  maxResults?: number;
  placeholder?: string;
  showAddButtons?: boolean;
  availablePlaylists?: Array<{ id: string; name: string }>;
}

const YouTubeSearch: React.FC<YouTubeSearchProps> = ({
  onVideoSelect,
  onAddToQueue,
  onAddToPlaylist,
  className,
  maxResults = 10,
  placeholder = "Search for songs, artists, or music videos...",
  showAddButtons = true,
  availablePlaylists = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState<string | null>(null);

  const formatDuration = (duration: string) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: string) => {
    const number = parseInt(num);
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(1)}M`;
    } else if (number >= 1000) {
      return `${(number / 1000).toFixed(1)}K`;
    }
    return number.toString();
  };

  const searchYouTube = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Utilizar el servicio tipado que apunta a music-service
      const results = await youtubeApiService.searchVideos(query, maxResults);
      setSearchResults(results);
    } catch (error) {
      console.error('YouTube search error:', error);
      setError('Error al buscar videos. Por favor, intenta de nuevo.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setError(null);
        const results = await youtubeApiService.searchVideos(query);
        setSearchResults(results);
      } catch (err) {
        setError('Error al buscar videos. Por favor, intenta de nuevo.');
        console.error('Search error:', err);
      }
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const handleVideoSelect = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    if (onVideoSelect) {
      onVideoSelect(video);
    }
  };

  const handleAddToQueue = (video: YouTubeVideo) => {
    if (onAddToQueue) {
      onAddToQueue(video);
    }
  };

  const handleAddToPlaylist = (video: YouTubeVideo, playlistId: string) => {
    if (onAddToPlaylist) {
      onAddToPlaylist(video, playlistId);
    }
    setShowPlaylistDropdown(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchYouTube(searchTerm);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>
        
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            ×
          </button>
        )}
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        )}

        {!isLoading && searchResults.length === 0 && searchTerm && (
          <div className="text-center py-8 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No results found for "{searchTerm}"</p>
          </div>
        )}

        {!isLoading && searchResults.map((video) => (
          <div
            key={video.id}
            className={cn(
              'p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer',
              selectedVideo?.id === video.id && 'ring-2 ring-red-600 bg-gray-750'
            )}
            onClick={() => handleVideoSelect(video)}
          >
            <div className="flex gap-3">
              {/* Thumbnail */}
              <div className="flex-shrink-0 relative">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-24 h-16 object-cover rounded"
                />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                  {formatDuration(video.duration)}
                </div>
              </div>

              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                  {video.title}
                </h3>
                <p className="text-gray-400 text-xs mb-2 line-clamp-1">
                  {video.channelTitle}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatNumber(video.viewCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" />
                    {formatNumber(video.likeCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(video.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {showAddButtons && (
                <div className="flex flex-col gap-2">
                  {onAddToQueue && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToQueue(video);
                      }}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      title="Add to queue"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}

                  {onAddToPlaylist && availablePlaylists.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPlaylistDropdown(showPlaylistDropdown === video.id ? null : video.id);
                        }}
                        className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                        title="Add to playlist"
                      >
                        <Music className="w-4 h-4" />
                      </button>

                      {showPlaylistDropdown === video.id && (
                        <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-48">
                          <div className="p-2">
                            <p className="text-white text-sm font-medium mb-2">Add to playlist:</p>
                            {availablePlaylists.map((playlist) => (
                              <button
                                key={playlist.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToPlaylist(video, playlist.id);
                                }}
                                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-700 rounded text-sm"
                              >
                                {playlist.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Click outside to close dropdown */}
      {showPlaylistDropdown && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowPlaylistDropdown(null)}
        />
      )}
    </div>
  );
};

export default YouTubeSearch;