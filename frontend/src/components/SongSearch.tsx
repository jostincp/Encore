'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Music, Play, Plus, Clock, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { musicService, YouTubeVideo, SearchResponse } from '@/services/musicService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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
        
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${response.data.videos.length} canciones`,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Error en búsqueda",
        description: error instanceof Error ? error.message : "No se pudo completar la búsqueda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  const handleAddToQueue = async (song: YouTubeVideo, priority: boolean = false) => {
    try {
      const result = await musicService.addToQueue(song, barId, userToken, priority);
      
      if (result.success) {
        toast({
          title: "¡Canción añadida!",
          description: `${song.title} ha sido añadida a la cola${priority ? ' con prioridad' : ''}`,
        });
        
        if (onSongAdded) {
          onSongAdded();
        }
      } else {
        throw new Error(result.message || 'No se pudo añadir la canción');
      }
    } catch (error) {
      console.error('Add to queue error:', error);
      toast({
        title: "Error al añadir canción",
        description: error instanceof Error ? error.message : "No se pudo añadir a la cola",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const SongCard = ({ song, showTrendingBadge = false }: { song: YouTubeVideo; showTrendingBadge?: boolean }) => (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
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
            <p className="text-sm text-muted-foreground mb-2">
              {song.artist}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Music className="w-3 h-3 mr-1" />
                YouTube
              </Badge>
              {showTrendingBadge && (
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Trending
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => handleAddToQueue(song)}
              disabled={loading}
              className="whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddToQueue(song, true)}
              disabled={loading}
              className="whitespace-nowrap"
            >
              <Clock className="w-4 h-4 mr-1" />
              Prioridad
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Music className="w-8 h-8" />
          Buscar Música
        </h1>
        <p className="text-muted-foreground">
          Busca tus canciones favoritas en YouTube y añádelas a la cola
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar canciones, artistas o álbumes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button 
            onClick={handleSearch} 
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </Button>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Búsquedas recientes:</span>
            {searchHistory.map((term, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => {
                  setQuery(term);
                  handleSearch();
                }}
              >
                {term}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search">
            Resultados de búsqueda {results.length > 0 && `(${results.length})`}
          </TabsTrigger>
          <TabsTrigger value="trending">
            Tendencias {trending.length > 0 && `(${trending.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span>Buscando canciones...</span>
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {results.map((song) => (
                  <SongCard key={song.id} song={song} />
                ))}
              </div>
            </ScrollArea>
          ) : query ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron resultados</h3>
              <p className="text-muted-foreground">
                Intenta con diferentes palabras clave o revisa la ortografía
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Comienza una búsqueda</h3>
              <p className="text-muted-foreground">
                Escribe el nombre de una canción, artista o álbum para buscar
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending" className="mt-4">
          {loadingTrending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span>Cargando tendencias...</span>
            </div>
          ) : trending.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {trending.map((song) => (
                  <SongCard key={song.id} song={song} showTrendingBadge />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No hay tendencias disponibles</h3>
              <p className="text-muted-foreground">
                Intenta más tarde o realiza una búsqueda manual
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SongSearch;
