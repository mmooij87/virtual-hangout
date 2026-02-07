'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { RoomProvider, useRoom } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';
import YouTubePlayer from '@/components/YouTubePlayer';
import VideoChat from '@/components/VideoChat';
import Chat from '@/components/Chat';
import Queue from '@/components/Queue';

function RoomContent() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.id as string;
    const { state, dispatch } = useRoom();
    const { isConnected, joinRoom } = useSocket(roomId);
    const [userName, setUserName] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const [showCopied, setShowCopied] = useState(false);

    // Set room ID in context
    useEffect(() => {
        if (roomId) {
            dispatch({ type: 'SET_ROOM_ID', payload: roomId });
        }
    }, [roomId, dispatch]);

    // Handle join
    const handleJoin = () => {
        if (!userName.trim()) return;

        const participant = {
            id: uuidv4(),
            name: userName.trim(),
            isHost: state.participants.length === 0,
            isMuted: false,
            isCameraOff: false,
        };

        joinRoom(participant);
        setHasJoined(true);
    };

    // Copy room link
    const copyRoomLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    // Join modal
    if (!hasJoined) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass-card p-8 w-full max-w-md animate-fade-in">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Join Hangout</h1>
                        <p className="text-gray-400 text-sm">Enter your name to join the session</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-300">
                                Your Name
                            </label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                placeholder="Enter your name..."
                                className="glass-input w-full px-4 py-3"
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={!userName.trim()}
                            className="btn btn-primary w-full disabled:opacity-50"
                        >
                            Join Room
                        </button>

                        <button
                            onClick={() => router.push('/')}
                            className="btn btn-secondary w-full"
                        >
                            ← Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background">
            {/* Header */}
            <header className="glass border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="font-semibold text-lg tracking-tight">Virtual Hangout</h1>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500'}`} />
                                {isConnected ? 'Connected' : 'Connecting...'}
                            </span>
                            <span>•</span>
                            <span>{state.participants.length} online</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={copyRoomLink}
                        className="btn btn-secondary text-sm py-2"
                    >
                        {showCopied ? (
                            <span className="flex items-center gap-2 text-green-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Share
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Main Content - 3 Column Layout */}
            <main className="flex-1 flex flex-col xl:flex-row gap-4 p-4 min-h-0 overflow-hidden">

                {/* Left Column - Queue & Search */}
                <div className="xl:w-80 flex-shrink-0 flex flex-col min-h-[400px] xl:min-h-0 glass-card rounded-xl overflow-hidden border border-white/5">
                    <div className="flex-1 flex flex-col overflow-hidden p-3">
                        <Queue roomId={roomId} />
                    </div>
                </div>

                {/* Center Column - Video Player */}
                <div className="flex-1 flex flex-col min-w-0 bg-black/40 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative">
                    <YouTubePlayer roomId={roomId} />
                </div>

                {/* Right Column - Chat & Video */}
                <div className="xl:w-80 flex-shrink-0 flex flex-col gap-4 min-h-[500px] xl:min-h-0">
                    {/* Video Chat (Top) */}
                    <div className="flex-shrink-0 glass-card rounded-xl overflow-hidden border border-white/5 p-3">
                        <VideoChat roomId={roomId} />
                    </div>

                    {/* Text Chat (Bottom - Fills remaining space) */}
                    <div className="flex-1 min-h-[300px] flex flex-col">
                        <Chat roomId={roomId} />
                    </div>
                </div>

            </main>
        </div>
    );
}

export default function RoomPage() {
    return (
        <RoomProvider>
            <RoomContent />
        </RoomProvider>
    );
}
