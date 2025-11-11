import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { useQueueWebSocket } from '../../hooks/useWebSocket';

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
  isPremium: boolean;
}

interface QueueState {
  current?: {
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    source: string;
  };
  priority: Array<{
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    userId: string;
  }>;
  standard: Array<{
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    userId: string;
  }>;
  activeVideoIds: string[];
}

const MusicSearchPage: React.FC = () => {
  const router = useRouter();
  const { b: barId, t: tableId } = router.query;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // WebSocket para actualizaciones en tiempo real
  const {
    isConnected: wsConnected,
    songAdded,
    trackChanged,
    clearUpdates
  } = useQueueWebSocket(barId as string);

  // Cargar estado inicial de la cola
  useEffect(() => {
    if (barId) {
      loadQueueState();
    }
  }, [barId]);

  // Manejar eventos WebSocket
  useEffect(() => {
    if (songAdded) {
      toast.success('¡Canción añadida a la cola!');
      loadQueueState(); // Recargar estado de la cola
      clearUpdates();
    }
  }, [songAdded, clearUpdates]);

  useEffect(() => {
    if (trackChanged) {
      toast.info('¡Nueva canción en reproducción!');
      loadQueueState(); // Recargar estado de la cola
      clearUpdates();
    }
  }, [trackChanged, clearUpdates]);

  const loadQueueState = async () => {
    if (!barId) return;

    setIsLoadingQueue(true);
    try {
      const response = await fetch(`/api/queue/bars/${barId}/state`);
      if (response.ok) {
        const data = await response.json();
        setQueueState(data.data);
      }
    } catch (error) {
      console.error('Error loading queue state:', error);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !barId) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/music/search?q=${encodeURIComponent(searchQuery)}&barId=${barId}`
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      } else {
        toast.error('Error al buscar música');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToQueue = async (song: YouTubeSearchResult, priority: boolean = false) => {
    if (!barId) return;

    try {
      const response = await fetch('/api/queue/enhanced-add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bar_id: barId,
          song_id: song.videoId,
          priority_play: priority,
          points_used: priority ? 10 : 5, // Costos de ejemplo
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          priority
            ? 'Canción añadida a cola prioritaria'
            : 'Canción añadida a cola estándar'
        );
        // Recargar estado de la cola
        loadQueueState();
      } else {
        if (data.error_code === 'INSUFFICIENT_POINTS') {
          toast.error('Puntos insuficientes para añadir esta canción');
        } else if (data.error_code === 'SONG_ALREADY_QUEUED') {
          toast.error('Esta canción ya está en la cola');
        } else {
          toast.error(data.message || 'Error al añadir canción');
        }
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast.error('Error de conexión');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isSongInQueue = (videoId: string): boolean => {
    if (!queueState) return false;
    return queueState.activeVideoIds.includes(videoId);
  };

  if (!barId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Código QR requerido
          </h1>
          <p className="text-gray-600">
            Escanea el código QR del bar para acceder a la búsqueda de música.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Buscar Música
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Bar ID: {barId} {tableId && `| Mesa: ${tableId}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {wsConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar canciones, artistas, álbumes..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Queue Status */}
        {queueState && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Estado de la Cola</h2>

            {/* Currently Playing */}
            {queueState.current && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Reproduciendo ahora:</h3>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <img
                    src={queueState.current.thumbnail}
                    alt={queueState.current.title}
                    className="w-12 h-12 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-green-800">{queueState.current.title}</p>
                    <p className="text-sm text-green-600">{queueState.current.source}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Prioritarias:</span> {queueState.priority.length}
              </div>
              <div>
                <span className="font-medium">Estándar:</span> {queueState.standard.length}
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                Resultados de búsqueda ({searchResults.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {searchResults.map((song) => (
                <div key={song.videoId} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-16 h-16 rounded object-cover"
                    />

                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 line-clamp-2">
                        {song.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>Duración: {formatDuration(song.duration)}</span>
                        {song.isPremium && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                            Premium
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isSongInQueue(song.videoId) ? (
                        <span className="px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
                          Ya en cola
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAddToQueue(song, false)}
                            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Añadir (5 pts)
                          </button>
                          <button
                            onClick={() => handleAddToQueue(song, true)}
                            className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                          >
                            Prioridad (10 pts)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty States */}
        {searchResults.length === 0 && searchQuery && !isSearching && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron resultados
            </h3>
            <p className="text-gray-600">
              Intenta con otros términos de búsqueda
            </p>
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Busca tu música favorita
            </h3>
            <p className="text-gray-600">
              Encuentra canciones, artistas y álbumes para añadir a la cola
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicSearchPage;