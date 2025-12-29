'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, Play, Plus, Clock, TrendingUp, Loader2, AlertCircle, X } from 'lucide-react';
import { musicService, YouTubeVideo } from '@/services/musicService';

interface SongSearchProps {
    barId: string;
    userToken: string;
    onSongAdded?: () => void;
}

// Session cache key
const CACHE_KEY_PREFIX = 'encore_search_cache_';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedSearch {
    query: string;
    results: YouTubeVideo[];
    timestamp: number;
}

export function SongSearchOptimized({ barId, userToken, onSongAdded }: SongSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<YouTubeVideo[]>([]);
    const [trending, setTrending] = useState<YouTubeVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingTrending, setLoadingTrending] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'search' | 'trending'>('search');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Refs for debouncing
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load trending and history on mount
    useEffect(() => {
        loadTrending();
        loadSearchHistory();

        // Focus search input on mount for better UX
        searchInputRef.current?.focus();
    }, []);

    /**
     * Load trending music
     */
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

    /**
     * Load search history from localStorage
     */
    const loadSearchHistory = () => {
        try {
            const history = localStorage.getItem('encore_search_history');
            if (history) {
                setSearchHistory(JSON.parse(history));
            }
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    };

    /**
     * Show toast notification
     */
    const showToast = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    /**
     * Save search query to history
     */
    const saveToSearchHistory = (searchQuery: string) => {
        try {
            const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
            setSearchHistory(newHistory);
            localStorage.setItem('encore_search_history', JSON.stringify(newHistory));
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    };

    /**
     * Get cached search results
     */
    const getCachedResults = (searchQuery: string): YouTubeVideo[] | null => {
        try {
            const cacheKey = CACHE_KEY_PREFIX + searchQuery.toLowerCase().trim();
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                const cachedData: CachedSearch = JSON.parse(cached);
                const now = Date.now();

                // Check if cache is still valid (< 1 hour old)
                if (now - cachedData.timestamp < CACHE_EXPIRY) {
                    console.log('✅ Cache HIT for query:', searchQuery);
                    return cachedData.results;
                } else {
                    // Remove expired cache
                    sessionStorage.removeItem(cacheKey);
                    console.log('⏰ Cache EXPIRED for query:', searchQuery);
                }
            }

            console.log('❌ Cache MISS for query:', searchQuery);
            return null;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    };

    /**
     * Cache search results
     */
    const cacheResults = (searchQuery: string, searchResults: YouTubeVideo[]) => {
        try {
            const cacheKey = CACHE_KEY_PREFIX + searchQuery.toLowerCase().trim();
            const cacheData: CachedSearch = {
                query: searchQuery,
                results: searchResults,
                timestamp: Date.now()
            };

            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log('💾 Cached results for query:', searchQuery);
        } catch (error) {
            console.error('Error caching results:', error);
        }
    };

    /**
     * Perform search (with cache check)
     */
    const performSearch = async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        setIsSearching(true);

        try {
            // Check cache first
            const cached = getCachedResults(searchQuery);
            if (cached) {
                setResults(cached);
                saveToSearchHistory(searchQuery);
                showToast('success', `Se encontraron ${cached.length} canciones (desde caché)`);
                setLoading(false);
                setIsSearching(false);
                return;
            }

            // Perform API search
            const response = await musicService.searchSongs(searchQuery, 20);

            if (response.success) {
                setResults(response.data.videos);
                saveToSearchHistory(searchQuery);
                cacheResults(searchQuery, response.data.videos);

                showToast('success', `Se encontraron ${response.data.videos.length} canciones`);
            }
        } catch (error) {
            console.error('Search error:', error);
            showToast('error', error instanceof Error ? error.message : "No se pudo completar la búsqueda");
            setResults([]);
        } finally {
            setLoading(false);
            setIsSearching(false);
        }
    };

    /**
     * Debounced search handler (300ms delay)
     */
    const handleSearchDebounced = useCallback((searchQuery: string) => {
        // Clear previous timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Show searching indicator immediately
        if (searchQuery.trim()) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
            setResults([]);
            return;
        }

        // Set new timer (300ms debounce)
        debounceTimerRef.current = setTimeout(() => {
            performSearch(searchQuery);
        }, 300);
    }, []);

    /**
     * Handle query change with debouncing
     */
    const handleQueryChange = (newQuery: string) => {
        setQuery(newQuery);
        handleSearchDebounced(newQuery);
    };

    /**
     * Handle immediate search (on button click or Enter)
     */
    const handleSearchImmediate = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        performSearch(query);
    };

    /**
     * Add song to queue
     */
    const handleAddToQueue = async (song: YouTubeVideo, priority: boolean = false) => {
        try {
            const result = await musicService.addToQueue(song, barId, userToken, priority);

            if (result.success) {
                showToast('success', `${song.title} ha sido añadida a la cola${priority ? ' con prioridad' : ''}`);

                if (onSongAdded) {
                    onSongAdded();
                }
            } else {
                throw new Error(result.message || 'No se pudo añadir la canción');
            }
        } catch (error) {
            console.error('Add to queue error:', error);
            showToast('error', error instanceof Error ? error.message : "No se pudo añadir a la cola");
        }
    };

    /**
     * Handle keyboard shortcuts
     */
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearchImmediate();
        } else if (e.key === 'Escape') {
            setQuery('');
            setResults([]);
            setIsSearching(false);
        }
    };

    /**
     * Clear search
     */
    const handleClearSearch = () => {
        setQuery('');
        setResults([]);
        setIsSearching(false);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        searchInputRef.current?.focus();
    };

    /**
     * Song Card Component
     */
    const SongCard = ({ song, showTrendingBadge = false }: { song: YouTubeVideo; showTrendingBadge?: boolean }) => (
        <div
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-200 mb-3"
            role="article"
            aria-label={`${song.title} por ${song.artist}`}
        >
            <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 group">
                    <img
                        src={musicService.getHighQualityThumbnail(song.thumbnail)}
                        alt={`Portada de ${song.title}`}
                        className="w-20 h-20 rounded-lg object-cover"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" aria-hidden="true" />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-1 mb-1">
                        {song.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                        {song.artist}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                            <Music className="w-3 h-3 mr-1" aria-hidden="true" />
                            YouTube
                        </span>
                        {showTrendingBadge && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                <TrendingUp className="w-3 h-3 mr-1" aria-hidden="true" />
                                Trending
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => handleAddToQueue(song)}
                        disabled={loading}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                        aria-label={`Añadir ${song.title} a la cola`}
                    >
                        <Plus className="w-4 h-4 inline mr-1" aria-hidden="true" />
                        Añadir
                    </button>
                    <button
                        onClick={() => handleAddToQueue(song, true)}
                        disabled={loading}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                        aria-label={`Añadir ${song.title} con prioridad`}
                    >
                        <Clock className="w-4 h-4 inline mr-1" aria-hidden="true" />
                        Prioridad
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            {/* Toast Message */}
            {message && (
                <div
                    className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}
                    role="alert"
                    aria-live="polite"
                >
                    {message.text}
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                    <Music className="w-8 h-8 text-blue-600" aria-hidden="true" />
                    Buscar Música
                </h1>
                <p className="text-gray-600">
                    Busca tus canciones favoritas en YouTube y añádelas a la cola
                </p>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar canciones, artistas o álbumes..."
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Campo de búsqueda de música"
                            aria-describedby="search-hint"
                        />
                        {query && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                        {isSearching && !loading && (
                            <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleSearchImmediate}
                        disabled={loading || !query.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        aria-label="Buscar ahora"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                <span className="sr-only">Buscando...</span>
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4" aria-hidden="true" />
                                <span>Buscar</span>
                            </>
                        )}
                    </button>
                </div>

                <p id="search-hint" className="text-xs text-gray-500 mt-1">
                    Escribe para buscar automáticamente o presiona Enter
                </p>

                {/* Search History */}
                {searchHistory.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap" role="group" aria-label="Búsquedas recientes">
                        <span className="text-sm text-gray-600">Búsquedas recientes:</span>
                        {searchHistory.map((term, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setQuery(term);
                                    performSearch(term);
                                }}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                aria-label={`Buscar ${term}`}
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4" role="tablist" aria-label="Pestañas de contenido">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('search')}
                        role="tab"
                        aria-selected={activeTab === 'search'}
                        aria-controls="search-panel"
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'search'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Resultados de búsqueda {results.length > 0 && `(${results.length})`}
                    </button>
                    <button
                        onClick={() => setActiveTab('trending')}
                        role="tab"
                        aria-selected={activeTab === 'trending'}
                        aria-controls="trending-panel"
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'trending'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Tendencias {trending.length > 0 && `(${trending.length})`}
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto" role="region" aria-live="polite">
                {activeTab === 'search' && (
                    <div id="search-panel" role="tabpanel" aria-labelledby="search-tab">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin mr-2 text-blue-600" aria-hidden="true" />
                                <span>Buscando canciones...</span>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-3">
                                {results.map((song) => (
                                    <SongCard key={song.id} song={song} />
                                ))}
                            </div>
                        ) : query ? (
                            <div className="text-center py-12">
                                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                                <h3 className="text-lg font-semibold mb-2">No se encontraron resultados</h3>
                                <p className="text-gray-600">
                                    Intenta con diferentes palabras clave o revisa la ortografía
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                                <h3 className="text-lg font-semibold mb-2">Comienza una búsqueda</h3>
                                <p className="text-gray-600">
                                    Escribe el nombre de una canción, artista o álbum para buscar
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'trending' && (
                    <div id="trending-panel" role="tabpanel" aria-labelledby="trending-tab">
                        {loadingTrending ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin mr-2 text-blue-600" aria-hidden="true" />
                                <span>Cargando tendencias...</span>
                            </div>
                        ) : trending.length > 0 ? (
                            <div className="space-y-3">
                                {trending.map((song) => (
                                    <SongCard key={song.id} song={song} showTrendingBadge />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                                <h3 className="text-lg font-semibold mb-2">No hay tendencias disponibles</h3>
                                <p className="text-gray-600">
                                    Intenta más tarde o realiza una búsqueda manual
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SongSearchOptimized;
