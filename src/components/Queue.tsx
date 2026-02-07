'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoom } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';
import { extractVideoId, getVideoInfo, getThumbnailUrl } from '@/utils/youtube';
import { v4 as uuidv4 } from 'uuid';

interface SearchResult {
    videoId: string;
    title: string;
    author: string;
    duration: string;
    thumbnail: string;
    viewCount: string;
}

interface QueueProps {
    roomId: string;
}

export default function Queue({ roomId }: QueueProps) {
    const { state, dispatch } = useRoom();
    const { addToQueue, removeFromQueue, changeVideo } = useSocket(roomId);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Search for videos
    const searchVideos = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        // Check if it's a URL first
        const videoId = extractVideoId(query);
        if (videoId) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.error && data.videos.length === 0) {
                setError(data.error);
            }

            setSearchResults(data.videos || []);
            setShowResults(true);
        } catch (err) {
            setError('Search failed. Try pasting a URL.');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (inputValue.trim().length >= 2 && !extractVideoId(inputValue)) {
            searchTimeoutRef.current = setTimeout(() => {
                searchVideos(inputValue);
            }, 500);
        } else {
            setSearchResults([]);
            setShowResults(false);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [inputValue, searchVideos]);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Add video from search result
    const handleAddFromSearch = async (result: SearchResult) => {
        setIsLoading(true);
        setShowResults(false);
        setInputValue('');

        try {
            const queueItem = {
                id: uuidv4(),
                videoId: result.videoId,
                title: result.title,
                thumbnail: result.thumbnail,
                addedBy: state.localParticipant?.name || 'You',
                duration: result.duration,
            };

            dispatch({ type: 'ADD_TO_QUEUE', payload: queueItem });
            addToQueue(queueItem);
        } catch (err) {
            setError('Failed to add video');
        } finally {
            setIsLoading(false);
        }
    };

    // Add video from URL
    const handleAddFromUrl = async () => {
        if (!inputValue.trim()) return;

        const videoId = extractVideoId(inputValue);
        if (!videoId) {
            // Not a URL, might be a search - show error
            setError('Voer een geldige YouTube URL in of zoek naar een video');
            return;
        }

        setIsLoading(true);
        setError(null);
        setShowResults(false);

        try {
            const info = await getVideoInfo(videoId);
            if (!info) {
                setError('Video niet gevonden');
                setIsLoading(false);
                return;
            }

            const queueItem = {
                id: uuidv4(),
                videoId: info.videoId,
                title: info.title,
                thumbnail: info.thumbnail,
                addedBy: state.localParticipant?.name || 'You',
            };

            dispatch({ type: 'ADD_TO_QUEUE', payload: queueItem });
            addToQueue(queueItem);
            setInputValue('');
        } catch (err) {
            setError('Kon video niet toevoegen');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = (itemId: string) => {
        dispatch({ type: 'REMOVE_FROM_QUEUE', payload: itemId });
        removeFromQueue(itemId);
    };

    const handleSelectVideo = (index: number) => {
        dispatch({ type: 'SET_CURRENT_VIDEO_INDEX', payload: index });
        changeVideo(index);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (searchResults.length > 0 && showResults) {
                handleAddFromSearch(searchResults[0]);
            } else {
                handleAddFromUrl();
            }
        }
        if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Wachtrij
                    <span className="text-sm font-normal text-gray-400">
                        ({state.queue.length})
                    </span>
                </h2>
            </div>

            {/* Search Input */}
            <div className="relative mb-4" ref={containerRef}>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => searchResults.length > 0 && setShowResults(true)}
                            placeholder="Zoek video's of plak URL..."
                            className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                            disabled={isLoading}
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="spinner w-4 h-4" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleAddFromUrl}
                        disabled={isLoading || !inputValue.trim()}
                        className="btn btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="spinner w-5 h-5" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 glass-card border border-white/10 max-h-80 overflow-y-auto">
                        {searchResults.map((result) => (
                            <button
                                key={result.videoId}
                                onClick={() => handleAddFromSearch(result)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                            >
                                <img
                                    src={result.thumbnail}
                                    alt={result.title}
                                    className="w-24 h-14 rounded object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium line-clamp-2">{result.title}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {result.author} • {result.duration} • {result.viewCount}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {state.queue.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p>Wachtrij is leeg</p>
                        <p className="text-sm mt-1">Zoek een video of plak een URL</p>
                    </div>
                ) : (
                    state.queue.map((item, index) => {
                        const isActive = index === state.currentVideoIndex;

                        return (
                            <div
                                key={item.id}
                                className={`queue-item ${isActive ? 'active' : ''} cursor-default`}
                            >
                                {/* Position Number */}
                                <span className="w-6 text-center text-sm text-gray-500 flex-shrink-0">
                                    {isActive ? (
                                        <span className="text-indigo-400">▶</span>
                                    ) : (
                                        index + 1
                                    )}
                                </span>

                                {/* Thumbnail */}
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={item.thumbnail}
                                        alt={item.title}
                                        className="queue-thumbnail"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = getThumbnailUrl(item.videoId, 'default');
                                        }}
                                    />
                                    {item.duration && (
                                        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[10px]">
                                            {item.duration}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                    <p className="text-xs text-gray-500">Toegevoegd door {item.addedBy}</p>
                                </div>

                                {/* Remove Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(item.id);
                                    }}
                                    className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
