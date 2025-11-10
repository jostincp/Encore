import React, { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Edit3, Save, X, Music, Clock, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import YouTubeSearch from './YouTubeSearch';
import { 
  youtubeApiService, 
  YouTubePlaylist as Playlist, 
  YouTubePlaylistItem as PlaylistItem,
  YouTubeVideo 
} from '../services/youtubeApi';

// Interfaces now imported from youtubeApi service

interface YouTubePlaylistManagerProps {
  barId: string;
  className?: string;
  onVideoSelect?: (videoId: string) => void;
  onPlaylistSelect?: (playlist: YouTubePlaylist) => void;
}

const YouTubePlaylistManager: React.FC<YouTubePlaylistManagerProps> = ({
  barId,
  className,
  onVideoSelect,
  onPlaylistSelect
}) => {
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', isPublic: false });

  const fetchPlaylists = async () => {
    if (!barId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const playlistsData = await youtubeApiService.getBarPlaylists(barId);
      setPlaylists(playlistsData);
    } catch (error) {
      console.error('Fetch playlists error:', error);
      setError('Failed to load playlists. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [barId]);

  const createPlaylist = async (name: string, description: string, isPublic: boolean) => {
    try {
      const createdPlaylist = await youtubeApiService.createPlaylist({
        name,
        description,
        isPublic,
        barId
      });
      
      setPlaylists([...playlists, createdPlaylist]);
      setShowCreateForm(false);
      return createdPlaylist;
    } catch (error) {
      console.error('Create playlist error:', error);
      setError('Failed to create playlist. Please try again.');
      throw error;
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      await youtubeApiService.deletePlaylist(playlistId);
      
      setPlaylists(playlists.filter(p => p.id !== playlistId));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (error) {
      console.error('Delete playlist error:', error);
      setError('Failed to delete playlist. Please try again.');
    }
  };

  const updatePlaylist = async (playlistId: string, updates: Partial<YouTubePlaylist>) => {
    try {
      const updatedPlaylist = await youtubeApiService.updatePlaylist(playlistId, updates);
      
      setPlaylists(playlists.map(p => p.id === playlistId ? updatedPlaylist : p));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(updatedPlaylist);
      }
      setEditingPlaylist(null);
    } catch (error) {
      console.error('Update playlist error:', error);
      setError('Failed to update playlist. Please try again.');
    }
  };

  const addVideoToPlaylist = async (video: YouTubeVideo, playlistId: string) => {
    try {
      await youtubeApiService.addVideoToPlaylist(playlistId, {
        videoId: video.id,
        title: video.title,
        channelTitle: video.channelTitle,
        duration: parseDuration(video.duration),
        thumbnailUrl: video.thumbnail
      });
      
      const updatedPlaylist = await youtubeApiService.getPlaylist(playlistId);
      setPlaylists(playlists.map(p => p.id === playlistId ? updatedPlaylist : p));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(updatedPlaylist);
      }
    } catch (error) {
      console.error('Add video to playlist error:', error);
      setError('Failed to add video to playlist. Please try again.');
    }
  };

  const removeVideoFromPlaylist = async (playlistId: string, itemId: string) => {
    try {
      await youtubeApiService.removeVideoFromPlaylist(playlistId, itemId);
      
      const updatedPlaylist = await youtubeApiService.getPlaylist(playlistId);
      setPlaylists(playlists.map(p => p.id === playlistId ? updatedPlaylist : p));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(updatedPlaylist);
      }
    } catch (error) {
      console.error('Remove video from playlist error:', error);
      setError('Failed to remove video from playlist. Please try again.');
    }
  };

  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const CreatePlaylistForm = () => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
      <h3 className="text-white font-medium mb-3">Create New Playlist</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          createPlaylist(
            formData.get('name') as string,
            formData.get('description') as string,
            formData.get('isPublic') === 'on'
          );
        }}
        className="space-y-3"
      >
        <input
          name="name"
          type="text"
          placeholder="Playlist name"
          required
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <textarea
          name="description"
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <label className="flex items-center text-white">
          <input
            name="isPublic"
            type="checkbox"
            className="mr-2"
          />
          Make playlist public
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  const PlaylistEditForm = ({ playlist }: { playlist: YouTubePlaylist }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
      <h3 className="text-white font-medium mb-3">Edit Playlist</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updatePlaylist(playlist.id, editForm);
        }}
        className="space-y-3"
      >
        <input
          value={editForm.name}
          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          type="text"
          placeholder="Playlist name"
          required
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <textarea
          value={editForm.description}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <label className="flex items-center text-white">
          <input
            type="checkbox"
            checked={editForm.isPublic}
            onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
            className="mr-2"
          />
          Make playlist public
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingPlaylist(null)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            <X className="w-4 h-4 inline mr-1" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">YouTube Playlists</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Playlist
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Create Playlist Form */}
      {showCreateForm && <CreatePlaylistForm />}

      {/* Playlist Edit Form */}
      {editingPlaylist && (
        <PlaylistEditForm playlist={playlists.find(p => p.id === editingPlaylist)!} />
      )}

      {/* Search Section */}
      {showSearch && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-white">Add Videos to Playlist</h3>
            <button
              onClick={() => setShowSearch(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <YouTubeSearch
            onAddToPlaylist={addVideoToPlaylist}
            availablePlaylists={selectedPlaylist ? [{ id: selectedPlaylist.id, name: selectedPlaylist.name }] : []}
            showAddButtons={true}
            className="mb-4"
          />
        </div>
      )}

      {/* Playlist List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : playlists.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No playlists found. Create your first playlist!</p>
          </div>
        ) : (
          playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{playlist.name}</h3>
                  <p className="text-gray-400 text-sm truncate">{playlist.description}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => {
                      setEditingPlaylist(playlist.id);
                      setEditForm({
                        name: playlist.name,
                        description: playlist.description,
                        isPublic: playlist.isPublic
                      });
                    }}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Edit playlist"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePlaylist(playlist.id)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{playlist.items.length} videos</span>
                <span className={playlist.isPublic ? 'text-green-400' : 'text-yellow-400'}>
                  {playlist.isPublic ? 'Public' : 'Private'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedPlaylist(playlist);
                    setShowSearch(true);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add Videos
                </button>
                <button
                  onClick={() => {
                    setSelectedPlaylist(playlist);
                    onPlaylistSelect?.(playlist);
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default YouTubePlaylistManager;