'use client';

import React, { useState, useEffect } from 'react';
import { SongSearch } from '@/components/SongSearchSimple';
import { Music, Users, Clock, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';
import { musicService } from '@/services/musicService';

interface QueueItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  addedBy: string;
  addedAt: string;
  isPriority: boolean;
  position: number;
}

interface QueueServiceItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  addedBy: string;
  addedAt: string;
  isPriority: boolean;
}

interface MusicPageProps {
  barId: string;
  userToken: string;
  userName: string;
  userPoints: number;
}

export function MusicPage({ barId, userToken, userName, userPoints }: MusicPageProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [currentSong, setCurrentSong] = useState<QueueItem | null>(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    priorityItems: 0,
    estimatedWaitTime: 0
  });

  // Cargar cola actual
  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      // Usar el Queue Service real
      const response = await musicService.getQueue(barId);
      
      if (response.success) {
        const queueData = response.data.queue.map((item: QueueServiceItem, index: number) => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          thumbnail: item.thumbnail,
          addedBy: item.addedBy,
          addedAt: item.addedAt,
          isPriority: item.isPriority,
          position: index + 1
        }));

        setQueue(queueData);
        setCurrentSong(queueData[0] || null);
        
        const priorityCount = queueData.filter(item => item.isPriority).length;
        setStats({
          totalItems: queueData.length,
          priorityItems: priorityCount,
          estimatedWaitTime: queueData.length * 4 // 4 minutos por canción
        });
      }
    } catch (error) {
      console.error('Error loading queue:', error);
      // En caso de error, usar datos simulados
      const mockQueue: QueueItem[] = [
        {
          id: '1',
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
          addedBy: 'Juan Pérez',
          addedAt: '2024-01-15T20:30:00Z',
          isPriority: true,
          position: 1
        }
      ];

      setQueue(mockQueue);
      setCurrentSong(mockQueue[0] || null);
      
      setStats({
        totalItems: mockQueue.length,
        priorityItems: mockQueue.filter(item => item.isPriority).length,
        estimatedWaitTime: mockQueue.length * 4
      });
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadQueue();
    
    // Simular actualización en tiempo real
    const interval = setInterval(loadQueue, 30000); // Cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const handleSongAdded = () => {
    loadQueue(); // Recargar cola cuando se añade una canción
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Music className="w-10 h-10 text-blue-600" />
                Encore Music
              </h1>
              <p className="text-gray-600 text-lg mt-2">
                Rockola digital del bar
              </p>
            </div>
            
            {/* User Info */}
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-medium">{userName}</span>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                {userPoints} puntos disponibles
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Búsqueda - Columna principal */}
          <div className="lg:col-span-2">
            <SongSearch
              barId={barId}
              userToken={userToken}
              onSongAdded={handleSongAdded}
            />
          </div>

          {/* Cola actual - Columna lateral */}
          <div className="space-y-6">
            {/* Canción actual */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-green-500" />
                  Sonando ahora
                </h2>
              </div>
              {currentSong ? (
                <div className="flex gap-3">
                  <img
                    src={musicService.getHighQualityThumbnail(currentSong.thumbnail)}
                    alt={currentSong.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold line-clamp-1">
                      {currentSong.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {currentSong.artist}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Añadida por {currentSong.addedBy}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay canción reproduciéndose</p>
                </div>
              )}
            </div>

            {/* Cola de reproducción */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Cola de reproducción
                </h2>
                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                  {stats.totalItems} canciones
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Tiempo estimado: {stats.estimatedWaitTime} minutos
              </div>
              
              {loadingQueue ? (
                <div className="text-center py-4 text-gray-500">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm">Cargando cola...</p>
                </div>
              ) : queue.length > 1 ? ( // Excluyendo la canción actual
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {queue.slice(1).map((song, index) => (
                    <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 w-6 text-center">
                        <span className="text-sm font-medium text-gray-600">
                          {index + 1}
                        </span>
                      </div>
                      <img
                        src={musicService.getHighQualityThumbnail(song.thumbnail)}
                        alt={song.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {song.title}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {song.artist} • {song.addedBy}
                        </p>
                      </div>
                      {song.isPriority && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          Prioridad
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">La cola está vacía</p>
                  <p className="text-xs">¡Añade canciones para empezar!</p>
                </div>
              )}
            </div>

            {/* Estadísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Estadísticas</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Canciones en cola</span>
                  <span className="font-medium">{stats.totalItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Canciones prioritarias</span>
                  <span className="font-medium">{stats.priorityItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tiempo de espera</span>
                  <span className="font-medium">{stats.estimatedWaitTime} min</span>
                </div>
                <hr className="my-3" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Costo por canción</span>
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    10 puntos
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Costo prioritario</span>
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    25 puntos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MusicPage;
