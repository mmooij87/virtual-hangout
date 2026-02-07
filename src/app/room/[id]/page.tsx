'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { RoomProvider, useRoom } from '@/context/RoomContext';
import { useSocket } from '@/hooks/useSocket';
import YouTubePlayer from '@/components/YouTubePlayer';
import VideoChat from '@/components/VideoChat';
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
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="glass border-b border-white/10 px-4 py-3 flex items-center justify-between">
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
                        <h1 className="font-semibold">Virtual Hangout</h1>
                        <p className="text-xs text-gray-400">
                            {state.participants.length} participant{state.participants.length !== 1 ? 's' : ''}
                            {' • '}
                            <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                                {isConnected ? 'Connected' : 'Connecting...'}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={copyRoomLink}
                        className="btn btn-secondary text-sm"
                    >
                        {showCopied ? (
                            <>
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Share
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
                {/* Left Section - Video Player & Queue */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* YouTube Player */}
                    <div className="flex-shrink-0">
                        <YouTubePlayer roomId={roomId} />
                    </div>

                    {/* Queue */}
                    <div className="flex-1 glass-card p-4 min-h-[200px] lg:min-h-0 overflow-hidden flex flex-col">
                        <Queue roomId={roomId} />
                    </div>
                </div>

                {/* Right Section - Video Chat */}
                <div className="lg:w-80 xl:w-96 flex-shrink-0">
                    <div className="glass-card p-4 h-full lg:h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
                        <VideoChat roomId={roomId} />
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
