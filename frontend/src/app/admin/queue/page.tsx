'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Music, 
  Play, 
  Pause, 
  SkipForward, 
  Trash2, 
  Star, 
  Clock, 
  Users, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  GripVertical,
  Filter,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatTime, formatDuration } from '@/utils/format';
import { QueueItem } from '@/types';
import axios from 'axios';
import { useWebSocket } from '@/utils/websocket';
import { WS_EVENTS } from '@/utils/websocket';

// Mock data para la cola musical
const mockQueue: QueueItem[] = [
  {
    id: 'queue-1',
    tableNumber: 5,
    status: 'playing',
    requestedBy: 'Usuario Mesa 5',
    timestamp: new Date(Date.now() - 3 * 60000),
    isPriority: false,
    pointsSpent: 50,
    song: {
      id: 'song-1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      duration: 355,
      genre: 'Rock',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Queen%20Bohemian%20Rhapsody%20album%20cover%20classic%20rock%20vintage%20style&image_size=square',
      pointsCost: 50
    }
  },
  {
    id: 'queue-2',
    tableNumber: 12,
    status: 'approved',
    requestedBy: 'Usuario Mesa 12',
    timestamp: new Date(Date.now() - 1 * 60000),
    isPriority: true,
    pointsSpent: 100,
    song: {
      id: 'song-2',
      title: 'Despacito',
      artist: 'Luis Fonsi ft. Daddy Yankee',
      duration: 229,
      genre: 'Reggaeton',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Despacito%20Luis%20Fonsi%20reggaeton%20tropical%20music%20cover&image_size=square',
      pointsCost: 50
    }
  },
  {
    id: 'queue-3',
    tableNumber: 8,
    status: 'approved',
    requestedBy: 'Usuario Mesa 8',
    timestamp: new Date(Date.now() - 30000),
    isPriority: false,
    pointsSpent: 50,
    song: {
      id: 'song-3',
      title: 'Shape of You',
      artist: 'Ed Sheeran',
      duration: 263,
      genre: 'Pop',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Ed%20Sheeran%20Shape%20of%20You%20pop%20music%20album%20cover&image_size=square',
      pointsCost: 50
    }
  },
  {
    id: 'queue-4',
    tableNumber: 3,
    status: 'pending',
    requestedBy: 'Usuario Mesa 3',
    timestamp: new Date(Date.now() - 15000),
    isPriority: false,
    pointsSpent: 50,
    song: {
      id: 'song-4',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: 200,
      genre: 'Pop',
      thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=The%20Weeknd%20Blinding%20Lights%20synthwave%20neon%20album%20cover&image_size=square',
      pointsCost: 50
    }
  }
];

