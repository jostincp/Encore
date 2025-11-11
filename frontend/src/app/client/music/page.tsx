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
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDuration, formatPoints } from '@/utils/format';
import { Song } from '@/types';
import axios from 'axios';

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
  const searchParams = useSearchParams();
  const barId = searchParams?.get('barId');
  const tableNumber = searchParams?.get('table');
  
  const { isConnected, disconnect } = useQRConnection();
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
  
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Obtener información del bar para personalizar experiencia
  useEffect(() => {
    if (barId) {
      // Obtener información del bar
      fetch(`http://localhost:3001/api/bars/${barId}/info`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setBarInfo(data.data);
            // Aplicar colores personalizados si existen
            if (data.data.primaryColor) {
              document.documentElement.style.setProperty('--primary', data.data.primaryColor);
            }
            if (data.data.secondaryColor) {
              document.documentElement.style.setProperty('--secondary', data.data.secondaryColor);
            }
          }
        })
        .catch(err => console.error('Error fetching bar info:', err));
      
      // Guardar en localStorage para persistencia
      localStorage.setItem('currentBarId', barId);
      localStorage.setItem('currentTable', tableNumber || '');
    }
  }, [barId, tableNumber]);

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
        const response = await axios.get('http://localhost:3002/api/youtube/search', {
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
          duration: item.duration || '0:00',
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
    // Obtener barId y tableNumber desde localStorage (persistencia QR)
    const currentBarId = localStorage.getItem('currentBarId') || barId;
    const currentTable = localStorage.getItem('currentTable') || tableNumber;

    if (!currentBarId) {
      error('No se ha detectado el bar. Escanea el código QR nuevamente.');
      return;
    }

    const cost = isPriority ? 100 : 50;
    const userPoints = 100; // TODO: Obtener puntos reales del usuario

    // TODO: Implementar verificación de puntos del usuario
    // Por ahora, asumimos que tiene puntos suficientes
    if (userPoints < cost) {
      error(`Necesitas ${cost} puntos para solicitar esta canción`);
      return;
    }

    try {
      // Llamar a la API para añadir a la cola
      const response = await axios.post(`http://localhost:3003/api/queue/${currentBarId}/add`, {
        song_id: song.id,
        priority_play: isPriority,
        points_used: cost,
        requested_by: currentTable || 'Cliente', // Mesa o identificador
        bar_id: currentBarId // Asegurar que se asocia al bar correcto
      });

      if (response.data.success) {
        success(
          isPriority
            ? `¡${song.title} agregada con Priority Play!`
            : `¡${song.title} agregada a la cola!`
        );

        // Actualizar puntos del usuario (restar los usados)
        // Esto debería venir del backend, pero por ahora lo simulamos
        // user.points -= cost;

        setSelectedSong(null);
        setShowPriorityDialog(false);
      } else {
        error(response.data.message || 'Error al añadir canción a la cola');
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
      
      // Manejar error 409 Conflict (canción duplicada)
      if (error.response?.status === 409) {
        error('🎵 Esta canción ya está en la cola');
        return;
      }
      
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
                <Image 
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
              Mesa {tableNumber || 'N/A'} • Puntos: {100} {/* TODO: user.points */}
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
                        <Image
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
                        <Image
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
                        <Image
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