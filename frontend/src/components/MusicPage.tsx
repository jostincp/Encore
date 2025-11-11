'use client';

import React, { useState, useEffect } from 'react';
import { SongSearch } from '@/components/SongSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
      // Simulación - en producción llamaría al Queue Service
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
        },
        {
          id: '2',
          title: 'Stairway to Heaven',
          artist: 'Led Zeppelin',
          thumbnail: 'https://i.ytimg.com/vi/9QZV3u2G71Y/mqdefault.jpg',
          addedBy: 'María García',
          addedAt: '2024-01-15T20:25:00Z',
          isPriority: false,
          position: 2
        }
      ];

      setQueue(mockQueue);
      setCurrentSong(mockQueue[0] || null);
      
      const priorityCount = mockQueue.filter(item => item.isPriority).length;
      setStats({
        totalItems: mockQueue.length,
        priorityItems: priorityCount,
        estimatedWaitTime: mockQueue.length * 4 // 4 minutos por canción
      });
    } catch (error) {
      console.error('Error loading queue:', error);
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Music className="w-10 h-10 text-primary" />
                Encore Music
              </h1>
              <p className="text-muted-foreground text-lg mt-2">
                Rockola digital del bar
              </p>
            </div>
            
            {/* User Info */}
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-medium">{userName}</span>
              </div>
              <Badge variant="secondary" className="text-sm">
                {userPoints} puntos disponibles
              </Badge>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-green-500" />
                  Sonando ahora
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                      <p className="text-sm text-muted-foreground">
                        {currentSong.artist}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Añadida por {currentSong.addedBy}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay canción reproduciéndose</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cola de reproducción */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Cola de reproducción
                  </CardTitle>
                  <Badge variant="outline">
                    {stats.totalItems} canciones
                  </Badge>
                </div>
                <CardDescription>
                  Tiempo estimado: {stats.estimatedWaitTime} minutos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQueue ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm">Cargando cola...</p>
                  </div>
                ) : queue.length > 1 ? ( // Excluyendo la canción actual
                  <div className="space-y-3">
                    {queue.slice(1).map((song, index) => (
                      <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                        <div className="flex-shrink-0 w-6 text-center">
                          <span className="text-sm font-medium text-muted-foreground">
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
                          <p className="text-xs text-muted-foreground">
                            {song.artist} • {song.addedBy}
                          </p>
                        </div>
                        {song.isPriority && (
                          <Badge variant="default" className="text-xs">
                            Prioridad
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">La cola está vacía</p>
                    <p className="text-xs">¡Añade canciones para empezar!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Estadísticas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Estadísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Canciones en cola</span>
                  <span className="font-medium">{stats.totalItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Canciones prioritarias</span>
                  <span className="font-medium">{stats.priorityItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tiempo de espera</span>
                  <span className="font-medium">{stats.estimatedWaitTime} min</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costo por canción</span>
                  <Badge variant="secondary">10 puntos</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costo prioritario</span>
                  <Badge variant="default">25 puntos</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MusicPage;
