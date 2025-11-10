import React, { useState, useEffect } from 'react';
import { Music, Search, List, Play, Settings } from 'lucide-react';
import YouTubePlayer from '../components/YouTubePlayer';
import YouTubeSearch from '../components/YouTubeSearch';
import YouTubePlaylistManager from '../components/YouTubePlaylistManager';
import { cn } from '../lib/utils';
import { youtubeApiService, YouTubeVideo } from '../services/youtubeApi';

// YouTubeVideo interface now imported from youtubeApi service

const YouTubePlayerPage: React.FC = () => {
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'player'>('search');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barId, setBarId] = useState<string>('1'); // Default bar ID
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleVideoSelect = (video: YouTubeVideo) => {
    setCurrentVideoId(video.id);
    setCurrentVideo(video);
    setActiveTab('player');
    setError(null);
  };

  const handleAddToQueue = async (video: YouTubeVideo) => {
    if (!barId) {
      setError('Por favor selecciona un bar primero');
      return;
    }

    setIsLoading(true);
    try {
      await youtubeApiService.addToQueue(video.id, barId);
      console.log('Added to queue:', video.title);
      // Here you would typically show a success toast
    } catch (error) {
      console.error('Error adding to queue:', error);
      setError('Error al agregar a la cola');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayerError = (error: any) => {
    console.error('YouTube player error:', error);
    setError('Error playing video. Please try another video.');
  };

  const tabs = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'playlists', label: 'Playlists', icon: List },
    { id: 'player', label: 'Player', icon: Play }
  ];

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('encore_access_token') : null;
    setIsAuthenticated(!!token);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Acceso restringido</h1>
          <p className="text-gray-300">Debes iniciar sesión para usar el reproductor y la cola.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Music className="w-8 h-8 text-red-500 mr-3" />
              <h1 className="text-xl font-bold text-white">YouTube Music Player</h1>
            </div>
            
            {/* Bar Selection */}
            <div className="flex items-center space-x-4">
              <select
                value={barId}
                onChange={(e) => setBarId(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="1">Bar 1</option>
                <option value="2">Bar 2</option>
                <option value="3">Bar 3</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm transition-colors',
                    activeTab === tab.id
                      ? 'border-red-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'search' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Search YouTube Music</h2>
                <YouTubeSearch
                  onVideoSelect={handleVideoSelect}
                  onAddToQueue={handleAddToQueue}
                  className="mb-6"
                  placeholder="Search for songs, artists, or music videos..."
                />
              </div>
            )}

            {activeTab === 'playlists' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">YouTube Playlists</h2>
                <YouTubePlaylistManager
                  barId={barId}
                  onVideoSelect={handleVideoSelect}
                  className="mb-6"
                />
              </div>
            )}

            {activeTab === 'player' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Now Playing</h2>
                {currentVideoId ? (
                  <div className="space-y-6">
                    <YouTubePlayer
                      videoId={currentVideoId}
                      onError={handlePlayerError}
                      className="w-full aspect-video rounded-lg overflow-hidden"
                      showControls={true}
                      autoplay={true}
                    />
                    
                    {currentVideo && (
                      <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-xl font-semibold text-white mb-2">{currentVideo.title}</h3>
                        <p className="text-gray-400 mb-4">{currentVideo.channelTitle}</p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {currentVideo.viewCount}
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {currentVideo.duration}
                          </span>
                        </div>
                        
                        <div className="mt-4">
                          <button
                            onClick={() => handleAddToQueue(currentVideo)}
                            disabled={isLoading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded transition-colors"
                          >
                            {isLoading ? 'Adding...' : 'Add to Queue'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-400 mb-2">No video selected</h3>
                    <p className="text-gray-500 mb-4">Search for a song or select one from your playlists to start playing.</p>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Search for Music
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Quick Actions
              </h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => setActiveTab('search')}
                  className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center"
                >
                  <Search className="w-4 h-4 mr-3" />
                  Search Music
                </button>
                
                <button
                  onClick={() => setActiveTab('playlists')}
                  className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center"
                >
                  <List className="w-4 h-4 mr-3" />
                  Manage Playlists
                </button>
                
                {currentVideoId && (
                  <button
                    onClick={() => setActiveTab('player')}
                    className="w-full text-left px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center"
                  >
                    <Play className="w-4 h-4 mr-3" />
                    Now Playing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubePlayerPage;