'use client';

import { useEffect, useState, useRef } from 'react';
import YouTube from 'react-youtube';
import { useWebSocket, WS_EVENTS } from '../utils/websocket';

interface Song {
  id: string;
  song_id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
  song?: {
    youtube_id?: string;
    spotify_id?: string;
  };
}

interface MusicPlayerProps {
  barId: string;
}

export default function MusicPlayer({ barId }: MusicPlayerProps) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const { on, off } = useWebSocket();

  const handleSongEnd = async () => {
    if (!currentSong) return;

    try {
      const response = await fetch('/api/music/queue/song-finished', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queueId: currentSong.id
        })
      });

      if (!response.ok) {
        console.error('Failed to notify song finished');
      }
    } catch (error) {
      console.error('Error notifying song finished:', error);
    }
  };

  const onPlayerReady = (event: any) => {
    setPlayer(event.target);
  };

  const onPlayerStateChange = (event: any) => {
    // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    if (event.data === 0) { // Video ended
      handleSongEnd();
    } else if (event.data === 1) { // Playing
      setIsPlaying(true);
    } else if (event.data === 2) { // Paused
      setIsPlaying(false);
    }
  };

  const onPlayerError = (error: any) => {
    console.error('YouTube player error:', error);
    // Could retry or notify user
  };

  useEffect(() => {
    const handlePlayNextSong = (data: any) => {
      if (data.nextSong) {
        setCurrentSong(data.nextSong);
        setIsPlaying(true);
      } else {
        // No more songs
        setCurrentSong(null);
        setIsPlaying(false);
      }
    };

    on(WS_EVENTS.PLAY_NEXT_SONG, handlePlayNextSong);

    return () => {
      off(WS_EVENTS.PLAY_NEXT_SONG, handlePlayNextSong);
    };
  }, [on, off]);

  const getVideoId = (song: Song): string | undefined => {
    // Try to get YouTube video ID from various sources
    if (song.song?.youtube_id) {
      return song.song.youtube_id;
    }

    // If song_id contains youtube:video:VIDEO_ID format
    if (song.song_id && song.song_id.includes('youtube:video:')) {
      return song.song_id.split(':').pop();
    }

    // Fallback - try to extract from external URLs or other fields
    return undefined;
  };

  const videoId = currentSong ? getVideoId(currentSong) : undefined;

  const opts = {
    height: '390',
    width: '640',
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="music-player bg-black rounded-lg p-4">
      <h2 className="text-white text-xl font-bold mb-4">🎵 Reproductor de Música</h2>

      {currentSong ? (
        <div className="space-y-4">
          <div className="text-white">
            <h3 className="text-lg font-semibold">{currentSong.title}</h3>
            <p className="text-gray-300">{currentSong.artist}</p>
          </div>

          {videoId ? (
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={onPlayerReady}
              onStateChange={onPlayerStateChange}
              onError={onPlayerError}
            />
          ) : (
            <div className="bg-gray-800 text-white p-4 rounded">
              <p>No se pudo cargar el video de YouTube</p>
              <p className="text-sm text-gray-400 mt-2">
                Video ID no disponible para: {currentSong.title}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-4 text-white">
            <span className={`text-sm ${isPlaying ? 'text-green-400' : 'text-gray-400'}`}>
              {isPlaying ? '▶ Reproduciendo' : '⏸ Pausado'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center text-white py-8">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-xl font-semibold mb-2">Sin canción reproduciéndose</h3>
          <p className="text-gray-400">
            Esperando que el administrador inicie la reproducción
          </p>
        </div>
      )}
    </div>
  );
}