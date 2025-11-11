import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

interface Track {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
  source: 'priority' | 'standard' | 'fallback';
  userId?: string;
  barId: string;
  addedAt?: string;
}

interface QueueState {
  current?: Track;
  priority: Track[];
  standard: Track[];
  activeVideoIds: string[];
}

interface QueueStats {
  totalSongs: number;
  priorityCount: number;
  standardCount: number;
  activeUsers: number;
}

const QueueManagementPage: React.FC = () => {
  const router = useRouter();
  const { barId } = router.query;

  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'priority' | 'standard'>('overview');

  useEffect(() => {
    if (barId) {
      loadData();
    }
  }, [barId]);

  const loadData = async () => {
    if (!barId) return;

    setIsLoading(true);
    try {
      const [queueResponse, statsResponse] = await Promise.all([
        fetch(`/api/queue/bars/${barId}/state`),
        fetch(`/api/queue/bars/${barId}/queue-stats`)
      ]);

      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setQueueState(queueData.data);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setQueueStats(statsData.data);
      }
    } catch (error) {
      console.error('Error loading queue data:', error);
      toast.error('Error al cargar datos de la cola');
    } finally {
      setIsLoading(false);
    }
  };

  const clearQueue = async () => {
    if (!barId) return;

    if (!confirm('¿Estás seguro de que quieres limpiar toda la cola?')) return;

    try {
      const response = await fetch(`/api/queue/bars/${barId}/clear`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Cola limpiada exitosamente');
        loadData();
      } else {
        toast.error('Error al limpiar la cola');
      }
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast.error('Error de conexión');
    }
  };

  const skipCurrentSong = async () => {
    if (!barId) return;

    try {
      const response = await fetch(`/api/queue/bars/${barId}/skip-track`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Saltado desde panel de administración'
        }),
      });

      if (response.ok) {
        toast.success('Canción saltada');
        loadData();
      } else {
        toast.error('Error al saltar canción');
      }
    } catch (error) {
      console.error('Error skipping song:', error);
      toast.error('Error de conexión');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getSourceColor = (source: string): string => {
    switch (source) {
      case 'priority': return 'bg-yellow-100 text-yellow-800';
      case 'standard': return 'bg-blue-100 text-blue-800';
      case 'fallback': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!barId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Bar ID requerido
          </h1>
          <p className="text-gray-600">
            Debes acceder desde el panel de administración con un Bar ID válido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestión de Cola Musical
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Bar ID: {barId}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? 'Cargando...' : 'Actualizar'}
              </button>
              <button
                onClick={() => router.push(`/admin/player/${barId}`)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Ir al Reproductor
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {queueStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Canciones</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStats.totalSongs}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Prioritarias</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStats.priorityCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Estándar</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStats.standardCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStats.activeUsers}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Track */}
        {queueState?.current && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Reproduciendo Ahora</h2>
              <button
                onClick={skipCurrentSong}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Saltar Canción
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={queueState.current.thumbnail}
                alt={queueState.current.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">
                  {queueState.current.title}
                </h3>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(queueState.current.source)}`}>
                    {queueState.current.source}
                  </span>
                  <span className="text-sm text-gray-600">
                    Duración: {formatTime(queueState.current.duration)}
                  </span>
                  {queueState.current.addedAt && (
                    <span className="text-sm text-gray-600">
                      Añadida: {formatDate(queueState.current.addedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue Management Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  selectedTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Vista General
              </button>
              <button
                onClick={() => setSelectedTab('priority')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  selectedTab === 'priority'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Cola Prioritaria ({queueState?.priority.length || 0})
              </button>
              <button
                onClick={() => setSelectedTab('standard')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  selectedTab === 'standard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Cola Estándar ({queueState?.standard.length || 0})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {selectedTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Resumen de Colas</h3>
                  <button
                    onClick={clearQueue}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Limpiar Toda la Cola
                  </button>
                </div>

                {/* Priority Queue Preview */}
                <div>
                  <h4 className="text-md font-medium mb-3 text-yellow-700">
                    Cola Prioritaria (Próximas {Math.min(5, queueState?.priority.length || 0)})
                  </h4>
                  {queueState?.priority.slice(0, 5).map((track, index) => (
                    <div key={track.videoId} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg mb-2">
                      <span className="text-sm font-medium text-yellow-700 w-6">#{index + 1}</span>
                      <img src={track.thumbnail} alt={track.title} className="w-10 h-10 rounded" />
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-1">{track.title}</p>
                        <p className="text-xs text-gray-600">{formatTime(track.duration)}</p>
                      </div>
                    </div>
                  ))}
                  {(!queueState?.priority || queueState.priority.length === 0) && (
                    <p className="text-gray-500 text-sm">No hay canciones prioritarias</p>
                  )}
                </div>

                {/* Standard Queue Preview */}
                <div>
                  <h4 className="text-md font-medium mb-3 text-blue-700">
                    Cola Estándar (Próximas {Math.min(5, queueState?.standard.length || 0)})
                  </h4>
                  {queueState?.standard.slice(0, 5).map((track, index) => (
                    <div key={track.videoId} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-2">
                      <span className="text-sm font-medium text-blue-700 w-6">#{index + 1}</span>
                      <img src={track.thumbnail} alt={track.title} className="w-10 h-10 rounded" />
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-1">{track.title}</p>
                        <p className="text-xs text-gray-600">{formatTime(track.duration)}</p>
                      </div>
                    </div>
                  ))}
                  {(!queueState?.standard || queueState.standard.length === 0) && (
                    <p className="text-gray-500 text-sm">No hay canciones estándar</p>
                  )}
                </div>
              </div>
            )}

            {/* Priority Queue Tab */}
            {selectedTab === 'priority' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Cola Prioritaria</h3>
                {queueState?.priority.map((track, index) => (
                  <div key={track.videoId} className="flex items-center gap-4 p-4 border-b border-gray-200">
                    <span className="text-lg font-bold text-yellow-600 w-8">#{index + 1}</span>
                    <img src={track.thumbnail} alt={track.title} className="w-16 h-16 rounded object-cover" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{track.title}</h4>
                      <p className="text-sm text-gray-600">Duración: {formatTime(track.duration)}</p>
                      {track.addedAt && (
                        <p className="text-sm text-gray-600">Añadida: {formatDate(track.addedAt)}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
                {(!queueState?.priority || queueState.priority.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No hay canciones en la cola prioritaria</p>
                )}
              </div>
            )}

            {/* Standard Queue Tab */}
            {selectedTab === 'standard' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Cola Estándar</h3>
                {queueState?.standard.map((track, index) => (
                  <div key={track.videoId} className="flex items-center gap-4 p-4 border-b border-gray-200">
                    <span className="text-lg font-bold text-blue-600 w-8">#{index + 1}</span>
                    <img src={track.thumbnail} alt={track.title} className="w-16 h-16 rounded object-cover" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{track.title}</h4>
                      <p className="text-sm text-gray-600">Duración: {formatTime(track.duration)}</p>
                      {track.addedAt && (
                        <p className="text-sm text-gray-600">Añadida: {formatDate(track.addedAt)}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
                {(!queueState?.standard || queueState.standard.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No hay canciones en la cola estándar</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueManagementPage;