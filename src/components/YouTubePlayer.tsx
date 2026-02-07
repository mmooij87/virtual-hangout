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
    const { sendPlayerAction, onPlayerSync, voteNext } = useSocket(roomId);
    const playerRef = useRef<YTPlayer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const isLocalActionRef = useRef(false);

    // Calculate if local user has voted
    const hasVoted = state.localParticipant ? state.votes.includes(state.localParticipant.id) : false;

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
                controls: 0, // Disable controls
                disablekb: 1, // Disable keyboard controls
                modestbranding: 1,
                rel: 0,
                fs: 0, // Disable fullscreen button (since we have custom overlay)
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

        // Handle video ended - REMOVED auto-advance
        if (playerState === YT_PLAYER_STATE.ENDED) {
            dispatch({ type: 'SET_PLAYER_STATE', payload: 'ended' });
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
    }, [dispatch, sendPlayerAction]); // Removed nextVideo from dependencies

    // Handle player errors
    const handleError = useCallback((event: { data: number }) => {
        const errorMessage = getYouTubeErrorMessage(event.data);
        setError(`${errorMessage} (ID: ${currentVideo?.videoId})`);
        console.error('YouTube Player Error:', event.data, currentVideo?.videoId);

        // If video is not embeddable, we might want to auto-skip still?
        // Or wait for votes? Let's auto-skip on error because it's broken.
        if (event.data === YT_ERROR_CODES.NOT_EMBEDDABLE ||
            event.data === YT_ERROR_CODES.NOT_EMBEDDABLE_2 ||
            event.data === YT_ERROR_CODES.NOT_FOUND ||
            event.data === YT_ERROR_CODES.INVALID_PARAM) {
            setTimeout(() => {
                nextVideo(); // Keep auto-skip for broken videos
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

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Video Container */}
            <div className="video-container glass-card overflow-hidden relative flex-1" ref={containerRef}>
                <div id="youtube-player" className="absolute inset-0 w-full h-full" />

                {/* Event overlay to block clicks on iframe if needed, 
                    but we want standard youtube interactions? 
                    User said "Remove playback controls". 
                    If we disable controls in playerVars, user can still click to play/pause in center.
                    To strictly enforce "no user control", we need a transparent overlay. */}
                <div className="absolute inset-0 z-0" />

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                        <div className="spinner" />
                    </div>
                )}

                {/* Consensus Controls Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/60 to-transparent flex flex-col items-center justify-end z-10">

                    {/* Info */}
                    <div className="w-full mb-4 flex justify-between items-end text-sm">
                        <div className="text-white/80 font-medium truncate max-w-[70%]">
                            {currentVideo?.title}
                        </div>
                        <div className="text-white/60 font-mono">
                            {formatDuration(currentTime)} / {formatDuration(duration)}
                        </div>
                    </div>

                    {/* Progress Bar (Visual only) */}
                    <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mb-6">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
                            style={{
                                width: `${(currentTime / (duration || 100)) * 100}%`
                            }}
                        />
                    </div>

                    {/* Voting Section */}
                    <div className="flex items-center gap-4">
                        {state.currentVideoIndex < state.queue.length - 1 ? (
                            <button
                                onClick={() => {
                                    if (!hasVoted) voteNext();
                                }}
                                disabled={hasVoted}
                                className={`
                                    px-8 py-3 rounded-full font-bold transition-all transform 
                                    flex items-center gap-3 shadow-xl backdrop-blur-md border border-white/10
                                    ${hasVoted
                                        ? 'bg-green-500 text-white cursor-default scale-100'
                                        : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white'}
                                `}
                            >
                                {hasVoted ? (
                                    <>
                                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Waiting for others...</span>
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-sm ml-1">
                                            {state.votes.length}/{state.participants.length}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Vote to Play Next ({state.votes.length}/{state.participants.length})</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="text-gray-400 text-sm font-medium bg-black/60 px-6 py-3 rounded-full backdrop-blur-md border border-white/5">
                                End of queue
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
