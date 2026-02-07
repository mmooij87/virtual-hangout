'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';
import {
    YT_PLAYER_STATE,
    YT_ERROR_CODES,
    getYouTubeErrorMessage,
    formatDuration
} from '@/utils/youtube';

// YouTube IFrame API types
declare global {
    interface Window {
        YT: {
            Player: new (
                element: string | HTMLElement,
                options: {
                    videoId?: string;
                    playerVars?: Record<string, number | string>;
                    events?: {
                        onReady?: (event: { target: YTPlayer }) => void;
                        onStateChange?: (event: { target: YTPlayer; data: number }) => void;
                        onError?: (event: { target: YTPlayer; data: number }) => void;
                    };
                }
            ) => YTPlayer;
            PlayerState: typeof YT_PLAYER_STATE;
        };
        onYouTubeIframeAPIReady: () => void;
    }
}

interface YTPlayer {
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getPlayerState: () => number;
    loadVideoById: (videoId: string) => void;
    destroy: () => void;
}

interface YouTubePlayerProps {
    roomId: string;
}

export default function YouTubePlayer({ roomId }: YouTubePlayerProps) {
    const { state, dispatch, currentVideo, nextVideo } = useRoom();
    const { sendPlayerAction, onPlayerSync } = useSocket(roomId);
    const playerRef = useRef<YTPlayer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const isLocalActionRef = useRef(false);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load YouTube IFrame API
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (window.YT) {
            initPlayer();
            return;
        }

        // Load API script
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            initPlayer();
        };

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
        };
    }, []);

    // Initialize player
    const initPlayer = useCallback(() => {
        if (!containerRef.current || playerRef.current) return;

        console.log('Initializing player with video:', currentVideo?.videoId);

        playerRef.current = new window.YT.Player('youtube-player', {
            videoId: currentVideo?.videoId || '',
            playerVars: {
                autoplay: 0,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                fs: 1,
                playsinline: 1,
                enablejsapi: 1,
                origin: typeof window !== 'undefined' ? window.location.origin : '',
            },
            events: {
                onReady: handleReady,
                onStateChange: handleStateChange,
                onError: handleError,
            },
        });
    }, [currentVideo?.videoId]);

    // Handle player ready
    const handleReady = useCallback((event: { target: YTPlayer }) => {
        setIsReady(true);
        setDuration(event.target.getDuration());
    }, []);

    // Handle player state changes
    const handleStateChange = useCallback((event: { target: YTPlayer; data: number }) => {
        const player = event.target;
        const playerState = event.data;

        // Update duration when video loads
        if (playerState === YT_PLAYER_STATE.PLAYING || playerState === YT_PLAYER_STATE.PAUSED) {
            setDuration(player.getDuration());
        }

        // Handle video ended
        if (playerState === YT_PLAYER_STATE.ENDED) {
            dispatch({ type: 'SET_PLAYER_STATE', payload: 'ended' });
            // Auto-play next video
            nextVideo();
            return;
        }

        // Skip if this is a response to a remote sync
        if (!isLocalActionRef.current) {
            return;
        }
        isLocalActionRef.current = false;

        // Broadcast state changes to other participants
        const currentTime = player.getCurrentTime();

        if (playerState === YT_PLAYER_STATE.PLAYING) {
            dispatch({ type: 'SET_PLAYER_STATE', payload: 'playing' });
            sendPlayerAction('play', currentTime);
        } else if (playerState === YT_PLAYER_STATE.PAUSED) {
            dispatch({ type: 'SET_PLAYER_STATE', payload: 'paused' });
            sendPlayerAction('pause', currentTime);
        } else if (playerState === YT_PLAYER_STATE.BUFFERING) {
            dispatch({ type: 'SET_PLAYER_STATE', payload: 'buffering' });
        }
    }, [dispatch, nextVideo, sendPlayerAction]);

    // Handle player errors
    const handleError = useCallback((event: { data: number }) => {
        const errorMessage = getYouTubeErrorMessage(event.data);
        setError(`${errorMessage} (ID: ${currentVideo?.videoId})`);
        console.error('YouTube Player Error:', event.data, currentVideo?.videoId);

        // If video is not embeddable, skip to next
        if (event.data === YT_ERROR_CODES.NOT_EMBEDDABLE ||
            event.data === YT_ERROR_CODES.NOT_EMBEDDABLE_2 ||
            event.data === YT_ERROR_CODES.NOT_FOUND ||
            event.data === YT_ERROR_CODES.INVALID_PARAM) {
            setTimeout(() => {
                nextVideo();
                setError(null);
            }, 3000);
        }
    }, [nextVideo, currentVideo?.videoId]);

    // Load new video when currentVideo changes
    useEffect(() => {
        if (playerRef.current && currentVideo?.videoId && isReady) {
            console.log('Loading video:', currentVideo.videoId);
            playerRef.current.loadVideoById(currentVideo.videoId);
            setError(null);
        }
    }, [currentVideo?.videoId, isReady]);

    // Subscribe to player sync events from other participants
    useEffect(() => {
        const unsubscribe = onPlayerSync((data) => {
            const player = playerRef.current;
            if (!player || !isReady) return;

            // Calculate latency compensation
            const latency = (Date.now() - data.serverTime) / 1000;
            const targetTime = data.videoTime + latency;

            // Only seek if difference is significant (> 1 second)
            const currentPlayerTime = player.getCurrentTime();
            if (data.action === 'seek' || Math.abs(currentPlayerTime - targetTime) > 1) {
                player.seekTo(targetTime, true);
            }

            // Apply play/pause action
            if (data.action === 'play') {
                player.playVideo();
                dispatch({ type: 'SET_PLAYER_STATE', payload: 'playing' });
            } else if (data.action === 'pause') {
                player.pauseVideo();
                dispatch({ type: 'SET_PLAYER_STATE', payload: 'paused' });
            }
        });

        return unsubscribe;
    }, [onPlayerSync, isReady, dispatch]);

    // Update current time periodically
    useEffect(() => {
        if (!isReady || !playerRef.current) return;

        const interval = setInterval(() => {
            if (playerRef.current) {
                const time = playerRef.current.getCurrentTime();
                setCurrentTime(time);
                dispatch({ type: 'SET_CURRENT_TIME', payload: time });
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isReady, dispatch]);

    // Local control handlers
    const handlePlay = () => {
        isLocalActionRef.current = true;
        playerRef.current?.playVideo();
    };

    const handlePause = () => {
        isLocalActionRef.current = true;
        playerRef.current?.pauseVideo();
    };

    const handleSeek = (time: number) => {
        if (playerRef.current) {
            isLocalActionRef.current = true;
            playerRef.current.seekTo(time, true);
            sendPlayerAction('seek', time);
        }
    };

    const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);

        // Debounce seek
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        setCurrentTime(time);

        syncTimeoutRef.current = setTimeout(() => {
            handleSeek(time);
        }, 100);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Video Container */}
            <div className="video-container glass-card overflow-hidden" ref={containerRef}>
                <div id="youtube-player" />

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="text-center p-6 max-w-md">
                            <div className="text-red-400 mb-2">
                                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-red-300 font-medium">{error}</p>
                            <p className="text-gray-400 text-sm mt-2">Skipping to next video...</p>
                        </div>
                    </div>
                )}

                {/* Loading Overlay */}
                {!isReady && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="spinner" />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="glass p-4 flex flex-col gap-3">
                {/* Now Playing */}
                {currentVideo && (
                    <div className="flex items-center gap-3">
                        <div className="flex-1 truncate">
                            <p className="text-sm text-gray-400">Now Playing</p>
                            <p className="font-medium truncate">{currentVideo.title}</p>
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-12 text-right">
                        {formatDuration(currentTime)}
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeekInput}
                        className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-sm text-gray-400 w-12">
                        {formatDuration(duration)}
                    </span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={handlePause}
                        className="btn btn-secondary btn-icon"
                        title="Pause"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                    </button>

                    <button
                        onClick={handlePlay}
                        className="btn btn-primary btn-icon w-14 h-14"
                        title="Play"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => nextVideo()}
                        className="btn btn-secondary btn-icon"
                        title="Next"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
