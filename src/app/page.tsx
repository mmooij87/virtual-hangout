'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();
      router.push(data.url);
    } catch (error) {
      console.error('Failed to create room:', error);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      // Support both full URLs and just the room ID
      let roomId = joinCode.trim();

      // Extract room ID from URL if provided
      if (roomId.includes('/room/')) {
        roomId = roomId.split('/room/').pop() || '';
      }

      if (roomId) {
        router.push(`/room/${roomId}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      {/* Main Content */}
      <main className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo/Title */}
        <div className="mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>

          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
            Virtual Hangout
          </h1>
          <p className="text-xl text-gray-400 max-w-md mx-auto">
            Watch videos together with friends. Synchronized playback, video chat, and shared queues.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Create Room Card */}
          <div className="glass-card p-8 text-left">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Create a Room</h2>
            <p className="text-gray-400 text-sm mb-6">
              Start a new hangout session and invite your friends with a shareable link.
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="btn btn-primary w-full"
            >
              {isCreating ? (
                <>
                  <div className="spinner w-5 h-5" />
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </button>
          </div>

          {/* Join Room Card */}
          <div className="glass-card p-8 text-left">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Join a Room</h2>
            <p className="text-gray-400 text-sm mb-4">
              Enter a room link or code to join an existing session.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="Paste room link..."
                className="glass-input flex-1 px-4 py-3 text-sm"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!joinCode.trim()}
                className="btn btn-secondary disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm">Synced Playback</h3>
            <p className="text-xs text-gray-500 mt-1">Play/pause syncs for everyone</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm">Video Chat</h3>
            <p className="text-xs text-gray-500 mt-1">See friends while watching</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <h3 className="font-medium text-sm">Shared Queue</h3>
            <p className="text-xs text-gray-500 mt-1">Everyone can add videos</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center text-gray-600 text-sm">
        Built with Next.js, Socket.io & YouTube API
      </footer>
    </div>
  );
}