export default function AdminQueuePage() {
  const { user } = useAppStore();
  const router = useRouter();
  const { success, error } = useToast();
  const { connect, on, off } = useWebSocket();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(45);
  const [isMuted, setIsMuted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleNextSong = useCallback(() => {
    const currentIndex = queue.findIndex(item => item.status === 'playing');
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      const newQueue = [...queue];
      newQueue[currentIndex].status = 'completed';
      newQueue[currentIndex + 1].status = 'playing';
      setQueue(newQueue);
      setCurrentProgress(0);
      success('Siguiente canción');
    }
  }, [queue, setQueue, setCurrentProgress, success]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }

    // Cargar cola inicial
    const loadQueue = async () => {
      try {
        const response = await axios.get('http://localhost:3003/api/music/queue/default-bar');
        if (response.data.success) {
          // Transformar datos de la API al formato QueueItem
          const apiQueue: QueueItem[] = response.data.data.map((item: any) => ({
            id: item.id,
            song: {
              id: item.song.id,
              title: item.song.title,
              artist: item.song.artist,
              duration: item.song.duration,
              thumbnailUrl: item.song.thumbnail_url,
              genre: 'Unknown',
              pointsCost: 50
            },
            requestedBy: item.user.first_name + ' ' + item.user.last_name,
            tableNumber: 1, // Asumir mesa por defecto
            timestamp: new Date(item.requested_at),
            status: item.status as 'pending' | 'approved' | 'rejected' | 'playing' | 'completed',
            isPriority: item.priority_play,
            pointsSpent: item.points_used
          }));
          setQueue(apiQueue);
        }
      } catch (err) {
        console.error('Error loading queue:', err);
        error('Error al cargar la cola');
      } finally {
        setLoading(false);
      }
    };

    loadQueue();

    // Conectar WebSocket para actualizaciones en tiempo real
    const initWebSocket = async () => {
      try {
        await connect(); // Conectar como admin
        on(WS_EVENTS.QUEUE_UPDATED, (data) => {
          console.log('Admin queue updated:', data);
          // Recargar cola cuando haya cambios
          loadQueue();
        });
      } catch (wsError) {
        console.error('WebSocket connection failed:', wsError);
      }
    };

    initWebSocket();

    return () => {
      off(WS_EVENTS.QUEUE_UPDATED);
    };
  }, [user, router, connect, on, off, error]);

  useEffect(() => {
    // Simular progreso de la canción actual
    const interval = setInterval(() => {
      if (isPlaying) {
        setCurrentProgress(prev => {
          if (prev >= 100) {
            // Canción terminada, pasar a la siguiente
            handleNextSong();
            return 0;
          }
          return prev + 0.5;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, handleNextSong]);

  if (!user || user.role !== 'admin') return null;

  const currentSong = queue.find(item => item.status === 'playing');
  const filteredQueue = queue.filter(item => {
    const matchesSearch = item.song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    success(isPlaying ? 'Música pausada' : 'Música reanudada');
  };

  const handleApproveSong = async (id: string) => {
    try {
      const response = await axios.patch(`http://localhost:3002/api/music/queue/default-bar/${id}/status`, {
        status: 'approved'
      });
      if (response.data.success) {
        setQueue(prev => prev.map(item =>
          item.id === id ? { ...item, status: 'approved' as const } : item
        ));
        success('Canción aprobada');
      }
    } catch (err) {
      console.error('Error approving song:', err);
      error('Error al aprobar canción');
    }
  };

  const handleRejectSong = async (id: string) => {
    try {
      const response = await axios.patch(`http://localhost:3003/api/music/queue/default-bar/${id}/status`, {
        status: 'rejected'
      });
      if (response.data.success) {
        setQueue(prev => prev.filter(item => item.id !== id));
        success('Canción rechazada');
      }
    } catch (err) {
      console.error('Error rejecting song:', err);
      error('Error al rechazar canción');
    }
  };

  const handleRemoveSong = async (id: string) => {
    try {
      const response = await axios.delete(`http://localhost:3003/api/music/queue/default-bar/${id}`);
      if (response.data.success) {
        setQueue(prev => prev.filter(item => item.id !== id));
        success('Canción eliminada de la cola');
      }
    } catch (err) {
      console.error('Error removing song:', err);
      error('Error al eliminar canción');
    }
  };

  const handleMoveToTop = (id: string) => {
    const item = queue.find(q => q.id === id);
    if (!item || item.status === 'playing') return;

    const newQueue = queue.filter(q => q.id !== id);
    const playingIndex = newQueue.findIndex(q => q.status === 'playing');
    
    if (playingIndex !== -1) {
      newQueue.splice(playingIndex + 1, 0, { ...item });
    } else {
      newQueue.unshift({ ...item });
    }

    // Reordenar cola
    const reorderedQueue = newQueue;

    setQueue(reorderedQueue);
    success('Canción movida al inicio de la cola');
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = queue.findIndex(item => item.id === draggedItem);
    const targetIndex = queue.findIndex(item => item.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    const newQueue = [...queue];
    const [draggedItemData] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(targetIndex, 0, draggedItemData);

    // Reordenar posiciones
    const reorderedQueue = newQueue.map((item) => ({
      ...item,
      // No position property needed
    }));

    setQueue(reorderedQueue);
    setDraggedItem(null);
    success('Orden de la cola actualizado');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'playing': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'completed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'playing': return <Play className="h-4 w-4" />;
      case 'approved': return <Clock className="h-4 w-4" />;
      case 'pending': return <AlertTriangle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <AdminLayout>
      <PageContainer className="p-6">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Music className="h-8 w-8 text-primary" />
                Gestión de Cola Musical
              </h1>
              <p className="text-muted-foreground mt-1">
                Controla la reproducción y orden de las canciones
              </p>
            </div>
          </div>
        </motion.div>

        {/* Current Playing */}
        {currentSong && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <Image 
                    src={currentSong.song.thumbnailUrl} 
                    alt={currentSong.song.title}
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-lg object-cover shadow-lg"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className="bg-green-600 text-white">
                        <Play className="h-3 w-3 mr-1" />
                        Reproduciendo Ahora
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Mesa {currentSong.tableNumber}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{currentSong.song.title}</h3>
                    <p className="text-muted-foreground mb-3">{currentSong.song.artist}</p>
                    <div className="flex items-center gap-4">
                      <Progress value={currentProgress} className="flex-1" />
                      <span className="text-sm text-muted-foreground">
                        {Math.floor((currentProgress / 100) * currentSong.song.duration / 60)}:
                        {String(Math.floor((currentProgress / 100) * currentSong.song.duration % 60)).padStart(2, '0')} / 
                        {formatDuration(currentSong.song.duration)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextSong}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar canciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="playing">Reproduciendo</SelectItem>
              <SelectItem value="approved">Aprobada</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Queue List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Cola de Reproducción ({filteredQueue.length} canciones)
                </div>
                <div className="text-sm text-muted-foreground">
                  Arrastra para reordenar
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredQueue.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, delay: index * 0.02 }}
                    >
                      <div
                        draggable={item.status !== 'playing'}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item.id)}
                      className={`flex items-center gap-4 p-4 border rounded-lg transition-all ${
                        item.status === 'playing' 
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                          : 'hover:bg-muted/50 cursor-move'
                      } ${
                        draggedItem === item.id ? 'opacity-50' : ''
                      }`}
                    >
                      {item.status !== 'playing' && (
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                      )}
                      
                      <div className="flex-shrink-0">
                        <Image 
                          src={item.song.thumbnailUrl} 
                          alt={item.song.title}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                          <h4 className="font-medium truncate">{item.song.title}</h4>
                          {item.isPriority && (
                            <Badge variant="destructive" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Priority
                            </Badge>
                          )}
                          <Badge className={getStatusColor(item.status)}>
                            {getStatusIcon(item.status)}
                            {item.status === 'playing' && 'Reproduciendo'}
                            {item.status === 'approved' && 'Aprobada'}
                            {item.status === 'pending' && 'Pendiente'}
                            {item.status === 'completed' && 'Completado'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground truncate mb-1">
                          {item.song.artist} • {item.song.genre}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Mesa {item.tableNumber}</span>
                          <span>{formatDuration(item.song.duration)}</span>
                          <span>{formatTime(item.timestamp)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveSong(item.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectSong(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveToTop(item.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status !== 'playing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveSong(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredQueue.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Music className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No hay canciones en la cola</p>
                    <p className="text-sm">Las canciones aparecerán aquí cuando los clientes las agreguen</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </AdminLayout>
  );
}