'use client';

import { useEffect, useState } from 'react';
import MusicPage from '@/components/MusicPage';
import { useQRConnection } from '@/hooks/useQRConnection';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Loader2, AlertCircle, Link, Unlink, ArrowLeft, Music2, Search,
  TrendingUp, Clock, Shuffle, Play, Zap, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDuration, formatPoints } from '@/utils/format';
import { Song } from '@/types';
import axios from 'axios';
import Image from 'next/image';
import { API_URLS } from '@/utils/constants';
import { wsManager } from '@/utils/websocket';

// Mock data para el catálogo musical
const mockSongs: Song[] = [
  {
    id: '1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    duration: 355,
    thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Queen%20Bohemian%20Rhapsody%20album%20cover%20vintage%20rock%20music&image_size=square',
    genre: 'Rock',
    pointsCost: 50
  },
  {
    id: '2',
    title: 'Hotel California',
    artist: 'Eagles',
    duration: 391,
    thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Eagles%20Hotel%20California%20album%20cover%20classic%20rock&image_size=square',
    genre: 'Rock',
    pointsCost: 50
  },
  {
    id: '3',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    duration: 294,
    thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Michael%20Jackson%20Thriller%20album%20cover%20pop%20music&image_size=square',
    genre: 'Pop',
    pointsCost: 50
  },
  {
    id: '4',
    title: 'Sweet Child O Mine',
    artist: 'Guns N Roses',
    duration: 356,
    thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Guns%20N%20Roses%20rock%20album%20cover%20hard%20rock&image_size=square',
    genre: 'Rock',
    pointsCost: 50
  },
  {
    id: '5',
    title: 'Imagine',
    artist: 'John Lennon',
    duration: 183,
    thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=John%20Lennon%20Imagine%20album%20cover%20peaceful%20music&image_size=square',
    genre: 'Rock',
    pointsCost: 50
  }
];

