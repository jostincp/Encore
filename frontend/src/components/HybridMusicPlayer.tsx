'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, SkipForward, CheckCircle, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import YouTubePlayer from '@/components/YouTubePlayer';

interface Song {
    id: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    duration: number;
    genre: string;
}

interface QueueItem {
    id: string;
    song: Song;
    tableNumber: string;
    isPriority: boolean;
    timestamp: string;
    status?: string;
}

interface HybridMusicPlayerProps {
    currentSong: QueueItem;
    onSkip: () => Promise<void>;
    onMarkPlayed: () => Promise<void>;
}

export default function HybridMusicPlayer({ currentSong, onSkip, onMarkPlayed }: HybridMusicPlayerProps) {
    const [playerMode, setPlayerMode] = useState<'external' | 'embedded'>('external');

    return (
        <div className="mb-6">
            {/* Mode Toggle */}
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Reproduciendo ahora:</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Modo:</span>
                    <Button
                        size="sm"
                        variant={playerMode === 'external' ? 'default' : 'outline'}
                        onClick={() => setPlayerMode('external')}
                        className="h-7 text-xs"
                    >
                        🎬 Externo
                    </Button>
                    <Button
                        size="sm"
                        variant={playerMode === 'embedded' ? 'default' : 'outline'}
                        onClick={() => setPlayerMode('embedded')}
                        className="h-7 text-xs"
                    >
                        📺 Embebido
                    </Button>
                </div>
            </div>

            {/* External Mode - Default (No errors in localhost) */}
            {playerMode === 'external' ? (
                <div className="border rounded-lg overflow-hidden">
                    {/* Large Thumbnail */}
                    <div className="relative aspect-video bg-black">
                        <Image
                            src={currentSong.song.thumbnailUrl}
                            alt={currentSong.song.title}
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                            <h2 className="text-2xl font-bold text-white mb-2">
                                {currentSong.song.title}
                            </h2>
                            <p className="text-lg text-white/90 mb-4">
                                {currentSong.song.artist} • Mesa {currentSong.tableNumber}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <Button
                                    size="lg"
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => {
                                        window.open(`https://www.youtube.com/watch?v=${currentSong.song.id}`, '_blank');
                                    }}
                                >
                                    <Play className="h-5 w-5 mr-2" />
                                    ABRIR EN YOUTUBE
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                                    onClick={onSkip}
                                >
                                    <SkipForward className="h-5 w-5 mr-2" />
                                    SIGUIENTE
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                                    onClick={onMarkPlayed}
                                >
                                    <CheckCircle className="h-5 w-5 mr-2" />
                                    YA SONÓ
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                            💡 <strong>Modo Externo:</strong> Haz clic en "ABRIR EN YOUTUBE" para reproducir. Usa "YA SONÓ" cuando termine la canción.
                        </p>
                    </div>
                </div>
            ) : (
                /* Embedded Mode - For production (HTTPS) */
                <div>
                    <div className="mb-3 flex items-center gap-3">
                        <Image
                            src={currentSong.song.thumbnailUrl}
                            alt={currentSong.song.title}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{currentSong.song.title}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                                {currentSong.song.artist} • Mesa {currentSong.tableNumber}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onSkip}
                        >
                            <SkipForward className="h-4 w-4 mr-2" />
                            Siguiente
                        </Button>
                    </div>

                    {/* YouTube Player Component with automatic fallback */}
                    <YouTubePlayer
                        key={`player-${currentSong.song.id}`}
                        videoId={currentSong.song.id}
                        autoplay={true}
                        showControls={true}
                        onError={(error) => {
                            console.log('Video con restricciones, cambiando a modo externo');
                            setPlayerMode('external');
                        }}
                        onEnd={onSkip}
                    />
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            ⚠️ <strong>Modo Embebido:</strong> Algunos videos pueden tener restricciones de embedding. Si ves errores, cambia a "Modo Externo".
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export function EmptyPlayerState({ onStart }: { onStart: () => void }) {
    return (
        <div className="mb-6 text-center py-8 border-2 border-dashed rounded-lg">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No hay canción reproduciéndose</p>
            <Button
                size="sm"
                className="mt-3"
                onClick={onStart}
            >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Reproducción
            </Button>
        </div>
    );
}
