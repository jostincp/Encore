'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  Clock, 
  Play, 
  Pause, 
  ArrowLeft, 
  User, 
  Zap,
  Music,
  Volume2,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';

import { formatDuration, formatRelativeTime } from '@/utils/format';
import { QueueItem } from '@/types';

export default function QueuePage() {
  const { user, queue, currentSong } = useAppStore();
  const router = useRouter();

  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push('/qr');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    // Simular progreso de la canción actual
    if (currentSong) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          const newProgress = (newTime / currentSong.duration) * 100;
          setProgress(newProgress);
          
          // Si la canción termina, reiniciar
          if (newTime >= currentSong.duration) {
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentSong]);

  if (!user) return null;

  const userQueue = queue.filter(item => item.requestedBy === user.id);
  const totalQueue = queue.length;
  const userPosition = user ? 
    queue.findIndex(item => item.requestedBy === user.id && item.status === 'pending') + 1 : 0;

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
                <Clock className="h-6 w-6 text-primary" />
                Cola Musical
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalQueue} canciones en cola
              </p>
            </div>
          </div>
        </motion.div>

        {/* Now Playing */}
        {currentSong && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-primary" />
                  Reproduciendo Ahora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Image 
                    src={currentSong.thumbnailUrl || '/placeholder-music.jpg'}
                  alt={currentSong.title}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{currentSong.title}</h3>
                <p className="text-muted-foreground">{currentSong.artist}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        Mesa {currentSong.tableNumber}
                      </Badge>
                      {currentSong.isPriority && (
                        <Badge className="text-xs bg-yellow-500">
                          <Zap className="h-3 w-3 mr-1" />
                          Priority
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-2">
                      {currentSong ? (
                        <Pause className="h-5 w-5 text-primary" />
                      ) : (
                        <Play className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(currentTime)} / {formatDuration(currentSong.duration)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* User's Queue */}
        {userQueue.length > 0 && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  Mis Canciones
                  <Badge variant="secondary">{userQueue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnimatePresence>
                  {userQueue.map((item, index) => (
                    <QueueItemCard 
                      key={item.id} 
                      item={item} 
                      index={index}
                      isUserSong={true}
                      position={queue.findIndex(q => q.id === item.id) + 1}
                    />
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Global Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5 text-green-500" />
                Cola General
                <Badge variant="secondary">{totalQueue}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queue.length === 0 ? (
                <div className="text-center py-8">
                  <Music className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay canciones en cola</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push('/client/music')}
                  >
                    Explorar Música
                  </Button>
                </div>
              ) : (
                <AnimatePresence>
                  {queue.map((item, index) => (
                    <QueueItemCard 
                      key={item.id} 
                      item={item} 
                      index={index}
                      isUserSong={item.requestedBy === user.id}
                      position={index + 1}
                    />
                  ))}
                </AnimatePresence>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Queue Stats */}
        <motion.div
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{totalQueue}</div>
              <div className="text-xs text-muted-foreground">Total en Cola</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{userQueue.length}</div>
              <div className="text-xs text-muted-foreground">Mis Canciones</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {queue.filter(item => item.isPriority).length}
              </div>
              <div className="text-xs text-muted-foreground">Priority Play</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">
                {userPosition || '-'}
              </div>
              <div className="text-xs text-muted-foreground">Mi Posición</div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    </Layout>
  );
}

// Componente para cada item de la cola
interface QueueItemCardProps {
  item: QueueItem;
  index: number;
  isUserSong: boolean;
  position: number;
}

function QueueItemCard({ item, index, isUserSong, position }: QueueItemCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'playing': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'playing': return 'Reproduciendo';
      case 'pending': return 'En Cola';
      case 'completed': return 'Completada';
      case 'rejected': return 'Rechazada';
      default: return 'Desconocido';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`p-4 rounded-lg border transition-all duration-200 ${
        isUserSong 
          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
          : 'bg-card border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Position */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          {position}
        </div>
        
        {/* Song Info */}
        <Image 
          src={item.song.thumbnailUrl || '/placeholder-music.jpg'} 
          alt={item.song.title}
          width={48}
          height={48}
          className="w-12 h-12 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{item.song.title}</h4>
          <p className="text-sm text-muted-foreground truncate">{item.song.artist}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              Mesa {item.tableNumber}
            </Badge>
            {item.isPriority && (
              <Badge className="text-xs bg-yellow-500">
                <Zap className="h-3 w-3 mr-1" />
                Priority
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={`text-xs ${getStatusColor(item.status)} text-white border-0`}
            >
              {getStatusText(item.status)}
            </Badge>
          </div>
        </div>
        
        {/* Time and Actions */}
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-muted-foreground mb-1">
            {formatDuration(item.song.duration)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatRelativeTime(item.timestamp)}
          </div>
          {isUserSong && item.status === 'pending' && (
            <Button variant="ghost" size="sm" className="mt-1 h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}