import React, { useState, useEffect, useRef } from 'react';
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

const PlayerPage: React.FC = () => {
  const router = useRouter();
  const { barId } = router.query;
  const playerRef = useRef<any>(null);

  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Cargar estado inicial
  useEffect(() => {
    if (barId) {
      loadQueueState();
      // Conectar WebSocket para actualizaciones en tiempo real
      connectWebSocket();
    }
  }, [barId]);

  const loadQueueState = async () => {
    if (!barId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/queue/bars/${barId}/state`);
      if (response.ok) {
        const data = await response.json();
        setQueueState(data.data);
      }
    } catch (error) {
      console.error('Error loading queue state:', error);
      toast.error('Error al cargar estado de la cola');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWebSocket = () => {
    // TODO: Implementar conexión WebSocket
    console.log('WebSocket connection would be established here');
  };

  const handleNextTrack = async () => {
    if (!barId) return;

    try {
      const response = await fetch(`/api/queue/bars/${barId}/next-track`);
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setQueueState(prev => prev ? { ...prev, current: data.data } : null);
          // Cargar nueva canción en el reproductor
          loadVideo(data.data.videoId);
          toast.success('Siguiente canción cargada');
        } else {
          toast.error('No hay más canciones en la cola');
        }
      }
    } catch (error) {
      console.error('Error getting next track:', error);
      toast.error('Error al obtener siguiente canción');
    }
  };

  const handleSkipTrack = async () => {
    if (!barId) return;

    try {
      const response = await fetch(`/api/queue/bars/${barId}/skip-track`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Saltado por administrador'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQueueState(prev => prev ? { ...prev, current: data.data } : null);
        loadVideo(data.data.videoId);
        toast.success('Canción saltada');
      }
    } catch (error) {
      console.error('Error skipping track:', error);
      toast.error('Error al saltar canción');
    }
  };

  const loadVideo = (videoId: string) => {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // YouTube Player events
  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(volume);

    // Auto-play if there's a current track
    if (queueState?.current) {
      loadVideo(queueState.current.videoId);
    }
  };

  const onPlayerStateChange = (event: any) => {
    const playerState = event.data;

    switch (playerState) {
      case 1: // Playing
        setIsPlaying(true);
        break;
      case 2: // Paused
        setIsPlaying(false);
        break;
      case 3: // Buffering
        break;
      case 0: // Ended
        // Auto-advance to next track
        handleNextTrack();
        break;
    }
  };

  const onPlayerError = (error: any) => {
    console.error('YouTube player error:', error);
    toast.error('Error en el reproductor de YouTube');
  };

  if (!barId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Acceso no autorizado
          </h1>
          <p className="text-gray-600">
            Solo administradores pueden acceder a esta página.
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
                Panel de Administración - Reproductor
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Bar ID: {barId}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadQueueState}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Actualizar Cola
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Player */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Reproductor de YouTube</h2>

              {/* YouTube Player Container */}
              <div className="aspect-video bg-black rounded-lg mb-4 overflow-hidden">
                <div id="youtube-player" className="w-full h-full"></div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayPause}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zM14 4h4v16h-4V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={handleNextTrack}
                    className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                    </svg>
                  </button>

                  <button
                    onClick={handleSkipTrack}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-600 w-8">{volume}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Queue Management */}
          <div className="space-y-6">
            {/* Current Track */}
            {queueState?.current && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Reproduciendo ahora</h3>
                <div className="flex items-center gap-3">
                  <img
                    src={queueState.current.thumbnail}
                    alt={queueState.current.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 line-clamp-2">
                      {queueState.current.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Fuente: {queueState.current.source}
                    </p>
                    <p className="text-sm text-gray-600">
                      Duración: {formatTime(queueState.current.duration)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Estado de la Cola</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Canciones prioritarias:</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    {queueState?.priority.length || 0}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Canciones estándar:</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {queueState?.standard.length || 0}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total activas:</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                    {queueState?.activeVideoIds.length || 0}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={loadQueueState}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>

              <div className="space-y-3">
                <button
                  onClick={handleNextTrack}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Siguiente Canción
                </button>

                <button
                  onClick={handleSkipTrack}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Saltar Canción
                </button>

                <button
                  onClick={() => router.push(`/admin/queue/${barId}`)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Gestionar Cola
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Load YouTube IFrame API */}
      <script src="https://www.youtube.com/iframe_api"></script>
    </div>
  );
};

export default PlayerPage;