export default function ClientMusicPage() {
  const { isConnected, disconnect, barId: storeBarId, tableNumber: storeTableNumber } = useQRConnection();

  const searchParams = useSearchParams();
  const paramBarId = searchParams?.get('barId');
  const paramTableNumber = searchParams?.get('table');

  const barId = storeBarId || paramBarId;
  const tableNumber = storeTableNumber || paramTableNumber;

  const router = useRouter();
  const { success, error } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [barInfo, setBarInfo] = useState<any>(null);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [queueDetails, setQueueDetails] = useState<Record<string, any>>({});
  const [nowPlaying, setNowPlaying] = useState<any | null>(null);
  const [points, setPoints] = useState<number>(100);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Obtener información del bar para personalizar experiencia
  useEffect(() => {
    if (barId) {
      // Guardar en localStorage para persistencia
      localStorage.setItem('currentBarId', barId);
      localStorage.setItem('currentTable', String(tableNumber || ''));

      // Fallback de información de bar en modo guest (sin auth-service)
      (async () => {
        try {
          const res = await fetch(`http://localhost:3001/api/bars/${barId}/info`, { method: 'GET' });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setBarInfo(data.data);
              if (data.data.primaryColor) {
                document.documentElement.style.setProperty('--primary', data.data.primaryColor);
              }
              if (data.data.secondaryColor) {
                document.documentElement.style.setProperty('--secondary', data.data.secondaryColor);
              }
              return;
            }
          }
        } catch (err) {
          // auth-service no disponible: usar valores por defecto
        }
        setBarInfo({ name: 'Rockola Digital', description: 'Bar de prueba', primaryColor: undefined, secondaryColor: undefined });
      })();
    }
  }, [barId, tableNumber]);

  // Obtener puntos reales del backend
  useEffect(() => {
    const fetchPoints = async () => {
      if (!barId || !tableNumber) return;

      try {
        const res = await fetch(`${API_URLS.musicBase}/points/${barId}/${tableNumber}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && typeof data.data.points === 'number') {
            setPoints(data.data.points);
          }
        }
      } catch (err) {
        console.error('Error fetching points:', err);
      }
    };

    fetchPoints();
    // Actualizar puntos cada 30 segundos
    const interval = setInterval(fetchPoints, 30000);
    return () => clearInterval(interval);
  }, [barId, tableNumber]);

  const fetchQueue = async () => {
    const currentBarId = barId || 'test-bar';
    try {
      // Obtener cola del queue-service (via proxy en music-service)
      const res = await fetch(`${API_URLS.musicBase}/queue/${currentBarId}`);
      const json = await res.json();

      // Los datos ya vienen con title, artist, thumbnail desde Redis
      const items = json?.data?.queue || json?.data || [];
      setQueueItems(items);

      // Convertir a formato de detalles para compatibilidad con UI
      const details: Record<string, any> = {};
      items.forEach((item: any) => {
        details[item.id || item.song_id] = {
          id: item.id || item.song_id,
          title: item.title || item.id || 'Unknown',
          artist: item.artist || 'Unknown Artist',
          thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.id || item.song_id}/hqdefault.jpg`
        };
      });
      setQueueDetails(details);
    } catch (e) {
      console.error('Error fetching queue:', e);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Polling como fallback
    const t = setInterval(fetchQueue, 10000);

    // Escuchar eventos de socket desde queue-service (3005)
    const handleQueueUpdate = () => {
      console.log('Socket queue update received, fetching queue...');
      fetchQueue();
    };

    const handleNowPlaying = (data: any) => {
      try { setNowPlaying(data); } catch { }
    };

    const handlePointsUpdate = (data: any) => {
      try {
        if (typeof data.points === 'number') setPoints(data.points);
      } catch { }
    };

    wsManager.on('queue-updated', handleQueueUpdate);
    wsManager.on('song-added', handleQueueUpdate);
    wsManager.on('queueUpdate', handleQueueUpdate); // Legacy event name support
    wsManager.on('nowPlaying', handleNowPlaying);
    wsManager.on('pointsUpdate', handlePointsUpdate);

    return () => {
      clearInterval(t);
      wsManager.off('queue-updated', handleQueueUpdate);
      wsManager.off('song-added', handleQueueUpdate);
      wsManager.off('queueUpdate', handleQueueUpdate);
      wsManager.off('nowPlaying', handleNowPlaying);
      wsManager.off('pointsUpdate', handlePointsUpdate);
    };
  }, [barId]);

  // SSE eliminado en favor de Socket.IO (wsManager)

  useEffect(() => {
    // TODO: Implementar verificación de usuario
    // Por ahora, permitimos acceso sin autenticación para probar QR
    if (false) { // !user
      router.push('/qr');
      return;
    }
  }, [router]);

  useEffect(() => {
    const searchSongs = async () => {
      if (!debouncedSearch.trim()) {
        setSongs([]);
        return;
      }

      setIsSearching(true);
      try {
        // Usar music-service (3003) para búsqueda
        const response = await axios.get(`${API_URLS.musicBase}/youtube/search`, {
          params: { q: debouncedSearch, maxResults: 25 },
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
          }
        });

        // Transformar respuesta de la API a formato Song
        const apiSongs: Song[] = response.data.data.videos.map((item: any) => ({
          id: item.id,
          title: item.title,
          artist: item.artist || item.channel || 'Unknown Artist',
          duration: item.durationSeconds || 0, // Usar durationSeconds si está disponible
          thumbnailUrl: item.thumbnail,
          genre: 'Unknown', // La API no proporciona género
          previewUrl: '', // YouTube no proporciona preview
          isExplicit: false,
          popularity: 0,
          album: '',
          externalIds: {
            youtube: item.id,
            spotify: ''
          }
        }));

        setSongs(apiSongs);
      } catch (err) {
        console.error('Error searching songs:', err);
        error('Error al buscar canciones');
        setSongs([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchSongs();
  }, [debouncedSearch, error]);

  const handleSongRequest = async (song: Song, isPriority = false) => {
    // Obtener barId y tableNumber desde los parámetros URL o Zustand store
    const currentBarId = barId || 'test-bar';
    const currentTable = tableNumber?.toString() || '1';

    if (!currentBarId) {
      error('No se ha detectado el bar. Escanea el código QR nuevamente.');
      return;
    }

    const cost = isPriority ? 100 : 50;
    const userPoints = points;

    // TODO: Implementar verificación de puntos del usuario
    // Por ahora, asumimos que tiene puntos suficientes
    if (userPoints < cost) {
      error(`Necesitas ${cost} puntos para solicitar esta canción`);
      return;
    }

    try {
      // Usar music-service (3002) para añadir a la cola (proxy to queue-service 3003)
      const res = await fetch(`${API_URLS.musicBase}/queue/${currentBarId}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bar_id: currentBarId,
          song_id: song.id,
          video_id: song.id,
          title: song.title,           // ← Añadido: título de la canción
          artist: song.artist,         // ← Añadido: artista
          thumbnail: song.thumbnailUrl, // ← Añadido: thumbnail
          priority_play: isPriority,
          points_used: cost,
          table: currentTable
        })
      });

      if (res.status === 409) {
        error('🎵 Esta canción ya está en la cola');
        return;
      }
      if (res.status === 402) {
        error('💰 Saldo insuficiente. Recarga tus puntos para continuar');
        return;
      }
      if (res.ok) {
        success(
          isPriority
            ? `¡${song.title} agregada con Priority Play!`
            : `¡${song.title} agregada a la cola!`
        );

        // Actualizar puntos del usuario (restar los usados)
        // Esto debería venir del backend, pero por ahora lo simulamos
        setPoints(p => Math.max(0, p - cost));

        setSelectedSong(null);
        setShowPriorityDialog(false);
        // fetchQueue se llamará automáticamente por el evento de socket
      } else {
        error('Error al añadir canción a la cola');
      }
    } catch (error: any) {
      console.error('Error adding song to queue:', error);

      // Manejar error 402 Payment Required
      if (error.response?.status === 402) {
        error('💰 Saldo insuficiente. Recarga tus puntos para continuar');
        // Opcionalmente, redirigir a la página de recarga o mostrar un botón
        setTimeout(() => {
          // router.push('/client/recharge'); // Si existe página de recarga
        }, 3000);
        return;
      }

      // Manejar duplicado ya controlado arriba

      const errorMessage = error.response?.data?.message || 'Error al añadir canción a la cola';
      error(errorMessage);
    }
  };

  const genres = ['all', 'rock', 'pop', 'jazz', 'electronic', 'reggaeton', 'salsa'];

  // TODO: Implementar verificación de usuario cuando el sistema de autenticación esté listo
  // Por ahora, permitimos acceso para probar el flujo QR
  const userPoints = 100; // TODO: Obtener puntos reales del usuario

  return (
    <Layout background="gradient" animate>
      <PageContainer className="min-h-screen p-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-card-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-card-foreground">
                {barInfo?.logo && (
                  <img
                    src={barInfo.logo}
                    alt={barInfo.name}
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                )}
                <Music2 className="h-6 w-6 text-primary" />
                {barInfo?.name || 'Rockola Digital'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {barInfo?.description && `${barInfo.description} • `}
                Mesa {tableNumber || 'N/A'} • Puntos: {points}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              {barId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect()}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          className="mb-6 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canciones, artistas o álbumes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card text-card-foreground placeholder:text-muted-foreground border-border"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {genres.map((genre) => (
              <Button
                key={genre}
                variant={selectedGenre === genre ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGenre(genre)}
                className="whitespace-nowrap"
              >
                {genre === 'all' ? 'Todos' : genre.charAt(0).toUpperCase() + genre.slice(1)}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Music Catalog */}
        <Tabs defaultValue="popular" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="popular" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Populares
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recientes
            </TabsTrigger>
            <TabsTrigger value="random" className="flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Sorpréndeme
            </TabsTrigger>
          </TabsList>

          <TabsContent value="popular" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs.map((song: any, index: number) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={song.thumbnailUrl}
                          alt={song.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors text-card-foreground">
                            {song.title}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">
                              {song.genre}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(song.duration)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-muted-foreground">4.5</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSong(song);
                              setShowPriorityDialog(true);
                            }}
                            disabled={userPoints < 50}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Pedir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs.slice(0, 6).map((song: any, index: number) => (
                <motion.div
                  key={`recent-${song.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={song.thumbnailUrl}
                          alt={song.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors text-card-foreground">
                            {song.title}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">
                              {song.genre}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(song.duration)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-muted-foreground">4.5</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSong(song);
                              setShowPriorityDialog(true);
                            }}
                            disabled={userPoints < 50}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Pedir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="random" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs
                .sort(() => Math.random() - 0.5)
                .slice(0, 6)
                .map((song: any, index: number) => (
                  <motion.div
                    key={`random-${song.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors text-card-foreground">
                              {song.title}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">
                                {song.genre}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDuration(song.duration)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              <span className="text-xs text-muted-foreground">4.5</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedSong(song);
                                setShowPriorityDialog(true);
                              }}
                              disabled={userPoints < 50}
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Pedir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-3 text-card-foreground">En cola</h2>
          {nowPlaying?.details && (
            <div className="mb-4">
              <h3 className="text-sm text-muted-foreground">Reproduciendo ahora</h3>
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={nowPlaying.details.thumbnail || '/placeholder-music.jpg'}
                  alt={nowPlaying.details.title}
                  width={56}
                  height={42}
                  className="w-14 h-10 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-card-foreground">{nowPlaying.details.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{nowPlaying.details.artist || nowPlaying.details.channelTitle}</div>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  await fetch(`http://localhost:3002/api/player/${barId || 'test-bar'}/skip`, { method: 'POST' });
                }}>Saltar</Button>
              </div>
            </div>
          )}
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay canciones en cola</p>
          ) : (
            <div className="space-y-3">
              {queueItems.map((it: any, idx: number) => {
                const itemId = it.id || it.song_id;
                const d = queueDetails[itemId];
                return (
                  <Card key={itemId} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={d?.thumbnail || it.thumbnail || `https://img.youtube.com/vi/${itemId}/hqdefault.jpg`}
                          alt={d?.title || it.title || itemId}
                          width={56}
                          height={42}
                          className="w-14 h-10 rounded-md object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-card-foreground">{d?.title || it.title || itemId}</div>
                          <div className="text-xs text-muted-foreground truncate">{d?.artist || it.artist || d?.channelTitle || ''}</div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">
                          {it.isPriority ? 'Prioridad' : 'En cola'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(it.addedAt || it.requested_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority Play Dialog */}
        <Dialog open={showPriorityDialog} onOpenChange={setShowPriorityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Canción</DialogTitle>
            </DialogHeader>
            {selectedSong && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Image
                    src={selectedSong.thumbnailUrl || '/placeholder-music.jpg'}
                    alt={selectedSong.title}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="font-semibold">{selectedSong.title}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSong.artist}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(selectedSong.duration)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => handleSongRequest(selectedSong, false)}
                    disabled={userPoints < 50}
                    className="w-full justify-between"
                    variant="outline"
                  >
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Solicitar Normal
                    </span>
                    <Badge variant="secondary">50 puntos</Badge>
                  </Button>

                  <Button
                    onClick={() => handleSongRequest(selectedSong, true)}
                    disabled={userPoints < 100}
                    className="w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Priority Play
                    </span>
                    <Badge variant="secondary">100 puntos</Badge>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Priority Play coloca tu canción al inicio de la cola
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </Layout>
  );
}
