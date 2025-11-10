import React, { useRef, useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { cn } from '../lib/utils';

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (event: any) => void;
  onStateChange?: (event: any) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
  showControls?: boolean;
  width?: string | number;
  height?: string | number;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  onReady,
  onStateChange,
  onEnd,
  onError,
  className,
  autoplay = false,
  controls = false,
  showControls = true,
  width = '100%',
  height = '100%'
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    isFullscreen: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const opts = {
    height: height,
    width: width,
    playerVars: {
      autoplay: autoplay ? 1 : 0,
      controls: controls ? 1 : 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      fs: 0,
      cc_load_policy: 0
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          const isMuted = playerRef.current.isMuted();
          const volume = playerRef.current.getVolume();

          setPlayerState(prev => ({
            ...prev,
            currentTime,
            duration,
            volume,
            isMuted
          }));
        } catch (error) {
          console.error('Error updating player state:', error);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleReady = (event: any) => {
    playerRef.current = event.target;
    setIsLoading(false);
    setError(null);
    
    try {
      const duration = playerRef.current.getDuration();
      setPlayerState(prev => ({ ...prev, duration }));
    } catch (error) {
      console.error('Error getting video duration:', error);
    }

    if (onReady) {
      onReady(event);
    }
  };

  const handleStateChange = (event: any) => {
    const state = event.data;
    
    switch (state) {
      case 1: // Playing
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        break;
      case 2: // Paused
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        break;
      case 0: // Ended
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        if (onEnd) onEnd();
        break;
      case -1: // Unstarted
      case 3: // Buffering
      case 5: // Video cued
        break;
    }

    if (onStateChange) {
      onStateChange(event);
    }
  };

  const handleError = (error: any) => {
    console.error('YouTube player error:', error);
    setError('Error loading video');
    setIsLoading(false);
    
    if (onError) {
      onError(error);
    }
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;

    try {
      if (playerState.isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  const skipForward = () => {
    if (!playerRef.current) return;

    try {
      const currentTime = playerRef.current.getCurrentTime();
      const newTime = Math.min(currentTime + 10, playerState.duration);
      playerRef.current.seekTo(newTime);
    } catch (error) {
      console.error('Error skipping forward:', error);
    }
  };

  const skipBack = () => {
    if (!playerRef.current) return;

    try {
      const currentTime = playerRef.current.getCurrentTime();
      const newTime = Math.max(currentTime - 10, 0);
      playerRef.current.seekTo(newTime);
    } catch (error) {
      console.error('Error skipping back:', error);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;

    try {
      if (playerState.isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setPlayerState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleVolumeChange = (volume: number) => {
    if (!playerRef.current) return;

    try {
      playerRef.current.setVolume(volume);
      setPlayerState(prev => ({ ...prev, volume }));
      if (volume > 0 && prev.isMuted) {
        playerRef.current.unMute();
        setPlayerState(prev => ({ ...prev, isMuted: false }));
      }
    } catch (error) {
      console.error('Error changing volume:', error);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!playerState.isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    
    setPlayerState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const newTime = percentage * playerState.duration;

    try {
      playerRef.current.seekTo(newTime);
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-white text-center">
            <p className="text-lg mb-2">Error loading video</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      )}

      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onStateChange={handleStateChange}
        onError={handleError}
      />

      {showControls && !isLoading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <div 
              className="w-full h-1 bg-white/30 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-red-600 rounded-full transition-all duration-200"
                style={{ width: `${(playerState.currentTime / playerState.duration) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/70 mt-1">
              <span>{formatTime(playerState.currentTime)}</span>
              <span>{formatTime(playerState.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={skipBack}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
              >
                {playerState.isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              
              <button
                onClick={skipForward}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {/* Volume Control */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  {playerState.isMuted || playerState.volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playerState.volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-20 accent-red-600"
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-gray-300 transition-colors"
              >
                {playerState.isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;