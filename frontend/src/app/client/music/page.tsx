'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Search, 
  Play, 
  Clock, 
  Star, 
  ArrowLeft, 
  Shuffle,
  TrendingUp,
  Music2,
  Zap
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

export default function MusicPage() {
  const { user, addToQueue, queue } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (!user) {
      router.push('/qr');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const searchSongs = async () => {
      if (!debouncedSearch.trim()) {
        setSongs([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await axios.get('http://localhost:3003/api/music/songs/external/youtube/search', {
          params: { q: debouncedSearch, maxResults: 25 }
        });

        // Transformar respuesta de la API a formato Song
        const apiSongs: Song[] = response.data.songs.map((item: any) => ({
          id: item.song_id,
          title: item.title,
          artist: item.artist,
          duration: item.duration,
          thumbnailUrl: item.thumbnailUrl,
          genre: 'Unknown', // La API no proporciona género
          pointsCost: 50 // Costo por defecto
        }));

        setSongs(apiSongs);
      } catch (error) {
        console.error('Error searching songs:', error);
        showErrorToast('Error al buscar canciones');
        setSongs([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchSongs();
  }, [debouncedSearch, showErrorToast]);

  const handleSongRequest = async (song: Song, isPriority = false) => {
    if (!user) return;

    const cost = isPriority ? 100 : 50;

    if (user.points < cost) {
      showErrorToast(`Necesitas ${cost} puntos para solicitar esta canción`);
      return;
    }

    try {
      // Llamar a la API para añadir a la cola
      const response = await axios.post('http://localhost:3003/api/music/queue/default-bar/add', {
        song_id: song.id,
        priority_play: isPriority,
        points_used: cost
      });

      if (response.data.success) {
        showSuccessToast(
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
        showErrorToast(response.data.message || 'Error al añadir canción a la cola');
      }
    } catch (error: any) {
      console.error('Error adding song to queue:', error);
      const errorMessage = error.response?.data?.message || 'Error al añadir canción a la cola';
      showErrorToast(errorMessage);
    }
  };

  const genres = ['all', 'rock', 'pop', 'jazz', 'electronic', 'reggaeton', 'salsa'];

  if (!user) return null;

  return (
    <Layout background="dark" animate>
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
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Music2 className="h-6 w-6 text-primary" />
                Rockola Digital
              </h1>
              <p className="text-sm text-muted-foreground">
                Puntos disponibles: {formatPoints(user.points)}
              </p>
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
              className="pl-10"
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
              {songs
                .map((song, index) => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  index={index}
                  onRequest={(song) => {
                    setSelectedSong(song);
                    setShowPriorityDialog(true);
                  }}
                  userPoints={user.points}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs
                .map((song, index) => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  index={index}
                  onRequest={(song) => {
                    setSelectedSong(song);
                    setShowPriorityDialog(true);
                  }}
                  userPoints={user.points}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="random" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs
                .sort(() => Math.random() - 0.5)
                .map((song, index) => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  index={index}
                  onRequest={(song) => {
                    setSelectedSong(song);
                    setShowPriorityDialog(true);
                  }}
                  userPoints={user.points}
                />
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
                    disabled={user.points < 50}
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
                    disabled={user.points < 100}
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

// Componente para cada tarjeta de canción
interface SongCardProps {
  song: Song;
  index: number;
  onRequest: (song: Song) => void;
  userPoints: number;
}

function SongCard({ song, index, onRequest, userPoints }: SongCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Image 
              src={song.thumbnailUrl || '/placeholder-music.jpg'} 
              alt={song.title}
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-cover group-hover:scale-105 transition-transform"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                {song.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
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
                <span className="text-xs">4.5</span>
              </div>
              <Button
                size="sm"
                onClick={() => onRequest(song)}
                disabled={userPoints < 50}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play className="h-3 w-3 mr-1" />
                Pedir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}