'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Music, Play, Plus, Clock, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { musicService, YouTubeVideo } from '@/services/musicService';

interface SongSearchProps {
  barId: string;
  userToken: string;
  onSongAdded?: () => void;
}

export function SongSearch({ barId, userToken, onSongAdded }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [trending, setTrending] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'trending'>('search');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cargar tendencias al montar
  useEffect(() => {
    loadTrending();
    loadSearchHistory();
  }, []);

  const loadTrending = async () => {
    setLoadingTrending(true);
    try {
      const response = await musicService.getTrending('US');
      if (response.success) {
        setTrending(response.data.videos.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadSearchHistory = () => {
    const history = localStorage.getItem('encore_search_history');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveToSearchHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('encore_search_history', JSON.stringify(newHistory));
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await musicService.searchSongs(query, 20);
      
      if (response.success) {
        setResults(response.data.videos);
        saveToSearchHistory(query);
        
        showToast('success', `Se encontraron ${response.data.videos.length} canciones`);
      }
    } catch (error) {
      console.error('Search error:', error);
      showToast('error', error instanceof Error ? error.message : "No se pudo completar la búsqueda");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleAddToQueue = async (song: YouTubeVideo, priority: boolean = false) => {
    try {
      const result = await musicService.addToQueue(song, barId, userToken, priority);
      
      if (result.success) {
        showToast('success', `${song.title} ha sido añadida a la cola${priority ? ' con prioridad' : ''}`);
        
        if (onSongAdded) {
          onSongAdded();
        }
      } else {
        throw new Error(result.message || 'No se pudo añadir la canción');
      }
    } catch (error) {
      console.error('Add to queue error:', error);
      showToast('error', error instanceof Error ? error.message : "No se pudo añadir a la cola");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const SongCard = ({ song, showTrendingBadge = false }: { song: YouTubeVideo; showTrendingBadge?: boolean }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-200 mb-3">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0">
          <img
            src={musicService.getHighQualityThumbnail(song.thumbnail)}
            alt={song.title}
            className="w-20 h-20 rounded-lg object-cover"
          />
          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-1 mb-1">
            {song.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            {song.artist}
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
              <Music className="w-3 h-3 mr-1" />
              YouTube
            </span>
            {showTrendingBadge && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                <TrendingUp className="w-3 h-3 mr-1" />
                Trending
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAddToQueue(song)}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Añadir
          </button>
          <button
            onClick={() => handleAddToQueue(song, true)}
            disabled={loading}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Clock className="w-4 h-4 inline mr-1" />
            Prioridad
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Toast Message */}
      {message && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Music className="w-8 h-8 text-blue-600" />
          Buscar Música
        </h1>
        <p className="text-gray-600">
          Busca tus canciones favoritas en YouTube y añádelas a la cola
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar canciones, artistas o álbumes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSearch} 
            disabled={loading || !query.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </button>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Búsquedas recientes:</span>
            {searchHistory.map((term, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(term);
                  handleSearch();
                }}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Resultados de búsqueda {results.length > 0 && `(${results.length})`}
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tendencias {trending.length > 0 && `(${trending.length})`}
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'search' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                <span>Buscando canciones...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((song) => (
                  <SongCard key={song.id} song={song} />
                ))}
              </div>
            ) : query ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No se encontraron resultados</h3>
                <p className="text-gray-600">
                  Intenta con diferentes palabras clave o revisa la ortografía
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">Comienza una búsqueda</h3>
                <p className="text-gray-600">
                  Escribe el nombre de una canción, artista o álbum para buscar
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'trending' && (
          <>
            {loadingTrending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                <span>Cargando tendencias...</span>
              </div>
            ) : trending.length > 0 ? (
              <div className="space-y-3">
                {trending.map((song) => (
                  <SongCard key={song.id} song={song} showTrendingBadge />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No hay tendencias disponibles</h3>
                <p className="text-gray-600">
                  Intenta más tarde o realiza una búsqueda manual
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SongSearch;
